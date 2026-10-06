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
async function createCashfreePGOrder(params) {
  const config = getCashfreeConfig();
  const isCredentialsConfigured = Boolean(config.appId && config.secretKey);
  if (!isCredentialsConfigured) {
    console.log(`[Cashfree Simulator] Emulating payment session for order: ${params.orderId}`);
    return {
      cfOrderId: `cf_sim_${params.orderId}`,
      paymentSessionId: `session_sim_${params.orderId}_${Date.now()}`,
      orderStatus: "ACTIVE",
      isSimulated: true
    };
  }
  const endpoint = `${config.baseUrl}/orders`;
  const body = {
    order_id: params.orderId,
    order_amount: Number(params.orderAmount.toFixed(2)),
    order_currency: "INR",
    customer_details: {
      customer_id: params.customerDetails.customerId,
      customer_name: params.customerDetails.customerName,
      customer_phone: params.customerDetails.customerPhone,
      customer_email: params.customerDetails.customerEmail || `${params.customerDetails.customerPhone}@thepetalandbloom.in`
    },
    order_meta: {
      return_url: params.returnUrl
    }
  };
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-client-id": config.appId,
        "x-client-secret": config.secretKey,
        "x-api-version": config.apiVersion,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) {
      console.warn("[Cashfree Sandbox Notice]", data);
      console.warn("[Cashfree Fallback] Automatically utilizing Developer Sandbox Simulator.");
      return {
        cfOrderId: `cf_sim_${params.orderId}`,
        paymentSessionId: `session_sim_${params.orderId}_${Date.now()}`,
        orderStatus: "ACTIVE",
        isSimulated: true
      };
    }
    return {
      cfOrderId: data.order_id || String(data.cf_order_id),
      paymentSessionId: data.payment_session_id,
      orderStatus: data.order_status,
      isSimulated: false
    };
  } catch (err) {
    console.warn("[Cashfree Fetch Error, fallback to simulator]:", err.message);
    return {
      cfOrderId: `cf_sim_${params.orderId}`,
      paymentSessionId: `session_sim_${params.orderId}_${Date.now()}`,
      orderStatus: "ACTIVE",
      isSimulated: true
    };
  }
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

// server/lib/couponEngine.ts
function getScopeMismatchMessage(coupon) {
  const scope = coupon.scope_type || "ALL";
  if (scope === "CATEGORIES" && coupon.applicable_categories?.length) {
    const cats = coupon.applicable_categories.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ");
    return `This coupon is valid only on items in: ${cats}. Add an eligible item to your cart!`;
  }
  if (scope === "SPECIFIC_PRODUCTS") {
    return "This coupon is valid only for selected promotional arrangements.";
  }
  if (scope === "PRICE_TIER" && (coupon.min_product_price_in_paise || 0) > 0) {
    const minRupees = Math.round((coupon.min_product_price_in_paise || 0) / 100);
    return `This coupon applies to premium pieces priced \u20B9${minRupees} or above.`;
  }
  if (scope === "OCCASION" && coupon.applicable_occasions?.length) {
    const occs = coupon.applicable_occasions.map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join(", ");
    return `This promotional code applies only to ${occs} collection items.`;
  }
  if (scope === "CUSTOM_COMPOUND") {
    return "Your cart does not meet the specific promotional criteria for this coupon.";
  }
  return "Your cart does not contain items eligible for this promotion.";
}
function isProductEligibleForCoupon(coupon, product) {
  const scope = coupon.scope_type || "ALL";
  switch (scope) {
    case "ALL":
      return true;
    case "CATEGORIES": {
      if (!coupon.applicable_categories || coupon.applicable_categories.length === 0) return true;
      const prodCategory = (product.category_slug || "").toLowerCase().trim();
      return coupon.applicable_categories.some(
        (cat) => cat.toLowerCase().trim() === prodCategory
      );
    }
    case "SPECIFIC_PRODUCTS": {
      if (!coupon.applicable_product_codes || coupon.applicable_product_codes.length === 0) return false;
      const prodCode = product.code.toUpperCase().trim();
      return coupon.applicable_product_codes.some(
        (code) => code.toUpperCase().trim() === prodCode
      );
    }
    case "PRICE_TIER": {
      const minPrice = coupon.min_product_price_in_paise || 0;
      return product.price_in_paise >= minPrice;
    }
    case "OCCASION": {
      if (!coupon.applicable_occasions || coupon.applicable_occasions.length === 0) return true;
      const prodOccasions = (product.occasions || []).map((o) => o.toLowerCase().trim());
      return coupon.applicable_occasions.some(
        (occ) => prodOccasions.includes(occ.toLowerCase().trim())
      );
    }
    case "CUSTOM_COMPOUND": {
      if (coupon.applicable_categories && coupon.applicable_categories.length > 0) {
        const prodCategory = (product.category_slug || "").toLowerCase().trim();
        const matchesCategory = coupon.applicable_categories.some(
          (cat) => cat.toLowerCase().trim() === prodCategory
        );
        if (!matchesCategory) return false;
      }
      if (coupon.applicable_product_codes && coupon.applicable_product_codes.length > 0) {
        const prodCode = product.code.toUpperCase().trim();
        const matchesProduct = coupon.applicable_product_codes.some(
          (code) => code.toUpperCase().trim() === prodCode
        );
        if (!matchesProduct) return false;
      }
      if ((coupon.min_product_price_in_paise || 0) > 0) {
        if (product.price_in_paise < (coupon.min_product_price_in_paise || 0)) {
          return false;
        }
      }
      if (coupon.applicable_occasions && coupon.applicable_occasions.length > 0) {
        const prodOccasions = (product.occasions || []).map((o) => o.toLowerCase().trim());
        const matchesOccasion = coupon.applicable_occasions.some(
          (occ) => prodOccasions.includes(occ.toLowerCase().trim())
        );
        if (!matchesOccasion) return false;
      }
      return true;
    }
    default:
      return true;
  }
}
function evaluateCoupon(params) {
  const { coupon, items, productsMap, cartSubtotalInPaise } = params;
  if (!coupon.active) {
    return {
      isValid: false,
      discountInPaise: 0,
      discountInRupees: 0,
      eligibleSubtotalInPaise: 0,
      totalCartInPaise: 0,
      eligibleProductCodes: [],
      eligibleItemsCount: 0,
      message: "This promotional code is no longer active."
    };
  }
  if (coupon.expires_at && new Date(coupon.expires_at) <= /* @__PURE__ */ new Date()) {
    return {
      isValid: false,
      discountInPaise: 0,
      discountInRupees: 0,
      eligibleSubtotalInPaise: 0,
      totalCartInPaise: 0,
      eligibleProductCodes: [],
      eligibleItemsCount: 0,
      message: "This coupon has expired."
    };
  }
  if (coupon.usage_limit !== null && coupon.usage_limit !== void 0) {
    if ((coupon.usage_count || 0) >= coupon.usage_limit) {
      return {
        isValid: false,
        discountInPaise: 0,
        discountInRupees: 0,
        eligibleSubtotalInPaise: 0,
        totalCartInPaise: 0,
        eligibleProductCodes: [],
        eligibleItemsCount: 0,
        message: "This coupon has reached its total usage limit."
      };
    }
  }
  const scope = coupon.scope_type || "ALL";
  const cartMixMode = coupon.cart_mix_mode || "ALLOW_MIXED";
  const hasItems = Array.isArray(items) && items.length > 0 && productsMap && productsMap.size > 0;
  let totalCartInPaise = 0;
  let eligibleSubtotalInPaise = 0;
  const eligibleProductCodes = [];
  let eligibleItemsCount = 0;
  let ineligibleItemsCount = 0;
  if (hasItems) {
    for (const item of items) {
      if (item.code.startsWith("ADDON-")) continue;
      const trimmedCode = (item.code || "").trim();
      const product = productsMap.get(trimmedCode) || productsMap.get(trimmedCode.toUpperCase()) || productsMap.get(trimmedCode.toLowerCase());
      if (!product || product.is_active === false) continue;
      const qty = Math.max(1, Math.min(50, Math.floor(Number(item.quantity) || 1)));
      const lineItemTotalInPaise = product.price_in_paise * qty;
      totalCartInPaise += lineItemTotalInPaise;
      const isEligible = isProductEligibleForCoupon(coupon, product);
      if (isEligible) {
        eligibleSubtotalInPaise += lineItemTotalInPaise;
        eligibleProductCodes.push(product.code);
        eligibleItemsCount += qty;
      } else {
        ineligibleItemsCount += qty;
      }
    }
  } else {
    totalCartInPaise = Math.max(0, Number(cartSubtotalInPaise) || 0);
    if (scope === "ALL") {
      eligibleSubtotalInPaise = totalCartInPaise;
      eligibleItemsCount = 1;
    } else {
      eligibleSubtotalInPaise = 0;
    }
  }
  if (scope !== "ALL" && eligibleSubtotalInPaise <= 0) {
    return {
      isValid: false,
      couponId: coupon.id,
      code: coupon.code,
      discountInPaise: 0,
      discountInRupees: 0,
      eligibleSubtotalInPaise: 0,
      totalCartInPaise,
      eligibleProductCodes: [],
      eligibleItemsCount: 0,
      message: getScopeMismatchMessage(coupon)
    };
  }
  if (scope !== "ALL" && cartMixMode === "STRICT_EXCLUSIVE" && ineligibleItemsCount > 0) {
    return {
      isValid: false,
      couponId: coupon.id,
      code: coupon.code,
      discountInPaise: 0,
      discountInRupees: 0,
      eligibleSubtotalInPaise,
      totalCartInPaise,
      eligibleProductCodes,
      eligibleItemsCount,
      message: "This exclusive coupon can only be used when your cart contains ONLY qualifying promotional pieces (no other items)."
    };
  }
  const minSpendMode = coupon.min_spend_mode || "ELIGIBLE_ITEMS_ONLY";
  const minRequiredInPaise = coupon.min_order_in_paise || 0;
  if (minRequiredInPaise > 0) {
    const spendToVerify = minSpendMode === "CART_TOTAL" ? totalCartInPaise : eligibleSubtotalInPaise;
    if (spendToVerify < minRequiredInPaise) {
      const minRequiredRupees = minRequiredInPaise / 100;
      const targetLabel = minSpendMode === "CART_TOTAL" ? "an order total" : "eligible promotional items total";
      return {
        isValid: false,
        couponId: coupon.id,
        code: coupon.code,
        discountInPaise: 0,
        discountInRupees: 0,
        eligibleSubtotalInPaise,
        totalCartInPaise,
        eligibleProductCodes,
        eligibleItemsCount,
        message: `This coupon requires ${targetLabel} of at least \u20B9${minRequiredRupees}.`
      };
    }
  }
  let discountInPaise = 0;
  if (coupon.discount_type === "PERCENT") {
    const rawDiscount = Math.round(eligibleSubtotalInPaise * coupon.discount_value / 100);
    discountInPaise = coupon.max_discount_in_paise ? Math.min(rawDiscount, coupon.max_discount_in_paise) : rawDiscount;
  } else {
    const flatAmount = coupon.discount_value < 100 ? coupon.discount_value * 100 : coupon.discount_value;
    discountInPaise = Math.min(eligibleSubtotalInPaise, flatAmount);
  }
  return {
    isValid: true,
    couponId: coupon.id,
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    discountInPaise,
    discountInRupees: discountInPaise / 100,
    eligibleSubtotalInPaise,
    totalCartInPaise,
    eligibleProductCodes,
    eligibleItemsCount,
    description: coupon.description || (coupon.discount_type === "PERCENT" ? `${coupon.discount_value}% off eligible items` : `Flat \u20B9${Math.round(discountInPaise / 100)} off`)
  };
}

// server/handlers/checkout/create-order.ts
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  try {
    const storeConfig = getCachedStoreSettings();
    if (storeConfig.featureFlags?.storeMaintenanceMode) {
      return res.status(503).json({
        success: false,
        message: "The studio checkout is temporarily undergoing scheduled maintenance. Please check back shortly."
      });
    }
    const body = req.body;
    const { items, customer, shippingAddress, couponCode, customerNote } = body;
    if (!customer?.name?.trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required." });
    }
    const cleanPhone = (customer.phone || "").replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: "A valid 10-digit mobile number is required." });
    }
    if (!shippingAddress?.addressLine1?.trim() || !shippingAddress?.city?.trim() || !shippingAddress?.state?.trim()) {
      return res.status(400).json({ success: false, message: "Complete delivery address is required." });
    }
    const cleanPincode = (shippingAddress.pincode || "").replace(/\D/g, "");
    if (cleanPincode.length !== 6) {
      return res.status(400).json({ success: false, message: "A valid 6-digit postal PIN code is required." });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart cannot be empty." });
    }
    const KNOWN_ADDONS = {
      "ADDON-Greeting Card": { name: "Greeting Card", priceInPaise: 4900, image: "/greeting.avif" },
      "ADDON-Personalised Message": { name: "Personalised Message", priceInPaise: 3900, image: "/message.avif" },
      "ADDON-Name Customisation": { name: "Name Customisation", priceInPaise: 7900 },
      "ADDON-Premium Ribbon": { name: "Premium Ribbon", priceInPaise: 4900, image: "/ribbon.avif" },
      "ADDON-Premium Wrapping": { name: "Premium Wrapping", priceInPaise: 7900, image: "/wrapping.avif" },
      "ADDON-Extra Flower": { name: "Extra Flower", priceInPaise: 19900 }
    };
    const catalogItems = items.filter((i) => !i.code?.startsWith("ADDON-"));
    const addonItems = items.filter((i) => i.code?.startsWith("ADDON-"));
    const productMap = /* @__PURE__ */ new Map();
    if (catalogItems.length > 0) {
      const rawCodes = catalogItems.map((i) => (i.code || "").trim()).filter(Boolean);
      const queryCodes = Array.from(/* @__PURE__ */ new Set([
        ...rawCodes,
        ...rawCodes.map((c) => c.toUpperCase()),
        ...rawCodes.map((c) => c.toLowerCase())
      ]));
      const { data: dbProducts, error: prodError } = await supabaseAdmin.from("products").select("id, code, name, price_in_paise, inventory_count, is_active, images, category_slug, occasions").in("code", queryCodes);
      if (prodError) {
        console.error("[Verify Catalog DB Error]", prodError);
        return res.status(500).json({
          success: false,
          message: `Database error verifying catalog items: ${prodError.message}`
        });
      }
      if (dbProducts) {
        for (const p of dbProducts) {
          productMap.set(p.code, p);
          productMap.set(p.code.toUpperCase(), p);
          productMap.set(p.code.toLowerCase(), p);
        }
      }
    }
    let subtotalInPaise = 0;
    let giftWrapTotalInPaise = 0;
    const resolvedOrderItems = [];
    for (const item of catalogItems) {
      const trimmedCode = (item.code || "").trim();
      const prod = productMap.get(trimmedCode) || productMap.get(trimmedCode.toUpperCase()) || productMap.get(trimmedCode.toLowerCase());
      if (!prod) {
        console.error(`[Checkout] Missing product in catalog: "${item.code}"`);
        return res.status(400).json({
          success: false,
          message: `The item "${item.code}" was not found in the current catalog. Please clear your cart and select from the current collection.`
        });
      }
      if (!prod.is_active) {
        return res.status(400).json({ success: false, message: `Product "${prod.name}" (${prod.code}) is currently inactive.` });
      }
      const qty = Math.max(1, Math.min(20, Math.floor(Number(item.quantity) || 1)));
      if (!prod.is_made_to_order && (prod.inventory_count !== null && prod.inventory_count !== void 0) && prod.inventory_count < qty) {
        return res.status(400).json({
          success: false,
          message: `Only ${prod.inventory_count} piece(s) of "${prod.name}" remain in stock. Please adjust your cart quantity.`
        });
      }
      const unitPriceInPaise = prod.price_in_paise;
      const itemSubtotal = unitPriceInPaise * qty;
      subtotalInPaise += itemSubtotal;
      const giftWrapFee = storeConfig.businessRules?.giftWrapFeePaise ?? 7900;
      if (item.giftWrap) {
        giftWrapTotalInPaise += giftWrapFee * qty;
      }
      resolvedOrderItems.push({
        product_id: prod.id,
        product_code: prod.code,
        product_name: prod.name,
        unit_price_in_paise: unitPriceInPaise,
        quantity: qty,
        total_price_in_paise: itemSubtotal,
        selected_color: item.color || null,
        gift_wrap: Boolean(item.giftWrap),
        personal_message: item.message || null,
        item_image: Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : null
      });
    }
    for (const item of addonItems) {
      const addonMeta = KNOWN_ADDONS[item.code];
      const qty = Math.max(1, Math.min(20, Math.floor(Number(item.quantity) || 1)));
      const unitPriceInPaise = addonMeta ? addonMeta.priceInPaise : 4900;
      const itemSubtotal = unitPriceInPaise * qty;
      subtotalInPaise += itemSubtotal;
      resolvedOrderItems.push({
        product_id: null,
        product_code: item.code,
        product_name: addonMeta ? addonMeta.name : item.code.replace("ADDON-", ""),
        unit_price_in_paise: unitPriceInPaise,
        quantity: qty,
        total_price_in_paise: itemSubtotal,
        selected_color: null,
        gift_wrap: false,
        personal_message: null,
        item_image: addonMeta?.image || null
      });
    }
    let discountInPaise = 0;
    let validatedCouponId = null;
    let validatedCouponCode = null;
    if (couponCode && couponCode.trim()) {
      const normalizedCode = couponCode.trim().toUpperCase();
      let { data: coupon, error: couponErr } = await supabaseAdmin.from("coupons").select("*").eq("code", normalizedCode).eq("active", true).maybeSingle();
      if (!coupon && (normalizedCode === "FLAT" || normalizedCode === "FLAT10" || normalizedCode === "FALT")) {
        const { data: fallbackCoupons } = await supabaseAdmin.from("coupons").select("*").in("code", ["FLAT", "FLAT10", "FALT"]).eq("active", true).limit(1);
        if (fallbackCoupons && fallbackCoupons.length > 0) {
          coupon = fallbackCoupons[0];
        }
      }
      if (couponErr || !coupon) {
        return res.status(400).json({
          success: false,
          message: `The coupon code '${normalizedCode}' is invalid or no longer active.`
        });
      }
      if (coupon.per_customer_limit && coupon.per_customer_limit > 0 && cleanPhone) {
        const { count, error: countErr } = await supabaseAdmin.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", coupon.id).ilike("customer_phone", `%${cleanPhone}%`);
        if (!countErr && count !== null && count >= coupon.per_customer_limit) {
          return res.status(400).json({
            success: false,
            message: "You have already redeemed this promotional code the maximum number of times."
          });
        }
      }
      const evaluation = evaluateCoupon({
        coupon,
        items: catalogItems.map((i) => ({ code: i.code, quantity: i.quantity })),
        productsMap: productMap,
        cartSubtotalInPaise: subtotalInPaise
      });
      if (!evaluation.isValid) {
        return res.status(400).json({
          success: false,
          message: evaluation.message || "The applied coupon is no longer valid for your cart items. Please review your order."
        });
      }
      if (evaluation.discountInPaise <= 0) {
        return res.status(400).json({
          success: false,
          message: "The applied coupon provides zero discount for the selected items."
        });
      }
      validatedCouponId = coupon.id;
      validatedCouponCode = coupon.code;
      discountInPaise = evaluation.discountInPaise;
    }
    let loyaltyPointsRedeemed = 0;
    let loyaltyDiscountInPaise = 0;
    const isLoyaltyEnabled = storeConfig.featureFlags?.enableLoyalty ?? true;
    const minPointsOrder = storeConfig.businessRules?.minLoyaltyOrderPaise ?? 29900;
    const pointValuePaise = storeConfig.businessRules?.loyaltyPointRedemptionPaise ?? 50;
    const meetsPointsMinThreshold = subtotalInPaise >= minPointsOrder;
    if (isLoyaltyEnabled && meetsPointsMinThreshold && customer.customerId && req.body.redeemPoints && Number(req.body.redeemPoints) > 0) {
      const { data: loyaltyAcc } = await supabaseAdmin.from("loyalty_accounts").select("points_balance").eq("customer_id", customer.customerId).maybeSingle();
      if (loyaltyAcc && (loyaltyAcc.points_balance || 0) > 0) {
        loyaltyPointsRedeemed = Math.min(loyaltyAcc.points_balance, Math.floor(Number(req.body.redeemPoints)));
        const maxRedeemablePaise = Math.max(0, subtotalInPaise - discountInPaise);
        loyaltyDiscountInPaise = Math.min(loyaltyPointsRedeemed * pointValuePaise, maxRedeemablePaise);
      }
    }
    const freeShippingThreshold = storeConfig.businessRules?.freeShippingThresholdPaise ?? 12e4;
    const standardShippingFee = storeConfig.businessRules?.standardShippingFeePaise ?? 6900;
    const expressShippingFee = storeConfig.businessRules?.expressShippingFeePaise ?? 4900;
    const isExpress = Boolean(req.body.isExpress);
    const baseShippingFee = subtotalInPaise >= freeShippingThreshold ? 0 : standardShippingFee;
    const shippingFeeInPaise = baseShippingFee + (isExpress ? expressShippingFee : 0);
    const totalInPaise = Math.max(0, subtotalInPaise - discountInPaise - loyaltyDiscountInPaise + shippingFeeInPaise + giftWrapTotalInPaise);
    const orderNumber = `TPB-${Date.now().toString(36).toUpperCase()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const addressSnapshot = {
      recipientName: shippingAddress.recipientName || customer.name,
      phone: shippingAddress.phone || cleanPhone,
      addressLine1: shippingAddress.addressLine1.trim(),
      addressLine2: (shippingAddress.addressLine2 || "").trim(),
      city: shippingAddress.city.trim(),
      state: shippingAddress.state.trim(),
      pincode: cleanPincode
    };
    const { data: newOrder, error: orderErr } = await supabaseAdmin.from("orders").insert({
      order_number: orderNumber,
      customer_id: customer.customerId || null,
      guest_name: customer.name.trim(),
      guest_phone: cleanPhone,
      guest_email: customer.email?.trim() || null,
      shipping_address_snapshot: addressSnapshot,
      subtotal_in_paise: subtotalInPaise,
      discount_in_paise: discountInPaise,
      loyalty_points_redeemed: loyaltyPointsRedeemed,
      loyalty_discount_in_paise: loyaltyDiscountInPaise,
      shipping_fee_in_paise: shippingFeeInPaise + giftWrapTotalInPaise,
      total_in_paise: totalInPaise,
      order_status: "PENDING_PAYMENT",
      payment_status: "PENDING",
      applied_coupon_code: validatedCouponCode,
      customer_note: customerNote || null
    }).select("id, order_number, total_in_paise").single();
    if (orderErr || !newOrder) {
      console.error("[Create Order DB Error]", orderErr);
      return res.status(500).json({ success: false, message: "Could not create order." });
    }
    const itemsToInsert = resolvedOrderItems.map((item) => ({
      ...item,
      order_id: newOrder.id
    }));
    await supabaseAdmin.from("order_items").insert(itemsToInsert);
    await supabaseAdmin.from("order_status_history").insert({
      order_id: newOrder.id,
      previous_status: null,
      new_status: "PENDING_PAYMENT",
      note: "Order initiated via online checkout",
      created_by: "system"
    });
    if (customer.customerId && loyaltyPointsRedeemed > 0) {
      try {
        await supabaseAdmin.from("loyalty_transactions").insert({
          customer_id: customer.customerId,
          order_id: newOrder.id,
          type: "REDEEM_PURCHASE",
          points: -loyaltyPointsRedeemed,
          description: `Redeemed on Order ${orderNumber}`
        });
        const { data: loyaltyAcc } = await supabaseAdmin.from("loyalty_accounts").select("points_balance").eq("customer_id", customer.customerId).maybeSingle();
        if (loyaltyAcc) {
          await supabaseAdmin.from("loyalty_accounts").update({
            points_balance: Math.max(0, (loyaltyAcc.points_balance || 0) - loyaltyPointsRedeemed)
          }).eq("customer_id", customer.customerId);
        }
      } catch (loyaltyErr) {
        console.error("[Loyalty Deduction Error]", loyaltyErr);
      }
    }
    if (customer.customerId && shippingAddress?.addressLine1) {
      try {
        const { data: existingAddrs } = await supabaseAdmin.from("customer_addresses").select("id, address_line1, pincode").eq("customer_id", customer.customerId);
        const alreadyExists = (existingAddrs || []).some(
          (a) => a.address_line1.trim().toLowerCase() === shippingAddress.addressLine1.trim().toLowerCase() && a.pincode.replace(/\D/g, "") === cleanPincode
        );
        if (!alreadyExists) {
          await supabaseAdmin.from("customer_addresses").insert({
            customer_id: customer.customerId,
            recipient_name: shippingAddress.recipientName || customer.name,
            phone: cleanPhone,
            address_line1: shippingAddress.addressLine1.trim(),
            address_line2: (shippingAddress.addressLine2 || "").trim() || null,
            city: shippingAddress.city.trim(),
            state: shippingAddress.state.trim(),
            pincode: cleanPincode,
            is_default: (existingAddrs || []).length === 0
          });
        }
      } catch (addrErr) {
        console.warn("[Auto-save Address Error in create-order]:", addrErr);
      }
    }
    const requestedPaymentMethod = body.paymentMethod || "MANUAL_UPI";
    if (requestedPaymentMethod === "CASHFREE") {
      try {
        const origin = req.headers.origin || "https://thepetalandbloom.vercel.app";
        const returnUrl = `${origin}/order-confirmation?order_id=${newOrder.order_number}`;
        const cfOrder = await createCashfreePGOrder({
          orderId: newOrder.order_number,
          orderAmount: totalInPaise / 100,
          customerDetails: {
            customerId: customer.customerId || `cust_${cleanPhone}`,
            customerName: customer.name.trim(),
            customerPhone: cleanPhone,
            customerEmail: customer.email?.trim()
          },
          returnUrl
        });
        await supabaseAdmin.from("payments").insert({
          order_id: newOrder.id,
          provider: "CASHFREE",
          cf_order_id: cfOrder.cfOrderId,
          cf_payment_session_id: cfOrder.paymentSessionId,
          amount_in_paise: totalInPaise,
          currency: "INR",
          status: "PENDING"
        });
        return res.status(200).json({
          success: true,
          orderId: newOrder.id,
          orderNumber: newOrder.order_number,
          totalInPaise,
          totalInRupees: totalInPaise / 100,
          paymentMethod: "CASHFREE",
          paymentSessionId: cfOrder.paymentSessionId,
          isSimulated: cfOrder.isSimulated
        });
      } catch (cfErr) {
        console.warn("[Cashfree PG Session Warning, falling back to MANUAL_UPI]:", cfErr);
      }
    }
    const { error: payErr } = await supabaseAdmin.from("payments").insert({
      order_id: newOrder.id,
      provider: "MANUAL_UPI",
      cf_order_id: `manual_${newOrder.order_number}`,
      cf_payment_session_id: `manual_session_${newOrder.order_number}`,
      amount_in_paise: totalInPaise,
      currency: "INR",
      status: "PENDING"
    });
    if (payErr) {
      console.warn("[Manual UPI Payment Record Warning]:", payErr);
    }
    return res.status(200).json({
      success: true,
      orderId: newOrder.id,
      orderNumber: newOrder.order_number,
      totalInPaise,
      totalInRupees: totalInPaise / 100,
      paymentMethod: "MANUAL_UPI",
      paymentStatus: "PENDING",
      orderStatus: "PENDING_PAYMENT"
    });
  } catch (err) {
    console.error("[Create Order Error]", err);
    return res.status(500).json({
      success: false,
      message: err.message || "An unexpected error occurred during order creation."
    });
  }
}

// server/handlers/coupons/validate.ts
async function handler2(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  try {
    const storeConfig = getCachedStoreSettings();
    if (storeConfig.featureFlags && storeConfig.featureFlags.enableCoupons === false) {
      return res.status(400).json({ success: false, message: "Coupons and promotional discounts are currently paused." });
    }
    const { code, items, cartSubtotalInPaise, customerPhone, customerEmail } = req.body || {};
    if (!code || typeof code !== "string") {
      return res.status(400).json({ success: false, message: "Coupon code is required." });
    }
    const normalizedCode = code.trim().toUpperCase();
    const subtotal = Math.max(0, Number(cartSubtotalInPaise) || 0);
    let { data: coupon, error } = await supabaseAdmin.from("coupons").select("*").eq("code", normalizedCode).eq("active", true).maybeSingle();
    if (!coupon && (normalizedCode === "FLAT" || normalizedCode === "FLAT10" || normalizedCode === "FALT")) {
      const { data: fallbackCoupons } = await supabaseAdmin.from("coupons").select("*").in("code", ["FLAT", "FLAT10", "FALT"]).eq("active", true).limit(1);
      if (fallbackCoupons && fallbackCoupons.length > 0) {
        coupon = fallbackCoupons[0];
        if (coupon.code === "FALT") {
          void supabaseAdmin.from("coupons").update({ code: "FLAT10" }).eq("id", coupon.id);
        }
      }
    }
    if (error || !coupon) {
      return res.status(404).json({ success: false, message: "Invalid coupon code." });
    }
    if (coupon.per_customer_limit && coupon.per_customer_limit > 0 && customerPhone) {
      const cleanPhone = String(customerPhone).replace(/\D/g, "").slice(-10);
      if (cleanPhone) {
        const { count, error: countErr } = await supabaseAdmin.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", coupon.id).ilike("customer_phone", `%${cleanPhone}%`);
        if (!countErr && count !== null && count >= coupon.per_customer_limit) {
          return res.status(400).json({
            success: false,
            message: "You have already redeemed this promotional code the maximum number of times."
          });
        }
      }
    }
    const productsMap = /* @__PURE__ */ new Map();
    if (Array.isArray(items) && items.length > 0) {
      const rawCodes = items.map((i) => (i.code || "").trim()).filter(Boolean);
      const queryCodes = Array.from(/* @__PURE__ */ new Set([
        ...rawCodes,
        ...rawCodes.map((c) => c.toUpperCase()),
        ...rawCodes.map((c) => c.toLowerCase())
      ]));
      const { data: dbProducts } = await supabaseAdmin.from("products").select("id, code, name, price_in_paise, category_slug, occasions, is_active").in("code", queryCodes);
      if (dbProducts) {
        for (const p of dbProducts) {
          productsMap.set(p.code, p);
          productsMap.set(p.code.toUpperCase(), p);
          productsMap.set(p.code.toLowerCase(), p);
        }
      }
    }
    const evaluation = evaluateCoupon({
      coupon,
      items: Array.isArray(items) ? items : void 0,
      productsMap: productsMap.size > 0 ? productsMap : void 0,
      cartSubtotalInPaise: subtotal
    });
    if (!evaluation.isValid) {
      return res.status(400).json({
        success: false,
        message: evaluation.message || "This coupon cannot be applied to your cart."
      });
    }
    return res.status(200).json({
      success: true,
      code: coupon.code,
      discountType: evaluation.discountType,
      discountValue: evaluation.discountValue,
      discountInPaise: evaluation.discountInPaise,
      discountInRupees: evaluation.discountInRupees,
      eligibleProductCodes: evaluation.eligibleProductCodes,
      eligibleItemsCount: evaluation.eligibleItemsCount,
      description: evaluation.description || coupon.description || (coupon.discount_type === "PERCENT" ? `${coupon.discount_value}% off eligible items` : `Flat \u20B9${Math.round(evaluation.discountInRupees)} off`)
    });
  } catch (err) {
    console.error("[Coupon Validation Error]", err);
    return res.status(500).json({ success: false, message: "Failed to validate coupon." });
  }
}

// server/api/checkout.ts
async function handler3(req, res) {
  const url = req.url || "";
  const pathname = url.split("?")[0];
  if (pathname.includes("/coupon") || pathname.includes("/validate")) {
    return handler2(req, res);
  }
  return handler(req, res);
}
export {
  handler3 as default
};
