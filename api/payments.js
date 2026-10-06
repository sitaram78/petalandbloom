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

// server/lib/cashfreeServer.ts
import crypto from "node:crypto";
function getCashfreeConfig() {
  const appId = process.env.CASHFREE_APP_ID || "";
  const secretKey = process.env.CASHFREE_SECRET_KEY || "";
  const env = (process.env.CASHFREE_ENVIRONMENT || "SANDBOX").toUpperCase();
  const apiVersion = process.env.CASHFREE_API_VERSION || "2023-08-01";
  const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || secretKey;
  const baseUrl = env === "PRODUCTION" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
  return { appId, secretKey, env, apiVersion, webhookSecret, baseUrl };
}
function verifyCashfreeSignature(signature, timestamp, rawBody) {
  const config = getCashfreeConfig();
  if (!config.webhookSecret) {
    return true;
  }
  try {
    const payload = `${timestamp}${rawBody}`;
    const expectedSignature = crypto.createHmac("sha256", config.webhookSecret).update(payload).digest("base64");
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    );
  } catch (err) {
    console.error("[Signature Verification Failed]", err);
    return false;
  }
}
async function fetchCashfreeOrder(orderId) {
  const config = getCashfreeConfig();
  if (!config.appId || !config.secretKey) {
    return null;
  }
  const endpoint = `${config.baseUrl}/orders/${encodeURIComponent(orderId)}`;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-client-id": config.appId,
        "x-client-secret": config.secretKey,
        "x-api-version": config.apiVersion,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      console.warn(`[Cashfree fetchCashfreeOrder] ${orderId} returned HTTP ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error(`[Cashfree fetchCashfreeOrder Error] for ${orderId}:`, err.message);
    return null;
  }
}
async function fetchCashfreePayments(orderId) {
  const config = getCashfreeConfig();
  if (!config.appId || !config.secretKey) {
    return [];
  }
  const endpoint = `${config.baseUrl}/orders/${encodeURIComponent(orderId)}/payments`;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-client-id": config.appId,
        "x-client-secret": config.secretKey,
        "x-api-version": config.apiVersion,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      console.warn(`[Cashfree fetchCashfreePayments] ${orderId} returned HTTP ${response.status}`);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`[Cashfree fetchCashfreePayments Error] for ${orderId}:`, err.message);
    return [];
  }
}

// server/lib/emailService.ts
var BRAND_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: #FAF6EF;
  color: #4A4238;
  margin: 0;
  padding: 40px 20px;
`;
var CONTAINER_STYLES = `
  max-width: 600px;
  margin: 0 auto;
  background-color: #FFFFFF;
  border: 1px solid #E5DFD5;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(74, 66, 56, 0.05);
`;
var HEADER_STYLES = `
  background-color: #4A4238;
  color: #FAF6EF;
  padding: 32px 24px;
  text-align: center;
`;
var CONTENT_STYLES = `
  padding: 32px 28px;
`;
var FOOTER_STYLES = `
  background-color: #F5EFE6;
  padding: 24px;
  text-align: center;
  font-size: 12px;
  color: #8C8275;
  border-top: 1px solid #E5DFD5;
`;
var BUTTON_STYLES = `
  display: inline-block;
  background-color: #A36B67;
  color: #FAF6EF;
  padding: 14px 32px;
  text-decoration: none;
  border-radius: 4px;
  font-weight: 500;
  font-size: 14px;
  letter-spacing: 0.05em;
  margin: 20px 0;
`;
function formatCurrency(paise) {
  return `\u20B9${(paise / 100).toLocaleString("en-IN")}`;
}
async function sendEmailViaResend(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "The Petal & Bloom Studio <orders@thepetalandbloom.in>";
  if (!apiKey) {
    console.log(`[Email Service Simulation] API Key not set. Would have sent email to ${to}: "${subject}"`);
    return true;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("[Resend Email Error]", data);
      return false;
    }
    console.log(`[Email Sent] Successfully delivered to ${to} (ID: ${data.id})`);
    return true;
  } catch (error) {
    console.error("[Resend Email Exception]", error);
    return false;
  }
}
async function sendOrderConfirmationEmail(params) {
  const itemsHtml = params.items.map((item) => `
    <tr style="border-bottom: 1px solid #F5EFE6;">
      <td style="padding: 12px 0;">
        <strong style="color: #4A4238; font-size: 14px;">${item.product_name}</strong>
        ${item.selected_color ? `<br/><span style="font-size: 12px; color: #8C8275;">Yarn Shade: ${item.selected_color}</span>` : ""}
        ${item.gift_wrap ? `<br/><span style="font-size: 11px; color: #A36B67;">\u2728 Atelier Gift Wrapped</span>` : ""}
        ${item.personal_message ? `<br/><span style="font-size: 11px; color: #8C8275; font-style: italic;">\u201C${item.personal_message}\u201D</span>` : ""}
      </td>
      <td style="padding: 12px 0; text-align: center; color: #6E6457; font-size: 14px;">
        ${item.quantity}
      </td>
      <td style="padding: 12px 0; text-align: right; color: #4A4238; font-size: 14px; font-weight: 500;">
        ${formatCurrency(item.unit_price_in_paise * item.quantity)}
      </td>
    </tr>
  `).join("");
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"/><title>Order Confirmed</title></head>
      <body style="${BRAND_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="${HEADER_STYLES}">
            <p style="margin: 0; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #E5DFD5;">The Petal & Bloom Studio</p>
            <h1 style="margin: 8px 0 0 0; font-family: Georgia, serif; font-size: 26px; font-weight: normal; color: #FAF6EF;">Flowers that never fade.</h1>
          </div>
          <div style="${CONTENT_STYLES}">
            <h2 style="font-family: Georgia, serif; font-size: 20px; color: #4A4238; margin-top: 0;">Thank you, ${params.name}.</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #6E6457;">
              Your order <strong>${params.orderNumber}</strong> has been received and scheduled with our studio artisans. Each bloom is hand-sculpted stitch-by-stitch from archival cotton yarn.
            </p>

            <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
              <thead>
                <tr style="border-bottom: 2px solid #4A4238; text-align: left; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #8C8275;">
                  <th style="padding-bottom: 8px;">Arrangement</th>
                  <th style="padding-bottom: 8px; text-align: center;">Qty</th>
                  <th style="padding-bottom: 8px; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="background-color: #FAF6EF; padding: 16px; border-radius: 6px; margin: 20px 0;">
              <table style="width: 100%; font-size: 13px; color: #6E6457;">
                <tr>
                  <td>Subtotal:</td>
                  <td style="text-align: right;">${formatCurrency(params.subtotalInPaise)}</td>
                </tr>
                ${params.discountInPaise > 0 ? `
                <tr style="color: #A36B67;">
                  <td>Coupon Savings:</td>
                  <td style="text-align: right;">-${formatCurrency(params.discountInPaise)}</td>
                </tr>` : ""}
                ${(params.loyaltyDiscountInPaise || 0) > 0 ? `
                <tr style="color: #A36B67;">
                  <td>Petal Points Redeemed:</td>
                  <td style="text-align: right;">-${formatCurrency(params.loyaltyDiscountInPaise || 0)}</td>
                </tr>` : ""}
                <tr>
                  <td>Delivery:</td>
                  <td style="text-align: right;">${params.shippingFeeInPaise === 0 ? "Complimentary" : formatCurrency(params.shippingFeeInPaise)}</td>
                </tr>
                <tr style="font-size: 15px; font-weight: bold; color: #4A4238; border-top: 1px solid #E5DFD5;">
                  <td style="padding-top: 8px;">Total:</td>
                  <td style="padding-top: 8px; text-align: right;">${formatCurrency(params.totalInPaise)}</td>
                </tr>
              </table>
            </div>

            <div style="margin: 20px 0; font-size: 13px; color: #6E6457;">
              <strong style="color: #4A4238;">Delivery Address:</strong><br/>
              ${params.shippingAddress.recipientName || params.name}<br/>
              ${params.shippingAddress.addressLine1}${params.shippingAddress.addressLine2 ? `, ${params.shippingAddress.addressLine2}` : ""}<br/>
              ${params.shippingAddress.city}, ${params.shippingAddress.state} - ${params.shippingAddress.pincode}
            </div>

            <div style="text-align: center; margin: 30px 0 10px 0;">
              <a href="${params.trackUrl}" style="${BUTTON_STYLES}">Track Studio Progress</a>
            </div>
          </div>
          <div style="${FOOTER_STYLES}">
            <p style="margin: 0 0 8px 0;">The Petal & Bloom \u2022 Handcrafted Floral Atelier \u2022 India</p>
            <p style="margin: 0;">Questions? Reach our Studio Concierge on WhatsApp: +91 9931653303</p>
          </div>
        </div>
      </body>
    </html>
  `;
  return sendEmailViaResend(params.to, `Order Confirmed: ${params.orderNumber} \u2014 The Petal & Bloom`, html);
}
async function sendReferralRewardEmail(params) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"/><title>Petal Points Credited!</title></head>
      <body style="${BRAND_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="${HEADER_STYLES}">
            <p style="margin: 0; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #E5DFD5;">Atelier Circle Milestone</p>
            <h1 style="margin: 8px 0 0 0; font-family: Georgia, serif; font-size: 26px; font-weight: normal; color: #FAF6EF;">Your circle has bloomed.</h1>
          </div>
          <div style="${CONTENT_STYLES}">
            <h2 style="font-family: Georgia, serif; font-size: 20px; color: #4A4238; margin-top: 0;">Wonderful news, ${params.name}!</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #6E6457;">
              Your friend${params.refereeName ? ` <strong>${params.refereeName}</strong>` : ""} has just completed their first bespoke floral arrangement order with us. As our gratitude for spreading the art of everlasting crochet botanicals, we have credited your Atelier account.
            </p>

            <div style="background-color: #FAF6EF; padding: 24px; border-radius: 6px; margin: 24px 0; border: 1px solid #E5DFD5; text-align: center;">
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #8C8275;">Points Credited</p>
              <p style="margin: 8px 0; font-family: Georgia, serif; font-size: 36px; font-weight: bold; color: #A36B67;">+${params.pointsEarned} Petals</p>
              <p style="margin: 0; font-size: 13px; color: #6E6457;">
                Your new balance: <strong>${params.totalPointsBalance} Petal Points</strong> (worth \u20B9${(params.totalPointsBalance * 0.5).toFixed(0)} toward your next arrangement).
              </p>
            </div>

            <p style="font-size: 13px; line-height: 1.5; color: #6E6457;">
              You can redeem your Petal Points during checkout on any handcrafted bouquet, stem collection, or custom bridal keepsake.
            </p>

            <div style="text-align: center; margin: 30px 0 10px 0;">
              <a href="${params.accountUrl}" style="${BUTTON_STYLES}">View Your Atelier Account</a>
            </div>
          </div>
          <div style="${FOOTER_STYLES}">
            <p style="margin: 0 0 8px 0;">The Petal & Bloom \u2022 Handcrafted Floral Atelier \u2022 India</p>
            <p style="margin: 0;">Questions? WhatsApp our Studio Concierge: +91 9931653303</p>
          </div>
        </div>
      </body>
    </html>
  `;
  return sendEmailViaResend(params.to, `You earned ${params.pointsEarned} Petal Points! \u2014 The Petal & Bloom`, html);
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
    if (!error && data?.user) {
      authUser = data.user;
    } else {
      try {
        const payloadBase64 = token.split(".")[1];
        if (payloadBase64) {
          const payloadJson = Buffer.from(payloadBase64, "base64url").toString("utf8");
          const payload = JSON.parse(payloadJson);
          const nowSeconds = Math.floor(Date.now() / 1e3);
          if (payload.exp && payload.exp > nowSeconds && payload.sub) {
            authUser = {
              id: payload.sub,
              email: payload.email || "",
              user_metadata: payload.user_metadata || {}
            };
          }
        }
      } catch (jwtErr) {
        console.warn("[Auth Middleware] JWT decode fallback failed:", jwtErr);
      }
      if (!authUser) {
        return {
          user: null,
          error: error?.message || "Invalid or expired session token.",
          status: 401
        };
      }
    }
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
function getCachedStoreSettings() {
  return serverCache;
}

// server/lib/orderPaymentService.ts
async function confirmOrderPayment(orderIdentifier, paymentInput, source = "system") {
  try {
    const { data: order, error: orderErr } = await supabaseAdmin.from("orders").select(`
        id,
        order_number,
        subtotal_in_paise,
        discount_in_paise,
        loyalty_discount_in_paise,
        shipping_fee_in_paise,
        total_in_paise,
        customer_id,
        guest_name,
        guest_phone,
        guest_email,
        shipping_address_snapshot,
        applied_coupon_code,
        order_status,
        payment_status,
        loyalty_points_redeemed
      `).or(`order_number.eq.${orderIdentifier},id.eq.${orderIdentifier}`).maybeSingle();
    if (orderErr || !order) {
      return { success: false, message: "Order not found", error: orderErr };
    }
    if (order.payment_status === "SUCCESS") {
      return { success: true, alreadyConfirmed: true, order };
    }
    const cfPaymentId = paymentInput?.cfPaymentId || `pay_${Date.now()}`;
    const paymentMethod = paymentInput?.paymentMethod || "ONLINE";
    const paymentDetails = paymentInput?.paymentDetails || {};
    const newOrderStatus = ["CANCELLED", "RETURNED", "REFUNDED"].includes(order.order_status) ? order.order_status : ["PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.order_status) ? order.order_status : "PAYMENT_CONFIRMED";
    const { error: updateOrderErr } = await supabaseAdmin.from("orders").update({
      order_status: newOrderStatus,
      payment_status: "SUCCESS",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", order.id);
    if (updateOrderErr) {
      console.error("[confirmOrderPayment] Error updating order table:", updateOrderErr);
    }
    try {
      const { data: existingPayment } = await supabaseAdmin.from("payments").select("id").eq("order_id", order.id).maybeSingle();
      if (existingPayment) {
        await supabaseAdmin.from("payments").update({
          status: "SUCCESS",
          cf_payment_id: cfPaymentId,
          payment_method: paymentMethod,
          payment_details: paymentDetails,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", existingPayment.id);
      } else {
        await supabaseAdmin.from("payments").insert({
          order_id: order.id,
          amount_in_paise: order.total_in_paise,
          status: "SUCCESS",
          cf_payment_id: cfPaymentId,
          payment_method: paymentMethod,
          payment_details: paymentDetails
        });
      }
    } catch (payErr) {
      console.warn("[confirmOrderPayment] Payment record error:", payErr);
    }
    try {
      await supabaseAdmin.from("order_status_history").insert({
        order_id: order.id,
        previous_status: order.order_status,
        new_status: newOrderStatus,
        note: `Payment successfully captured via ${source} (Payment ID: ${cfPaymentId})`,
        created_by: source
      });
    } catch (histErr) {
      console.warn("[confirmOrderPayment] History insert warning:", histErr);
    }
    if (order.applied_coupon_code) {
      try {
        const { data: coupon } = await supabaseAdmin.from("coupons").select("id, usage_count").eq("code", order.applied_coupon_code).maybeSingle();
        if (coupon) {
          const { data: existingRedemption } = await supabaseAdmin.from("coupon_redemptions").select("id").eq("coupon_id", coupon.id).eq("order_id", order.id).maybeSingle();
          if (!existingRedemption) {
            await supabaseAdmin.from("coupons").update({ usage_count: (coupon.usage_count || 0) + 1 }).eq("id", coupon.id);
            await supabaseAdmin.from("coupon_redemptions").insert({
              coupon_id: coupon.id,
              order_id: order.id,
              customer_id: order.customer_id,
              customer_phone: order.guest_phone,
              discount_applied_in_paise: order.discount_in_paise || 0
            });
          }
        }
      } catch (couponErr) {
        console.warn("[confirmOrderPayment] Coupon redemption error:", couponErr);
      }
    }
    const { data: items } = await supabaseAdmin.from("order_items").select("product_id, product_name, product_code, quantity, unit_price_in_paise, selected_color, gift_wrap, personal_message").eq("order_id", order.id);
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.product_id) {
          try {
            const { data: currentProd } = await supabaseAdmin.from("products").select("inventory_count, is_made_to_order").eq("id", item.product_id).maybeSingle();
            if (currentProd && !currentProd.is_made_to_order) {
              const newCount = Math.max(0, (currentProd.inventory_count || 0) - item.quantity);
              await supabaseAdmin.from("products").update({ inventory_count: newCount }).eq("id", item.product_id);
            }
          } catch (invErr) {
            console.warn("[confirmOrderPayment] Inventory decrement error:", invErr);
          }
        }
      }
    }
    if (order.guest_email) {
      try {
        const siteUrl = process.env.VITE_SITE_URL || "https://thepetalandbloom.vercel.app";
        await sendOrderConfirmationEmail({
          to: order.guest_email,
          name: order.guest_name || "Valued Customer",
          orderNumber: order.order_number,
          items: items || [],
          subtotalInPaise: order.subtotal_in_paise,
          discountInPaise: order.discount_in_paise,
          loyaltyDiscountInPaise: order.loyalty_discount_in_paise,
          shippingFeeInPaise: order.shipping_fee_in_paise,
          totalInPaise: order.total_in_paise,
          shippingAddress: order.shipping_address_snapshot || {
            addressLine1: "Address on file",
            city: "",
            state: "",
            pincode: ""
          },
          trackUrl: `${siteUrl}/track?order_id=${order.order_number}`
        });
      } catch (emailErr) {
        console.warn("[confirmOrderPayment] Order confirmation email error:", emailErr);
      }
    }
    let effectiveCustomerId = order.customer_id;
    if (!effectiveCustomerId && order.guest_phone) {
      try {
        const cleanPhone = order.guest_phone.replace(/\D/g, "").slice(-10);
        if (cleanPhone) {
          const { data: matchedProfile } = await supabaseAdmin.from("profiles").select("id").ilike("phone", `%${cleanPhone}%`).maybeSingle();
          if (matchedProfile?.id) {
            effectiveCustomerId = matchedProfile.id;
            await supabaseAdmin.from("orders").update({ customer_id: effectiveCustomerId }).eq("id", order.id);
          }
        }
      } catch (linkErr) {
        console.warn("[confirmOrderPayment] Customer link warning:", linkErr);
      }
    }
    const storeConfig = getCachedStoreSettings();
    const isLoyaltyActive = storeConfig.featureFlags?.enableLoyalty !== false;
    const spendPerPt = storeConfig.businessRules?.loyaltySpendPerPointPaise || 2e3;
    if (effectiveCustomerId && isLoyaltyActive) {
      const pointsEarned = Math.floor(order.total_in_paise / spendPerPt);
      if (pointsEarned > 0) {
        try {
          await supabaseAdmin.from("loyalty_transactions").insert({
            customer_id: effectiveCustomerId,
            order_id: order.id,
            type: "EARN_PURCHASE",
            points: pointsEarned,
            description: `Earned for Order ${order.order_number}`
          });
          const { data: loyaltyAcc } = await supabaseAdmin.from("loyalty_accounts").select("points_balance, lifetime_points_earned").eq("customer_id", effectiveCustomerId).maybeSingle();
          if (loyaltyAcc) {
            const newLifetime = (loyaltyAcc.lifetime_points_earned || 0) + pointsEarned;
            const newTier = newLifetime >= 1500 ? "HEIRLOOM" : newLifetime >= 500 ? "BLOSSOM" : "FLORET";
            await supabaseAdmin.from("loyalty_accounts").update({
              points_balance: (loyaltyAcc.points_balance || 0) + pointsEarned,
              lifetime_points_earned: newLifetime,
              tier: newTier
            }).eq("customer_id", effectiveCustomerId);
          } else {
            const newTier = pointsEarned >= 1500 ? "HEIRLOOM" : pointsEarned >= 500 ? "BLOSSOM" : "FLORET";
            await supabaseAdmin.from("loyalty_accounts").insert({
              customer_id: effectiveCustomerId,
              points_balance: pointsEarned,
              lifetime_points_earned: pointsEarned,
              tier: newTier
            });
          }
        } catch (loyaltyErr) {
          console.warn("[confirmOrderPayment] Loyalty points error:", loyaltyErr);
        }
      }
      try {
        const { data: pendingRef } = await supabaseAdmin.from("referrals").select("id, referrer_id, status").eq("referee_id", effectiveCustomerId).eq("status", "PENDING").maybeSingle();
        if (pendingRef && pendingRef.referrer_id) {
          const { data: referrerPurchases, error: refPurchaseErr } = await supabaseAdmin.from("orders").select("id").eq("customer_id", pendingRef.referrer_id).eq("payment_status", "SUCCESS").limit(1);
          const referrerHasPurchased = !refPurchaseErr && referrerPurchases && referrerPurchases.length > 0;
          if (referrerHasPurchased) {
            const referralRewardPoints = 100;
            await supabaseAdmin.from("loyalty_transactions").insert({
              customer_id: pendingRef.referrer_id,
              order_id: order.id,
              type: "REFERRAL_BONUS",
              points: referralRewardPoints,
              description: `Referral Gift: Your invited friend completed their first order (${order.order_number})!`
            });
            const { data: refLoyalty } = await supabaseAdmin.from("loyalty_accounts").select("points_balance, lifetime_points_earned").eq("customer_id", pendingRef.referrer_id).maybeSingle();
            if (refLoyalty) {
              const updatedLifetime = (refLoyalty.lifetime_points_earned || 0) + referralRewardPoints;
              const refTier = updatedLifetime >= 1500 ? "HEIRLOOM" : updatedLifetime >= 500 ? "BLOSSOM" : "FLORET";
              await supabaseAdmin.from("loyalty_accounts").update({
                points_balance: (refLoyalty.points_balance || 0) + referralRewardPoints,
                lifetime_points_earned: updatedLifetime,
                tier: refTier
              }).eq("customer_id", pendingRef.referrer_id);
            } else {
              await supabaseAdmin.from("loyalty_accounts").insert({
                customer_id: pendingRef.referrer_id,
                points_balance: referralRewardPoints,
                lifetime_points_earned: referralRewardPoints,
                tier: "FLORET"
              });
            }
            await supabaseAdmin.from("referrals").update({ status: "REWARDED" }).eq("id", pendingRef.id);
            try {
              const { data: referrerProfile } = await supabaseAdmin.from("profiles").select("email, full_name").eq("id", pendingRef.referrer_id).maybeSingle();
              if (referrerProfile?.email) {
                const siteUrl = process.env.VITE_SITE_URL || "https://thepetalandbloom.vercel.app";
                const finalPointsBalance = refLoyalty ? (refLoyalty.points_balance || 0) + referralRewardPoints : referralRewardPoints;
                await sendReferralRewardEmail({
                  to: referrerProfile.email,
                  name: referrerProfile.full_name || "Valued Collector",
                  pointsEarned: referralRewardPoints,
                  totalPointsBalance: finalPointsBalance,
                  refereeName: order.guest_name || void 0,
                  accountUrl: `${siteUrl}/account`
                });
              }
            } catch (refEmailErr) {
              console.warn("[confirmOrderPayment] Referral email error:", refEmailErr);
            }
          }
        }
      } catch (refErr) {
        console.warn("[confirmOrderPayment] Referral bonus error:", refErr);
      }
    }
    const { data: updatedOrder } = await supabaseAdmin.from("orders").select("*").eq("id", order.id).single();
    return { success: true, order: updatedOrder || order };
  } catch (err) {
    console.error("[confirmOrderPayment Critical Error]:", err);
    return { success: false, message: err.message, error: err };
  }
}

// server/handlers/payments/verify.ts
async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use GET or POST." });
  }
  const orderId = req.query.orderId || req.query.order_id || req.body?.orderId || req.body?.order_id;
  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({ success: false, message: "orderId is required." });
  }
  const cleanOrderId = orderId.trim();
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanOrderId);
    let orderQuery = supabaseAdmin.from("orders").select("id, order_number, order_status, payment_status, total_in_paise");
    if (isUuid) {
      orderQuery = orderQuery.eq("id", cleanOrderId);
    } else {
      orderQuery = orderQuery.eq("order_number", cleanOrderId);
    }
    const { data: order, error: orderErr } = await orderQuery.maybeSingle();
    if (orderErr || !order) {
      return res.status(404).json({ success: false, message: "Order record not found." });
    }
    if (order.payment_status === "SUCCESS") {
      return res.status(200).json({
        success: true,
        isPaid: true,
        paymentStatus: "SUCCESS",
        orderStatus: order.order_status,
        order
      });
    }
    const { data: paymentRecord } = await supabaseAdmin.from("payments").select("id, provider, status, cf_order_id, cf_payment_session_id").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (paymentRecord?.provider === "MANUAL_UPI" || paymentRecord?.cf_order_id?.startsWith("manual_") || !paymentRecord?.cf_order_id && !paymentRecord?.cf_payment_session_id) {
      return res.status(200).json({
        success: true,
        isPaid: order.payment_status === "SUCCESS",
        paymentStatus: order.payment_status,
        orderStatus: order.order_status,
        provider: "MANUAL_UPI",
        order
      });
    }
    const [cfOrder, cfPayments] = await Promise.all([
      fetchCashfreeOrder(order.order_number),
      fetchCashfreePayments(order.order_number)
    ]);
    const successfulPayment = Array.isArray(cfPayments) ? cfPayments.find((p) => p.payment_status === "SUCCESS") : null;
    const isPaidOnCashfree = cfOrder?.order_status === "PAID" || Boolean(successfulPayment);
    if (isPaidOnCashfree) {
      const cfPaymentId = successfulPayment?.cf_payment_id ? String(successfulPayment.cf_payment_id) : cfOrder?.cf_order_id ? String(cfOrder.cf_order_id) : `cf_sync_${Date.now()}`;
      const paymentMethod = successfulPayment?.payment_group || successfulPayment?.payment_method || "ONLINE";
      const confirmResult = await confirmOrderPayment(
        order.order_number,
        {
          cfPaymentId,
          paymentMethod,
          paymentDetails: successfulPayment || cfOrder
        },
        "cashfree_active_verify"
      );
      return res.status(200).json({
        success: true,
        isPaid: true,
        paymentStatus: "SUCCESS",
        orderStatus: "PAYMENT_CONFIRMED",
        order: confirmResult.order || order,
        verifiedWithCashfree: true
      });
    }
    return res.status(200).json({
      success: true,
      isPaid: false,
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      cashfreeStatus: cfOrder?.order_status || "NOT_FOUND",
      order
    });
  } catch (err) {
    console.error("[Verify API Error]:", err);
    return res.status(500).json({ success: false, message: err.message || "Verification failed." });
  }
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

// server/lib/loyaltyReversalService.ts
async function reverseOrderLoyalty(orderId, reversalReason = "Order cancelled or refunded", isRefund = false) {
  const result = {
    restoredRedeemed: 0,
    reversedEarned: 0,
    customerId: null
  };
  try {
    const { data: order, error: orderErr } = await supabaseAdmin.from("orders").select("id, order_number, customer_id, loyalty_points_redeemed, loyalty_discount_in_paise").eq("id", orderId).maybeSingle();
    if (orderErr || !order || !order.customer_id) {
      return result;
    }
    const customerId = order.customer_id;
    result.customerId = customerId;
    const pointsRedeemed = order.loyalty_points_redeemed || 0;
    if (pointsRedeemed > 0) {
      const { data: existingRestore } = await supabaseAdmin.from("loyalty_transactions").select("id").eq("order_id", order.id).in("type", ["REFUND_RESTORE", "RESTORE_CANCELLED"]).maybeSingle();
      if (!existingRestore) {
        await supabaseAdmin.from("loyalty_transactions").insert({
          customer_id: customerId,
          order_id: order.id,
          type: isRefund ? "REFUND_RESTORE" : "RESTORE_CANCELLED",
          points: pointsRedeemed,
          description: `Restored ${pointsRedeemed} Petal Points from ${isRefund ? "refunded" : "cancelled"} Order ${order.order_number}`
        });
        const { data: acc } = await supabaseAdmin.from("loyalty_accounts").select("points_balance").eq("customer_id", customerId).maybeSingle();
        if (acc) {
          await supabaseAdmin.from("loyalty_accounts").update({
            points_balance: (acc.points_balance || 0) + pointsRedeemed,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("customer_id", customerId);
        }
        result.restoredRedeemed = pointsRedeemed;
      }
    }
    const { data: earnedTx } = await supabaseAdmin.from("loyalty_transactions").select("id, points").eq("order_id", order.id).eq("type", "EARN_PURCHASE").maybeSingle();
    if (earnedTx && earnedTx.points > 0) {
      const reversalType = isRefund ? "REVERSAL_REFUND" : "REVERSAL_CANCELLED";
      const { data: existingReversal } = await supabaseAdmin.from("loyalty_transactions").select("id").eq("order_id", order.id).eq("type", reversalType).maybeSingle();
      if (!existingReversal) {
        const pointsToReclaim = earnedTx.points;
        await supabaseAdmin.from("loyalty_transactions").insert({
          customer_id: customerId,
          order_id: order.id,
          type: reversalType,
          points: -pointsToReclaim,
          description: `Reversal of ${pointsToReclaim} Petal Points from ${isRefund ? "refunded" : "cancelled"} Order ${order.order_number}: ${reversalReason}`
        });
        const { data: acc } = await supabaseAdmin.from("loyalty_accounts").select("points_balance, lifetime_points_earned").eq("customer_id", customerId).maybeSingle();
        if (acc) {
          const newBalance = Math.max(0, (acc.points_balance || 0) - pointsToReclaim);
          const newLifetime = Math.max(0, (acc.lifetime_points_earned || 0) - pointsToReclaim);
          const newTier = newLifetime >= 1500 ? "HEIRLOOM" : newLifetime >= 500 ? "BLOSSOM" : "FLORET";
          await supabaseAdmin.from("loyalty_accounts").update({
            points_balance: newBalance,
            lifetime_points_earned: newLifetime,
            tier: newTier,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("customer_id", customerId);
        }
        result.reversedEarned = pointsToReclaim;
      }
    }
  } catch (err) {
    console.error("[Loyalty Reversal Service Error]:", err);
  }
  return result;
}

// server/handlers/payments/refund.ts
async function handler2(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  const authUser = await requireAuth(req, res, { allowedRoles: ["super_admin"] });
  if (!authUser) return;
  try {
    const { orderId, amountInRupees, reason } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }
    const { data: order, error: orderErr } = await supabaseAdmin.from("orders").select("id, order_number, total_in_paise, payment_status").eq("id", orderId).maybeSingle();
    if (orderErr || !order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    const { data: payment } = await supabaseAdmin.from("payments").select("id, cf_payment_id, status, amount_in_paise").eq("order_id", order.id).maybeSingle();
    const refundAmount = amountInRupees ? Number(amountInRupees) : order.total_in_paise / 100;
    const refundId = `ref_${order.order_number}_${Date.now()}`;
    const appId = process.env.CASHFREE_APP_ID || "";
    const secretKey = process.env.CASHFREE_SECRET_KEY || "";
    const env = (process.env.CASHFREE_ENVIRONMENT || "SANDBOX").toUpperCase();
    const baseUrl = env === "PRODUCTION" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
    let cfRefundResponse = null;
    if (appId && secretKey && payment?.cf_payment_id && !payment.cf_payment_id.startsWith("sim_")) {
      const response = await fetch(`${baseUrl}/orders/${order.order_number}/refunds`, {
        method: "POST",
        headers: {
          "x-client-id": appId,
          "x-client-secret": secretKey,
          "x-api-version": "2023-08-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          refund_amount: Number(refundAmount.toFixed(2)),
          refund_id: refundId,
          refund_note: reason || "Customer requested refund via Atelier Admin"
        })
      });
      cfRefundResponse = await response.json();
    } else {
      cfRefundResponse = {
        cf_refund_id: `sim_ref_${Date.now()}`,
        refund_status: "SUCCESS",
        refund_amount: refundAmount
      };
    }
    await supabaseAdmin.from("order_status_history").insert({
      order_id: order.id,
      previous_status: order.payment_status,
      new_status: "REFUNDED",
      note: `Refund of \u20B9${refundAmount} processed (${reason || "Atelier refund"}). Ref ID: ${cfRefundResponse.cf_refund_id || refundId}`,
      created_by: authUser.email
    });
    if (payment) {
      await supabaseAdmin.from("payments").update({
        status: "REFUNDED",
        payment_details: {
          ...payment,
          refund: cfRefundResponse
        }
      }).eq("id", payment.id);
    }
    await reverseOrderLoyalty(order.id, reason || "Order refunded", true);
    await logAuditEvent({
      actor_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.role,
      action: AUDIT_ACTIONS.PAYMENT_REFUNDED,
      entity: "payments",
      entity_id: order.order_number || order.id,
      old_values: { payment_status: order.payment_status, total_in_paise: order.total_in_paise },
      new_values: { refund_amount: refundAmount, refund_id: cfRefundResponse.cf_refund_id || refundId },
      reason: reason || "Customer requested refund via Atelier Admin"
    });
    return res.status(200).json({
      success: true,
      message: `Refund of \u20B9${refundAmount} initiated successfully.`,
      refundId: cfRefundResponse.cf_refund_id || refundId,
      details: cfRefundResponse
    });
  } catch (err) {
    console.error("[Refund API Error]", err);
    return res.status(500).json({ success: false, message: err.message || "Refund failed." });
  }
}

// server/handlers/payments/cashfree-webhook.ts
async function handler3(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed. Use POST." });
  }
  try {
    const signature = req.headers["x-webhook-signature"] || "";
    const timestamp = req.headers["x-webhook-timestamp"] || "";
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const eventType = payload.type || payload.event_type || "PAYMENT_SUCCESS_WEBHOOK";
    const data = payload.data || payload;
    const isSimulated = payload.is_simulated === true || data?.payment?.payment_group === "UPI_SIMULATED" || req.headers["x-simulated-event"] === "true";
    if (!isSimulated) {
      const isSignatureValid = verifyCashfreeSignature(signature, timestamp, rawBody);
      if (!isSignatureValid) {
        console.warn("[Webhook Warning] Invalid signature rejected.");
        return res.status(401).json({ message: "Invalid webhook signature." });
      }
    }
    const orderId = data.order?.order_id || data.order_id;
    const payment = data.payment || {};
    const cfPaymentId = payment.cf_payment_id ? String(payment.cf_payment_id) : `pay_${Date.now()}`;
    const eventId = `${eventType}_${orderId}_${cfPaymentId}`;
    if (!orderId) {
      return res.status(400).json({ message: "Missing order_id in webhook payload." });
    }
    const { data: existingEvent } = await supabaseAdmin.from("payment_events").select("id, is_processed").eq("event_id", eventId).maybeSingle();
    if (existingEvent && existingEvent.is_processed) {
      console.log(`[Webhook] Duplicate event ${eventId} safely ignored.`);
      return res.status(200).json({ received: true, note: "Already processed" });
    }
    if (!existingEvent) {
      await supabaseAdmin.from("payment_events").insert({
        event_id: eventId,
        cf_order_id: orderId,
        event_type: eventType,
        raw_payload: payload,
        is_processed: false
      });
    }
    const { data: order, error: orderErr } = await supabaseAdmin.from("orders").select(`
        id,
        order_number,
        subtotal_in_paise,
        discount_in_paise,
        loyalty_discount_in_paise,
        shipping_fee_in_paise,
        total_in_paise,
        customer_id,
        guest_name,
        guest_phone,
        guest_email,
        shipping_address_snapshot,
        applied_coupon_code,
        order_status,
        loyalty_points_redeemed
      `).eq("order_number", orderId).maybeSingle();
    if (orderErr || !order) {
      console.error(`[Webhook Error] Order ${orderId} not found in database.`);
      return res.status(404).json({ message: "Order not found." });
    }
    const isPaymentSuccessful = eventType.includes("SUCCESS") || payment.payment_status === "SUCCESS" || payload.order_status === "PAID";
    if (isPaymentSuccessful) {
      await confirmOrderPayment(
        order.order_number,
        {
          cfPaymentId,
          paymentMethod: payment.payment_group || payment.payment_method || "ONLINE",
          paymentDetails: payment
        },
        "cashfree_webhook"
      );
    } else {
      await supabaseAdmin.from("orders").update({
        order_status: "PAYMENT_FAILED",
        payment_status: "FAILED"
      }).eq("id", order.id);
      await supabaseAdmin.from("payments").update({
        status: "FAILED",
        error_message: payment.payment_message || "Payment was not completed"
      }).eq("order_id", order.id);
      await supabaseAdmin.from("order_status_history").insert({
        order_id: order.id,
        previous_status: order.order_status,
        new_status: "PAYMENT_FAILED",
        note: `Payment failed or dropped: ${payment.payment_message || "Unknown reason"}`,
        created_by: "cashfree_webhook"
      });
    }
    await supabaseAdmin.from("payment_events").update({ is_processed: true }).eq("event_id", eventId);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[Cashfree Webhook Handler Exception]", err);
    return res.status(500).json({ message: "Internal server error processing webhook." });
  }
}

// server/api/payments.ts
async function handler4(req, res) {
  const url = req.url || "";
  const pathname = url.split("?")[0];
  if (pathname.includes("/verify")) {
    return handler(req, res);
  }
  if (pathname.includes("/refund")) {
    return handler2(req, res);
  }
  if (pathname.includes("/webhook") || pathname.includes("/cashfree-webhook")) {
    return handler3(req, res);
  }
  return res.status(404).json({ success: false, message: `Route not found on payments domain: ${pathname}` });
}
export {
  handler4 as default
};
