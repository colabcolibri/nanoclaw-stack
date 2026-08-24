import fs from 'fs';
import path from 'path';
import type { AgentTool } from './types.js';
import { resolveUiPublicUrl } from '../runtime-paths.js';

interface YampiCreds {
  alias: string;
  userToken: string;
  userSecretKey: string;
}

// --- DTOs mínimos da API Yampi/Dooki (só o que a tool lê) ---
interface YampiSku {
  stock?: { data?: { quantity?: number } };
}
interface YampiProduct {
  id: number | string;
  name?: string;
  sku?: string;
  url?: string;
  description?: string;
  prices?: { data?: { price?: number; promotional_price?: number } };
  has_unlimited_stock?: boolean;
  skus?: { data?: YampiSku[] };
}
interface YampiOrderItem {
  name?: string;
  quantity?: number;
  price?: number;
  sku?: { data?: { title?: string } };
}
interface YampiOrder {
  id: number | string;
  number?: number | string;
  customer?: { data?: { email?: string; name?: string } };
  items?: { data?: YampiOrderItem[] };
  shipping?: { data?: { tracking_code?: string; tracking_url?: string } };
  tracking_code?: string;
  status?: { data?: { name?: string } };
  status_alias?: string;
  is_paid?: boolean;
  created_at?: { date?: string };
  value_total?: number;
}
interface YampiListResponse<T> {
  data?: T[];
}

function getYampiCreds(cwd: string): YampiCreds | null {
  const possiblePaths = [
    path.join(cwd, 'yampi_tokens.json'),
    '/workspace/group/yampi_tokens.json',
    '/workspace/agent/yampi_tokens.json',
    ...(process.env.AGENT_GROUP_DIR ? [path.join(process.env.AGENT_GROUP_DIR, 'yampi_tokens.json')] : []),
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

export interface YampiToolArgs {
  action?: string;
  query?: string;
  product_id?: string;
  requested_quantity?: number;
  order_number?: string;
  client_email?: string;
  status?: string;
  limit?: number;
  [key: string]: unknown;
}

export const yampiTool: AgentTool = {
  domain: 'ecommerce_logistics',
  definition: {
    type: 'function',
    function: {
      name: 'yampi_store',
      description:
        'Accesses Yampi e-commerce platform to search products catalog, check real-time stock availability, and track customer orders with privacy verification.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'search_products',
              'get_product',
              'check_product_quantity',
              'get_order',
              'get_client_orders',
              'list_recent_orders',
            ],
            description:
              'Action to perform: "search_products", "get_product", "check_product_quantity" (safe stock level check), "get_order" (order tracking), "get_client_orders" (order history by email), "list_recent_orders".',
          },
          query: {
            type: 'string',
            description: 'Product name, SKU, or search term.',
          },
          product_id: {
            type: 'string',
            description: 'Numeric product ID in Yampi.',
          },
          requested_quantity: {
            type: 'number',
            description: 'Unit quantity requested to verify stock feasibility.',
          },
          order_number: {
            type: 'string',
            description: 'Order number (e.g. "446652", "11").',
          },
          client_email: {
            type: 'string',
            description:
              'Customer email address (required for customer-facing order tracking for privacy protection).',
          },
          status: {
            type: 'string',
            description: 'Order status filter (e.g. "paid", "delivered", "shipped", "cancelled").',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default 10).',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: YampiToolArgs, cwd: string): Promise<string> => {
    const creds = getYampiCreds(cwd);
    if (!creds) {
      return JSON.stringify({
        status: 'error',
        error:
          `Yampi credentials not configured. Set Alias, User-Token, and Secret-Key in the web panel (${resolveUiPublicUrl()}, Accounts & Integrations tab).`,
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

      const data = (await res.json()) as YampiListResponse<YampiProduct>;
      const products = (data.data ?? []).map((p) => {
        const totalStock = (p.skus?.data || []).reduce((acc: number, s: any) => acc + (s.stock?.data?.quantity || 0), 0);
        return {
          id: p.id,
          name: p.name,
          sku: p.sku || p.id,
          price: p.prices?.data?.price,
          promotional_price: p.prices?.data?.promotional_price,
          in_stock: totalStock > 0 || p.has_unlimited_stock,
          availability: totalStock > 0 || p.has_unlimited_stock ? 'In stock for immediate shipment' : 'Out of stock',
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
        return JSON.stringify({ status: 'error', error: 'Provide product name or ID to check quantity.' });
      }

      const res = await fetch(`${baseURL}/catalog/products?q=${encodeURIComponent(q)}`, { headers });
      if (!res.ok) {
        return JSON.stringify({ status: 'error', code: res.status, text: await res.text() });
      }

      const data = (await res.json()) as YampiListResponse<YampiProduct>;
      const product = data.data?.[0];
      if (!product) {
        return JSON.stringify({ status: 'not_found', message: `Product "${q}" not found in catalog.` });
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
          ? `Requested quantity (${requested} units) is available for immediate shipment.`
          : totalStock > 0
          ? `Not enough stock (${requested} units requested) for immediate shipment, but a smaller quantity is available.`
          : `Product "${product.name}" is temporarily out of stock.`,
      });
    }

    // 3. GET ORDER (WITH STRICT DATA PRIVACY LOCK)
    if (action === 'get_order') {
      const orderNumber = String(args.order_number || '').replace('#', '').trim();
      const clientEmail = args.client_email ? String(args.client_email).trim().toLowerCase() : null;

      if (!orderNumber) {
        return JSON.stringify({ status: 'error', error: 'Parameter order_number is required.' });
      }

      const res = await fetch(`${baseURL}/orders?q=${encodeURIComponent(orderNumber)}&include=customer,items,shipping`, { headers });
      if (!res.ok) {
        return JSON.stringify({ status: 'error', code: res.status, text: await res.text() });
      }

      const data = (await res.json()) as YampiListResponse<YampiOrder>;
      const order = (data.data ?? []).find(
        (o) => String(o.number) === orderNumber || String(o.id) === orderNumber
      );

      if (!order) {
        return JSON.stringify({ status: 'not_found', message: `Order #${orderNumber} not found in store.` });
      }

      const buyerEmail = (order.customer?.data?.email || '').trim().toLowerCase();

      // SECURITY ENFORCEMENT: Client can ONLY access their own order
      if (clientEmail && buyerEmail && buyerEmail !== clientEmail) {
        return JSON.stringify({
          status: 'security_denied',
          message: 'SECURITY LOCK ACTIVE: This order belongs to another customer. Viewing or disclosing third-party data is not allowed.',
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
        return JSON.stringify({ status: 'error', error: 'Parameter client_email is required to look up customer order history.' });
      }

      const res = await fetch(`${baseURL}/orders?q=${encodeURIComponent(clientEmail)}&include=items,shipping&limit=10`, { headers });
      if (!res.ok) {
        return JSON.stringify({ status: 'error', code: res.status, text: await res.text() });
      }

      const data = (await res.json()) as YampiListResponse<YampiOrder>;
      const orders = (data.data ?? []).map((o) => ({
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

      const data = (await res.json()) as YampiListResponse<YampiOrder>;
      const orders = (data.data ?? []).map((o) => ({
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

    return JSON.stringify({ status: 'error', error: `Unknown action: "${action}".` });
  },
};
