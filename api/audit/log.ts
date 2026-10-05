import { VercelRequest, VercelResponse } from '@vercel/node';
import { logAuditEvent, AuditLogEntry, AUDIT_ACTIONS } from '../lib/auditService';
import { requireAuth } from '../lib/authMiddleware';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enforce staff/admin authentication
  const authUser = await requireAuth(req, res, { allowedRoles: ['super_admin', 'admin', 'operations', 'support'] });
  if (!authUser) return;

  try {
    const {
      action,
      entity,
      entity_id,
      old_values,
      new_values,
      reason,
    } = req.body as AuditLogEntry;

    // Validate required fields
    if (!action || !entity || !entity_id) {
      return res.status(400).json({ error: 'action, entity, and entity_id are required' });
    }

    // Validate action is a known type
    const validActions = Object.values(AUDIT_ACTIONS);
    if (!validActions.includes(action as any)) {
      return res.status(400).json({ error: `Invalid action: ${action}` });
    }

    await logAuditEvent({
      actor_id: authUser.id,
      actor_role: authUser.role,
      actor_email: authUser.email,
      action,
      entity,
      entity_id,
      old_values: old_values || null,
      new_values: new_values || null,
      reason: reason || undefined,
      ip_address: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || undefined,
      user_agent: req.headers['user-agent'] || undefined,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    return res.status(500).json({ error: 'Failed to log audit event' });
  }
}
