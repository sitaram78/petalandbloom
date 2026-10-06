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
var ipRateLimitMap = /* @__PURE__ */ new Map();
function checkRateLimit(req, maxRequests = 10, windowMs = 6e4) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) || (typeof req.headers["x-real-ip"] === "string" ? req.headers["x-real-ip"] : null) || req.socket?.remoteAddress || "127.0.0.1";
  const now = Date.now();
  const record = ipRateLimitMap.get(ip);
  if (ipRateLimitMap.size > 1e4) {
    for (const [key, val] of ipRateLimitMap.entries()) {
      if (now > val.resetTime) ipRateLimitMap.delete(key);
    }
  }
  if (!record || now > record.resetTime) {
    ipRateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}

// server/handlers/account/signup.ts
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  const rateCheck = checkRateLimit(req, 5, 6e4);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      message: "Too many registration requests. Please wait a minute before trying again."
    });
  }
  try {
    const { email, password, fullName, phone } = req.body || {};
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: "Email address is required." });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: "Full name is required." });
    }
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: "A valid 10-digit mobile number is required." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const { data: phoneInUse } = await supabaseAdmin.from("profiles").select("id, email, phone").eq("phone", cleanPhone).maybeSingle();
    if (phoneInUse) {
      if (phoneInUse.email && phoneInUse.email.toLowerCase() === cleanEmail) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email and mobile number already exists. Please Sign In or use "Forgot Password".'
        });
      }
      return res.status(400).json({
        success: false,
        message: "This mobile number is already registered to another account. Please use a different mobile number or sign in."
      });
    }
    const { data: emailInUse } = await supabaseAdmin.from("profiles").select("id, email").ilike("email", cleanEmail).maybeSingle();
    if (emailInUse) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists. Please sign in or use "Forgot Password" to access your account.'
      });
    }
    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        phone: cleanPhone,
        role: "customer"
      }
    });
    if (createErr) {
      const msg = createErr.message || "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists. Please sign in or use "Forgot Password".'
        });
      }
      if (msg.toLowerCase().includes("database error")) {
        return res.status(400).json({
          success: false,
          message: "Unable to register with these details. The email or mobile number may already be registered. Please try signing in or resetting your password."
        });
      }
      return res.status(400).json({ success: false, message: msg });
    }
    if (!userData?.user) {
      return res.status(500).json({ success: false, message: "Failed to create user account." });
    }
    const userId2 = userData.user.id;
    const generatedReferralCode = `BLOOM-${cleanPhone.slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;
    let validReferredBy = null;
    let referrerId = null;
    const { referredByCode } = req.body || {};
    if (referredByCode && typeof referredByCode === "string" && referredByCode.trim()) {
      const cleanRef = referredByCode.trim().toUpperCase();
      const { data: referrer } = await supabaseAdmin.from("profiles").select("id, referral_code").eq("referral_code", cleanRef).maybeSingle();
      if (referrer) {
        validReferredBy = referrer.referral_code;
        referrerId = referrer.id;
      }
    }
    await supabaseAdmin.from("profiles").upsert({
      id: userId2,
      email: cleanEmail,
      full_name: fullName.trim(),
      phone: cleanPhone,
      role: "customer",
      referral_code: generatedReferralCode,
      referred_by: validReferredBy,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "id" });
    if (referrerId) {
      try {
        await supabaseAdmin.from("referrals").insert({
          referrer_id: referrerId,
          referee_id: userId2,
          status: "PENDING"
        });
      } catch (refErr) {
        console.warn("[Referral Insert Warning]:", refErr);
      }
    }
    const { data: existingLoyalty } = await supabaseAdmin.from("loyalty_accounts").select("id, points_balance").eq("customer_id", userId2).maybeSingle();
    if (!existingLoyalty) {
      await supabaseAdmin.from("loyalty_accounts").insert({
        customer_id: userId2,
        points_balance: 40,
        lifetime_points_earned: 40,
        tier: "FLORET"
      });
      await supabaseAdmin.from("loyalty_transactions").insert({
        customer_id: userId2,
        type: "WELCOME_BONUS",
        points: 40,
        description: "Welcome to The Petal & Bloom: 40 Petal Points gift (\u20B920 value, redeemable on orders > \u20B9299)"
      });
    }
    try {
      await supabaseAdmin.from("orders").update({ customer_id: userId2 }).eq("customer_id", null).or(`guest_email.ilike.${cleanEmail},guest_phone.ilike.%${cleanPhone}%`);
    } catch {
    }
    return res.status(200).json({
      success: true,
      message: "Account created successfully. 40 Petal Points (\u20B920 value) have been credited to your atelier account!",
      user: {
        id: userId2,
        email: cleanEmail
      }
    });
  } catch (err) {
    console.error("[API Signup Error]", err);
    return res.status(500).json({
      success: false,
      message: err.message || "An error occurred during account registration."
    });
  }
}

// server/handlers/account/recover.ts
async function handler2(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  const rateCheck = checkRateLimit(req, 4, 9e5);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      message: "Too many recovery attempts from this network. For security, please wait 15 minutes before trying again."
    });
  }
  try {
    const { email, phone } = req.body || {};
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, message: "Email address is required." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = (phone || "").toString().replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "A valid 10-digit registered mobile number is required to verify ownership."
      });
    }
    let userVerified = false;
    let customerName = "Customer";
    let customerUserId = null;
    const { data: profile } = await supabaseAdmin.from("profiles").select("id, email, phone, full_name").ilike("email", cleanEmail).maybeSingle();
    if (profile) {
      const profileCleanPhone = (profile.phone || "").replace(/\D/g, "").slice(-10);
      if (profileCleanPhone === cleanPhone) {
        userVerified = true;
        customerUserId = profile.id;
        customerName = profile.full_name || "Customer";
      }
    }
    if (!userVerified) {
      const { data: matchedOrder } = await supabaseAdmin.from("orders").select("id, guest_name, guest_email, guest_phone, customer_id").ilike("guest_email", cleanEmail).ilike("guest_phone", `%${cleanPhone}%`).limit(1).maybeSingle();
      if (matchedOrder) {
        userVerified = true;
        customerName = matchedOrder.guest_name || "Customer";
        if (matchedOrder.customer_id) {
          customerUserId = matchedOrder.customer_id;
        }
      }
    }
    if (!userVerified) {
      return res.status(400).json({
        success: false,
        message: "The email and mobile number provided do not match our verified records. Please verify both details or contact support."
      });
    }
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let authUser = (existingUsers?.users || []).find(
      (u) => (u.email || "").toLowerCase() === cleanEmail
    );
    if (!authUser) {
      const tempPassword = `BloomInit#${Math.random().toString(36).slice(-8)}!`;
      const { data: createdAuth, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: customerName,
          phone: cleanPhone,
          role: "customer"
        }
      });
      if (createAuthErr || !createdAuth?.user) {
        console.error("[Account Recovery Auto-Provision Error]:", createAuthErr);
        return res.status(500).json({
          success: false,
          message: "Unable to initialize account credentials. Please contact support."
        });
      }
      authUser = createdAuth.user;
      await supabaseAdmin.from("profiles").upsert({
        id: authUser.id,
        email: cleanEmail,
        phone: cleanPhone,
        full_name: customerName,
        role: "customer"
      }, { onConflict: "id" });
      try {
        await supabaseAdmin.from("orders").update({ customer_id: authUser.id }).or(`guest_email.ilike.${cleanEmail},guest_phone.ilike.%${cleanPhone}%`);
      } catch (linkErr2) {
        console.warn("[Account Recovery Order Link Warning]:", linkErr2);
      }
    }
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5173";
    const proto = req.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
    const siteUrl = `${proto}://${host}`;
    const redirectUrl = `${siteUrl}/account?mode=reset-password`;
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: cleanEmail,
      options: {
        redirectTo: redirectUrl
      }
    });
    if (linkErr || !linkData?.properties?.action_link) {
      console.error("[Account Recovery Link Generation Error]:", linkErr);
      return res.status(500).json({
        success: false,
        message: "Failed to generate security recovery session. Please try again."
      });
    }
    return res.status(200).json({
      success: true,
      message: "Account ownership verified successfully.",
      redirectUrl: linkData.properties.action_link
    });
  } catch (err) {
    console.error("[API Account Recovery Error]:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "An unexpected error occurred during account recovery."
    });
  }
}

// server/handlers/account/link-orders.ts
async function handler3(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const authUser = await requireAuth(req, res);
  if (!authUser) return;
  try {
    let verifiedEmail = authUser.email ? authUser.email.trim().toLowerCase() : "";
    let verifiedPhone = authUser.phone ? authUser.phone.replace(/\D/g, "").slice(-10) : "";
    if (!verifiedPhone || !verifiedEmail) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("email, phone").eq("id", userId).maybeSingle();
      if (profile) {
        if (!verifiedEmail && profile.email) verifiedEmail = profile.email.trim().toLowerCase();
        if (!verifiedPhone && profile.phone) verifiedPhone = profile.phone.replace(/\D/g, "").slice(-10);
      }
    }
    if (!verifiedEmail && !verifiedPhone) {
      return res.status(400).json({
        success: false,
        message: "No verified phone number or email found on your account to associate past orders."
      });
    }
    if (verifiedEmail) {
      const { data, error } = await supabaseAdmin.from("orders").update({ customer_id: userId }).is("customer_id", null).ilike("guest_email", verifiedEmail).select("id");
      if (!error && data) {
        linkedCount += data.length;
      }
    }
    if (verifiedPhone && verifiedPhone.length === 10) {
      const { data, error } = await supabaseAdmin.from("orders").update({ customer_id: userId }).is("customer_id", null).ilike("guest_phone", `%${verifiedPhone}%`).select("id");
      if (!error && data) {
        linkedCount += data.length;
      }
    }
    return res.status(200).json({
      success: true,
      linkedOrdersCount: linkedCount
    });
  } catch (error) {
    console.error("[Link Orders Error]:", error);
    return res.status(500).json({
      error: "Failed to link guest orders",
      message: error.message
    });
  }
}

// server/api/account.ts
async function handler4(req, res) {
  const url = req.url || "";
  const pathname = url.split("?")[0];
  if (pathname.includes("/signup")) {
    return handler(req, res);
  }
  if (pathname.includes("/recover")) {
    return handler2(req, res);
  }
  if (pathname.includes("/link-orders")) {
    return handler3(req, res);
  }
  return res.status(404).json({ success: false, message: `Route not found on account domain: ${pathname}` });
}
export {
  handler4 as default
};
