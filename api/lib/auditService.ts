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
} as const;

export const localAuditCache: (AuditLogEntry & { created_at: string, id: string })[] = [];

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('audit_logs').insert([entry]);
    if (error) {
      console.warn('Failed to insert audit log to db, falling back to local cache', error);
      localAuditCache.push({
        ...entry,
        created_at: new Date().toISOString(),
        id: Math.random().toString(36).substring(2, 15),
      });
    }
  } catch (error) {
    console.warn('Exception while inserting audit log to db, falling back to local cache', error);
    localAuditCache.push({
      ...entry,
      created_at: new Date().toISOString(),
      id: Math.random().toString(36).substring(2, 15),
    });
  }
}
