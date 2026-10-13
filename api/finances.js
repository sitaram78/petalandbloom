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

// server/handlers/admin/materials/index.ts
var VALID_MATERIAL_TYPES = ["YARN", "PIPE_CLEANER", "FLORAL_WIRE", "PACKAGING", "TOOLS", "OTHER"];
var VALID_COLORS = ["RED", "GREEN", "PINK", "WHITE", "PURPLE", "YELLOW", "BLUE", "OTHER"];
async function handler(req, res) {
  const authUser = await requireAuth(req, res, {
    allowedRoles: ["super_admin", "admin", "operations", "marketing"]
  });
  if (!authUser) return;
  if (req.method === "GET") {
    return handleGetMaterials(req, res);
  } else if (req.method === "POST") {
    return handleCreateMaterial(req, res, authUser);
  } else if (req.method === "DELETE") {
    return handleDeleteMaterial(req, res, authUser);
  } else {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
}
async function handleGetMaterials(req, res) {
  try {
    const range = typeof req.query.range === "string" ? req.query.range : "all";
    const materialType = typeof req.query.type === "string" ? req.query.type : void 0;
    let query = supabaseAdmin.from("raw_material_procurements").select("*").order("purchase_date", { ascending: false }).order("created_at", { ascending: false });
    if (materialType && VALID_MATERIAL_TYPES.includes(materialType)) {
      query = query.eq("material_type", materialType);
    }
    if (range !== "all") {
      const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString().slice(0, 10);
      query = query.gte("purchase_date", cutoff);
    }
    const { data: procurements, error } = await query;
    if (error) {
      console.error("[Materials API] Error fetching procurements:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch material procurements: " + error.message });
    }
    const items = procurements || [];
    let totalSpendPaise = 0;
    const byType = {};
    const byColor = {};
    VALID_MATERIAL_TYPES.forEach((t) => {
      byType[t] = 0;
    });
    VALID_COLORS.forEach((c) => {
      byColor[c] = 0;
    });
    for (const item of items) {
      const price = Number(item.price_in_paise) || 0;
      totalSpendPaise += price;
      const t = item.material_type || "OTHER";
      byType[t] = (byType[t] || 0) + price;
      const c = item.color_family || "OTHER";
      byColor[c] = (byColor[c] || 0) + price;
    }
    return res.status(200).json({
      success: true,
      procurements: items,
      totalCount: items.length,
      totalSpendPaise,
      totalSpendRupees: Math.round(totalSpendPaise / 100),
      byType,
      byColor
    });
  } catch (err) {
    console.error("[Materials API] Unexpected GET error:", err);
    return res.status(500).json({ success: false, message: "Internal server error: " + err.message });
  }
}
async function handleCreateMaterial(req, res, authUser) {
  try {
    const {
      material_type,
      color_family = "OTHER",
      description,
      quantity_label,
      price_in_paise,
      purchase_date,
      vendor_name,
      notes
    } = req.body || {};
    if (!material_type || !VALID_MATERIAL_TYPES.includes(material_type)) {
      return res.status(400).json({ success: false, message: "Invalid or missing material_type." });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ success: false, message: "Description is required." });
    }
    if (!quantity_label || typeof quantity_label !== "string" || !quantity_label.trim()) {
      return res.status(400).json({ success: false, message: "Quantity / weight is required (e.g. 100gm, 100 pcs)." });
    }
    const priceNum = Number(price_in_paise);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ success: false, message: "Valid positive price_in_paise is required." });
    }
    const dateStr = purchase_date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const newRecord = {
      material_type,
      color_family: VALID_COLORS.includes(color_family) ? color_family : "OTHER",
      description: description.trim(),
      quantity_label: quantity_label.trim(),
      price_in_paise: Math.round(priceNum),
      purchase_date: dateStr,
      vendor_name: vendor_name?.trim() || null,
      notes: notes?.trim() || null
    };
    const { data, error } = await supabaseAdmin.from("raw_material_procurements").insert(newRecord).select().single();
    if (error) {
      console.error("[Materials API] Insert error:", error);
      return res.status(500).json({ success: false, message: "Failed to record procurement: " + error.message });
    }
    await logAuditEvent({
      actor_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.role,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entity: "raw_material_procurements",
      entity_id: data.id,
      new_values: newRecord,
      reason: `Procured ${newRecord.description} (${newRecord.quantity_label}) for \u20B9${(newRecord.price_in_paise / 100).toFixed(2)}`
    });
    return res.status(201).json({
      success: true,
      procurement: data,
      message: "Raw material procurement logged successfully."
    });
  } catch (err) {
    console.error("[Materials API] Unexpected POST error:", err);
    return res.status(500).json({ success: false, message: "Internal server error: " + err.message });
  }
}
async function handleDeleteMaterial(req, res, authUser) {
  try {
    const id = req.query.id || req.body && req.body.id;
    if (!id) {
      return res.status(400).json({ success: false, message: "Procurement ID is required for deletion." });
    }
    const { data: existing } = await supabaseAdmin.from("raw_material_procurements").select("*").eq("id", id).single();
    const { error: delErr } = await supabaseAdmin.from("raw_material_procurements").delete().eq("id", id);
    if (delErr) {
      console.error("[Materials API] Delete error:", delErr);
      return res.status(500).json({ success: false, message: "Failed to delete procurement: " + delErr.message });
    }
    if (existing) {
      await logAuditEvent({
        actor_id: authUser.id,
        actor_email: authUser.email,
        actor_role: authUser.role,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entity: "raw_material_procurements",
        entity_id: id,
        old_values: existing,
        reason: `Deleted procurement entry: ${existing.description}`
      });
    }
    return res.status(200).json({
      success: true,
      message: "Procurement entry deleted successfully."
    });
  } catch (err) {
    console.error("[Materials API] Unexpected DELETE error:", err);
    return res.status(500).json({ success: false, message: "Internal server error: " + err.message });
  }
}

// server/handlers/admin/materials/summary.ts
async function handler2(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use GET." });
  }
  const authUser = await requireAuth(req, res, {
    allowedRoles: ["super_admin", "admin", "operations", "marketing"]
  });
  if (!authUser) return;
  try {
    const range = typeof req.query.range === "string" ? req.query.range : "all";
    let ordersQuery = supabaseAdmin.from("orders").select("id, order_number, total_in_paise, subtotal_in_paise, discount_in_paise, order_status, payment_status, created_at").neq("order_status", "CANCELLED");
    let procurementsQuery = supabaseAdmin.from("raw_material_procurements").select("*").order("purchase_date", { ascending: true });
    if (range !== "all") {
      const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString();
      const cutoffDate = cutoff.slice(0, 10);
      ordersQuery = ordersQuery.gte("created_at", cutoff);
      procurementsQuery = procurementsQuery.gte("purchase_date", cutoffDate);
    }
    const [
      { data: ordersData, error: ordersErr },
      { data: procurementsData, error: procurementsErr }
    ] = await Promise.all([ordersQuery, procurementsQuery]);
    if (ordersErr) {
      console.error("[Financial Summary] Orders fetch error:", ordersErr);
      return res.status(500).json({ success: false, message: "Failed to fetch sales data: " + ordersErr.message });
    }
    if (procurementsErr) {
      console.error("[Financial Summary] Procurements fetch error:", procurementsErr);
      return res.status(500).json({ success: false, message: "Failed to fetch procurements: " + procurementsErr.message });
    }
    const orders = ordersData || [];
    const procurements = procurementsData || [];
    const totalSalesPaise = orders.reduce((sum, o) => sum + (Number(o.total_in_paise) || 0), 0);
    const totalOrdersCount = orders.length;
    const totalProcurementPaise = procurements.reduce((sum, p) => sum + (Number(p.price_in_paise) || 0), 0);
    const netProfitPaise = totalSalesPaise - totalProcurementPaise;
    const netMarginPercent = totalSalesPaise > 0 ? Number((netProfitPaise / totalSalesPaise * 100).toFixed(1)) : 0;
    const capitalMultiplier = totalProcurementPaise > 0 ? Number((totalSalesPaise / totalProcurementPaise).toFixed(2)) : 0;
    const now = /* @__PURE__ */ new Date();
    let periods = [];
    if (range === "7d") {
      for (let i = 6; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59);
        const label = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        periods.push({ label, fullDate: start.toISOString().slice(0, 10), start, end });
      }
    } else if (range === "30d") {
      const stepDays = 6;
      for (let i = 4; i >= 0; i--) {
        const start = new Date(now.getTime() - (i + 1) * stepDays * 24 * 60 * 60 * 1e3);
        const end = new Date(now.getTime() - i * stepDays * 24 * 60 * 60 * 1e3);
        const label = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        periods.push({ label, fullDate: end.toISOString().slice(0, 10), start, end });
      }
    } else {
      periods = [
        {
          label: "Sep W1",
          fullDate: "Sep 1 \u2013 Sep 7, 2026",
          start: /* @__PURE__ */ new Date("2026-09-01T00:00:00Z"),
          end: /* @__PURE__ */ new Date("2026-09-07T23:59:59Z")
        },
        {
          label: "Sep W2",
          fullDate: "Sep 8 \u2013 Sep 14, 2026",
          start: /* @__PURE__ */ new Date("2026-09-08T00:00:00Z"),
          end: /* @__PURE__ */ new Date("2026-09-14T23:59:59Z")
        },
        {
          label: "Sep W3",
          fullDate: "Sep 15 \u2013 Sep 21, 2026",
          start: /* @__PURE__ */ new Date("2026-09-15T00:00:00Z"),
          end: /* @__PURE__ */ new Date("2026-09-21T23:59:59Z")
        },
        {
          label: "Sep W4",
          fullDate: "Sep 22 \u2013 Sep 30, 2026",
          start: /* @__PURE__ */ new Date("2026-09-22T00:00:00Z"),
          end: /* @__PURE__ */ new Date("2026-09-30T23:59:59Z")
        },
        {
          label: "Oct W1",
          fullDate: "Oct 1 \u2013 Oct 7, 2026",
          start: /* @__PURE__ */ new Date("2026-10-01T00:00:00Z"),
          end: /* @__PURE__ */ new Date("2026-10-07T23:59:59Z")
        },
        {
          label: "Oct (Live)",
          fullDate: "Oct 8 \u2013 Present, 2026",
          start: /* @__PURE__ */ new Date("2026-10-08T00:00:00Z"),
          end: new Date(now.getTime() + 864e5)
        }
      ];
    }
    let cumSalesPaise = 0;
    let cumSpendPaise = 0;
    const trajectory = periods.map((p) => {
      const periodSalesPaise = orders.filter((o) => {
        if (!o.created_at) return false;
        const t = new Date(o.created_at).getTime();
        return t >= p.start.getTime() && t <= p.end.getTime();
      }).reduce((sum, o) => sum + (Number(o.total_in_paise) || 0), 0);
      const periodSpendPaise = procurements.filter((proc) => {
        if (!proc.purchase_date) return false;
        const t = (/* @__PURE__ */ new Date(proc.purchase_date + "T12:00:00Z")).getTime();
        return t >= p.start.getTime() && t <= p.end.getTime();
      }).reduce((sum, proc) => sum + (Number(proc.price_in_paise) || 0), 0);
      cumSalesPaise += periodSalesPaise;
      cumSpendPaise += periodSpendPaise;
      return {
        month: p.label,
        fullDate: p.fullDate,
        salesRupees: Math.round(cumSalesPaise / 100),
        spendRupees: Math.round(cumSpendPaise / 100),
        profitRupees: Math.round((cumSalesPaise - cumSpendPaise) / 100),
        periodSalesRupees: Math.round(periodSalesPaise / 100),
        periodSpendRupees: Math.round(periodSpendPaise / 100),
        periodProfitRupees: Math.round((periodSalesPaise - periodSpendPaise) / 100)
      };
    });
    return res.status(200).json({
      success: true,
      summary: {
        totalSalesPaise,
        totalSalesRupees: Math.round(totalSalesPaise / 100),
        totalOrdersCount,
        totalProcurementPaise,
        totalProcurementRupees: Math.round(totalProcurementPaise / 100),
        netProfitPaise,
        netProfitRupees: Math.round(netProfitPaise / 100),
        netMarginPercent,
        capitalMultiplier,
        trajectory
      }
    });
  } catch (err) {
    console.error("[Financial Summary] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error: " + err.message });
  }
}

// server/api/materials.ts
async function handler3(req, res) {
  const url = req.url || "";
  const pathname = url.split("?")[0];
  if (pathname.includes("/summary")) {
    return handler2(req, res);
  }
  return handler(req, res);
}

// server/api/finances.ts
async function handler4(req, res) {
  return handler3(req, res);
}
export {
  handler4 as default
};
