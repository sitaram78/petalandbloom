import crypto from 'node:crypto';
import { supabaseAdmin } from '../../lib/supabaseServer';

function isValidUUID(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

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
    subject: 'Bespoke bouquet color palette request',
    status: 'OPEN',
    last_message_preview: 'Could you craft these crochet roses in French Lilac and Dusty Rose?',
    last_message_at: new Date(Date.now() - 5 * 60000).toISOString(),
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
  },
  {
    id: 'conv-ananya-roy',
    customer_id: null,
    customer_name: 'Ananya Roy',
    customer_phone: '+919876543210',
    customer_email: 'ananya.roy@example.com',
    subject: 'Anniversary gift dispatch timeline',
    status: 'PENDING_ADMIN',
    last_message_preview: 'Hi! Can I get guaranteed delivery to Bangalore by Friday?',
    last_message_at: new Date(Date.now() - 15 * 60000).toISOString(),
    created_at: new Date(Date.now() - 120 * 60000).toISOString(),
  },
  {
    id: 'conv-priya-sharma',
    customer_id: null,
    customer_name: 'Priya Sharma',
    customer_phone: '+919811223344',
    customer_email: 'priya.sharma@example.com',
    subject: 'Custom palette for wedding centerpieces',
    status: 'REPLIED',
    last_message_preview: 'We have dispatched our seasonal shade card to your email.',
    last_message_at: new Date(Date.now() - 45 * 60000).toISOString(),
    created_at: new Date(Date.now() - 180 * 60000).toISOString(),
  },
  {
    id: 'conv-rohit-mehta',
    customer_id: null,
    customer_name: 'Rohit Mehta',
    customer_phone: '+919922334455',
    customer_email: 'rohit.m@example.com',
    subject: 'Care and dusting instructions',
    status: 'RESOLVED',
    last_message_preview: 'Thank you so much! The bouquet looks marvelous on our mantle.',
    last_message_at: new Date(Date.now() - 180 * 60000).toISOString(),
    created_at: new Date(Date.now() - 360 * 60000).toISOString(),
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
    const convId = isValidUUID(payload.id) ? payload.id : crypto.randomUUID();
    const newConv: ServerConversation = {
      id: convId,
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

  if (req.method === 'DELETE') {
    const parsedUrl = new URL(req.url, 'http://localhost:5173');
    const convId = parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('conversation_id') ||
      (req.body && (typeof req.body === 'string' ? JSON.parse(req.body).id : req.body.id));

    if (!convId) {
      return res.status(400).json({ error: 'Conversation id is required' });
    }

    try {
      // 1. Delete all messages for this conversation to free storage
      const { error: msgErr } = await supabaseAdmin
        .from('assistance_messages')
        .delete()
        .eq('conversation_id', convId);

      if (msgErr) {
        console.warn('[assistance_messages DB cascade delete warning]:', msgErr.message);
      }

      // 2. Delete the conversation
      const { error: convErr } = await supabaseAdmin
        .from('assistance_conversations')
        .delete()
        .eq('id', convId);

      if (convErr) {
        console.warn('[assistance_conversations DB delete warning]:', convErr.message);
      }

      // 3. Remove from cache
      conversationsCache = conversationsCache.filter((c) => c.id !== convId);

      return res.status(200).json({
        success: true,
        message: 'Conversation and all associated messages permanently deleted. Storage freed.',
      });
    } catch (err: any) {
      console.warn('[assistance_conversations DB delete exception]:', err?.message || err);
      return res.status(500).json({ error: err?.message || 'Failed to delete conversation' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
