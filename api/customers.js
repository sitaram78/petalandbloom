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

// src/services/loyaltyService.ts
function resolveLoyaltyTier(lifetimePoints) {
  const points = Math.max(0, lifetimePoints || 0);
  if (points >= 1500) return "HEIRLOOM";
  if (points >= 500) return "BLOSSOM";
  return "FLORET";
}

// server/handlers/admin/customers/adjust-points.ts
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  const authUser = await requireAuth(req, res, {
    requiredPermission: "customers.adjust_points"
  });
  if (!authUser) return;
  try {
    const { customerId, pointsDelta, pointsType = "ADD", reason } = req.body || {};
    if (!customerId || pointsDelta === void 0 || pointsDelta === null) {
      return res.status(400).json({ success: false, message: "customerId and pointsDelta are required." });
    }
    const rawDelta = Math.abs(Number(pointsDelta) || 0);
    if (rawDelta === 0) {
      return res.status(400).json({ success: false, message: "Points adjustment must be greater than zero." });
    }
    const delta = pointsType === "ADD" ? rawDelta : -rawDelta;
    const noteText = reason?.trim() || `Administrative points adjustment (${pointsType}) by ${authUser.email}`;
    const { data: acc } = await supabaseAdmin.from("loyalty_accounts").select("points_balance, lifetime_points_earned, tier").eq("customer_id", customerId).maybeSingle();
    const oldBalance = acc?.points_balance || 0;
    const oldLifetime = acc?.lifetime_points_earned || 0;
    const oldTier = acc?.tier || "FLORET";
    const newBalance = Math.max(0, oldBalance + delta);
    const newLifetime = pointsType === "ADD" ? oldLifetime + delta : oldLifetime;
    const newTier = resolveLoyaltyTier(newLifetime);
    await supabaseAdmin.from("loyalty_transactions").insert({
      customer_id: customerId,
      type: pointsType === "ADD" ? "ADMIN_CREDIT" : "ADMIN_DEBIT",
      points: delta,
      description: noteText
    });
    if (acc) {
      await supabaseAdmin.from("loyalty_accounts").update({
        points_balance: newBalance,
        lifetime_points_earned: newLifetime,
        tier: newTier,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("customer_id", customerId);
    } else {
      await supabaseAdmin.from("loyalty_accounts").insert({
        customer_id: customerId,
        points_balance: newBalance,
        lifetime_points_earned: newLifetime,
        tier: newTier
      });
    }
    await logAuditEvent({
      actor_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.role,
      action: AUDIT_ACTIONS.POINTS_ADJUSTED,
      entity: "loyalty_accounts",
      entity_id: customerId,
      old_values: { points_balance: oldBalance, tier: oldTier },
      new_values: {
        points_balance: newBalance,
        lifetime_points_earned: newLifetime,
        tier: newTier,
        delta,
        type: pointsType
      },
      reason: noteText
    });
    return res.status(200).json({
      success: true,
      pointsBalance: newBalance,
      lifetimePoints: newLifetime,
      tier: newTier,
      message: `Successfully adjusted points. New balance: ${newBalance} Petal Points.`
    });
  } catch (err) {
    console.error("[Admin Points Adjustment Error]:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to adjust points." });
  }
}

// server/api/customers.ts
async function handler2(req, res) {
  return handler(req, res);
}
export {
  handler2 as default
};
