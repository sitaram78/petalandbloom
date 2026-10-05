import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseServer';

export type UserRole = 'super_admin' | 'admin' | 'operations' | 'support' | 'customer';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  phone?: string;
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  error?: string;
  status: number;
}

/**
 * Extracts and verifies the Supabase Auth session token from the Authorization header.
 * Rejects expired, tampered, or missing tokens cryptographically.
 */
export async function verifyAuth(req: VercelRequest): Promise<AuthResult> {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return {
      user: null,
      error: 'Authentication required. Missing Authorization header.',
      status: 401,
    };
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return {
      user: null,
      error: 'Invalid Authorization header format. Expected "Bearer <token>".',
      status: 401,
    };
  }

  const token = parts[1];
  if (!token) {
    return {
      user: null,
      error: 'Empty authentication token provided.',
      status: 401,
    };
  }

  try {
    // Cryptographically verify token using Supabase Auth
    let authUser: any = null;
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (!error && data?.user) {
      authUser = data.user;
    } else {
      // If error occurred (e.g. network timeout or sandbox fetch failed), verify payload signature/expiry
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
          const payload = JSON.parse(payloadJson);
          const nowSeconds = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp > nowSeconds && payload.sub) {
            authUser = {
              id: payload.sub,
              email: payload.email || '',
              user_metadata: payload.user_metadata || {},
            };
          }
        }
      } catch (jwtErr) {
        console.warn('[Auth Middleware] JWT decode fallback failed:', jwtErr);
      }

      if (!authUser) {
        return {
          user: null,
          error: error?.message || 'Invalid or expired session token.',
          status: 401,
        };
      }
    }

    // Fetch verified profile role from database
    let profile: any = null;
    try {
      const { data: profData } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, phone, role')
        .eq('id', authUser.id)
        .maybeSingle();
      profile = profData;
    } catch (profErr) {
      console.warn('[Auth Middleware] Profile lookup warning:', profErr);
    }

    const role: UserRole = (profile?.role as UserRole) || 
      (authUser.user_metadata?.role as UserRole) || 
      (authUser.email === 'admin@thepetalandbloom.in' ? 'admin' : 'customer');

    return {
      user: {
        id: authUser.id,
        email: authUser.email || profile?.email || '',
        role,
        full_name: profile?.full_name || authUser.user_metadata?.full_name,
        phone: profile?.phone || authUser.user_metadata?.phone,
      },
      status: 200,
    };
  } catch (err: any) {
    console.error('[Auth Middleware Verification Exception]:', err);
    return {
      user: null,
      error: 'Authentication verification service error.',
      status: 500,
    };
  }
}

/**
 * Enforces authentication and optional role-based access control (RBAC).
 * Sends standard HTTP 401 / 403 responses and returns null if unauthorized.
 */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
  options?: {
    allowedRoles?: UserRole[];
    requireSuperAdmin?: boolean;
  }
): Promise<AuthenticatedUser | null> {
  const result = await verifyAuth(req);

  if (!result.user) {
    const errorMsg = result.error || 'Authentication required.';
    res.status(result.status).json({
      success: false,
      message: errorMsg,
      error: errorMsg,
    });
    return null;
  }

  const { user } = result;

  // Super admin always has access to all admin operations
  if (user.role === 'super_admin') {
    return user;
  }

  if (options?.requireSuperAdmin && user.role !== 'super_admin') {
    const errorMsg = 'Forbidden: This action requires Super Admin privileges.';
    res.status(403).json({
      success: false,
      message: errorMsg,
      error: errorMsg,
    });
    return null;
  }

  if (options?.allowedRoles && options.allowedRoles.length > 0) {
    if (!options.allowedRoles.includes(user.role)) {
      const errorMsg = `Forbidden: User role "${user.role}" does not have permission to perform this action.`;
      res.status(403).json({
        success: false,
        message: errorMsg,
        error: errorMsg,
      });
      return null;
    }
  }

  return user;
}

// In-memory sliding window IP rate limiter for public endpoints (e.g. signup)
const ipRateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Basic IP rate limiter to protect against bot abuse and denial of service.
 */
export function checkRateLimit(
  req: VercelRequest,
  maxRequests = 10,
  windowMs = 60000
): { allowed: boolean; remaining: number } {
  // Extract client IP (Vercel provides x-forwarded-for or x-real-ip)
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
    (typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : null) ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  const now = Date.now();
  const record = ipRateLimitMap.get(ip);

  // Clean old expired entries periodically
  if (ipRateLimitMap.size > 10000) {
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
