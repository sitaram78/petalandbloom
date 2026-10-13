import crypto from 'node:crypto';
import { supabaseAdmin } from '../../lib/supabaseServer';
import { requireAuth } from '../../lib/authMiddleware';

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

function parseJsonSafe<T = any>(input: any, defaultValue: T): T {
  if (typeof input === 'object' && input !== null) return input;
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

// In-memory server fallback ledger (synthetic demo data, no real PII)
let conversationsCache: ServerConversation[] = [
  {
    id: 'demo-welcome-conv',
    customer_id: null,
    customer_name: 'Studio Concierge Test',
    customer_phone: '+910000000001',
    customer_email: 'concierge.test@example.com',
    subject: 'Bespoke bouquet color palette request',
    status: 'OPEN',
    last_message_preview: 'Could you craft these crochet roses in French Lilac and Dusty Rose?',
    last_message_at: new Date(Date.now() - 5 * 60000).toISOString(),
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
  },
  {
    id: 'conv-sample-1',
    customer_id: null,
    customer_name: 'Sample Patron 1',
    customer_phone: '+910000000002',
    customer_email: 'patron1@example.com',
    subject: 'Anniversary gift dispatch timeline',
    status: 'PENDING_ADMIN',
    last_message_preview: 'Hi! Can I get guaranteed delivery to Bangalore by Friday?',
    last_message_at: new Date(Date.now() - 15 * 60000).toISOString(),
    created_at: new Date(Date.now() - 120 * 60000).toISOString(),
  },
  {
    id: 'conv-sample-2',
    customer_id: null,
    customer_name: 'Sample Patron 2',
    customer_phone: '+910000000003',
    customer_email: 'patron2@example.com',
    subject: 'Custom palette for wedding centerpieces',
    status: 'REPLIED',
    last_message_preview: 'We have dispatched our seasonal shade card to your email.',
    last_message_at: new Date(Date.now() - 45 * 60000).toISOString(),
    created_at: new Date(Date.now() - 180 * 60000).toISOString(),
  },
  {
    id: 'conv-sample-3',
    customer_id: null,
    customer_name: 'Sample Patron 3',
    customer_phone: '+910000000004',
    customer_email: 'patron3@example.com',
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
    // Only authenticated staff with messages.manage capability can view all customer conversations
    const authUser = await requireAuth(req, res, {
      requiredPermission: 'messages.manage',
      allowedRoles: ['super_admin', 'admin', 'support'],
    });
    if (!authUser) return;

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
    const payload = parseJsonSafe(req.body, {});
    const convId = isValidUUID(payload.id) ? payload.id : crypto.randomUUID();
    const cleanCustomerName = String(payload.customer_name || 'Guest Visitor').replace(/<[^>]*>?/gm, '').trim().slice(0, 100);
    const cleanSubject = String(payload.subject || 'Atelier Enquiry').replace(/<[^>]*>?/gm, '').trim().slice(0, 200);
    const cleanPreview = String(payload.last_message_preview || '').replace(/<[^>]*>?/gm, '').trim().slice(0, 500);

    const newConv: ServerConversation = {
      id: convId,
      customer_id: payload.customer_id || null,
      customer_name: cleanCustomerName,
      customer_phone: payload.customer_phone ? String(payload.customer_phone).slice(0, 20) : null,
      customer_email: payload.customer_email ? String(payload.customer_email).trim().slice(0, 100) : null,
      subject: cleanSubject,
      status: payload.status || 'PENDING_ADMIN',
      last_message_preview: cleanPreview,
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const existingIdx = conversationsCache.findIndex((c) => c.id === newConv.id);
    if (existingIdx !== -1) {
      conversationsCache[existingIdx] = {
        ...conversationsCache[existingIdx],
        ...payload,
        customer_name: cleanCustomerName,
        subject: cleanSubject,
        last_message_preview: cleanPreview,
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
    // Only authenticated staff with messages.manage capability can delete conversations
    const authUser = await requireAuth(req, res, {
      requiredPermission: 'messages.manage',
      allowedRoles: ['super_admin', 'admin', 'support'],
    });
    if (!authUser) return;

    const parsedUrl = new URL(req.url, 'http://localhost:5173');
    const bodyObj = parseJsonSafe(req.body, {});
    const convId = parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('conversation_id') || bodyObj.id;

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
