import type { AgentTool } from './types.js';
import { calculateResaleProposal, loadProductsFromCsv } from '../../skills/store-email-attendant/scripts/calcular_orcamento.js';

export const resalePricingTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'resale_pricing',
      description:
        'Motor Oficial de Precificação e Orçamentos de Revenda PJ da Colab Colibri (Independente da Yampi). Calcula propostas comerciais para empresas, escolas, prefeituras e compras por atacado aplicando as faixas oficiais de desconto progressivo (-30% a -38%).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['calculate_quote', 'list_table'],
            description: 'Ação: "calculate_quote" para calcular uma proposta comercial, ou "list_table" para listar a tabela de preços oficial.',
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nameOrSku: { type: 'string', description: 'Nome do produto ou SKU (ex: "Jogo Grok", "JG001", "Livro CNV")' },
                quantity: { type: 'number', description: 'Quantidade de unidades desejadas' },
              },
              required: ['nameOrSku', 'quantity'],
            },
            description: 'Lista de produtos e quantidades para o cálculo do orçamento.',
          },
          buyer_name: {
            type: 'string',
            description: 'Nome da empresa, prefeitura, escola ou responsável pelo orçamento.',
          },
          buyer_document: {
            type: 'string',
            description: 'CNPJ ou CPF do comprador (se informado).',
          },
          buyer_address: {
            type: 'string',
            description: 'Endereço completo ou CEP de entrega do comprador (se informado).',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: any, _cwd: string) => {
    const action = args.action || 'calculate_quote';

    if (action === 'list_table') {
      try {
        const products = loadProductsFromCsv();
        return JSON.stringify({
          status: 'ok',
          count: products.length,
          products: products.map((p) => ({
            sku: p.sku,
            product: p.product,
            cover_price: p.coverPrice,
            tier_1_10: p.tier_1_10,
            tier_11_20: p.tier_11_20,
            tier_21_40: p.tier_21_40,
            tier_41_plus: p.tier_41_plus,
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
        const proposal = calculateResaleProposal(args.items, {
          buyerName: args.buyer_name,
          buyerDocument: args.buyer_document,
          buyerAddress: args.buyer_address,
        });

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
