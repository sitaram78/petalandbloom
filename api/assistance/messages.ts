import { supabaseAdmin } from '../lib/supabaseServer';
import { getConversationsCache } from './conversations';

export interface ServerMessage {
  id: string;
  conversation_id: string;
  sender_type: 'CUSTOMER' | 'ADMIN' | 'BOT';
  sender_name: string;
  message_text: string;
  created_at: string;
}

// In-memory messages ledger
let messagesCache: Record<string, ServerMessage[]> = {
  'demo-welcome-conv': [
    {
      id: 'demo-msg-1',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'BOT',
      sender_name: 'Atelier Concierge',
      message_text: 'Welcome to The Petal & Bloom! How may we assist you with our bespoke floral pieces today?',
      created_at: new Date().toISOString(),
    },
  ],
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  const parsedUrl = new URL(req.url, 'http://localhost:5173');
  const conversationId = parsedUrl.searchParams.get('conversation_id');

  if (req.method === 'GET') {
    if (!conversationId) {
      return res.status(400).json({ error: 'conversation_id is required' });
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('assistance_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        messagesCache[conversationId] = data;
      }
    } catch {
      // Use fallback
    }

    const convMessages = messagesCache[conversationId] || [];
    return res.status(200).json({ success: true, messages: convMessages });
  }

  if (req.method === 'POST') {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const targetConvId = payload.conversation_id || conversationId;

    if (!targetConvId || !payload.message_text) {
      return res.status(400).json({ error: 'conversation_id and message_text are required' });
    }

    const newMsg: ServerMessage = {
      id: payload.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversation_id: targetConvId,
      sender_type: payload.sender_type || 'CUSTOMER',
      sender_name: payload.sender_name || 'Visitor',
      message_text: payload.message_text,
      created_at: new Date().toISOString(),
    };

    if (!messagesCache[targetConvId]) {
      messagesCache[targetConvId] = [];
    }
    messagesCache[targetConvId].push(newMsg);

    // Update conversation preview in memory
    const convList = getConversationsCache();
    const conv = convList.find((c) => c.id === targetConvId);
    if (conv) {
      conv.last_message_preview = payload.message_text;
      conv.last_message_at = new Date().toISOString();
      if (newMsg.sender_type === 'CUSTOMER') {
        conv.status = 'PENDING_ADMIN';
      } else if (newMsg.sender_type === 'ADMIN') {
        conv.status = 'REPLIED';
      }
    } else {
      convList.unshift({
        id: targetConvId,
        customer_id: null,
        customer_name: newMsg.sender_name || 'Customer',
        customer_phone: null,
        customer_email: null,
        subject: payload.message_text.slice(0, 50),
        status: newMsg.sender_type === 'CUSTOMER' ? 'PENDING_ADMIN' : 'REPLIED',
        last_message_preview: payload.message_text,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    try {
      await supabaseAdmin.from('assistance_messages').insert({
        id: newMsg.id,
        conversation_id: newMsg.conversation_id,
        sender_type: newMsg.sender_type,
        sender_name: newMsg.sender_name,
        message_text: newMsg.message_text,
        created_at: newMsg.created_at,
      });

      await supabaseAdmin
        .from('assistance_conversations')
        .update({
          last_message_preview: newMsg.message_text,
          last_message_at: newMsg.created_at,
          status: newMsg.sender_type === 'CUSTOMER' ? 'PENDING_ADMIN' : 'REPLIED',
        })
        .eq('id', targetConvId);
    } catch {
      // Keep in local cache
    }

    return res.status(200).json({ success: true, message: newMsg });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
