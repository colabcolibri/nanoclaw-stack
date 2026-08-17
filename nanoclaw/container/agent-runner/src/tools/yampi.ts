import fs from 'fs';
import path from 'path';
import type { AgentTool } from './types.js';

interface YampiCreds {
  alias: string;
  userToken: string;
  userSecretKey: string;
}

function getYampiCreds(cwd: string): YampiCreds | null {
  const possiblePaths = [
    path.join(cwd, 'yampi_tokens.json'),
    path.join(cwd, 'groups', 'barao', 'yampi_tokens.json'),
    '/opt/nanoclaw-stack/nanoclaw/groups/barao/yampi_tokens.json',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (data.alias && data.userToken && data.userSecretKey) {
          return data;
        }
      } catch {}
    }
  }
  return null;
}

export const yampiTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'yampi_store',
      description:
        'Acessa a loja virtual Yampi para consultar catálogo de produtos, verificar disponibilidade de estoque e consultar status de pedidos com trava de segurança de privacidade.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['search_products', 'get_product', 'check_product_quantity', 'get_order', 'get_client_orders', 'list_recent_orders'],
            description:
              'Ação a realizar: search_products (buscar produtos no catálogo), get_product (detalhes de produto), check_product_quantity (verificar se tem quantidade solicitada sem vazar estoque total), get_order (consultar pedido por número com validação de e-mail), get_client_orders (pedidos de um cliente por e-mail), list_recent_orders (apenas para o operador da loja).',
          },
          query: {
            type: 'string',
            description: 'Nome, SKU ou termo de busca do produto.',
          },
          product_id: {
            type: 'string',
            description: 'ID do produto na Yampi.',
          },
          requested_quantity: {
            type: 'number',
            description: 'Quantidade que o cliente deseja comprar para verificar viabilidade.',
          },
          order_number: {
            type: 'string',
            description: 'Número do pedido (ex: "446652", "11").',
          },
          client_email: {
            type: 'string',
            description:
              'E-mail do cliente solicitante (OBRIGATÓRIO quando for atendimento ao cliente para trava de segurança).',
          },
          status: {
            type: 'string',
            description: 'Status do pedido (ex: "paid", "delivered", "shipped", "cancelled").',
          },
          limit: {
            type: 'number',
            description: 'Limite de resultados (padrão 10).',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    const creds = getYampiCreds(cwd);
    if (!creds) {
      return JSON.stringify({
        status: 'error',
        error:
          'Credenciais da Yampi não configuradas. Cadastre seu Alias, User-Token e Secret-Key no painel Web (https://uai.sergioluciano.com na aba Contas & Integrações).',
      });
    }

    const headers = {
      'User-Token': creds.userToken,
      'User-Secret-Key': creds.userSecretKey,
      'Content-Type': 'application/json',
    };
    const baseURL = `https://api.dooki.com.br/v2/${creds.alias}`;

    const action = args.action || 'search_products';

    // 1. SEARCH PRODUCTS
    if (action === 'search_products') {
      const q = args.query ? `?q=${encodeURIComponent(args.query)}` : '?limit=15';
      const res = await fetch(`${baseURL}/catalog/products${q}`, { headers });
      if (!res.ok) {
        return JSON.stringify({ status: 'error', code: res.status, text: await res.text() });
      }

      const data = (await res.json()) as any;
      const products = (data.data || []).map((p: any) => {
        const totalStock = (p.skus?.data || []).reduce((acc: number, s: any) => acc + (s.stock?.data?.quantity || 0), 0);
        return {
          id: p.id,
          name: p.name,
          sku: p.sku || p.id,
          price: p.prices?.data?.price,
          promotional_price: p.prices?.data?.promotional_price,
          in_stock: totalStock > 0 || p.has_unlimited_stock,
          availability: totalStock > 0 || p.has_unlimited_stock ? 'Disponível para pronta entrega' : 'Esgotado no momento',
          url: p.url,
          description: p.description ? p.description.replace(/<[^>]*>/g, ' ').slice(0, 300).trim() : '',
        };
      });

      return JSON.stringify({
        status: 'ok',
        totalFound: products.length,
        products,
      });
    }

    // 2. CHECK PRODUCT QUANTITY (Safe stock check without leaking total quantity)
    if (action === 'check_product_quantity') {
      const q = args.query || args.product_id;
      const requested = Number(args.requested_quantity) || 1;

      if (!q) {
        return JSON.stringify({ status: 'error', error: 'Informe o nome ou ID do produto para verificar a quantidade.' });
      }

      const res = await fetch(`${baseURL}/catalog/products?q=${encodeURIComponent(q)}`, { headers });
      if (!res.ok) {
        return JSON.stringify({ status: 'error', code: res.status, text: await res.text() });
      }

      const data = (await res.json()) as any;
      const product = data.data?.[0];
      if (!product) {
        return JSON.stringify({ status: 'not_found', message: `Produto "${q}" não encontrado no catálogo.` });
      }

      const totalStock = (product.skus?.data || []).reduce((acc: number, s: any) => acc + (s.stock?.data?.quantity || 0), 0);
      const hasUnlimited = product.has_unlimited_stock;
      const canFulfill = hasUnlimited || totalStock >= requested;

      return JSON.stringify({
        status: 'ok',
        product_name: product.name,
        requested_quantity: requested,
        can_fulfill: canFulfill,
        in_stock: totalStock > 0 || hasUnlimited,
        message: canFulfill
          ? `Temos a quantidade solicitada (${requested} unidades) disponível para envio imediato.`
          : totalStock > 0
          ? `Não temos toda essa quantidade (${requested} un.) em estoque para envio imediato no momento, mas temos uma quantidade menor disponível pronta para envio.`
          : `O produto "${product.name}" encontra-se temporariamente esgotado.`,
      });
    }

    // 3. GET ORDER (WITH STRICT DATA PRIVACY LOCK)
    if (action === 'get_order') {
      const orderNumber = String(args.order_number || '').replace('#', '').trim();
      const clientEmail = args.client_email ? String(args.client_email).trim().toLowerCase() : null;

      if (!orderNumber) {
        return JSON.stringify({ status: 'error', error: 'Parâmetro order_number é obrigatório.' });
      }

      const res = await fetch(`${baseURL}/orders?q=${encodeURIComponent(orderNumber)}&include=customer,items,shipping`, { headers });
      if (!res.ok) {
        return JSON.stringify({ status: 'error', code: res.status, text: await res.text() });
      }

      const data = (await res.json()) as any;
      const order = (data.data || []).find(
        (o: any) => String(o.number) === orderNumber || String(o.id) === orderNumber
      );

      if (!order) {
        return JSON.stringify({ status: 'not_found', message: `Pedido #${orderNumber} não encontrado na loja.` });
      }

      const buyerEmail = (order.customer?.data?.email || '').trim().toLowerCase();

      // SECURITY ENFORCEMENT: Client can ONLY access their own order
      if (clientEmail && buyerEmail && buyerEmail !== clientEmail) {
        return JSON.stringify({
          status: 'security_denied',
          message: 'TRAVA DE SEGURANÇA ATIVADA: Os dados deste pedido pertencem a outro cliente. Não é permitido visualizar ou divulgar informações de terceiros.',
        });
      }

      const items = (order.items?.data || []).map((i: any) => ({
        name: i.name || i.sku?.data?.title,
        quantity: i.quantity,
        price: i.price,
      }));

      const tracking = order.shipping?.data?.tracking_code || order.tracking_code || null;
      const trackingUrl = order.shipping?.data?.tracking_url || null;

      return JSON.stringify({
        status: 'ok',
        order_number: order.number || order.id,
        status_name: order.status?.data?.name || order.status_alias || 'Processando',
        paid: order.is_paid,
        created_at: order.created_at?.date || order.created_at,
        total: order.value_total,
        items,
        tracking_code: tracking,
        tracking_url: trackingUrl,
        buyer_name: order.customer?.data?.name,
      });
    }

    // 4. GET CLIENT ORDERS (Lookup all orders of a verified email)
    if (action === 'get_client_orders') {
      const clientEmail = args.client_email ? String(args.client_email).trim().toLowerCase() : null;
      if (!clientEmail) {
        return JSON.stringify({ status: 'error', error: 'Parâmetro client_email é obrigatório para consultar histórico do cliente.' });
      }

      const res = await fetch(`${baseURL}/orders?q=${encodeURIComponent(clientEmail)}&include=items,shipping&limit=10`, { headers });
      if (!res.ok) {
        return JSON.stringify({ status: 'error', code: res.status, text: await res.text() });
      }

      const data = (await res.json()) as any;
      const orders = (data.data || []).map((o: any) => ({
        order_number: o.number || o.id,
        status: o.status?.data?.name || o.status_alias,
        total: o.value_total,
        created_at: o.created_at?.date || o.created_at,
        items: (o.items?.data || []).map((i: any) => `${i.quantity}x ${i.name}`),
        tracking_code: o.shipping?.data?.tracking_code || null,
      }));

      return JSON.stringify({
        status: 'ok',
        client_email: clientEmail,
        total_orders: orders.length,
        orders,
      });
    }

    // 5. LIST RECENT ORDERS (Internal operator overview)
    if (action === 'list_recent_orders') {
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 30);
      const res = await fetch(`${baseURL}/orders?limit=${limit}&include=customer,items`, { headers });
      if (!res.ok) {
        return JSON.stringify({ status: 'error', code: res.status, text: await res.text() });
      }

      const data = (await res.json()) as any;
      const orders = (data.data || []).map((o: any) => ({
        order_number: o.number || o.id,
        customer_name: o.customer?.data?.name,
        customer_email: o.customer?.data?.email,
        status: o.status?.data?.name || o.status_alias,
        total: o.value_total,
        created_at: o.created_at?.date || o.created_at,
        items: (o.items?.data || []).map((i: any) => `${i.quantity}x ${i.name}`),
      }));

      return JSON.stringify({
        status: 'ok',
        totalOrders: orders.length,
        orders,
      });
    }

    return JSON.stringify({ status: 'error', error: `Ação "${action}" não reconhecida.` });
  },
};
