/**
 * Client-side audit logging helper.
 * Fire-and-forget: never throws, never blocks UI.
 */

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

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

interface AuditPayload {
  actor_id?: string;
  actor_role?: string;
  actor_email?: string;
  action: AuditAction;
  entity: string;
  entity_id: string;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  reason?: string;
}

/**
 * Submit an audit log event. This is fire-and-forget —
 * it will never throw or block the calling function.
 */
export function logAudit(payload: AuditPayload): void {
  fetch('/api/audit/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn('[Audit] Failed to log event:', err);
  });
}
