import type { AgentTool } from './types.js';
import { ResalePricingEngine } from '../services/pricing.js';

export const resalePricingTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'resale_pricing',
      description:
        'Official B2B/Wholesale Pricing & Quote Engine. Calculates commercial proposals for corporate clients, schools, and bulk buyers applying progressive discount tiers.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['calculate_quote', 'list_table'],
            description: 'Action: "calculate_quote" to compute a commercial proposal, or "list_table" to view the official pricing table.',
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nameOrSku: { type: 'string', description: 'Product name or SKU (e.g. "Jogo Grok", "JG001", "Livro CNV")' },
                quantity: { type: 'number', description: 'Desired unit quantity' },
              },
              required: ['nameOrSku', 'quantity'],
            },
            description: 'List of items and quantities for quote calculation.',
          },
          buyer_name: {
            type: 'string',
            description: 'Name of the buyer, school, company or organization.',
          },
          buyer_document: {
            type: 'string',
            description: 'Tax ID (CNPJ/CPF) of the buyer (if provided).',
          },
          buyer_address: {
            type: 'string',
            description: 'Delivery address or postal code (CEP) of the buyer (if provided).',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: any, cwd: string) => {
    const action = args.action || 'calculate_quote';

    if (action === 'list_table') {
      try {
        const products = ResalePricingEngine.loadProductsFromCsv(cwd);
        return JSON.stringify({
          status: 'ok',
          count: products.length,
          products: products.map((p) => ({
            sku: p.sku,
            product: p.product,
            cover_price: p.coverPrice,
            tier_1_10: p.tier1to10,
            tier_11_20: p.tier11to20,
            tier_21_40: p.tier21to40,
            tier_41_plus: p.tier41plus,
          })),
        });
      } catch (err: any) {
        return JSON.stringify({ status: 'error', message: err.message });
      }
    }

    if (action === 'calculate_quote') {
      if (!args.items || !Array.isArray(args.items) || args.items.length === 0) {
        return JSON.stringify({
          status: 'error',
          error: 'Parâmetro "items" é obrigatório com ao menos 1 item para calcular o orçamento.',
        });
      }

      try {
        const proposal = ResalePricingEngine.calculateQuote(
          args.items,
          {
            name: args.buyer_name || 'Cliente',
            document: args.buyer_document,
            address: args.buyer_address,
          },
          false,
          cwd
        );

        return JSON.stringify({
          status: 'ok',
          message: 'Orçamento comercial de revenda calculado com sucesso.',
          buyer: proposal.buyer,
          totalQuantity: proposal.totalQuantity,
          totalCoverValue: proposal.totalCoverValue,
          totalQuoteValue: proposal.totalQuoteValue,
          totalSavings: proposal.totalSavings,
          items: proposal.items,
          formattedProposalMarkdown: proposal.formattedProposalMarkdown,
        });
      } catch (err: any) {
        return JSON.stringify({ status: 'error', message: err.message });
      }
    }

    return JSON.stringify({ status: 'error', message: `Ação desconhecida: ${action}` });
  },
};
