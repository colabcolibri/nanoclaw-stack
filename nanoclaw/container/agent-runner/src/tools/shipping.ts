import type { AgentTool } from './types.js';

interface ShippingOption {
  service: string;
  name: string;
  originalPrice: number;
  estimatedPrice: number;
  originalDeliveryDays: number;
  estimatedDeliveryDays: number;
  formattedText: string;
}

/**
 * Official Correios baseline matrix by destination region (from SP/Sudeste origin).
 */
const REGION_RATES: Record<string, { pacBase: number; sedexBase: number; pacDays: number; sedexDays: number; regionName: string }> = {
  // Mesma localidade / Capital
  SP_CAPITAL: { pacBase: 16.50, sedexBase: 21.90, pacDays: 3, sedexDays: 1, regionName: 'São Paulo (Capital)' },
  SP_INTERIOR: { pacBase: 22.90, sedexBase: 32.50, pacDays: 5, sedexDays: 2, regionName: 'São Paulo (Interior/Litoral)' },
  
  // Região Sudeste & Sul
  RJ: { pacBase: 26.80, sedexBase: 46.50, pacDays: 5, sedexDays: 2, regionName: 'Rio de Janeiro' },
  MG: { pacBase: 27.50, sedexBase: 48.20, pacDays: 5, sedexDays: 2, regionName: 'Minas Gerais' },
  ES: { pacBase: 29.90, sedexBase: 52.80, pacDays: 6, sedexDays: 3, regionName: 'Espírito Santo' },
  PR: { pacBase: 28.40, sedexBase: 49.60, pacDays: 5, sedexDays: 2, regionName: 'Paraná' },
  SC: { pacBase: 29.50, sedexBase: 51.90, pacDays: 6, sedexDays: 3, regionName: 'Santa Catarina' },
  RS: { pacBase: 32.90, sedexBase: 58.40, pacDays: 6, sedexDays: 3, regionName: 'Rio Grande do Sul' },

  // Centro-Oeste
  DF: { pacBase: 31.80, sedexBase: 56.70, pacDays: 6, sedexDays: 2, regionName: 'Distrito Federal' },
  GO: { pacBase: 33.50, sedexBase: 59.80, pacDays: 6, sedexDays: 3, regionName: 'Goiás' },
  MT: { pacBase: 38.90, sedexBase: 69.50, pacDays: 8, sedexDays: 3, regionName: 'Mato Grosso' },
  MS: { pacBase: 36.40, sedexBase: 64.90, pacDays: 7, sedexDays: 3, regionName: 'Mato Grosso do Sul' },

  // Nordeste
  BA: { pacBase: 35.80, sedexBase: 63.90, pacDays: 7, sedexDays: 3, regionName: 'Bahia' },
  PE: { pacBase: 39.50, sedexBase: 71.80, pacDays: 8, sedexDays: 3, regionName: 'Pernambuco' },
  CE: { pacBase: 41.20, sedexBase: 74.50, pacDays: 8, sedexDays: 3, regionName: 'Ceará' },
  PB: { pacBase: 40.80, sedexBase: 73.20, pacDays: 8, sedexDays: 3, regionName: 'Paraíba' },
  RN: { pacBase: 41.90, sedexBase: 75.60, pacDays: 8, sedexDays: 3, regionName: 'Rio Grande do Norte' },
  AL: { pacBase: 39.90, sedexBase: 72.10, pacDays: 8, sedexDays: 3, regionName: 'Alagoas' },
  SE: { pacBase: 38.60, sedexBase: 69.80, pacDays: 8, sedexDays: 3, regionName: 'Sergipe' },
  PI: { pacBase: 42.50, sedexBase: 76.80, pacDays: 9, sedexDays: 4, regionName: 'Piauí' },
  MA: { pacBase: 43.80, sedexBase: 79.50, pacDays: 9, sedexDays: 4, regionName: 'Maranhão' },

  // Norte
  AM: { pacBase: 52.80, sedexBase: 96.50, pacDays: 12, sedexDays: 4, regionName: 'Amazonas' },
  PA: { pacBase: 48.90, sedexBase: 88.40, pacDays: 10, sedexDays: 4, regionName: 'Pará' },
  RO: { pacBase: 47.50, sedexBase: 86.20, pacDays: 10, sedexDays: 4, regionName: 'Rondônia' },
  TO: { pacBase: 41.50, sedexBase: 74.90, pacDays: 8, sedexDays: 3, regionName: 'Tocantins' },
  AC: { pacBase: 56.40, sedexBase: 104.20, pacDays: 14, sedexDays: 5, regionName: 'Acre' },
  RR: { pacBase: 58.90, sedexBase: 108.70, pacDays: 14, sedexDays: 5, regionName: 'Roraima' },
  AP: { pacBase: 54.20, sedexBase: 99.80, pacDays: 13, sedexDays: 4, regionName: 'Amapá' },
};

export const correiosShippingTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'correios_shipping',
      description:
        'Calcula estimativas oficiais de frete dos Correios (PAC e SEDEX) para qualquer CEP do Brasil. Aplica automaticamente a margem de segurança operacional da Colibri (+30% no valor e +3 dias úteis no prazo de entrega).',
      parameters: {
        type: 'object',
        properties: {
          destination_cep: {
            type: 'string',
            description: 'CEP de destino do comprador (ex: "01310-100" ou "01310100").',
          },
          origin_cep: {
            type: 'string',
            description: 'CEP de origem de despacho da loja (padrão: "01310-100").',
          },
          weight_kg: {
            type: 'number',
            description: 'Peso total estimado da encomenda em kg (ex: 0.5, 1.2, 3.5). Padrão: 1.0 kg.',
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nameOrSku: { type: 'string', description: 'Nome ou SKU do item' },
                quantity: { type: 'number', description: 'Quantidade' },
              },
            },
            description: 'Lista de produtos para cálculo automático do peso da caixa.',
          },
        },
        required: ['destination_cep'],
      },
    },
  },
  execute: async (args: any, _cwd: string) => {
    const rawCep = String(args.destination_cep || '').replace(/\D/g, '');
    if (rawCep.length !== 8) {
      return JSON.stringify({
        status: 'error',
        error: `CEP inválido: "${args.destination_cep}". Informe um CEP válido com 8 dígitos.`,
      });
    }

    const formattedCep = `${rawCep.slice(0, 5)}-${rawCep.slice(5)}`;
    let locationData: { city?: string; state?: string; neighborhood?: string; street?: string } = {};

    // 1. Resolve address via BrasilAPI or ViaCEP
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${rawCep}`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        locationData = await res.json();
      }
    } catch {
      try {
        const res2 = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`, { signal: AbortSignal.timeout(3000) });
        if (res2.ok) {
          const v = (await res2.json()) as any;
          locationData = { city: v.localidade, state: v.uf, neighborhood: v.bairro, street: v.logradouro };
        }
      } catch {}
    }

    const state = (locationData.state || 'SP').toUpperCase();
    const isSpCapital = state === 'SP' && rawCep.startsWith('01') || rawCep.startsWith('02') || rawCep.startsWith('03') || rawCep.startsWith('04') || rawCep.startsWith('05') || rawCep.startsWith('08');
    
    const rateKey = state === 'SP' ? (isSpCapital ? 'SP_CAPITAL' : 'SP_INTERIOR') : (REGION_RATES[state] ? state : 'MG');
    const baseRate = REGION_RATES[rateKey] || REGION_RATES.SP_INTERIOR;

    // Weight computation: 0.38kg per game, 0.25kg per book, or explicit weight
    let weightKg = Number(args.weight_kg) || 0;
    if (!weightKg && Array.isArray(args.items) && args.items.length > 0) {
      weightKg = args.items.reduce((acc: number, item: any) => {
        const name = (item.nameOrSku || '').toLowerCase();
        const qty = Number(item.quantity) || 1;
        const itemWeight = name.includes('grok') ? 0.38 : 0.25;
        return acc + itemWeight * qty;
      }, 0.2); // 200g box packaging baseline
    }
    if (weightKg <= 0) weightKg = 1.0;
    weightKg = Math.max(0.3, Math.round(weightKg * 10) / 10);

    // Weight scaling factor for packages over 1kg
    const weightFactor = weightKg > 1 ? 1 + (weightKg - 1) * 0.25 : 1;

    // Base rates
    const rawPac = Math.round(baseRate.pacBase * weightFactor * 100) / 100;
    const rawSedex = Math.round(baseRate.sedexBase * weightFactor * 100) / 100;

    // Business Rules: +30% price markup & +3 business days buffer
    const estimatedPacPrice = Math.round(rawPac * 1.30 * 100) / 100;
    const estimatedSedexPrice = Math.round(rawSedex * 1.30 * 100) / 100;

    const estimatedPacDays = baseRate.pacDays + 3;
    const estimatedSedexDays = baseRate.sedexDays + 3;

    const locationStr = [locationData.neighborhood, locationData.city, locationData.state].filter(Boolean).join(' - ') || state;

    const options: ShippingOption[] = [
      {
        service: 'PAC',
        name: 'PAC (Correios)',
        originalPrice: rawPac,
        estimatedPrice: estimatedPacPrice,
        originalDeliveryDays: baseRate.pacDays,
        estimatedDeliveryDays: estimatedPacDays,
        formattedText: `• **PAC Estimado:** R$ ${estimatedPacPrice.toFixed(2).replace('.', ',')} (Prazo estimado: ${estimatedPacDays} a ${estimatedPacDays + 2} dias úteis)`,
      },
      {
        service: 'SEDEX',
        name: 'SEDEX (Correios Expresso)',
        originalPrice: rawSedex,
        estimatedPrice: estimatedSedexPrice,
        originalDeliveryDays: baseRate.sedexDays,
        estimatedDeliveryDays: estimatedSedexDays,
        formattedText: `• **SEDEX Estimado:** R$ ${estimatedSedexPrice.toFixed(2).replace('.', ',')} (Prazo estimado: ${estimatedSedexDays} a ${estimatedSedexDays + 1} dias úteis)`,
      },
    ];

    const markdownSummary = `### 🚚 Estimativa de Frete — Correios (Destino: ${formattedCep} · ${locationStr})\n` +
      `*Peso Total Estimado:* **${weightKg.toFixed(1).replace('.', ',')} kg**\n\n` +
      options.map((o) => o.formattedText).join('\n') +
      `\n\n*(Valores e prazos incluem margem de manuseio e tempo de separação).*`;

    return JSON.stringify({
      status: 'ok',
      destination_cep: formattedCep,
      location: locationStr,
      city: locationData.city || null,
      state: locationData.state || state,
      weight_kg: weightKg,
      options,
      markdown: markdownSummary,
    });
  },
};
