import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';
import { localAuditCache } from '../lib/auditService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' });

    if (action) query = query.eq('action', action);
    if (entity) query = query.eq('entity', entity);
    if (entity_id) query = query.eq('entity_id', entity_id);
    if (actor_id) query = query.eq('actor_id', actor_id);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (search) {
      query = query.or(`entity_id.ilike.%${search}%,reason.ilike.%${search}%,actor_email.ilike.%${search}%`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      logs: data,
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.warn('Failed to fetch from audit_logs table, falling back to local cache', error);
    
    // In-memory fallback
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

    let filtered = [...localAuditCache];

    if (action) filtered = filtered.filter(l => l.action === action);
    if (entity) filtered = filtered.filter(l => l.entity === entity);
    if (entity_id) filtered = filtered.filter(l => l.entity_id === entity_id);
    if (actor_id) filtered = filtered.filter(l => l.actor_id === actor_id);
    if (from) filtered = filtered.filter(l => new Date(l.created_at) >= new Date(from));
    if (to) filtered = filtered.filter(l => new Date(l.created_at) <= new Date(to));
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(l => 
        (l.entity_id && l.entity_id.toLowerCase().includes(s)) ||
        (l.reason && l.reason.toLowerCase().includes(s)) ||
        (l.actor_email && l.actor_email.toLowerCase().includes(s))
      );
    }

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const paginated = filtered.slice(offset, offset + limit);

    return res.status(200).json({
      logs: paginated,
      total: filtered.length,
      page,
      limit,
    });
  }
}
