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

// server/handlers/admin/staff/index.ts
var STAFF_ROLES = ["super_admin", "admin", "operations", "support", "marketing"];
async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const authUser = await requireAuth(req, res, {
    requiredPermission: "staff.manage",
    allowedRoles: ["super_admin", "admin"]
  });
  if (!authUser) return;
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const { data: staffMembers, error: staffErr } = await supabaseAdmin.from("profiles").select("*").in("role", STAFF_ROLES).order("created_at", { ascending: true });
    if (staffErr) {
      console.error("[Staff API] Error fetching staff:", staffErr);
      return res.status(500).json({ success: false, message: "Failed to fetch staff members: " + staffErr.message });
    }
    const enrichedStaff = await Promise.all(
      (staffMembers || []).map(async (member) => {
        let permissions = Array.isArray(member.permissions) ? member.permissions : [];
        let role = member.role;
        try {
          const { data: authData } = await supabaseAdmin.auth.admin.getUserById(member.id);
          if (authData?.user?.app_metadata?.role) {
            role = authData.user.app_metadata.role;
          }
          if (permissions.length === 0 && authData?.user?.app_metadata?.permissions) {
            permissions = authData.user.app_metadata.permissions;
          }
        } catch {
        }
        return {
          ...member,
          role,
          permissions
        };
      })
    );
    let searchResults = [];
    if (search.length >= 2) {
      const { data: foundUsers, error: searchErr } = await supabaseAdmin.from("profiles").select("*").or(`email.ilike.%${search}%,full_name.ilike.%${search}%,phone.ilike.%${search}%`).limit(10);
      if (!searchErr && foundUsers) {
        searchResults = foundUsers;
      }
    }
    return res.status(200).json({
      success: true,
      staff: enrichedStaff,
      searchResults
    });
  } catch (err) {
    console.error("[Staff API] Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Internal server error: " + err.message });
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

// server/handlers/admin/staff/create.ts
var ALLOWED_STAFF_ROLES = ["super_admin", "admin", "operations", "support", "marketing"];
async function handler2(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }
  const authUser = await requireAuth(req, res, {
    requiredPermission: "staff.manage",
    allowedRoles: ["super_admin", "admin"]
  });
  if (!authUser) return;
  const { fullName, email, phone, password, role, permissions } = req.body || {};
  if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
    return res.status(400).json({ success: false, message: "Full name is required." });
  }
  if (!email || typeof email !== "string" || !email.trim() || !email.includes("@")) {
    return res.status(400).json({ success: false, message: "A valid email address is required." });
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone ? phone.toString().replace(/\D/g, "").slice(-10) : null;
  if (!role || !ALLOWED_STAFF_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      message: `Invalid role. Allowed roles: ${ALLOWED_STAFF_ROLES.join(", ")}`
    });
  }
  if (role === "super_admin" && authUser.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Only an active Super Admin can create another Super Admin account."
    });
  }
  const cleanPermissions = Array.isArray(permissions) && permissions.length > 0 ? Array.from(new Set(permissions)) : [...ROLE_DEFAULT_PERMISSIONS[role] || []];
  try {
    const { data: existingProfile } = await supabaseAdmin.from("profiles").select("*").ilike("email", cleanEmail).maybeSingle();
    if (existingProfile) {
      if (ALLOWED_STAFF_ROLES.includes(existingProfile.role)) {
        return res.status(400).json({
          success: false,
          message: `User "${cleanEmail}" is already a staff member (${existingProfile.role}). You can use "Configure Access" to adjust their role and permissions.`,
          user: existingProfile
        });
      }
      const userId = existingProfile.id;
      try {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            full_name: fullName.trim(),
            phone: cleanPhone || existingProfile.phone,
            role
          },
          app_metadata: {
            role,
            permissions: cleanPermissions
          }
        });
      } catch (authErr) {
        console.warn("[Staff Create] Auth metadata update warning:", authErr.message);
      }
      let { error: dbErr } = await supabaseAdmin.from("profiles").update({
        full_name: fullName.trim(),
        phone: cleanPhone || existingProfile.phone,
        role,
        permissions: cleanPermissions,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", userId);
      if (dbErr && (dbErr.code === "42703" || dbErr.message?.includes("permissions"))) {
        const { error: retryErr } = await supabaseAdmin.from("profiles").update({
          full_name: fullName.trim(),
          phone: cleanPhone || existingProfile.phone,
          role,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", userId);
        dbErr = retryErr;
      }
      if (dbErr && (dbErr.code === "23514" || dbErr.message?.includes("profiles_role_check"))) {
        const { error: roleFallbackErr } = await supabaseAdmin.from("profiles").update({
          full_name: fullName.trim(),
          phone: cleanPhone || existingProfile.phone,
          role: "admin",
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", userId);
        dbErr = roleFallbackErr;
      }
      if (dbErr) throw dbErr;
      await logAuditEvent({
        actor_id: authUser.id,
        actor_role: authUser.role,
        actor_email: authUser.email,
        action: AUDIT_ACTIONS.STAFF_ROLE_MODIFIED,
        entity: "staff_member",
        entity_id: userId,
        old_values: { role: existingProfile.role },
        new_values: { role, permissions: cleanPermissions },
        reason: `Promoted existing user "${cleanEmail}" to staff role "${role}"`,
        ip_address: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || void 0,
        user_agent: req.headers["user-agent"] || void 0
      });
      return res.status(200).json({
        success: true,
        message: `Existing user "${cleanEmail}" has been promoted to Studio Staff as ${role}!`,
        user: {
          id: userId,
          email: cleanEmail,
          full_name: fullName.trim(),
          phone: cleanPhone || existingProfile.phone,
          role,
          permissions: cleanPermissions
        }
      });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "A secure password of at least 6 characters is required for new staff accounts."
      });
    }
    const { data: createdAuth, error: authCreateErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        phone: cleanPhone,
        role
      },
      app_metadata: {
        role,
        permissions: cleanPermissions
      }
    });
    if (authCreateErr) {
      if (authCreateErr.message?.toLowerCase().includes("already") || authCreateErr.message?.toLowerCase().includes("registered")) {
        try {
          const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
          const foundUser = (userList?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
          if (foundUser) {
            await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
              password,
              user_metadata: {
                full_name: fullName.trim(),
                phone: cleanPhone || foundUser.user_metadata?.phone,
                role
              },
              app_metadata: {
                role,
                permissions: cleanPermissions
              }
            });
            await supabaseAdmin.from("profiles").upsert({
              id: foundUser.id,
              email: cleanEmail,
              full_name: fullName.trim(),
              phone: cleanPhone || foundUser.user_metadata?.phone,
              role,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }, { onConflict: "id" });
            await logAuditEvent({
              actor_id: authUser.id,
              actor_role: authUser.role,
              actor_email: authUser.email,
              action: AUDIT_ACTIONS.STAFF_ROLE_MODIFIED,
              entity: "staff_member",
              entity_id: foundUser.id,
              old_values: null,
              new_values: { role, permissions: cleanPermissions, email: cleanEmail },
              reason: `Updated existing registered user "${cleanEmail}" to staff role "${role}"`,
              ip_address: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || void 0,
              user_agent: req.headers["user-agent"] || void 0
            });
            return res.status(200).json({
              success: true,
              message: `Successfully onboarded staff account for ${cleanEmail} (${role})!`,
              user: {
                id: foundUser.id,
                email: cleanEmail,
                full_name: fullName.trim(),
                phone: cleanPhone,
                role,
                permissions: cleanPermissions
              }
            });
          }
        } catch (recoverErr) {
          console.warn("[Staff Create] Existing user recovery warning:", recoverErr.message);
        }
      }
      return res.status(400).json({
        success: false,
        message: `Failed to create staff account: ${authCreateErr.message}`
      });
    }
    if (!createdAuth?.user) {
      return res.status(500).json({ success: false, message: "Failed to create user in auth service." });
    }
    const newUserId = createdAuth.user.id;
    const profilePayload = {
      id: newUserId,
      email: cleanEmail,
      full_name: fullName.trim(),
      phone: cleanPhone,
      role,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    let { error: insertErr } = await supabaseAdmin.from("profiles").upsert({ ...profilePayload, permissions: cleanPermissions }, { onConflict: "id" });
    if (insertErr && (insertErr.code === "42703" || insertErr.message?.includes("permissions"))) {
      const { error: retryInsertErr } = await supabaseAdmin.from("profiles").upsert(profilePayload, { onConflict: "id" });
      insertErr = retryInsertErr;
    }
    if (insertErr && (insertErr.code === "23514" || insertErr.message?.includes("profiles_role_check"))) {
      const { error: retryRoleErr } = await supabaseAdmin.from("profiles").upsert({ ...profilePayload, role: "admin" }, { onConflict: "id" });
      insertErr = retryRoleErr;
    }
    if (insertErr) {
      console.warn("[Staff Create] Profile insertion warning:", insertErr.message);
    }
    await logAuditEvent({
      actor_id: authUser.id,
      actor_role: authUser.role,
      actor_email: authUser.email,
      action: AUDIT_ACTIONS.STAFF_ROLE_MODIFIED,
      entity: "staff_member",
      entity_id: newUserId,
      old_values: null,
      new_values: { role, permissions: cleanPermissions, email: cleanEmail },
      reason: `Created new studio staff member: ${cleanEmail} with role ${role}`,
      ip_address: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || void 0,
      user_agent: req.headers["user-agent"] || void 0
    });
    return res.status(201).json({
      success: true,
      message: `Successfully created staff account for ${cleanEmail} (${role})!`,
      user: {
        id: newUserId,
        email: cleanEmail,
        full_name: fullName.trim(),
        phone: cleanPhone,
        role,
        permissions: cleanPermissions
      }
    });
  } catch (err) {
    console.error("[Staff Create API] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error: " + err.message });
  }
}

// server/handlers/admin/staff/update-role.ts
var VALID_ROLES = ["super_admin", "admin", "operations", "support", "marketing", "customer"];
var PROTECTED_FOUNDER_EMAILS = ["sitaramnayak8763@gmail.com", "admin@thepetalandbloom.in"];
async function handler3(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const authUser = await requireAuth(req, res, {
    requiredPermission: "staff.manage",
    allowedRoles: ["super_admin", "admin"]
  });
  if (!authUser) return;
  const { userId, newRole, permissions, reason } = req.body || {};
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ success: false, message: "Target user ID is required." });
  }
  if (!newRole || !VALID_ROLES.includes(newRole)) {
    return res.status(400).json({
      success: false,
      message: `Invalid role. Allowed roles: ${VALID_ROLES.join(", ")}`
    });
  }
  try {
    const { data: targetProfile, error: targetErr } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (targetErr || !targetProfile) {
      return res.status(404).json({ success: false, message: "User profile not found." });
    }
    const targetEmail = (targetProfile.email || "").toLowerCase().trim();
    if (PROTECTED_FOUNDER_EMAILS.includes(targetEmail) && newRole !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Primary Founder Super Admin account role cannot be modified or demoted."
      });
    }
    if (newRole === "super_admin" && authUser.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only an active Super Admin can assign the Super Admin role."
      });
    }
    if (targetProfile.role === "super_admin" && authUser.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "You cannot alter credentials of a Super Admin member."
      });
    }
    if (authUser.id === userId && newRole !== "super_admin" && authUser.role === "super_admin") {
      return res.status(400).json({
        success: false,
        message: "You cannot revoke your own Super Admin access to prevent lockout."
      });
    }
    const cleanPermissions = Array.isArray(permissions) ? Array.from(new Set(permissions.filter((p) => typeof p === "string" && p.trim().length > 0))) : [];
    let updateProfilesSuccess = false;
    try {
      const { error: fullUpdateErr } = await supabaseAdmin.from("profiles").update({
        role: newRole,
        permissions: cleanPermissions,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", userId);
      if (fullUpdateErr) {
        if (fullUpdateErr.code === "42703" || fullUpdateErr.message?.includes("permissions")) {
          console.warn('[Staff API] "permissions" column not migrated on profiles; falling back to updating role only.');
          let { error: roleOnlyErr } = await supabaseAdmin.from("profiles").update({
            role: newRole,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", userId);
          if (roleOnlyErr && (roleOnlyErr.code === "23514" || roleOnlyErr.message?.includes("profiles_role_check"))) {
            const { error: adminFallbackErr } = await supabaseAdmin.from("profiles").update({
              role: "admin",
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", userId);
            roleOnlyErr = adminFallbackErr;
          }
          if (roleOnlyErr) throw roleOnlyErr;
          updateProfilesSuccess = true;
        } else if (fullUpdateErr.code === "23514" || fullUpdateErr.message?.includes("profiles_role_check")) {
          const { error: adminFallbackErr } = await supabaseAdmin.from("profiles").update({
            role: "admin",
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", userId);
          if (adminFallbackErr) throw adminFallbackErr;
          updateProfilesSuccess = true;
        } else {
          throw fullUpdateErr;
        }
      } else {
        updateProfilesSuccess = true;
      }
    } catch (dbErr) {
      console.error("[Staff API] Database update error:", dbErr);
      return res.status(500).json({ success: false, message: "Failed to update database profile: " + dbErr.message });
    }
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: {
          role: newRole,
          permissions: cleanPermissions
        }
      });
    } catch (authErr) {
      console.warn("[Staff API] Could not update auth app_metadata:", authErr.message);
    }
    await logAuditEvent({
      actor_id: authUser.id,
      actor_role: authUser.role,
      actor_email: authUser.email,
      action: AUDIT_ACTIONS.STAFF_ROLE_MODIFIED,
      entity: "staff_member",
      entity_id: userId,
      old_values: {
        role: targetProfile.role,
        permissions: targetProfile.permissions || []
      },
      new_values: {
        role: newRole,
        permissions: cleanPermissions
      },
      reason: reason || `Updated member role to "${newRole}" and modified permissions via Atelier Team Manager`,
      ip_address: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || void 0,
      user_agent: req.headers["user-agent"] || void 0
    });
    return res.status(200).json({
      success: true,
      message: `Successfully updated ${targetProfile.full_name || targetEmail} to role "${newRole}".`,
      user: {
        id: userId,
        email: targetEmail,
        full_name: targetProfile.full_name,
        role: newRole,
        permissions: cleanPermissions
      }
    });
  } catch (err) {
    console.error("[Staff API] Unexpected error in update-role:", err);
    return res.status(500).json({ success: false, message: "Internal server error: " + err.message });
  }
}

// server/api/staff.ts
async function handler4(req, res) {
  const url = req.url || "";
  const pathname = url.split("?")[0];
  if (pathname.endsWith("/create")) {
    return handler2(req, res);
  }
  if (pathname.endsWith("/update-role")) {
    return handler3(req, res);
  }
  return handler(req, res);
}
export {
  handler4 as default
};
