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

// server/lib/auditService.ts
var AUDIT_ACTIONS = {
  ORDER_STATUS_TRANSITION: "ORDER_STATUS_TRANSITION",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  PAYMENT_REFUNDED: "PAYMENT_REFUNDED",
  POINTS_ADJUSTED: "POINTS_ADJUSTED",
  PRODUCT_PRICE_CHANGED: "PRODUCT_PRICE_CHANGED",
  PRODUCT_DEACTIVATED: "PRODUCT_DEACTIVATED",
  COUPON_CREATED: "COUPON_CREATED",
  COUPON_RATE_MODIFIED: "COUPON_RATE_MODIFIED",
  CUSTOMER_PII_EXPORTED: "CUSTOMER_PII_EXPORTED",
  STAFF_ROLE_MODIFIED: "STAFF_ROLE_MODIFIED",
  REVIEW_MODERATED: "REVIEW_MODERATED",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
  INFLUENCER_PAYOUT_RECORDED: "INFLUENCER_PAYOUT_RECORDED"
};
var localAuditCache = [];
async function logAuditEvent(entry) {
  const cachedItem = {
    ...entry,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  };
  localAuditCache.unshift(cachedItem);
  if (localAuditCache.length > 500) {
    localAuditCache.pop();
  }
  try {
    const { error } = await supabaseAdmin.from("audit_logs").insert([entry]);
    if (error) {
      const fallbackPayload = {
        actor_id: entry.actor_id || null,
        actor_role: entry.actor_role || "admin",
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entity_id,
        details: {
          actor_email: entry.actor_email,
          old_values: entry.old_values,
          new_values: entry.new_values,
          reason: entry.reason,
          user_agent: entry.user_agent,
          ip_address: entry.ip_address
        },
        ip_address: entry.ip_address || null
      };
      const { error: fallbackError } = await supabaseAdmin.from("audit_logs").insert([fallbackPayload]);
      if (fallbackError) {
        console.warn("[Audit] Fallback insertion to audit_logs failed:", fallbackError.message);
      }
    }
  } catch (error) {
    console.warn("[Audit] Exception while inserting audit log:", error?.message || error);
  }
}

// server/lib/authMiddleware.ts
var ROLE_DEFAULT_PERMISSIONS = {
  super_admin: ["*"],
  admin: [
    "orders.read",
    "orders.update_status",
    "orders.assign_carrier",
    "orders.cancel",
    "customers.read",
    "customers.adjust_points",
    "messages.manage",
    "reviews.moderate",
    "products.read",
    "products.write",
    "products.delete",
    "inventory.adjust",
    "coupons.manage",
    "influencers.manage",
    "analytics.read",
    "assets.manage",
    "navigation.manage",
    "settings.manage",
    "audit.read",
    "staff.manage"
  ],
  operations: [
    "orders.read",
    "orders.update_status",
    "orders.assign_carrier",
    "orders.cancel",
    "products.read",
    "products.write",
    "inventory.adjust",
    "assets.manage",
    "navigation.manage"
  ],
  support: [
    "orders.read",
    "customers.read",
    "customers.adjust_points",
    "products.read",
    "messages.manage",
    "reviews.moderate"
  ],
  marketing: [
    "analytics.read",
    "coupons.manage",
    "influencers.manage",
    "assets.manage",
    "products.read"
  ],
  customer: []
};
async function verifyAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return {
      user: null,
      error: "Authentication required. Missing Authorization header.",
      status: 401
    };
  }
  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return {
      user: null,
      error: 'Invalid Authorization header format. Expected "Bearer <token>".',
      status: 401
    };
  }
  const token = parts[1];
  if (!token) {
    return {
      user: null,
      error: "Empty authentication token provided.",
      status: 401
    };
  }
  try {
    let authUser = null;
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return {
        user: null,
        error: error?.message || "Invalid, expired, or untrusted session token.",
        status: 401
      };
    }
    authUser = data.user;
    let profile = null;
    try {
      const { data: profData } = await supabaseAdmin.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
      profile = profData;
    } catch (profErr) {
      console.warn("[Auth Middleware] Profile lookup warning:", profErr);
    }
    const email = (authUser.email || profile?.email || "").toLowerCase().trim();
    const isFounder = ["admin@thepetalandbloom.in", "sitaramnayak8763@gmail.com"].includes(email);
    const metaRole = authUser.app_metadata?.role;
    const dbRole = profile?.role;
    let role = "customer";
    if (isFounder) {
      role = "super_admin";
    } else if (dbRole && dbRole !== "admin") {
      role = dbRole;
    } else if (metaRole) {
      role = metaRole;
    } else if (dbRole) {
      role = dbRole;
    } else if (authUser.user_metadata?.role) {
      role = authUser.user_metadata.role;
    }
    const customPermissions = [
      ...Array.isArray(profile?.permissions) ? profile.permissions : [],
      ...Array.isArray(authUser.app_metadata?.permissions) ? authUser.app_metadata.permissions : [],
      ...Array.isArray(authUser.user_metadata?.permissions) ? authUser.user_metadata.permissions : []
    ];
    return {
      user: {
        id: authUser.id,
        email: email || authUser.email || profile?.email || "",
        role,
        permissions: Array.from(new Set(customPermissions)),
        full_name: profile?.full_name || authUser.user_metadata?.full_name,
        phone: profile?.phone || authUser.user_metadata?.phone
      },
      status: 200
    };
  } catch (err) {
    console.error("[Auth Middleware Verification Exception]:", err);
    return {
      user: null,
      error: "Authentication verification service error.",
      status: 500
    };
  }
}
async function requireAuth(req, res, options) {
  const result = await verifyAuth(req);
  if (!result.user) {
    const errorMsg = result.error || "Authentication required.";
    res.status(result.status).json({
      success: false,
      message: errorMsg,
      error: errorMsg
    });
    return null;
  }
  const { user } = result;
  if (user.role === "super_admin") {
    return user;
  }
  if (options?.requireSuperAdmin) {
    const errorMsg = "Forbidden: This action requires Super Admin privileges.";
    res.status(403).json({
      success: false,
      message: errorMsg,
      error: errorMsg
    });
    return null;
  }
  if (options?.requiredPermission) {
    const hasCustomPerms = Array.isArray(user.permissions) && user.permissions.length > 0;
    const effectivePermissions = hasCustomPerms ? user.permissions : ROLE_DEFAULT_PERMISSIONS[user.role] || [];
    const hasPerm = effectivePermissions.includes("*") || effectivePermissions.includes(options.requiredPermission);
    if (!hasPerm) {
      const errorMsg = `Forbidden: Missing required capability permission "${options.requiredPermission}".`;
      res.status(403).json({
        success: false,
        message: errorMsg,
        error: errorMsg
      });
      return null;
    }
  }
  if (options?.allowedRoles && options.allowedRoles.length > 0) {
    if (!options.allowedRoles.includes(user.role)) {
      const errorMsg = `Forbidden: User role "${user.role}" does not have permission to perform this action.`;
      res.status(403).json({
        success: false,
        message: errorMsg,
        error: errorMsg
      });
      return null;
    }
  }
  return user;
}

// server/handlers/audit/list.ts
async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const authUser = await requireAuth(req, res, {
    allowedRoles: ["super_admin", "admin", "operations", "support"]
  });
  if (!authUser) return;
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const action = req.query.action;
    const entity = req.query.entity;
    const entity_id = req.query.entity_id;
    const actor_id = req.query.actor_id;
    const from = req.query.from;
    const to = req.query.to;
    const search = req.query.search;
    let dbLogs = [];
    try {
      let query = supabaseAdmin.from("audit_logs").select("*");
      if (action) query = query.eq("action", action);
      if (entity) query = query.eq("entity", entity);
      if (entity_id) query = query.eq("entity_id", entity_id);
      if (actor_id) query = query.eq("actor_id", actor_id);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
      if (!error && data) {
        dbLogs = data.map((row) => ({
          id: row.id,
          created_at: row.created_at,
          actor_id: row.actor_id,
          actor_role: row.actor_role || "admin",
          actor_email: row.actor_email || row.details?.actor_email || null,
          action: row.action,
          entity: row.entity,
          entity_id: row.entity_id,
          old_values: row.old_values || row.details?.old_values || null,
          new_values: row.new_values || row.details?.new_values || null,
          reason: row.reason || row.details?.reason || null,
          ip_address: row.ip_address || null,
          user_agent: row.user_agent || row.details?.user_agent || null
        }));
      }
    } catch (dbErr) {
      console.warn("[Audit List] DB query failed, relying on local cache:", dbErr);
    }
    const seenIds = new Set(dbLogs.map((l) => l.id));
    const cachedItems = localAuditCache.filter((c) => !seenIds.has(c.id)).map((c) => ({
      id: c.id,
      created_at: c.created_at,
      actor_id: c.actor_id || null,
      actor_role: c.actor_role || "admin",
      actor_email: c.actor_email || null,
      action: c.action,
      entity: c.entity,
      entity_id: c.entity_id,
      old_values: c.old_values || null,
      new_values: c.new_values || null,
      reason: c.reason || null,
      ip_address: c.ip_address || null,
      user_agent: c.user_agent || null
    }));
    let allLogs = [...cachedItems, ...dbLogs];
    if (action) allLogs = allLogs.filter((l) => l.action === action);
    if (entity) allLogs = allLogs.filter((l) => l.entity === entity);
    if (entity_id) allLogs = allLogs.filter((l) => l.entity_id === entity_id);
    if (actor_id) allLogs = allLogs.filter((l) => l.actor_id === actor_id);
    if (from) allLogs = allLogs.filter((l) => new Date(l.created_at) >= new Date(from));
    if (to) allLogs = allLogs.filter((l) => new Date(l.created_at) <= new Date(to));
    if (search) {
      const s = search.toLowerCase();
      allLogs = allLogs.filter(
        (l) => l.entity_id && l.entity_id.toLowerCase().includes(s) || l.action && l.action.toLowerCase().includes(s) || l.reason && l.reason.toLowerCase().includes(s) || l.actor_email && l.actor_email.toLowerCase().includes(s)
      );
    }
    allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const total = allLogs.length;
    const paginated = allLogs.slice(offset, offset + limit);
    return res.status(200).json({
      logs: paginated,
      total,
      page,
      limit
    });
  } catch (error) {
    console.error("[Audit List] Error handler:", error);
    return res.status(500).json({ error: "Failed to retrieve audit records", message: error.message });
  }
}

// server/handlers/audit/log.ts
async function handler2(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const authUser = await requireAuth(req, res, { allowedRoles: ["super_admin", "admin", "operations", "support"] });
  if (!authUser) return;
  try {
    const {
      action,
      entity,
      entity_id,
      old_values,
      new_values,
      reason
    } = req.body;
    if (!action || !entity || !entity_id) {
      return res.status(400).json({ error: "action, entity, and entity_id are required" });
    }
    const validActions = Object.values(AUDIT_ACTIONS);
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: `Invalid action: ${action}` });
    }
    await logAuditEvent({
      actor_id: authUser.id,
      actor_role: authUser.role,
      actor_email: authUser.email,
      action,
      entity,
      entity_id,
      old_values: old_values || null,
      new_values: new_values || null,
      reason: reason || void 0,
      ip_address: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || void 0,
      user_agent: req.headers["user-agent"] || void 0
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to log audit event:", error);
    return res.status(500).json({ error: "Failed to log audit event" });
  }
}

// server/api/audit.ts
async function handler3(req, res) {
  const url = req.url || "";
  const pathname = url.split("?")[0];
  if (pathname.includes("/log")) {
    return handler2(req, res);
  }
  return handler(req, res);
}
export {
  handler3 as default
};
