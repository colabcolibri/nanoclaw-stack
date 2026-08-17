import fs from 'fs';
import path from 'path';

export interface QuoteItemInput {
  nameOrSku: string;
  quantity: number;
}

export interface BuyerInfo {
  name: string;
  document?: string; // CPF ou CNPJ
  stateRegistration?: string; // Inscrição Estadual
  email?: string;
  phone?: string;
  address?: string;
  cityState?: string;
  cep?: string;
}

export interface ProductPriceRow {
  sku: string;
  product: string;
  description: string;
  coverPrice: number;
  tier1to10: number;
  tier11to20: number;
  tier21to40: number;
  tier41plus: number;
}

export interface QuoteCalculationResult {
  buyer: BuyerInfo;
  isConsignment: boolean;
  items: Array<{
    sku: string;
    product: string;
    quantity: number;
    coverPrice: number;
    unitPrice: number;
    discountPercent: number;
    subtotal: number;
  }>;
  totalQuantity: number;
  totalCoverValue: number;
  totalQuoteValue: number;
  totalSavings: number;
  formattedProposalMarkdown: string;
}

/**
 * Dynamically finds and loads the resale prices CSV from the skill references folder.
 */
export function loadProductsFromCsv(customCsvPath?: string): ProductPriceRow[] {
  const possiblePaths = [
    customCsvPath,
    path.join(import.meta.dir, '..', 'references', 'tabela_precos_revenda.csv'),
    '/app/skills/store-email-attendant/references/tabela_precos_revenda.csv',
    '/workspace/skills/store-email-attendant/references/tabela_precos_revenda.csv',
    '/workspace/agent/skills/store-email-attendant/references/tabela_precos_revenda.csv',
    '/opt/nanoclaw-stack/nanoclaw/container/skills/store-email-attendant/references/tabela_precos_revenda.csv',
    path.join(process.cwd(), 'skills', 'store-email-attendant', 'references', 'tabela_precos_revenda.csv'),
  ].filter(Boolean) as string[];

  let csvContent = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        csvContent = fs.readFileSync(p, 'utf-8');
        if (csvContent.trim()) break;
      } catch {}
    }
  }

  if (!csvContent) {
    // Embedded resilient fallback in case container mount has unexpected paths
    csvContent = `sku,product,description,cover_price,tier_1_10,tier_11_20,tier_21_40,tier_41_plus
GROK-GAME,"Jogo Grok","O GROK é um jogo de cartas de sentimentos e necessidades baseado na CNV.",160.00,112.00,105.60,102.40,99.20
BOOK-CNV-WORK,"Comunicação Não Violenta no trabalho","Livro complementar CNV.",63.00,35.28,34.02,32.76,31.50
BOOK-CNV-TEAM,"Comunicação Não Violenta na equipe","Livro CNV na equipe.",53.00,29.68,28.62,27.56,26.50
BOOK-CNV-ILUST1,"CNV Ilustrada V1 – mudando a chave da desconexão à conexão","CNV Ilustrada.",44.00,24.64,23.76,22.88,22.00
BOOK-GIRAFA,"A linguagem da girafa","Livro de Jean Morrison.",44.00,24.64,23.76,22.88,22.00
BOOK-CORAZAO,"a corazão","Livro a corazão.",53.00,29.68,28.62,27.56,26.50
BOOK-LIBERDADE,"Liberdade sem distância, conexão sem controle","Livro relacionamentos.",44.00,24.64,23.76,22.88,22.00
BOOK-SAUDADE,"Saudade Sabor Chocolate","Livro Saudade.",44.00,24.64,23.76,22.88,22.00`;
  }

  // Parse CSV rows safely handling quotes
  const rows: ProductPriceRow[] = [];
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // Skip header line if present
  const dataLines = lines[0].toLowerCase().includes('sku') ? lines.slice(1) : lines;

  for (const line of dataLines) {
    // Regex to parse comma-separated values respecting double-quotes
    const match = line.match(/(?:^|,)(?:"([^"]*)"|([^",]*))/g);
    if (!match || match.length < 8) continue;

    const fields = match.map((val) => {
      let v = val.replace(/^,/, '').trim();
      if (v.startsWith('"') && v.endsWith('"')) {
        v = v.slice(1, -1).trim();
      }
      return v;
    });

    const sku = fields[0];
    const product = fields[1];
    const description = fields[2];
    const coverPrice = parseFloat(fields[3].replace(/[R$\s]/g, '').replace(',', '.')) || 0;
    const tier1to10 = parseFloat(fields[4].replace(/[R$\s]/g, '').replace(',', '.')) || coverPrice;
    const tier11to20 = parseFloat(fields[5].replace(/[R$\s]/g, '').replace(',', '.')) || tier1to10;
    const tier21to40 = parseFloat(fields[6].replace(/[R$\s]/g, '').replace(',', '.')) || tier11to20;
    const tier41plus = parseFloat(fields[7].replace(/[R$\s]/g, '').replace(',', '.')) || tier21to40;

    if (sku && product && coverPrice > 0) {
      rows.push({
        sku,
        product,
        description,
        coverPrice,
        tier1to10,
        tier11to20,
        tier21to40,
        tier41plus,
      });
    }
  }

  return rows;
}

/**
 * Calculates deterministic resale quote based on the live dynamic CSV table.
 */
export function calculateResaleQuote(
  itemsInput: QuoteItemInput[],
  buyer: BuyerInfo = { name: 'Cliente' },
  isConsignment = false,
  customCsvPath?: string
): QuoteCalculationResult {
  const productsTable = loadProductsFromCsv(customCsvPath);
  const calculatedItems = [];
  let totalQuantity = 0;
  let totalCoverValue = 0;
  let totalQuoteValue = 0;

  for (const input of itemsInput) {
    const q = Math.max(1, Math.floor(Number(input.quantity) || 1));
    const term = (input.nameOrSku || '').toLowerCase().trim();

    // Match product dynamically from CSV rows
    const product = productsTable.find((p) => {
      const s = p.sku.toLowerCase();
      const name = p.product.toLowerCase();
      return s === term || name === term || name.includes(term) || term.includes(name);
    }) || productsTable.find((p) => p.sku.toLowerCase().includes('grok')) || productsTable[0];

    if (!product) continue;

    let unitPrice = product.tier1to10;
    if (!isConsignment) {
      if (q >= 41) unitPrice = product.tier41plus;
      else if (q >= 21) unitPrice = product.tier21to40;
      else if (q >= 11) unitPrice = product.tier11to20;
      else unitPrice = product.tier1to10;
    }

    const subtotal = Number((unitPrice * q).toFixed(2));
    const coverTotal = Number((product.coverPrice * q).toFixed(2));
    const discountPercent = Math.round(((product.coverPrice - unitPrice) / product.coverPrice) * 100);

    totalQuantity += q;
    totalCoverValue += coverTotal;
    totalQuoteValue += subtotal;

    calculatedItems.push({
      sku: product.sku,
      product: product.product,
      quantity: q,
      coverPrice: product.coverPrice,
      unitPrice,
      discountPercent,
      subtotal,
    });
  }

  totalQuoteValue = Number(totalQuoteValue.toFixed(2));
  totalCoverValue = Number(totalCoverValue.toFixed(2));
  const totalSavings = Number((totalCoverValue - totalQuoteValue).toFixed(2));

  const itemsTable = calculatedItems
    .map(
      (it) =>
        `| ${it.product} | ${it.quantity} un. | R$ ${it.coverPrice.toFixed(2).replace('.', ',')} | **R$ ${it.unitPrice.toFixed(2).replace('.', ',')}** (-${it.discountPercent}%) | **R$ ${it.subtotal.toFixed(2).replace('.', ',')}** |`
    )
    .join('\n');

  const formattedProposalMarkdown = `
📋 **PROPOSTA COMERCIAL & ORÇAMENTO — COLAB COLIBRI**

**Dados do Cliente / Solicitante:**
* **Razão Social / Nome:** ${buyer.name}
${buyer.document ? `* **CNPJ / CPF:** ${buyer.document}\n` : ''}${buyer.stateRegistration ? `* **Inscrição Estadual:** ${buyer.stateRegistration}\n` : ''}${buyer.email ? `* **E-mail:** ${buyer.email}\n` : ''}${buyer.address ? `* **Endereço de Entrega:** ${buyer.address} ${buyer.cityState || ''} - CEP: ${buyer.cep || ''}\n` : ''}
* **Modalidade:** ${isConsignment ? '📦 Consignação' : '🛍️ Revenda com Desconto Progressivo'}

---

### 📦 Itens do Orçamento:

| Item | Quantidade | Preço de Capa | Preço Unit. Revenda | Subtotal |
| :--- | :---: | :---: | :---: | :---: |
${itemsTable}

---

### 💰 Resumo Financeiro:
* **Quantidade Total de Itens:** **${totalQuantity} unidades**
* **Valor Total de Capa:** ~~R$ ${totalCoverValue.toFixed(2).replace('.', ',')}~~
* **Economia Total Concedida:** **R$ ${totalSavings.toFixed(2).replace('.', ',')}**
* **VALOR TOTAL DO PEDIDO:** **R$ ${totalQuoteValue.toFixed(2).replace('.', ',')}**

---

**Condições Comerciais & Pagamento:**
* **Faturamento / Pagamento:** PIX (à vista com despacho prioritário), Boleto Bancário ou Cartão de Crédito.
* **Emissão Fiscal:** Nota Fiscal eletrônica (NF-e) emitida pela Colab Colibri Assessoria LTDA.
* **Prazo de Despacho:** Até 2 dias úteis após confirmação do pedido.

*Qualquer dúvida ou ajuste nos quantitativos, estamos à total disposição!*

Um abraço,  
**Equipe Colibri**  
contato@colabcolibri.com | colabcolibri.com
`.trim();

  return {
    buyer,
    isConsignment,
    items: calculatedItems,
    totalQuantity,
    totalCoverValue,
    totalQuoteValue,
    totalSavings,
    formattedProposalMarkdown,
  };
}

// CLI test mode: bun run calcular_orcamento.ts
if (import.meta.main) {
  const arg = process.argv[2];
  let input = { items: [{ nameOrSku: 'grok', quantity: 9 }], buyer: { name: 'Heloisa Vieira' } };
  if (arg) {
    try {
      input = JSON.parse(arg);
    } catch {}
  }
  const res = calculateResaleQuote(input.items, input.buyer, (input as any).isConsignment);
  console.log(res.formattedProposalMarkdown);
}
