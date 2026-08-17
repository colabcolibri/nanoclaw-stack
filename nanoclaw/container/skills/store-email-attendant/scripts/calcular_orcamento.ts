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

const PRODUCTS_TABLE = [
  {
    sku: 'GROK-GAME',
    aliases: ['grok', 'jogo grok', 'cartas grok', 'baralho grok'],
    product: 'Jogo Grok',
    cover: 160.0,
    t1: 112.0, // 1-10 (30%)
    t2: 105.6, // 11-20 (34%)
    t3: 102.4, // 21-40 (36%)
    t4: 99.2, // 41+ (38%)
  },
  {
    sku: 'BOOK-CNV-WORK',
    aliases: ['trabalho', 'cnv no trabalho', 'livro trabalho'],
    product: 'Livro: Comunicação Não Violenta no trabalho',
    cover: 63.0,
    t1: 35.28, // 44%
    t2: 34.02, // 46%
    t3: 32.76, // 48%
    t4: 31.5, // 50%
  },
  {
    sku: 'BOOK-CNV-TEAM',
    aliases: ['equipe', 'cnv na equipe', 'livro equipe'],
    product: 'Livro: Comunicação Não Violenta na equipe',
    cover: 53.0,
    t1: 29.68,
    t2: 28.62,
    t3: 27.56,
    t4: 26.5,
  },
  {
    sku: 'BOOK-CNV-ILUST1',
    aliases: ['ilustrada', 'cnv ilustrada', 'desconexão à conexão'],
    product: 'Livro: CNV Ilustrada V1 – mudando a chave da desconexão à conexão',
    cover: 44.0,
    t1: 24.64,
    t2: 23.76,
    t3: 22.88,
    t4: 22.0,
  },
  {
    sku: 'BOOK-GIRAFA',
    aliases: ['girafa', 'a linguagem da girafa'],
    product: 'Livro: A linguagem da girafa',
    cover: 44.0,
    t1: 24.64,
    t2: 23.76,
    t3: 22.88,
    t4: 22.0,
  },
  {
    sku: 'BOOK-CORAZAO',
    aliases: ['corazao', 'a corazão', 'a coracao'],
    product: 'Livro: a corazão',
    cover: 53.0,
    t1: 29.68,
    t2: 28.62,
    t3: 27.56,
    t4: 26.5,
  },
  {
    sku: 'BOOK-LIBERDADE',
    aliases: ['liberdade', 'liberdade sem distancia', 'liberdade sem distância'],
    product: 'Livro: Liberdade sem distância, conexão sem controle',
    cover: 44.0,
    t1: 24.64,
    t2: 23.76,
    t3: 22.88,
    t4: 22.0,
  },
  {
    sku: 'BOOK-SAUDADE',
    aliases: ['saudade', 'saudade sabor chocolate', 'chocolate'],
    product: 'Livro: Saudade Sabor Chocolate',
    cover: 44.0,
    t1: 24.64,
    t2: 23.76,
    t3: 22.88,
    t4: 22.0,
  },
];

export function calculateResaleQuote(
  itemsInput: QuoteItemInput[],
  buyer: BuyerInfo = { name: 'Cliente' },
  isConsignment = false
): QuoteCalculationResult {
  const calculatedItems = [];
  let totalQuantity = 0;
  let totalCoverValue = 0;
  let totalQuoteValue = 0;

  for (const input of itemsInput) {
    const q = Math.max(1, Math.floor(Number(input.quantity) || 1));
    const term = (input.nameOrSku || '').toLowerCase().trim();

    const product = PRODUCTS_TABLE.find(
      (p) =>
        p.sku.toLowerCase() === term ||
        p.product.toLowerCase().includes(term) ||
        p.aliases.some((a) => term.includes(a) || a.includes(term))
    ) || PRODUCTS_TABLE[0]; // fallback to Grok if not found

    let unitPrice = product.t1;
    if (!isConsignment) {
      if (q >= 41) unitPrice = product.t4;
      else if (q >= 21) unitPrice = product.t3;
      else if (q >= 11) unitPrice = product.t2;
      else unitPrice = product.t1;
    }

    const subtotal = Number((unitPrice * q).toFixed(2));
    const coverTotal = Number((product.cover * q).toFixed(2));
    const discountPercent = Math.round(((product.cover - unitPrice) / product.cover) * 100);

    totalQuantity += q;
    totalCoverValue += coverTotal;
    totalQuoteValue += subtotal;

    calculatedItems.push({
      sku: product.sku,
      product: product.product,
      quantity: q,
      coverPrice: product.cover,
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

// Support CLI execution: bun run calcular_orcamento.ts '{"items":[{"nameOrSku":"grok","quantity":9}]}'
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
