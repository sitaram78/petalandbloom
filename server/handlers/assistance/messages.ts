import crypto from 'node:crypto';
import { supabaseAdmin } from '../../lib/supabaseServer';
import { getConversationsCache } from './conversations';

function isValidUUID(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

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
      created_at: new Date(Date.now() - 40 * 60000).toISOString(),
    },
    {
      id: 'demo-msg-2',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'CUSTOMER',
      sender_name: 'Studio Concierge Test',
      message_text: 'Hello! I love the handcrafted heirloom roses. Are these 100% cotton yarn?',
      created_at: new Date(Date.now() - 38 * 60000).toISOString(),
    },
    {
      id: 'demo-msg-3',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'ADMIN',
      sender_name: 'Studio Artisan',
      message_text: 'Namaste! Yes indeed, all our botanical stems are crocheted using 100% combed cotton yarn for lifelong vibrancy and zero fading.',
      created_at: new Date(Date.now() - 35 * 60000).toISOString(),
    },
    {
      id: 'demo-msg-4',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'CUSTOMER',
      sender_name: 'Studio Concierge Test',
      message_text: 'That sounds delightful! Can you customize the bouquet with French Lilac and Dusty Rose shades?',
      created_at: new Date(Date.now() - 30 * 60000).toISOString(),
    },
    {
      id: 'demo-msg-5',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'ADMIN',
      sender_name: 'Studio Artisan',
      message_text: 'We dye our 100% combed cotton yarn to order and can craft this in any bespoke colorway or palette you wish. Would you like to see our seasonal shade card?',
      created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    },
    {
      id: 'demo-msg-6',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'CUSTOMER',
      sender_name: 'Studio Concierge Test',
      message_text: 'Yes please, that would be wonderful. What is the crafting turnaround time?',
      created_at: new Date(Date.now() - 20 * 60000).toISOString(),
    },
    {
      id: 'demo-msg-7',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'ADMIN',
      sender_name: 'Studio Artisan',
      message_text: 'Custom arrangements typically spend 48 to 72 hours in our master florist queue, after which they are packaged in our signature keepsake box.',
      created_at: new Date(Date.now() - 18 * 60000).toISOString(),
    },
    {
      id: 'demo-msg-8',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'CUSTOMER',
      sender_name: 'Studio Concierge Test',
      message_text: 'How does the gift packaging look? Is a wax seal included?',
      created_at: new Date(Date.now() - 15 * 60000).toISOString(),
    },
    {
      id: 'demo-msg-9',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'ADMIN',
      sender_name: 'Studio Artisan',
      message_text: 'All bespoke bouquets arrive in our signature kraft floral box, nestled in tissue, and accompanied by a botanical parchment card with our wax seal.',
      created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    },
    {
      id: 'demo-msg-10',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'CUSTOMER',
      sender_name: 'Studio Concierge Test',
      message_text: 'Superb! I have placed the order on the storefront now. My phone is +919931653303.',
      created_at: new Date(Date.now() - 8 * 60000).toISOString(),
    },
    {
      id: 'demo-msg-11',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'ADMIN',
      sender_name: 'Studio Artisan',
      message_text: 'Your order is currently with our master florists in the crafting queue. Each petal is delicately hand-crocheted and inspected before careful boxing.',
      created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    },
    {
      id: 'demo-msg-12',
      conversation_id: 'demo-welcome-conv',
      sender_type: 'CUSTOMER',
      sender_name: 'Studio Concierge Test',
      message_text: 'Could you craft these crochet roses in French Lilac and Dusty Rose?',
      created_at: new Date(Date.now() - 2 * 60000).toISOString(),
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
    const rawConvId = payload.conversation_id || conversationId;

    if (!rawConvId || !payload.message_text) {
      return res.status(400).json({ error: 'conversation_id and message_text are required' });
    }

    const targetConvId = isValidUUID(rawConvId) ? rawConvId : crypto.randomUUID();
    const cleanText = String(payload.message_text).trim().slice(0, 2000);
    const msgId = isValidUUID(payload.id) ? payload.id : crypto.randomUUID();

    const newMsg: ServerMessage = {
      id: msgId,
      conversation_id: targetConvId,
      sender_type: payload.sender_type || 'CUSTOMER',
      sender_name: payload.sender_name || 'Visitor',
      message_text: cleanText,
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
      conv.last_message_preview = cleanText;
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
        subject: cleanText.slice(0, 50),
        status: newMsg.sender_type === 'CUSTOMER' ? 'PENDING_ADMIN' : 'REPLIED',
        last_message_preview: cleanText,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    try {
      const { error: insertErr } = await supabaseAdmin.from('assistance_messages').insert({
        id: newMsg.id,
        conversation_id: newMsg.conversation_id,
        sender_type: newMsg.sender_type,
        sender_name: newMsg.sender_name,
        message_text: newMsg.message_text,
        created_at: newMsg.created_at,
      });

      if (insertErr) {
        console.warn('[assistance_messages DB insert error]:', insertErr.message);
      }

      await supabaseAdmin
        .from('assistance_conversations')
        .update({
          last_message_preview: newMsg.message_text,
          last_message_at: newMsg.created_at,
          status: newMsg.sender_type === 'CUSTOMER' ? 'PENDING_ADMIN' : 'REPLIED',
        })
        .eq('id', targetConvId);
    } catch (err: any) {
      console.warn('[assistance_messages DB exception]:', err?.message || err);
    }

    return res.status(200).json({ success: true, message: newMsg });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
