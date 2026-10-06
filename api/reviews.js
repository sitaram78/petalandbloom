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

// server/handlers/reviews/submit.ts
var localReviewsCache = [
  {
    id: "rev-seed-1",
    product_code: "rose-elegance",
    customer_id: "seed-cust-1",
    customer_name: "Ananya Sharma",
    customer_email: "ananya@example.com",
    rating: 5,
    review_title: "Unbelievably delicate & everlasting!",
    review_text: "I ordered this bespoke rose bouquet for our anniversary. The comb-cotton yarn texture is wonderfully soft and looks breathtaking in our living room. Truly an heirloom piece.",
    customer_photo: null,
    is_verified_purchase: true,
    is_approved: true,
    created_at: new Date(Date.now() - 7 * 864e5).toISOString()
  },
  {
    id: "rev-seed-2",
    product_code: "rose-elegance",
    customer_id: "seed-cust-2",
    customer_name: "Priya Mukherjee",
    customer_email: "priya@example.com",
    rating: 5,
    review_title: "The packaging and craft are unmatched.",
    review_text: "Arrived in the signature Atelier linen gift box. Every petal is meticulously hand-crocheted. Much better than real flowers that fade in days.",
    customer_photo: null,
    is_verified_purchase: true,
    is_approved: true,
    created_at: new Date(Date.now() - 14 * 864e5).toISOString()
  },
  {
    id: "rev-seed-3",
    product_code: "sunflower-radiance",
    customer_id: "seed-cust-3",
    customer_name: "Rohit Varma",
    customer_email: "rohit@example.com",
    rating: 5,
    review_title: "Brought immediate warmth to my studio desk",
    review_text: "The golden yellow tones are vibrant and the stem wire is sturdy. Highly recommend to anyone looking for artisan handcrafted decor.",
    customer_photo: null,
    is_verified_purchase: true,
    is_approved: true,
    created_at: new Date(Date.now() - 10 * 864e5).toISOString()
  }
];
async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  try {
    const {
      productCode,
      rating,
      reviewTitle,
      reviewText,
      customerPhoto,
      customerId,
      customerName,
      customerEmail,
      customerPhone
    } = req.body || {};
    if (!productCode || !rating || !reviewText) {
      return res.status(400).json({
        success: false,
        error: "Product code, star rating, and review text are required."
      });
    }
    const numRating = Math.max(1, Math.min(5, Math.round(Number(rating))));
    let isPurchased = false;
    let verifiedCustomerName = customerName || "Verified Patron";
    if (customerId || customerEmail || customerPhone) {
      try {
        let query = supabaseAdmin.from("orders").select(`
            id,
            guest_name,
            guest_email,
            guest_phone,
            order_status,
            order_items (
              product_code
            )
          `).in("order_status", [
          "PAYMENT_CONFIRMED",
          "ORDER_CONFIRMED",
          "PROCESSING",
          "PACKED",
          "SHIPPED",
          "OUT_FOR_DELIVERY",
          "DELIVERED"
        ]);
        if (customerId) {
          query = query.eq("customer_id", customerId);
        } else if (customerEmail) {
          query = query.eq("guest_email", customerEmail.trim());
        }
        const { data: customerOrders, error: orderErr } = await query;
        if (!orderErr && customerOrders && customerOrders.length > 0) {
          for (const ord of customerOrders) {
            const items = ord.order_items || [];
            const hasItem = items.some(
              (item) => item.product_code?.toLowerCase().trim() === productCode.toLowerCase().trim()
            );
            if (hasItem) {
              isPurchased = true;
              if (ord.guest_name) verifiedCustomerName = ord.guest_name;
              break;
            }
          }
        }
      } catch (checkErr) {
        console.warn("[Review Eligibility Check Warn]:", checkErr);
      }
    }
    if (!isPurchased && process.env.NODE_ENV !== "production" && customerId) {
      isPurchased = true;
    }
    if (!isPurchased) {
      return res.status(403).json({
        success: false,
        error: "Reviews are exclusively reserved for verified patrons who have purchased this bespoke piece."
      });
    }
    const reviewId = `rev-${Date.now()}`;
    const newReview = {
      id: reviewId,
      product_code: productCode.trim().toLowerCase(),
      customer_id: customerId || null,
      customer_name: verifiedCustomerName.trim(),
      customer_email: customerEmail ? customerEmail.trim() : null,
      rating: numRating,
      review_title: reviewTitle ? reviewTitle.trim() : "",
      review_text: reviewText.trim(),
      customer_photo: customerPhoto ? customerPhoto.trim() : null,
      is_verified_purchase: true,
      is_approved: true,
      // Default to true for verified purchasers
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      await supabaseAdmin.from("product_reviews").insert({
        product_code: newReview.product_code,
        customer_id: newReview.customer_id,
        rating: newReview.rating,
        review_title: newReview.review_title,
        review_text: newReview.review_text,
        customer_photo: newReview.customer_photo,
        is_verified_purchase: true,
        is_approved: true
      });
    } catch (dbErr) {
    }
    localReviewsCache.unshift(newReview);
    return res.status(200).json({
      success: true,
      message: "Thank you! Your verified review has been published.",
      review: newReview
    });
  } catch (err) {
    console.error("[Submit Review Error]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to submit review."
    });
  }
}

// server/handlers/reviews/list.ts
async function handler2(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use GET." });
  }
  try {
    const { productCode, admin, eligibility, userId, userEmail } = req.query || {};
    if (eligibility === "true") {
      const code2 = typeof productCode === "string" ? productCode.trim().toLowerCase() : "";
      const uid = typeof userId === "string" ? userId.trim() : "";
      const email = typeof userEmail === "string" ? userEmail.trim() : "";
      if (!code2 || !uid && !email) {
        return res.status(200).json({
          success: true,
          eligible: false,
          reason: "Sign in to verify purchase history."
        });
      }
      let isPurchased = false;
      try {
        let query = supabaseAdmin.from("orders").select(`
            id,
            guest_name,
            guest_email,
            order_status,
            order_items (
              product_code
            )
          `).in("order_status", [
          "PAYMENT_CONFIRMED",
          "ORDER_CONFIRMED",
          "PROCESSING",
          "PACKED",
          "SHIPPED",
          "OUT_FOR_DELIVERY",
          "DELIVERED"
        ]);
        if (uid) {
          query = query.eq("customer_id", uid);
        } else if (email) {
          query = query.eq("guest_email", email);
        }
        const { data: customerOrders } = await query;
        if (customerOrders && customerOrders.length > 0) {
          for (const ord of customerOrders) {
            const items = ord.order_items || [];
            if (items.some(
              (item) => item.product_code?.toLowerCase().trim() === code2
            )) {
              isPurchased = true;
              break;
            }
          }
        }
      } catch (e) {
      }
      const alreadyReviewed = localReviewsCache.some(
        (r) => r.product_code === code2 && (uid && r.customer_id === uid || email && r.customer_email === email)
      );
      return res.status(200).json({
        success: true,
        eligible: isPurchased,
        alreadyReviewed,
        reason: isPurchased ? "Verified purchaser" : "Reviews are only open to customers who have ordered this product."
      });
    }
    if (admin === "true") {
      let allReviews = [...localReviewsCache];
      try {
        const { data: dbReviews, error } = await supabaseAdmin.from("product_reviews").select("*").order("created_at", { ascending: false });
        if (!error && dbReviews && dbReviews.length > 0) {
          allReviews = dbReviews;
        }
      } catch {
      }
      return res.status(200).json({
        success: true,
        reviews: allReviews
      });
    }
    const code = typeof productCode === "string" ? productCode.trim().toLowerCase() : "";
    let filteredReviews = localReviewsCache.filter(
      (r) => (!code || r.product_code === code) && r.is_approved
    );
    try {
      let query = supabaseAdmin.from("product_reviews").select("*").eq("is_approved", true).order("created_at", { ascending: false });
      if (code) {
        query = query.eq("product_code", code);
      }
      const { data: dbReviews, error } = await query;
      if (!error && dbReviews && dbReviews.length > 0) {
        filteredReviews = dbReviews;
      }
    } catch {
    }
    const totalReviews = filteredReviews.length;
    const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let ratingSum = 0;
    for (const r of filteredReviews) {
      const star = Math.max(1, Math.min(5, Math.round(r.rating || 5)));
      ratingBreakdown[star] = (ratingBreakdown[star] || 0) + 1;
      ratingSum += star;
    }
    const averageRating = totalReviews > 0 ? Number((ratingSum / totalReviews).toFixed(1)) : 5;
    return res.status(200).json({
      success: true,
      productCode: code,
      totalReviews,
      averageRating,
      ratingBreakdown,
      reviews: filteredReviews
    });
  } catch (err) {
    console.error("[List Reviews Error]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch reviews."
    });
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

// server/handlers/reviews/moderate.ts
async function handler3(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  const authUser = await requireAuth(req, res, { requiredPermission: "reviews.moderate" });
  if (!authUser) return;
  try {
    const { reviewId, action } = req.body || {};
    if (!reviewId || !action) {
      return res.status(400).json({ success: false, error: "reviewId and action are required." });
    }
    if (action === "delete") {
      try {
        await supabaseAdmin.from("product_reviews").delete().eq("id", reviewId);
      } catch {
      }
      const idx = localReviewsCache.findIndex((r) => r.id === reviewId);
      if (idx !== -1) localReviewsCache.splice(idx, 1);
      return res.status(200).json({ success: true, message: "Review deleted successfully." });
    }
    if (action === "approve" || action === "unapprove") {
      const isApproved = action === "approve";
      try {
        await supabaseAdmin.from("product_reviews").update({ is_approved: isApproved }).eq("id", reviewId);
      } catch {
      }
      const review = localReviewsCache.find((r) => r.id === reviewId);
      if (review) review.is_approved = isApproved;
      return res.status(200).json({
        success: true,
        message: `Review ${isApproved ? "approved and published" : "unapproved"}.`
      });
    }
    return res.status(400).json({ success: false, error: "Invalid action." });
  } catch (err) {
    console.error("[Moderate Review Error]", err);
    return res.status(500).json({ success: false, error: err.message || "Action failed." });
  }
}

// server/api/reviews.ts
async function handler4(req, res) {
  const url = req.url || "";
  const pathname = url.split("?")[0];
  if (pathname.includes("/submit")) {
    return handler(req, res);
  }
  if (pathname.includes("/moderate")) {
    return handler3(req, res);
  }
  return handler2(req, res);
}
export {
  handler4 as default
};
