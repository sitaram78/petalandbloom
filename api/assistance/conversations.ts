import { supabaseAdmin } from '../lib/supabaseServer';

export interface ServerConversation {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  subject: string;
  status: 'OPEN' | 'PENDING_ADMIN' | 'REPLIED' | 'RESOLVED';
  last_message_preview: string | null;
  last_message_at: string;
  created_at: string;
}

// In-memory server fallback ledger
let conversationsCache: ServerConversation[] = [
  {
    id: 'demo-welcome-conv',
    customer_id: null,
    customer_name: 'Studio Concierge Test',
    customer_phone: '+919931653303',
    customer_email: 'guest@thepetalandbloom.com',
    subject: 'Welcome to The Petal & Bloom Studio',
    status: 'OPEN',
    last_message_preview: 'Welcome to The Petal & Bloom! How may we assist you?',
    last_message_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
];

export function getConversationsCache() {
  return conversationsCache;
}

export function updateConversationsCache(updated: ServerConversation[]) {
  conversationsCache = updated;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('assistance_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (!error && data && data.length > 0) {
        conversationsCache = data;
      }
    } catch {
      // Use fallback cache
    }

    return res.status(200).json({ success: true, conversations: conversationsCache });
  }

  if (req.method === 'POST') {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const newConv: ServerConversation = {
      id: payload.id || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      customer_id: payload.customer_id || null,
      customer_name: payload.customer_name || 'Guest Visitor',
      customer_phone: payload.customer_phone || null,
      customer_email: payload.customer_email || null,
      subject: payload.subject || 'Atelier Enquiry',
      status: payload.status || 'PENDING_ADMIN',
      last_message_preview: payload.last_message_preview || '',
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const existingIdx = conversationsCache.findIndex((c) => c.id === newConv.id);
    if (existingIdx !== -1) {
      conversationsCache[existingIdx] = {
        ...conversationsCache[existingIdx],
        ...payload,
        last_message_at: new Date().toISOString(),
      };
    } else {
      conversationsCache.unshift(newConv);
    }

    try {
      await supabaseAdmin.from('assistance_conversations').upsert(newConv, { onConflict: 'id' });
    } catch {
      // Keep in cache
    }

    return res.status(200).json({ success: true, conversation: newConv });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
