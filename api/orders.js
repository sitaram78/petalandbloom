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
function getCashfreeConfig() {
  const appId = process.env.CASHFREE_APP_ID || "";
  const secretKey = process.env.CASHFREE_SECRET_KEY || "";
  const env = (process.env.CASHFREE_ENVIRONMENT || "SANDBOX").toUpperCase();
  const apiVersion = process.env.CASHFREE_API_VERSION || "2023-08-01";
  const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || secretKey;
  const baseUrl = env === "PRODUCTION" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
  return { appId, secretKey, env, apiVersion, webhookSecret, baseUrl };
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
            <p style="margin: 0;">Questions? Reach our Studio Concierge on WhatsApp: +91 9861615937</p>
          </div>
        </div>
      </body>
    </html>
  `;
  return sendEmailViaResend(params.to, `Order Confirmed: ${params.orderNumber} \u2014 The Petal & Bloom`, html);
}
async function sendDispatchEmail(params) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"/><title>Your Blooms Have Dispatched</title></head>
      <body style="${BRAND_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="${HEADER_STYLES}">
            <p style="margin: 0; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #E5DFD5;">Studio Dispatch Notification</p>
            <h1 style="margin: 8px 0 0 0; font-family: Georgia, serif; font-size: 26px; font-weight: normal; color: #FAF6EF;">Your blooms are on their way.</h1>
          </div>
          <div style="${CONTENT_STYLES}">
            <h2 style="font-family: Georgia, serif; font-size: 20px; color: #4A4238; margin-top: 0;">Greetings, ${params.name}.</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #6E6457;">
              Your order <strong>${params.orderNumber}</strong> has completed hand-sculpting, quality inspection, and has been safely nestled into our archival postal box. It is now with our logistics partner.
            </p>

            <div style="background-color: #FAF6EF; padding: 20px; border-radius: 6px; margin: 24px 0; border: 1px solid #E5DFD5;">
              <table style="width: 100%; font-size: 13px; color: #6E6457;">
                <tr>
                  <td style="padding-bottom: 8px;"><strong>Courier Partner:</strong></td>
                  <td style="text-align: right; padding-bottom: 8px; color: #4A4238;">${params.carrier}</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 8px;"><strong>AWB Tracking Number:</strong></td>
                  <td style="text-align: right; padding-bottom: 8px; font-family: monospace; color: #4A4238; font-weight: bold;">${params.awbNumber}</td>
                </tr>
                ${params.estimatedDelivery ? `
                <tr>
                  <td><strong>Estimated Delivery:</strong></td>
                  <td style="text-align: right; color: #A36B67; font-weight: 500;">${params.estimatedDelivery}</td>
                </tr>` : ""}
              </table>
            </div>

            <div style="margin: 20px 0; font-size: 13px; color: #6E6457;">
              <strong style="color: #4A4238;">Shipping Destination:</strong><br/>
              ${params.shippingAddress.recipientName || params.name}<br/>
              ${params.shippingAddress.addressLine1}<br/>
              ${params.shippingAddress.city}, ${params.shippingAddress.state} - ${params.shippingAddress.pincode}
            </div>

            <div style="text-align: center; margin: 30px 0 10px 0;">
              <a href="${params.trackingUrl}" style="${BUTTON_STYLES}">Track Live Consignment</a>
            </div>
          </div>
          <div style="${FOOTER_STYLES}">
            <p style="margin: 0 0 8px 0;">The Petal & Bloom \u2022 Handcrafted Floral Atelier \u2022 India</p>
            <p style="margin: 0;">Questions or delivery instructions? WhatsApp: +91 9861615937</p>
          </div>
        </div>
      </body>
    </html>
  `;
  return sendEmailViaResend(params.to, `Dispatch Notice: Order ${params.orderNumber} is on its way!`, html);
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
            <p style="margin: 0;">Questions? WhatsApp our Studio Concierge: +91 9861615937</p>
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
function sanitizePostgrestFilter(val) {
  if (!val || typeof val !== "string") return "";
  return val.replace(/[(),:.\\]/g, "").trim();
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
  whatsappNumber: "+919861615937",
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
  pickupContactPhone: "9861615937",
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
    const query = supabaseAdmin.from("orders").select(`
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
      `);
    const cleanId = String(orderIdentifier || "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!cleanId) {
      return { success: false, message: "Invalid order reference format." };
    }
    const { data: order, error: orderErr } = await query.or(`order_number.eq.${cleanId},id.eq.${cleanId}`).maybeSingle();
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

// server/lib/delhiveryService.ts
var trackingCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 5 * 60 * 1e3;
var DELIVERED_CACHE_TTL_MS = 60 * 60 * 1e3;
async function getDelhiveryApiKey() {
  const envKey = process.env.DELHIVERY_API_KEY?.trim();
  if (envKey) return envKey;
  try {
    const { data, error } = await supabaseAdmin.from("store_settings").select("delhivery_api_key").eq("id", "primary").maybeSingle();
    if (!error && data?.delhivery_api_key?.trim()) {
      return data.delhivery_api_key.trim();
    }
  } catch (err) {
    console.warn("[Delhivery Service] Failed to retrieve API key from store_settings:", err);
  }
  return "";
}
function getDelhiveryTrackingUrl(awbNumber) {
  const cleanAwb = encodeURIComponent(awbNumber.trim());
  return `https://www.delhivery.com/track/package/${cleanAwb}`;
}
async function fetchDelhiveryLiveTracking(awbNumber, options) {
  const cleanAwb = (awbNumber || "").trim().toUpperCase();
  if (!cleanAwb) {
    return {
      success: false,
      carrier: "DELHIVERY",
      awbNumber: "",
      status: "Unknown",
      scans: [],
      trackingUrl: "https://www.delhivery.com",
      isDelivered: false,
      errorMessage: "Invalid or missing AWB number."
    };
  }
  const trackingUrl = getDelhiveryTrackingUrl(cleanAwb);
  if (!options?.forceRefresh) {
    const cached = trackingCache.get(cleanAwb);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        ...cached.data,
        cachedAt: new Date(cached.expiresAt - (cached.data.isDelivered ? DELIVERED_CACHE_TTL_MS : CACHE_TTL_MS)).toISOString()
      };
    }
  }
  const token = options?.apiKey?.trim() || await getDelhiveryApiKey();
  if (!token) {
    return {
      success: false,
      carrier: "DELHIVERY",
      awbNumber: cleanAwb,
      status: "Dispatched",
      currentLocation: "In Transit with Courier",
      scans: [],
      trackingUrl,
      isDelivered: false,
      errorMessage: "Delhivery API key not configured. Tracking available via official Delhivery portal."
    };
  }
  try {
    const endpoint = `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(cleanAwb)}`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json"
      }
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.warn(`[Delhivery API Error] HTTP ${response.status} for AWB ${cleanAwb}:`, errorText);
      return {
        success: false,
        carrier: "DELHIVERY",
        awbNumber: cleanAwb,
        status: "In Transit",
        scans: [],
        trackingUrl,
        isDelivered: false,
        errorMessage: `Delhivery API returned status ${response.status}.`
      };
    }
    const json = await response.json();
    const shipmentDataList = Array.isArray(json?.ShipmentData) ? json.ShipmentData : [];
    const firstItem = shipmentDataList[0];
    const shipment = firstItem?.Shipment || firstItem || null;
    if (!shipment) {
      return {
        success: false,
        carrier: "DELHIVERY",
        awbNumber: cleanAwb,
        status: "Manifested",
        currentLocation: "Awaiting Courier Pickup",
        scans: [],
        trackingUrl,
        isDelivered: false,
        errorMessage: "Shipment data not yet available on Delhivery network."
      };
    }
    let statusText = "In Transit";
    let statusDateTime;
    let statusCode;
    let statusType;
    if (typeof shipment.Status === "string") {
      statusText = shipment.Status;
    } else if (shipment.Status && typeof shipment.Status === "object") {
      statusText = shipment.Status.Status || shipment.Status.status || statusText;
      statusDateTime = shipment.Status.StatusDateTime || shipment.Status.statusDateTime;
      statusCode = shipment.Status.StatusCode || shipment.Status.statusCode;
      statusType = shipment.Status.StatusType || shipment.Status.statusType;
    }
    const rawScans = Array.isArray(shipment.Scans) ? shipment.Scans : [];
    const normalizedScans = [];
    for (const scanItem of rawScans) {
      const detail = scanItem?.ScanDetail || scanItem;
      if (!detail) continue;
      const scanTime = detail.ScanDateTime || detail.scanDateTime || "";
      const scanDesc = detail.Scan || detail.scan || detail.Instructions || "In Transit";
      const scanLoc = detail.ScannedLocation || detail.scannedLocation || detail.ScannedCity || "Transit Hub";
      normalizedScans.push({
        scanDateTime: scanTime,
        scanType: detail.ScanType || detail.scanType,
        scan: scanDesc,
        scannedLocation: scanLoc,
        instructions: detail.Instructions || detail.instructions,
        statusCode: detail.StatusCode || detail.statusCode
      });
    }
    normalizedScans.sort((a, b) => {
      const tA = new Date(a.scanDateTime).getTime() || 0;
      const tB = new Date(b.scanDateTime).getTime() || 0;
      return tB - tA;
    });
    const latestScan = normalizedScans[0];
    const currentLocation = latestScan?.scannedLocation || shipment.Destination || "In Transit";
    const normalizedStatusLower = statusText.toLowerCase();
    const isDelivered = normalizedStatusLower.includes("deliver") && !normalizedStatusLower.includes("undeliver");
    const result = {
      success: true,
      carrier: "DELHIVERY",
      awbNumber: cleanAwb,
      status: statusText,
      statusType,
      statusCode,
      statusDateTime: statusDateTime || latestScan?.scanDateTime,
      currentLocation,
      origin: shipment.Origin || shipment.PickupLocation,
      destination: shipment.Destination,
      expectedDeliveryDate: shipment.ExpectedDeliveryDate || shipment.PromisedDeliveryDate || null,
      pickupDate: shipment.PickUpDate || shipment.PickUpTime || null,
      scans: normalizedScans,
      trackingUrl,
      isDelivered
    };
    const ttl = isDelivered ? DELIVERED_CACHE_TTL_MS : CACHE_TTL_MS;
    trackingCache.set(cleanAwb, {
      data: result,
      expiresAt: Date.now() + ttl
    });
    return result;
  } catch (err) {
    console.error(`[Delhivery Service Fetch Error] AWB ${cleanAwb}:`, err);
    return {
      success: false,
      carrier: "DELHIVERY",
      awbNumber: cleanAwb,
      status: "In Transit",
      scans: [],
      trackingUrl,
      isDelivered: false,
      errorMessage: err.message || "Failed to connect to Delhivery tracking service."
    };
  }
}

// server/handlers/orders/track.ts
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  try {
    const { orderNumber, phone, awbNumber, forceRefresh } = req.body || {};
    if (awbNumber && !orderNumber) {
      const liveTracking2 = await fetchDelhiveryLiveTracking(String(awbNumber), {
        forceRefresh: Boolean(forceRefresh)
      });
      return res.status(200).json({
        success: true,
        liveTracking: liveTracking2
      });
    }
    if (!orderNumber || typeof orderNumber !== "string") {
      return res.status(400).json({ success: false, message: "Order number is required." });
    }
    const cleanOrderNumber = orderNumber.trim().toUpperCase();
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);
    const { data: order, error: orderErr } = await supabaseAdmin.from("orders").select(`
        id,
        order_number,
        order_status,
        payment_status,
        subtotal_in_paise,
        discount_in_paise,
        shipping_fee_in_paise,
        total_in_paise,
        shipping_address_snapshot,
        guest_name,
        guest_phone,
        applied_coupon_code,
        created_at
      `).eq("order_number", cleanOrderNumber).maybeSingle();
    if (orderErr || !order) {
      return res.status(404).json({ success: false, message: "Order not found. Please check your order reference." });
    }
    if (order.payment_status !== "SUCCESS" && order.order_status === "PENDING_PAYMENT") {
      try {
        const [cfOrder, cfPayments] = await Promise.all([
          fetchCashfreeOrder(order.order_number),
          fetchCashfreePayments(order.order_number)
        ]);
        const successfulPayment = Array.isArray(cfPayments) ? cfPayments.find((p) => p.payment_status === "SUCCESS") : null;
        const isPaid = cfOrder?.order_status === "PAID" || Boolean(successfulPayment);
        if (isPaid) {
          const cfPaymentId = successfulPayment?.cf_payment_id ? String(successfulPayment.cf_payment_id) : cfOrder?.cf_order_id ? String(cfOrder.cf_order_id) : `cf_sync_${Date.now()}`;
          const paymentMethod = successfulPayment?.payment_group || "ONLINE";
          const syncResult = await confirmOrderPayment(
            order.order_number,
            { cfPaymentId, paymentMethod, paymentDetails: successfulPayment || cfOrder },
            "cashfree_track_sync"
          );
          if (syncResult.order) {
            order.order_status = syncResult.order.order_status;
            order.payment_status = syncResult.order.payment_status;
          }
        }
      } catch (syncErr) {
        console.warn("[Track Order Cashfree Sync Warning]:", syncErr);
      }
    }
    let isFullyAuthorized = false;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader) {
      try {
        const auth = await verifyAuth(req);
        if (auth.user) {
          const isStaff = ["super_admin", "admin", "operations", "support"].includes(auth.user.role);
          const isOwner = Boolean(order.customer_id && order.customer_id === auth.user.id);
          if (isStaff || isOwner) {
            isFullyAuthorized = true;
          }
        }
      } catch {
      }
    }
    const storedPhone = (order.guest_phone || "").replace(/\D/g, "").slice(-10);
    if (cleanPhone) {
      if (storedPhone && storedPhone === cleanPhone) {
        isFullyAuthorized = true;
      } else {
        return res.status(403).json({ success: false, message: "The phone number provided does not match this order." });
      }
    }
    let sanitizedAddress = order.shipping_address_snapshot;
    if (!isFullyAuthorized && order.shipping_address_snapshot) {
      const snap = order.shipping_address_snapshot;
      const rawName = snap.recipientName || order.guest_name || "";
      const maskedName = rawName.length > 2 ? `${rawName[0]}*** ${rawName.slice(-1)}` : "***";
      sanitizedAddress = {
        recipientName: maskedName,
        city: snap.city || "",
        state: snap.state || "",
        pincode: snap.pincode ? `${snap.pincode.slice(0, 3)}***` : ""
      };
    }
    const { data: items } = await supabaseAdmin.from("order_items").select("product_code, product_name, unit_price_in_paise, quantity, selected_color, gift_wrap, item_image").eq("order_id", order.id);
    const { data: history } = await supabaseAdmin.from("order_status_history").select("previous_status, new_status, note, created_at").eq("order_id", order.id).order("created_at", { ascending: true });
    const { data: shipment } = await supabaseAdmin.from("shipments").select("carrier, awb_number, tracking_url, status, estimated_delivery_date").eq("order_id", order.id).maybeSingle();
    let liveTracking = null;
    if (shipment?.awb_number) {
      const carrierUpper = (shipment.carrier || "").toUpperCase();
      if (carrierUpper === "DELHIVERY" || !carrierUpper) {
        try {
          liveTracking = await fetchDelhiveryLiveTracking(shipment.awb_number, {
            forceRefresh: Boolean(forceRefresh)
          });
        } catch (delhiveryErr) {
          console.warn("[Track Order Delhivery Live Warning]:", delhiveryErr);
        }
      }
    }
    const enrichedShipment = shipment ? {
      ...shipment,
      tracking_url: shipment.tracking_url || (shipment.awb_number ? `https://www.delhivery.com/track/package/${encodeURIComponent(shipment.awb_number)}` : null),
      estimated_delivery_date: shipment.estimated_delivery_date || liveTracking?.expectedDeliveryDate || null,
      liveTracking
    } : null;
    return res.status(200).json({
      success: true,
      order: {
        orderNumber: order.order_number,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        subtotalInRupees: order.subtotal_in_paise / 100,
        discountInRupees: order.discount_in_paise / 100,
        shippingFeeInRupees: order.shipping_fee_in_paise / 100,
        totalInRupees: order.total_in_paise / 100,
        shippingAddress: sanitizedAddress,
        isAddressMasked: !isFullyAuthorized,
        createdAt: order.created_at,
        items: items || [],
        history: history || [],
        shipment: enrichedShipment,
        liveTracking
      }
    });
  } catch (err) {
    console.error("[Track Order Error]", err);
    return res.status(500).json({ success: false, message: "Failed to retrieve order tracking information." });
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

// server/handlers/orders/cancel.ts
async function handler2(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  const authUser = await requireAuth(req, res);
  if (!authUser) return;
  try {
    const { orderId, reason } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }
    const { data: order, error: orderErr } = await supabaseAdmin.from("orders").select("id, order_number, order_status, payment_status, customer_id, loyalty_points_redeemed").eq("id", orderId).maybeSingle();
    if (orderErr || !order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    const hasCancelPerm = authUser.role === "super_admin" || authUser.role === "admin" || authUser.role === "operations" || Array.isArray(authUser.permissions) && authUser.permissions.includes("orders.cancel");
    const isOwnerCustomer = Boolean(order.customer_id && order.customer_id === authUser.id);
    if (!hasCancelPerm && !isOwnerCustomer) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to cancel this order."
      });
    }
    if (order.order_status === "CANCELLED") {
      return res.status(200).json({ success: true, message: "Order is already cancelled." });
    }
    const nonCancellableStatuses = ["PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
    if (nonCancellableStatuses.includes(order.order_status)) {
      return res.status(400).json({
        success: false,
        message: "Crafting for this made-to-order piece is already in progress in our studio. Made-to-order creations cannot be cancelled once crafting has commenced."
      });
    }
    const wasInventoryDecremented = order.payment_status === "SUCCESS" || order.order_status === "PAYMENT_CONFIRMED";
    if (wasInventoryDecremented) {
      const { data: items } = await supabaseAdmin.from("order_items").select("product_id, quantity").eq("order_id", order.id);
      if (items && items.length > 0) {
        for (const item of items) {
          if (item.product_id) {
            const { data: prod } = await supabaseAdmin.from("products").select("inventory_count, is_made_to_order").eq("id", item.product_id).maybeSingle();
            if (prod && !prod.is_made_to_order) {
              await supabaseAdmin.from("products").update({ inventory_count: (prod.inventory_count || 0) + item.quantity }).eq("id", item.product_id);
            }
          }
        }
      }
    }
    const loyaltyReversal = await reverseOrderLoyalty(order.id, reason || "Order cancelled", false);
    await supabaseAdmin.from("orders").update({ order_status: "CANCELLED" }).eq("id", order.id);
    await supabaseAdmin.from("order_status_history").insert({
      order_id: order.id,
      previous_status: order.order_status,
      new_status: "CANCELLED",
      note: reason || "Order cancelled; stock and points restored.",
      created_by: authUser.email
    });
    return res.status(200).json({
      success: true,
      message: `Order ${order.order_number} has been successfully cancelled.`
    });
  } catch (err) {
    console.error("[Order Cancellation Error]", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to cancel order." });
  }
}

// server/handlers/orders/notify.ts
async function handler3(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  const authUser = await requireAuth(req, res, { allowedRoles: ["super_admin", "admin", "operations"] });
  if (!authUser) return;
  try {
    const { orderId, awbNumber, carrier, trackingUrl, estimatedDelivery } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }
    const { data: order, error: orderErr } = await supabaseAdmin.from("orders").select(`
        id,
        order_number,
        guest_name,
        guest_phone,
        guest_email,
        shipping_address_snapshot,
        order_status
      `).eq("id", orderId).maybeSingle();
    if (orderErr || !order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    const cleanPhone = (order.guest_phone || "").replace(/\D/g, "").slice(-10);
    const trackingLink = trackingUrl || `https://thepetalandbloom.vercel.app/track?order_id=${order.order_number}`;
    let emailSent = false;
    if (order.guest_email) {
      emailSent = await sendDispatchEmail({
        to: order.guest_email,
        name: order.guest_name,
        orderNumber: order.order_number,
        carrier: carrier || "Studio Express Courier",
        awbNumber: awbNumber || "TPB-DIRECT",
        trackingUrl: trackingLink,
        estimatedDelivery: estimatedDelivery || "3\u20135 business days",
        shippingAddress: order.shipping_address_snapshot || {
          addressLine1: "Address on file",
          city: "",
          state: "",
          pincode: ""
        }
      });
    }
    const waText = [
      `\u{1F338} *The Petal & Bloom Studio Dispatch*`,
      ``,
      `Dear ${order.guest_name},`,
      `Your bespoke blooms for Order *${order.order_number}* have been crafted and safely packed!`,
      ``,
      carrier && `\u{1F4E6} *Courier:* ${carrier}`,
      awbNumber && `\u{1F522} *AWB Number:* ${awbNumber}`,
      `\u{1F4CD} *Track Live:* ${trackingLink}`,
      ``,
      `Thank you for letting us create something meaningful for you! If you have any delivery requests, feel free to reply directly here. \u2728`
    ].filter(Boolean).join("\n");
    const whatsappLink = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(waText)}`;
    return res.status(200).json({
      success: true,
      message: "Notification processed successfully.",
      emailSent,
      whatsappLink,
      recipientPhone: cleanPhone
    });
  } catch (err) {
    console.error("[Notify API Error]", err);
    return res.status(500).json({ success: false, message: err.message || "Notification failed." });
  }
}

// server/lib/orderExpirationService.ts
async function expireStalePendingOrders(olderThanMinutes = 60) {
  const result = {
    expiredCount: 0,
    restoredPointsCount: 0,
    expiredOrderNumbers: []
  };
  try {
    const cutoffDate = new Date(Date.now() - olderThanMinutes * 60 * 1e3).toISOString();
    const { data: staleOrders, error } = await supabaseAdmin.from("orders").select("id, order_number, customer_id, loyalty_points_redeemed, created_at, payments(provider)").eq("order_status", "PENDING_PAYMENT").lt("created_at", cutoffDate).limit(100);
    if (error || !staleOrders || staleOrders.length === 0) {
      return result;
    }
    const manualCutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1e3).toISOString();
    for (const order of staleOrders) {
      const isManualUpi = order.payments?.some?.((p) => p.provider === "MANUAL_UPI");
      if (isManualUpi && order.created_at > manualCutoffDate) {
        continue;
      }
      if (order.customer_id && (order.loyalty_points_redeemed || 0) > 0) {
        try {
          const rev = await reverseOrderLoyalty(order.id, "Expired checkout; points refunded", false);
          result.restoredPointsCount += rev.restoredRedeemed;
        } catch (revErr) {
          console.warn(`[Order Expiration] Failed to restore points for order ${order.order_number}:`, revErr);
        }
      }
      const { error: updateErr } = await supabaseAdmin.from("orders").update({
        order_status: "PAYMENT_EXPIRED",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", order.id);
      if (!updateErr) {
        result.expiredCount++;
        result.expiredOrderNumbers.push(order.order_number);
        await supabaseAdmin.from("order_status_history").insert({
          order_id: order.id,
          previous_status: "PENDING_PAYMENT",
          new_status: "PAYMENT_EXPIRED",
          note: `Automatically expired after ${olderThanMinutes} minutes of payment inactivity.`,
          created_by: "system_sweeper"
        });
      }
    }
  } catch (err) {
    console.error("[Expire Stale Orders Error]:", err);
  }
  return result;
}

// server/handlers/orders/expire-pending.ts
async function handler4(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.query.secret || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const isSecretValid = Boolean(cronSecret && providedSecret === cronSecret);
  let isAuthorized = isVercelCron || isSecretValid;
  if (!isAuthorized && req.headers.authorization) {
    const auth = await verifyAuth(req);
    if (auth.user && (auth.user.role === "super_admin" || auth.user.role === "admin" || auth.user.role === "operations")) {
      isAuthorized = true;
    }
  }
  if (!isAuthorized) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Sweeper requires administrative credentials or valid cron secret."
    });
  }
  try {
    const olderThanMinutes = Number(req.query.minutes || req.body?.minutes) || 60;
    const result = await expireStalePendingOrders(olderThanMinutes);
    return res.status(200).json({
      success: true,
      message: `Cleaned up ${result.expiredCount} expired checkouts.`,
      result
    });
  } catch (err) {
    console.error("[Expire Pending Endpoint Error]:", err);
    return res.status(500).json({ success: false, message: err.message || "Sweeper failed" });
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

// src/services/shippingService.ts
function generateTrackingUrl(carrier, awbNumber) {
  const cleanAwb = awbNumber.trim();
  if (!cleanAwb) return "";
  switch (carrier) {
    case "DELHIVERY":
      return `https://www.delhivery.com/track/package/${cleanAwb}`;
    case "SHIPROCKET":
      return `https://shiprocket.co//tracking/${cleanAwb}`;
    case "INDIA_POST":
      return `https://www.indiapost.gov.in/_layouts/15/dpt.cept.tracking/trackconsignment.aspx?consignmentNumber=${cleanAwb}`;
    case "MANUAL":
    default:
      return "";
  }
}

// server/handlers/admin/orders/create.ts
async function handler5(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  const authUser = await requireAuth(req, res, {
    allowedRoles: ["super_admin", "admin", "operations"]
  });
  if (!authUser) return;
  try {
    const body = req.body || {};
    const {
      customer,
      shippingAddress,
      items,
      discountInRupees = 0,
      shippingFeeInRupees = 0,
      orderStatus,
      paymentStatus = "SUCCESS",
      paymentMethod = "MANUAL_UPI",
      orderDate,
      adminNote,
      shipment
    } = body;
    if (!customer?.name?.trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required." });
    }
    const cleanPhone = (customer.phone || "").replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "A valid 10-digit Indian mobile number is required."
      });
    }
    const cleanEmail = customer.email?.trim() || null;
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Invalid customer email address format." });
    }
    if (!shippingAddress?.addressLine1?.trim() || !shippingAddress?.city?.trim() || !shippingAddress?.state?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Complete shipping address (Address Line 1, City, State) is required."
      });
    }
    const cleanPincode = (shippingAddress.pincode || "").replace(/\D/g, "");
    if (cleanPincode.length !== 6) {
      return res.status(400).json({
        success: false,
        message: "A valid 6-digit postal PIN code is required."
      });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one purchased item is required." });
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productName?.trim()) {
        return res.status(400).json({ success: false, message: `Item #${i + 1} is missing product name.` });
      }
      if (typeof it.unitPriceInRupees !== "number" || it.unitPriceInRupees < 0) {
        return res.status(400).json({
          success: false,
          message: `Item #${i + 1} (${it.productName}) has an invalid unit price.`
        });
      }
      if (!it.quantity || it.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Item #${i + 1} (${it.productName}) must have a quantity of at least 1.`
        });
      }
    }
    const subtotalInPaise = items.reduce((acc, it) => {
      const unitPaise = Math.round(Number(it.unitPriceInRupees) * 100);
      return acc + unitPaise * Number(it.quantity);
    }, 0);
    const discountInPaise = Math.max(0, Math.round(Number(discountInRupees) * 100));
    const shippingFeeInPaise = Math.max(0, Math.round(Number(shippingFeeInRupees) * 100));
    const totalInPaise = Math.max(0, subtotalInPaise - discountInPaise + shippingFeeInPaise);
    let linkedCustomerId = null;
    try {
      const safePhone = sanitizePostgrestFilter(cleanPhone);
      const safeEmail = cleanEmail ? sanitizePostgrestFilter(cleanEmail) : null;
      const { data: profile } = await supabaseAdmin.from("customer_profiles").select("id, user_id, phone, email").or(`phone.eq.${safePhone}${safeEmail ? `,email.eq.${safeEmail}` : ""}`).maybeSingle();
      if (profile?.user_id) {
        linkedCustomerId = profile.user_id;
      } else if (profile?.id) {
        linkedCustomerId = profile.id;
      }
    } catch (profileErr) {
      console.warn("[Admin Create Order Customer Link Notice]:", profileErr);
    }
    const orderNumber = `TPB-ADM-${Date.now().toString(36).toUpperCase()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    let createdAt = (/* @__PURE__ */ new Date()).toISOString();
    if (orderDate && !isNaN(new Date(orderDate).getTime())) {
      createdAt = new Date(orderDate).toISOString();
    }
    let finalOrderStatus = orderStatus;
    if (!finalOrderStatus) {
      if (paymentStatus === "SUCCESS") {
        finalOrderStatus = "PAYMENT_CONFIRMED";
      } else {
        finalOrderStatus = "PENDING_PAYMENT";
      }
    }
    const addressSnapshot = {
      recipientName: shippingAddress.recipientName?.trim() || customer.name.trim(),
      phone: (shippingAddress.phone || "").replace(/\D/g, "").slice(-10) || cleanPhone,
      addressLine1: shippingAddress.addressLine1.trim(),
      addressLine2: (shippingAddress.addressLine2 || "").trim(),
      city: shippingAddress.city.trim(),
      state: shippingAddress.state.trim(),
      pincode: cleanPincode
    };
    const { data: newOrder, error: orderErr } = await supabaseAdmin.from("orders").insert({
      order_number: orderNumber,
      customer_id: linkedCustomerId,
      guest_name: customer.name.trim(),
      guest_phone: cleanPhone,
      guest_email: cleanEmail,
      shipping_address_snapshot: addressSnapshot,
      subtotal_in_paise: subtotalInPaise,
      discount_in_paise: discountInPaise,
      loyalty_points_redeemed: 0,
      loyalty_discount_in_paise: 0,
      shipping_fee_in_paise: shippingFeeInPaise,
      total_in_paise: totalInPaise,
      order_status: finalOrderStatus,
      payment_status: paymentStatus,
      customer_note: adminNote?.trim() || "Recorded manually from offline studio purchase.",
      created_at: createdAt
    }).select("id, order_number, order_status, payment_status, total_in_paise, created_at").single();
    if (orderErr || !newOrder) {
      console.error("[Admin Create Order Database Error]:", orderErr);
      return res.status(500).json({
        success: false,
        message: orderErr?.message || "Failed to save order to database.",
        error: orderErr
      });
    }
    const itemsPayload = items.map((it, idx) => {
      const unitPaise = Math.round(Number(it.unitPriceInRupees) * 100);
      const totalPaise = unitPaise * Number(it.quantity);
      const code = it.productCode?.trim() || `BESPOKE-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;
      return {
        order_id: newOrder.id,
        product_code: code,
        product_name: it.productName.trim(),
        unit_price_in_paise: unitPaise,
        quantity: Number(it.quantity),
        total_price_in_paise: totalPaise,
        selected_color: it.selectedColor?.trim() || null,
        gift_wrap: Boolean(it.giftWrap),
        personal_message: it.personalMessage?.trim() || null,
        item_image: it.itemImage || null
      };
    });
    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsPayload);
    if (itemsErr) {
      console.error("[Admin Create Order Items Error]:", itemsErr);
    }
    try {
      await supabaseAdmin.from("order_status_history").insert({
        order_id: newOrder.id,
        previous_status: null,
        new_status: finalOrderStatus,
        note: `Order recorded manually by ${authUser.email}. ${adminNote ? `Note: ${adminNote.trim()}` : ""}`.trim(),
        created_by: authUser.email,
        created_at: createdAt
      });
    } catch (histErr) {
      console.warn("[Admin Create Order History Warning]:", histErr);
    }
    const carrier = shipment?.carrier || "DELHIVERY";
    const cleanAwb = (shipment?.awbNumber || "").trim();
    if (cleanAwb || finalOrderStatus === "SHIPPED" || finalOrderStatus === "DELIVERED") {
      try {
        const trackingUrl = shipment?.customTrackingUrl?.trim() || generateTrackingUrl(carrier, cleanAwb) || (cleanAwb ? `https://www.delhivery.com/track/package/${encodeURIComponent(cleanAwb)}` : "");
        await supabaseAdmin.from("shipments").insert({
          order_id: newOrder.id,
          carrier,
          awb_number: cleanAwb || null,
          tracking_url: trackingUrl || null,
          status: finalOrderStatus === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT",
          created_at: createdAt
        });
      } catch (shipErr) {
        console.warn("[Admin Create Order Shipment Warning]:", shipErr);
      }
    }
    try {
      await supabaseAdmin.from("payments").insert({
        order_id: newOrder.id,
        amount_in_paise: totalInPaise,
        status: paymentStatus,
        payment_method: paymentMethod || "MANUAL_UPI",
        created_at: createdAt
      });
    } catch (payErr) {
      console.warn("[Admin Create Order Payment Warning]:", payErr);
    }
    try {
      await logAuditEvent({
        actor_id: authUser.id,
        actor_email: authUser.email,
        actor_role: authUser.role,
        action: "ORDER_MANUALLY_RECORDED",
        entity: "orders",
        entity_id: newOrder.order_number,
        new_values: {
          order_number: newOrder.order_number,
          total_in_rupees: totalInPaise / 100,
          customer_name: customer.name.trim(),
          customer_phone: cleanPhone,
          items_count: items.length,
          order_status: finalOrderStatus,
          payment_status: paymentStatus,
          carrier: cleanAwb ? carrier : null,
          awb_number: cleanAwb || null
        },
        reason: adminNote?.trim() || "Manual offline sale recorded by studio admin"
      });
    } catch (auditErr) {
      console.warn("[Admin Create Order Audit Warning]:", auditErr);
    }
    return res.status(201).json({
      success: true,
      message: `Order #${newOrder.order_number} successfully recorded in atelier archive.`,
      order: {
        id: newOrder.id,
        orderNumber: newOrder.order_number,
        orderStatus: newOrder.order_status,
        paymentStatus: newOrder.payment_status,
        totalInRupees: newOrder.total_in_paise / 100,
        createdAt: newOrder.created_at
      }
    });
  } catch (err) {
    console.error("[Admin Order Creation Exception]:", err);
    const msg = err.message || "Failed to record manual order.";
    return res.status(500).json({ success: false, message: msg, error: msg });
  }
}

// server/handlers/admin/orders/update-status.ts
async function handler6(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  const authUser = await requireAuth(req, res, {
    requiredPermission: "orders.update_status"
  });
  if (!authUser) return;
  try {
    const {
      orderId,
      newStatus,
      statusNote,
      carrier = "DELHIVERY",
      awbNumber,
      customTrackingUrl
    } = req.body || {};
    if (!orderId || !newStatus) {
      return res.status(400).json({ success: false, message: "orderId and newStatus are required." });
    }
    if (newStatus === "CANCELLED") {
      const hasCancelPerm = authUser.role === "super_admin" || authUser.role === "admin" || authUser.role === "operations" || Array.isArray(authUser.permissions) && authUser.permissions.includes("orders.cancel");
      if (!hasCancelPerm) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Missing capability permission "orders.cancel" to cancel an order.'
        });
      }
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    let orderQuery = supabaseAdmin.from("orders").select("id, order_number, order_status, payment_status, applied_coupon_code, customer_id, guest_phone, discount_in_paise, guest_name, guest_email, shipping_address_snapshot");
    if (isUuid) {
      orderQuery = orderQuery.eq("id", orderId);
    } else {
      orderQuery = orderQuery.eq("order_number", orderId);
    }
    const { data: order, error: fetchErr } = await orderQuery.maybeSingle();
    if (fetchErr) {
      console.error("[Admin Update Status Fetch Error]:", fetchErr);
      return res.status(500).json({ success: false, message: fetchErr.message || "Database connection error.", error: fetchErr.message || "Database connection error." });
    }
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found.", error: "Order not found." });
    }
    const previousStatus = order.order_status;
    const isPaidStatus = [
      "PAYMENT_CONFIRMED",
      "ORDER_CONFIRMED",
      "PROCESSING",
      "PACKED",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED"
    ].includes(newStatus);
    const updatePayload = {
      order_status: newStatus,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (isPaidStatus) {
      updatePayload.payment_status = "SUCCESS";
    }
    const { error: updateErr } = await supabaseAdmin.from("orders").update(updatePayload).eq("id", order.id);
    if (updateErr) {
      throw updateErr;
    }
    if (isPaidStatus) {
      try {
        const { data: existingPayment } = await supabaseAdmin.from("payments").select("id, status").eq("order_id", order.id).maybeSingle();
        if (existingPayment) {
          if (existingPayment.status !== "SUCCESS") {
            await supabaseAdmin.from("payments").update({ status: "SUCCESS", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", existingPayment.id);
          }
        } else {
          await supabaseAdmin.from("payments").insert({
            order_id: order.id,
            amount_in_paise: 0,
            status: "SUCCESS",
            payment_method: "ADMIN_CONFIRMED"
          });
        }
      } catch (payErr) {
        console.warn("[Admin Update Status Payment Sync Warning]:", payErr);
      }
      if (order.applied_coupon_code) {
        try {
          const { data: coupon } = await supabaseAdmin.from("coupons").select("id, usage_count").eq("code", order.applied_coupon_code).maybeSingle();
          if (coupon) {
            const { data: existingRedemption } = await supabaseAdmin.from("coupon_redemptions").select("id").eq("order_id", order.id).eq("coupon_id", coupon.id).maybeSingle();
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
          console.warn("[Admin Update Status Coupon Sync Warning]:", couponErr);
        }
      }
    }
    const noteText = statusNote?.trim() || `Status updated to ${newStatus} by ${authUser.email}`;
    try {
      await supabaseAdmin.from("order_status_history").insert({
        order_id: order.id,
        previous_status: previousStatus,
        new_status: newStatus,
        note: noteText,
        created_by: authUser.email
      });
    } catch (histErr) {
      console.warn("[Admin Update Status History Warning]:", histErr);
    }
    let finalTrackingUrl = "";
    if (newStatus === "SHIPPED" || awbNumber?.trim()) {
      try {
        const cleanAwb = (awbNumber || "").trim();
        finalTrackingUrl = (customTrackingUrl || "").trim() || generateTrackingUrl(carrier, cleanAwb) || `https://thepetalandbloom.vercel.app/track?order_id=${order.order_number}`;
        const { data: existingShip } = await supabaseAdmin.from("shipments").select("id").eq("order_id", order.id).maybeSingle();
        if (existingShip) {
          await supabaseAdmin.from("shipments").update({
            carrier,
            awb_number: cleanAwb || null,
            tracking_url: finalTrackingUrl || null,
            status: newStatus === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT",
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", existingShip.id);
        } else {
          await supabaseAdmin.from("shipments").insert({
            order_id: order.id,
            carrier,
            awb_number: cleanAwb || null,
            tracking_url: finalTrackingUrl || null,
            status: newStatus === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT"
          });
        }
        if (newStatus === "SHIPPED" && order.guest_email && cleanAwb) {
          try {
            await sendDispatchEmail({
              to: order.guest_email,
              name: order.guest_name || "Valued Collector",
              orderNumber: order.order_number,
              carrier,
              awbNumber: cleanAwb,
              trackingUrl: finalTrackingUrl,
              estimatedDelivery: "3\u20135 business days",
              shippingAddress: order.shipping_address_snapshot || {
                addressLine1: "Address on file",
                city: "",
                state: "",
                pincode: ""
              }
            });
          } catch (emailErr) {
            console.warn("[Dispatch Email Warning]:", emailErr);
          }
        }
      } catch (shipErr) {
        console.warn("[Admin Update Status Shipment Warning]:", shipErr);
      }
    }
    try {
      await logAuditEvent({
        actor_id: authUser.id,
        actor_email: authUser.email,
        actor_role: authUser.role,
        action: newStatus === "CANCELLED" ? AUDIT_ACTIONS.ORDER_CANCELLED : AUDIT_ACTIONS.ORDER_STATUS_TRANSITION,
        entity: "orders",
        entity_id: order.order_number,
        old_values: { order_status: previousStatus },
        new_values: {
          order_status: newStatus,
          carrier,
          awb_number: awbNumber?.trim() || null,
          tracking_url: finalTrackingUrl || null
        },
        reason: noteText
      });
    } catch (auditErr) {
      console.warn("[Admin Update Status Audit Warning]:", auditErr);
    }
    return res.status(200).json({
      success: true,
      orderNumber: order.order_number,
      previousStatus,
      newStatus,
      message: `Order ${order.order_number} successfully transitioned to ${newStatus}.`
    });
  } catch (err) {
    console.error("[Admin Order Update Error]:", err);
    const msg = err.message || "Failed to update order status.";
    return res.status(500).json({ success: false, message: msg, error: msg });
  }
}

// server/api/orders.ts
async function handler7(req, res) {
  const url = req.url || "";
  const pathname = url.split("?")[0];
  if (pathname.includes("/track")) {
    return handler(req, res);
  }
  if (pathname.includes("/cancel")) {
    return handler2(req, res);
  }
  if (pathname.includes("/notify")) {
    return handler3(req, res);
  }
  if (pathname.includes("/expire-pending")) {
    return handler4(req, res);
  }
  if (pathname.includes("/create")) {
    return handler5(req, res);
  }
  if (pathname.includes("/update-status")) {
    return handler6(req, res);
  }
  return res.status(404).json({ success: false, message: `Route not found on orders domain: ${pathname}` });
}
export {
  handler7 as default
};
