import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseServer';
import { localAuditCache } from '../../lib/auditService';
import { requireAuth } from '../../lib/authMiddleware';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enforce staff/admin authentication
  const authUser = await requireAuth(req, res, {
    allowedRoles: ['super_admin', 'admin', 'operations', 'support'],
  });
  if (!authUser) return;

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const action = req.query.action as string;
    const entity = req.query.entity as string;
    const entity_id = req.query.entity_id as string;
    const actor_id = req.query.actor_id as string;
    const from = req.query.from as string;
    const to = req.query.to as string;
    const search = req.query.search as string;

    let dbLogs: any[] = [];
    try {
      let query = supabaseAdmin.from('audit_logs').select('*');

      if (action) query = query.eq('action', action);
      if (entity) query = query.eq('entity', entity);
      if (entity_id) query = query.eq('entity_id', entity_id);
      if (actor_id) query = query.eq('actor_id', actor_id);
      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
      if (!error && data) {
        dbLogs = data.map((row: any) => ({
          id: row.id,
          created_at: row.created_at,
          actor_id: row.actor_id,
          actor_role: row.actor_role || 'admin',
          actor_email: row.actor_email || row.details?.actor_email || null,
          action: row.action,
          entity: row.entity,
          entity_id: row.entity_id,
          old_values: row.old_values || row.details?.old_values || null,
          new_values: row.new_values || row.details?.new_values || null,
          reason: row.reason || row.details?.reason || null,
          ip_address: row.ip_address || null,
          user_agent: row.user_agent || row.details?.user_agent || null,
        }));
      }
    } catch (dbErr) {
      console.warn('[Audit List] DB query failed, relying on local cache:', dbErr);
    }

    // Merge DB logs with local in-memory cache
    const seenIds = new Set(dbLogs.map((l: any) => l.id));
    const cachedItems = localAuditCache
      .filter((c) => !seenIds.has(c.id))
      .map((c) => ({
        id: c.id,
        created_at: c.created_at,
        actor_id: c.actor_id || null,
        actor_role: c.actor_role || 'admin',
        actor_email: c.actor_email || null,
        action: c.action,
        entity: c.entity,
        entity_id: c.entity_id,
        old_values: c.old_values || null,
        new_values: c.new_values || null,
        reason: c.reason || null,
        ip_address: c.ip_address || null,
        user_agent: c.user_agent || null,
      }));

    let allLogs = [...cachedItems, ...dbLogs];

    // Apply filters
    if (action) allLogs = allLogs.filter((l) => l.action === action);
    if (entity) allLogs = allLogs.filter((l) => l.entity === entity);
    if (entity_id) allLogs = allLogs.filter((l) => l.entity_id === entity_id);
    if (actor_id) allLogs = allLogs.filter((l) => l.actor_id === actor_id);
    if (from) allLogs = allLogs.filter((l) => new Date(l.created_at) >= new Date(from));
    if (to) allLogs = allLogs.filter((l) => new Date(l.created_at) <= new Date(to));
    if (search) {
      const s = search.toLowerCase();
      allLogs = allLogs.filter(
        (l) =>
          (l.entity_id && l.entity_id.toLowerCase().includes(s)) ||
          (l.action && l.action.toLowerCase().includes(s)) ||
          (l.reason && l.reason.toLowerCase().includes(s)) ||
          (l.actor_email && l.actor_email.toLowerCase().includes(s))
      );
    }

    allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = allLogs.length;
    const paginated = allLogs.slice(offset, offset + limit);

    return res.status(200).json({
      logs: paginated,
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('[Audit List] Error handler:', error);
    return res.status(500).json({ error: 'Failed to retrieve audit records', message: error.message });
  }
}
