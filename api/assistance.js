// server/handlers/assistance/conversations.ts
import crypto from "node:crypto";

// server/lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
function loadEnvIfMissing() {
  if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx !== -1) {
          const k = trimmed.slice(0, idx).trim();
          let v = trimmed.slice(idx + 1).trim();
          if (v.startsWith('"') && v.endsWith('"') || v.startsWith("'") && v.endsWith("'")) {
            v = v.slice(1, -1);
          }
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[Supabase Server] Could not read .env file:", e);
  }
}
loadEnvIfMissing();
var _adminClient = null;
function getSupabaseAdmin() {
  if (_adminClient) return _adminClient;
  loadEnvIfMissing();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase credentials missing: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) must be defined.");
  }
  _adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  return _adminClient;
}
var supabaseAdmin = new Proxy({}, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  }
});

// server/handlers/assistance/conversations.ts
function isValidUUID(val) {
  if (!val || typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}
var conversationsCache = [
  {
    id: "demo-welcome-conv",
    customer_id: null,
    customer_name: "Studio Concierge Test",
    customer_phone: "+919931653303",
    customer_email: "guest@thepetalandbloom.com",
    subject: "Bespoke bouquet color palette request",
    status: "OPEN",
    last_message_preview: "Could you craft these crochet roses in French Lilac and Dusty Rose?",
    last_message_at: new Date(Date.now() - 5 * 6e4).toISOString(),
    created_at: new Date(Date.now() - 60 * 6e4).toISOString()
  },
  {
    id: "conv-ananya-roy",
    customer_id: null,
    customer_name: "Ananya Roy",
    customer_phone: "+919876543210",
    customer_email: "ananya.roy@example.com",
    subject: "Anniversary gift dispatch timeline",
    status: "PENDING_ADMIN",
    last_message_preview: "Hi! Can I get guaranteed delivery to Bangalore by Friday?",
    last_message_at: new Date(Date.now() - 15 * 6e4).toISOString(),
    created_at: new Date(Date.now() - 120 * 6e4).toISOString()
  },
  {
    id: "conv-priya-sharma",
    customer_id: null,
    customer_name: "Priya Sharma",
    customer_phone: "+919811223344",
    customer_email: "priya.sharma@example.com",
    subject: "Custom palette for wedding centerpieces",
    status: "REPLIED",
    last_message_preview: "We have dispatched our seasonal shade card to your email.",
    last_message_at: new Date(Date.now() - 45 * 6e4).toISOString(),
    created_at: new Date(Date.now() - 180 * 6e4).toISOString()
  },
  {
    id: "conv-rohit-mehta",
    customer_id: null,
    customer_name: "Rohit Mehta",
    customer_phone: "+919922334455",
    customer_email: "rohit.m@example.com",
    subject: "Care and dusting instructions",
    status: "RESOLVED",
    last_message_preview: "Thank you so much! The bouquet looks marvelous on our mantle.",
    last_message_at: new Date(Date.now() - 180 * 6e4).toISOString(),
    created_at: new Date(Date.now() - 360 * 6e4).toISOString()
  }
];
function getConversationsCache() {
  return conversationsCache;
}
async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin.from("assistance_conversations").select("*").order("last_message_at", { ascending: false });
      if (!error && data && data.length > 0) {
        conversationsCache = data;
      }
    } catch {
    }
    return res.status(200).json({ success: true, conversations: conversationsCache });
  }
  if (req.method === "POST") {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const convId = isValidUUID(payload.id) ? payload.id : crypto.randomUUID();
    const newConv = {
      id: convId,
      customer_id: payload.customer_id || null,
      customer_name: payload.customer_name || "Guest Visitor",
      customer_phone: payload.customer_phone || null,
      customer_email: payload.customer_email || null,
      subject: payload.subject || "Atelier Enquiry",
      status: payload.status || "PENDING_ADMIN",
      last_message_preview: payload.last_message_preview || "",
      last_message_at: (/* @__PURE__ */ new Date()).toISOString(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const existingIdx = conversationsCache.findIndex((c) => c.id === newConv.id);
    if (existingIdx !== -1) {
      conversationsCache[existingIdx] = {
        ...conversationsCache[existingIdx],
        ...payload,
        last_message_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    } else {
      conversationsCache.unshift(newConv);
    }
    try {
      await supabaseAdmin.from("assistance_conversations").upsert(newConv, { onConflict: "id" });
    } catch {
    }
    return res.status(200).json({ success: true, conversation: newConv });
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// server/handlers/assistance/messages.ts
import crypto2 from "node:crypto";
function isValidUUID2(val) {
  if (!val || typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}
var messagesCache = {
  "demo-welcome-conv": [
    {
      id: "demo-msg-1",
      conversation_id: "demo-welcome-conv",
      sender_type: "BOT",
      sender_name: "Atelier Concierge",
      message_text: "Welcome to The Petal & Bloom! How may we assist you with our bespoke floral pieces today?",
      created_at: new Date(Date.now() - 40 * 6e4).toISOString()
    },
    {
      id: "demo-msg-2",
      conversation_id: "demo-welcome-conv",
      sender_type: "CUSTOMER",
      sender_name: "Studio Concierge Test",
      message_text: "Hello! I love the handcrafted heirloom roses. Are these 100% cotton yarn?",
      created_at: new Date(Date.now() - 38 * 6e4).toISOString()
    },
    {
      id: "demo-msg-3",
      conversation_id: "demo-welcome-conv",
      sender_type: "ADMIN",
      sender_name: "Studio Artisan",
      message_text: "Namaste! Yes indeed, all our botanical stems are crocheted using 100% combed cotton yarn for lifelong vibrancy and zero fading.",
      created_at: new Date(Date.now() - 35 * 6e4).toISOString()
    },
    {
      id: "demo-msg-4",
      conversation_id: "demo-welcome-conv",
      sender_type: "CUSTOMER",
      sender_name: "Studio Concierge Test",
      message_text: "That sounds delightful! Can you customize the bouquet with French Lilac and Dusty Rose shades?",
      created_at: new Date(Date.now() - 30 * 6e4).toISOString()
    },
    {
      id: "demo-msg-5",
      conversation_id: "demo-welcome-conv",
      sender_type: "ADMIN",
      sender_name: "Studio Artisan",
      message_text: "We dye our 100% combed cotton yarn to order and can craft this in any bespoke colorway or palette you wish. Would you like to see our seasonal shade card?",
      created_at: new Date(Date.now() - 25 * 6e4).toISOString()
    },
    {
      id: "demo-msg-6",
      conversation_id: "demo-welcome-conv",
      sender_type: "CUSTOMER",
      sender_name: "Studio Concierge Test",
      message_text: "Yes please, that would be wonderful. What is the crafting turnaround time?",
      created_at: new Date(Date.now() - 20 * 6e4).toISOString()
    },
    {
      id: "demo-msg-7",
      conversation_id: "demo-welcome-conv",
      sender_type: "ADMIN",
      sender_name: "Studio Artisan",
      message_text: "Custom arrangements typically spend 48 to 72 hours in our master florist queue, after which they are packaged in our signature keepsake box.",
      created_at: new Date(Date.now() - 18 * 6e4).toISOString()
    },
    {
      id: "demo-msg-8",
      conversation_id: "demo-welcome-conv",
      sender_type: "CUSTOMER",
      sender_name: "Studio Concierge Test",
      message_text: "How does the gift packaging look? Is a wax seal included?",
      created_at: new Date(Date.now() - 15 * 6e4).toISOString()
    },
    {
      id: "demo-msg-9",
      conversation_id: "demo-welcome-conv",
      sender_type: "ADMIN",
      sender_name: "Studio Artisan",
      message_text: "All bespoke bouquets arrive in our signature kraft floral box, nestled in tissue, and accompanied by a botanical parchment card with our wax seal.",
      created_at: new Date(Date.now() - 12 * 6e4).toISOString()
    },
    {
      id: "demo-msg-10",
      conversation_id: "demo-welcome-conv",
      sender_type: "CUSTOMER",
      sender_name: "Studio Concierge Test",
      message_text: "Superb! I have placed the order on the storefront now. My phone is +919931653303.",
      created_at: new Date(Date.now() - 8 * 6e4).toISOString()
    },
    {
      id: "demo-msg-11",
      conversation_id: "demo-welcome-conv",
      sender_type: "ADMIN",
      sender_name: "Studio Artisan",
      message_text: "Your order is currently with our master florists in the crafting queue. Each petal is delicately hand-crocheted and inspected before careful boxing.",
      created_at: new Date(Date.now() - 5 * 6e4).toISOString()
    },
    {
      id: "demo-msg-12",
      conversation_id: "demo-welcome-conv",
      sender_type: "CUSTOMER",
      sender_name: "Studio Concierge Test",
      message_text: "Could you craft these crochet roses in French Lilac and Dusty Rose?",
      created_at: new Date(Date.now() - 2 * 6e4).toISOString()
    }
  ]
};
async function handler2(req, res) {
  res.setHeader("Content-Type", "application/json");
  const parsedUrl = new URL(req.url, "http://localhost:5173");
  const conversationId = parsedUrl.searchParams.get("conversation_id");
  if (req.method === "GET") {
    if (!conversationId) {
      return res.status(400).json({ error: "conversation_id is required" });
    }
    try {
      const { data, error } = await supabaseAdmin.from("assistance_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
      if (!error && data && data.length > 0) {
        messagesCache[conversationId] = data;
      }
    } catch {
    }
    const convMessages = messagesCache[conversationId] || [];
    return res.status(200).json({ success: true, messages: convMessages });
  }
  if (req.method === "POST") {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const rawConvId = payload.conversation_id || conversationId;
    if (!rawConvId || !payload.message_text) {
      return res.status(400).json({ error: "conversation_id and message_text are required" });
    }
    const targetConvId = isValidUUID2(rawConvId) ? rawConvId : crypto2.randomUUID();
    const cleanText = String(payload.message_text).trim().slice(0, 2e3);
    const msgId = isValidUUID2(payload.id) ? payload.id : crypto2.randomUUID();
    const newMsg = {
      id: msgId,
      conversation_id: targetConvId,
      sender_type: payload.sender_type || "CUSTOMER",
      sender_name: payload.sender_name || "Visitor",
      message_text: cleanText,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!messagesCache[targetConvId]) {
      messagesCache[targetConvId] = [];
    }
    messagesCache[targetConvId].push(newMsg);
    const convList = getConversationsCache();
    const conv = convList.find((c) => c.id === targetConvId);
    if (conv) {
      conv.last_message_preview = cleanText;
      conv.last_message_at = (/* @__PURE__ */ new Date()).toISOString();
      if (newMsg.sender_type === "CUSTOMER") {
        conv.status = "PENDING_ADMIN";
      } else if (newMsg.sender_type === "ADMIN") {
        conv.status = "REPLIED";
      }
    } else {
      convList.unshift({
        id: targetConvId,
        customer_id: null,
        customer_name: newMsg.sender_name || "Customer",
        customer_phone: null,
        customer_email: null,
        subject: cleanText.slice(0, 50),
        status: newMsg.sender_type === "CUSTOMER" ? "PENDING_ADMIN" : "REPLIED",
        last_message_preview: cleanText,
        last_message_at: (/* @__PURE__ */ new Date()).toISOString(),
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    try {
      const { error: insertErr } = await supabaseAdmin.from("assistance_messages").insert({
        id: newMsg.id,
        conversation_id: newMsg.conversation_id,
        sender_type: newMsg.sender_type,
        sender_name: newMsg.sender_name,
        message_text: newMsg.message_text,
        created_at: newMsg.created_at
      });
      if (insertErr) {
        console.warn("[assistance_messages DB insert error]:", insertErr.message);
      }
      await supabaseAdmin.from("assistance_conversations").update({
        last_message_preview: newMsg.message_text,
        last_message_at: newMsg.created_at,
        status: newMsg.sender_type === "CUSTOMER" ? "PENDING_ADMIN" : "REPLIED"
      }).eq("id", targetConvId);
    } catch (err) {
      console.warn("[assistance_messages DB exception]:", err?.message || err);
    }
    return res.status(200).json({ success: true, message: newMsg });
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// server/api/assistance.ts
async function handler3(req, res) {
  const url = req.url || "";
  const pathname = url.split("?")[0];
  if (pathname.includes("/messages")) {
    return handler2(req, res);
  }
  return handler(req, res);
}
export {
  handler3 as default
};
