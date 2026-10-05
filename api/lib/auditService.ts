import { supabaseAdmin } from './supabaseServer';

export interface AuditLogEntry {
  actor_id?: string;
  actor_role?: string;
  actor_email?: string;
  action: string;
  entity: string;
  entity_id: string;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  reason?: string;
  ip_address?: string;
  user_agent?: string;
}

export const AUDIT_ACTIONS = {
  ORDER_STATUS_TRANSITION: 'ORDER_STATUS_TRANSITION',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  POINTS_ADJUSTED: 'POINTS_ADJUSTED',
  PRODUCT_PRICE_CHANGED: 'PRODUCT_PRICE_CHANGED',
  PRODUCT_DEACTIVATED: 'PRODUCT_DEACTIVATED',
  COUPON_CREATED: 'COUPON_CREATED',
  COUPON_RATE_MODIFIED: 'COUPON_RATE_MODIFIED',
  CUSTOMER_PII_EXPORTED: 'CUSTOMER_PII_EXPORTED',
  STAFF_ROLE_MODIFIED: 'STAFF_ROLE_MODIFIED',
  REVIEW_MODERATED: 'REVIEW_MODERATED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  INFLUENCER_PAYOUT_RECORDED: 'INFLUENCER_PAYOUT_RECORDED',
} as const;

export const localAuditCache: (AuditLogEntry & { created_at: string; id: string })[] = [];

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const cachedItem = {
    ...entry,
    created_at: new Date().toISOString(),
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  };
  
  // Always keep in-memory cache populated for instantaneous retrieval
  localAuditCache.unshift(cachedItem);
  if (localAuditCache.length > 500) {
    localAuditCache.pop();
  }

  try {
    // 1. First attempt: Direct insert with all fields
    const { error } = await supabaseAdmin.from('audit_logs').insert([entry]);
    if (error) {
      // 2. Second attempt: Schema compatibility fallback using details JSONB column
      const fallbackPayload = {
        actor_id: entry.actor_id || null,
        actor_role: entry.actor_role || 'admin',
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entity_id,
        details: {
          actor_email: entry.actor_email,
          old_values: entry.old_values,
          new_values: entry.new_values,
          reason: entry.reason,
          user_agent: entry.user_agent,
          ip_address: entry.ip_address,
        },
        ip_address: entry.ip_address || null,
      };

      const { error: fallbackError } = await supabaseAdmin.from('audit_logs').insert([fallbackPayload]);
      if (fallbackError) {
        console.warn('[Audit] Fallback insertion to audit_logs failed:', fallbackError.message);
      }
    }
  } catch (error: any) {
    console.warn('[Audit] Exception while inserting audit log:', error?.message || error);
  }
}
