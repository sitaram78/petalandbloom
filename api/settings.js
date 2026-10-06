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

// server/handlers/settings/store.ts
var DEFAULT_OCCASION_BANNER = {
  enabled: false,
  occasionTitle: "Mother's Day Special",
  marqueeText: "\u{1F338} Celebrate with Everlasting Blooms \xB7 Complimentary Studio Packaging on All Occasion Orders \xB7 Handcrafted with Love",
  couponCode: "MOM15",
  targetUrl: "/shop",
  theme: "rose",
  placement: "both"
};
var DEFAULT_FEATURE_FLAGS = {
  enableLoyalty: true,
  enableCoupons: true,
  enableInfluencerProgram: true,
  enableReviews: true,
  enableLiveChat: true,
  storeMaintenanceMode: false
};
var DEFAULT_BUSINESS_RULES = {
  freeShippingThresholdPaise: 12e4,
  standardShippingFeePaise: 6900,
  expressShippingFeePaise: 4900,
  giftWrapFeePaise: 7900,
  loyaltySpendPerPointPaise: 2e3,
  loyaltyPointRedemptionPaise: 50,
  minLoyaltyOrderPaise: 29900
};
var DEFAULT_SETTINGS = {
  whatsappNumber: "+919931653303",
  supportEmail: "concierge@thepetalandbloom.com",
  instagramHandle: "@thepetalandbloom",
  instagramUrl: "https://instagram.com/thepetalandbloom",
  businessHours: "Monday \u2013 Saturday, 10 AM \u2013 7 PM IST",
  responseTime: "We typically respond within a few hours during business hours.",
  conciergeChannelMode: "WHATSAPP",
  legalBusinessName: "The Petal & Bloom Studio",
  studioAddress: "Handmade Floral Craft Studio, India",
  gstin: "GSTIN-PENDING-UNREGISTERED",
  upiId: "9931657805@ptsbi",
  upiPhone: "9931657805",
  // Logistics
  shiprocketEmail: "",
  shiprocketPassword: "",
  shiprocketPickupLocation: "Atelier Primary Studio",
  delhiveryApiKey: "",
  delhiveryWarehouseName: "Atelier Central Studio",
  logisticsAutomationMode: "AUTOMATED_WITH_CONFIRMATION",
  pickupContactName: "The Petal & Bloom Atelier",
  pickupContactPhone: "9931653303",
  pickupPincode: "560001",
  // 4-Drawer Architecture
  featureFlags: DEFAULT_FEATURE_FLAGS,
  businessRules: DEFAULT_BUSINESS_RULES,
  // Festive & Occasion Sale Label
  occasionBanner: DEFAULT_OCCASION_BANNER
};
var serverCache = { ...DEFAULT_SETTINGS };
async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin.from("store_settings").select("*").eq("id", "primary").maybeSingle();
      if (!error && data) {
        serverCache = {
          ...serverCache,
          whatsappNumber: data.whatsapp_number || serverCache.whatsappNumber,
          supportEmail: data.support_email || serverCache.supportEmail,
          instagramHandle: data.instagram_handle || serverCache.instagramHandle,
          instagramUrl: data.instagram_url || serverCache.instagramUrl,
          businessHours: data.business_hours || serverCache.businessHours,
          responseTime: data.response_time || serverCache.responseTime,
          conciergeChannelMode: data.concierge_channel_mode || serverCache.conciergeChannelMode,
          legalBusinessName: data.legal_business_name || serverCache.legalBusinessName,
          studioAddress: data.studio_address || serverCache.studioAddress,
          gstin: data.gstin || serverCache.gstin,
          upiId: data.upi_id || serverCache.upiId,
          upiPhone: data.upi_phone || serverCache.upiPhone,
          shiprocketEmail: data.shiprocket_email || serverCache.shiprocketEmail,
          shiprocketPassword: data.shiprocket_password || serverCache.shiprocketPassword,
          shiprocketPickupLocation: data.shiprocket_pickup_location || serverCache.shiprocketPickupLocation,
          delhiveryApiKey: data.delhivery_api_key || serverCache.delhiveryApiKey,
          delhiveryWarehouseName: data.delhivery_warehouse_name || serverCache.delhiveryWarehouseName,
          logisticsAutomationMode: data.logistics_automation_mode || serverCache.logisticsAutomationMode,
          pickupContactName: data.pickup_contact_name || serverCache.pickupContactName,
          pickupContactPhone: data.pickup_contact_phone || serverCache.pickupContactPhone,
          pickupPincode: data.pickup_pincode || serverCache.pickupPincode,
          featureFlags: data.feature_flags ? { ...DEFAULT_FEATURE_FLAGS, ...data.feature_flags } : serverCache.featureFlags,
          businessRules: data.business_rules ? { ...DEFAULT_BUSINESS_RULES, ...data.business_rules } : serverCache.businessRules,
          occasionBanner: data.occasion_banner ? { ...DEFAULT_OCCASION_BANNER, ...data.occasion_banner } : serverCache.occasionBanner
        };
      }
    } catch (err) {
    }
    let isStaff = false;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader) {
      try {
        const auth = await verifyAuth(req);
        if (auth.user && ["super_admin", "admin", "operations"].includes(auth.user.role)) {
          isStaff = true;
        }
      } catch {
      }
    }
    if (isStaff) {
      return res.status(200).json({ success: true, settings: serverCache });
    }
    const sanitizedSettings = {
      ...serverCache,
      shiprocketEmail: "",
      shiprocketPassword: "",
      delhiveryApiKey: ""
    };
    return res.status(200).json({ success: true, settings: sanitizedSettings });
  }
  if (req.method === "POST" || req.method === "PUT") {
    const authUser = await requireAuth(req, res, { allowedRoles: ["super_admin", "admin"] });
    if (!authUser) return;
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    serverCache = {
      ...serverCache,
      ...payload,
      featureFlags: {
        ...serverCache.featureFlags,
        ...payload.featureFlags || {}
      },
      businessRules: {
        ...serverCache.businessRules,
        ...payload.businessRules || {}
      },
      occasionBanner: {
        ...serverCache.occasionBanner,
        ...payload.occasionBanner || {}
      }
    };
    try {
      const dbPayload = {
        id: "primary",
        whatsapp_number: serverCache.whatsappNumber,
        support_email: serverCache.supportEmail,
        instagram_handle: serverCache.instagramHandle,
        instagram_url: serverCache.instagramUrl,
        business_hours: serverCache.businessHours,
        response_time: serverCache.responseTime,
        concierge_channel_mode: serverCache.conciergeChannelMode,
        legal_business_name: serverCache.legalBusinessName,
        studio_address: serverCache.studioAddress,
        gstin: serverCache.gstin,
        upi_id: serverCache.upiId,
        upi_phone: serverCache.upiPhone,
        shiprocket_email: serverCache.shiprocketEmail,
        shiprocket_password: serverCache.shiprocketPassword,
        shiprocket_pickup_location: serverCache.shiprocketPickupLocation,
        delhivery_api_key: serverCache.delhiveryApiKey,
        delhivery_warehouse_name: serverCache.delhiveryWarehouseName,
        logistics_automation_mode: serverCache.logisticsAutomationMode,
        pickup_contact_name: serverCache.pickupContactName,
        pickup_contact_phone: serverCache.pickupContactPhone,
        pickup_pincode: serverCache.pickupPincode,
        feature_flags: serverCache.featureFlags,
        business_rules: serverCache.businessRules,
        occasion_banner: serverCache.occasionBanner,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { error: upsertErr } = await supabaseAdmin.from("store_settings").upsert(dbPayload, { onConflict: "id" });
      if (upsertErr) {
        console.warn("[store_settings full upsert error, attempting core columns fallback]:", upsertErr.message);
        await supabaseAdmin.from("store_settings").update({
          concierge_channel_mode: serverCache.conciergeChannelMode,
          whatsapp_number: serverCache.whatsappNumber,
          support_email: serverCache.supportEmail,
          instagram_handle: serverCache.instagramHandle,
          instagram_url: serverCache.instagramUrl,
          business_hours: serverCache.businessHours,
          response_time: serverCache.responseTime,
          legal_business_name: serverCache.legalBusinessName,
          studio_address: serverCache.studioAddress,
          gstin: serverCache.gstin,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", "primary");
      }
    } catch (err) {
      console.warn("[store_settings exception]:", err);
    }
    return res.status(200).json({ success: true, settings: serverCache });
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// server/handlers/sitemap.ts
async function handler2(req, res) {
  const baseUrl = process.env.VITE_SITE_URL || "https://thepetalandbloom.vercel.app";
  try {
    const { data: products } = await supabaseAdmin.from("products").select("code, updated_at").eq("is_active", true);
    const staticRoutes = [
      "",
      "/shop",
      "/about",
      "/contact",
      "/custom",
      "/custom-bouquet",
      "/gift-finder",
      "/privacy",
      "/terms",
      "/refund"
    ];
    const staticUrls = staticRoutes.map(
      (route) => `
  <url>
    <loc>${baseUrl}${route}</loc>
    <changefreq>weekly</changefreq>
    <priority>${route === "" ? "1.0" : "0.8"}</priority>
  </url>`
    ).join("");
    const productUrls = (products || []).map(
      (p) => `
  <url>
    <loc>${baseUrl}/product/${p.code}</loc>
    <lastmod>${new Date(p.updated_at || Date.now()).toISOString().slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`
    ).join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticUrls}
  ${productUrls}
</urlset>`;
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    return res.status(200).send(xml);
  } catch (err) {
    console.error("[Sitemap Generation Error]", err);
    return res.status(500).send("Error generating sitemap");
  }
}

// server/api/settings.ts
async function handler3(req, res) {
  const url = req.url || "";
  const pathname = url.split("?")[0];
  if (pathname.includes("/sitemap")) {
    return handler2(req, res);
  }
  return handler(req, res);
}
export {
  handler3 as default
};
