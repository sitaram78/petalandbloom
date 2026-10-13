import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseServer';
import { requireAuth } from '../../../lib/authMiddleware';
import { logAuditEvent, AUDIT_ACTIONS } from '../../../lib/auditService';

const VALID_MATERIAL_TYPES = ['YARN', 'PIPE_CLEANER', 'FLORAL_WIRE', 'PACKAGING', 'TOOLS', 'OTHER'];
const VALID_COLORS = ['RED', 'GREEN', 'PINK', 'WHITE', 'PURPLE', 'YELLOW', 'BLUE', 'OTHER'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enforce staff/admin authentication
  const authUser = await requireAuth(req, res, {
    allowedRoles: ['super_admin', 'admin', 'operations', 'marketing'],
  });
  if (!authUser) return;

  if (req.method === 'GET') {
    return handleGetMaterials(req, res);
  } else if (req.method === 'POST') {
    return handleCreateMaterial(req, res, authUser);
  } else if (req.method === 'DELETE') {
    return handleDeleteMaterial(req, res, authUser);
  } else {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}

// 1. GET: Fetch list of procurements + aggregate stats
async function handleGetMaterials(req: VercelRequest, res: VercelResponse) {
  try {
    const range = typeof req.query.range === 'string' ? req.query.range : 'all';
    const materialType = typeof req.query.type === 'string' ? req.query.type : undefined;

    let query = supabaseAdmin
      .from('raw_material_procurements')
      .select('*')
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply material type filter if specified
    if (materialType && VALID_MATERIAL_TYPES.includes(materialType)) {
      query = query.eq('material_type', materialType);
    }

    // Apply date range filter
    if (range !== 'all') {
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      query = query.gte('purchase_date', cutoff);
    }

    const { data: procurements, error } = await query;
    if (error) {
      console.error('[Materials API] Error fetching procurements:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch material procurements: ' + error.message });
    }

    const items = procurements || [];

    // Calculate aggregated metrics
    let totalSpendPaise = 0;
    const byType: Record<string, number> = {};
    const byColor: Record<string, number> = {};

    VALID_MATERIAL_TYPES.forEach(t => { byType[t] = 0; });
    VALID_COLORS.forEach(c => { byColor[c] = 0; });

    for (const item of items) {
      const price = Number(item.price_in_paise) || 0;
      totalSpendPaise += price;

      const t = item.material_type || 'OTHER';
      byType[t] = (byType[t] || 0) + price;

      const c = item.color_family || 'OTHER';
      byColor[c] = (byColor[c] || 0) + price;
    }

    return res.status(200).json({
      success: true,
      procurements: items,
      totalCount: items.length,
      totalSpendPaise,
      totalSpendRupees: Math.round(totalSpendPaise / 100),
      byType,
      byColor,
    });
  } catch (err: any) {
    console.error('[Materials API] Unexpected GET error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
}

// 2. POST: Record a new procurement entry
async function handleCreateMaterial(req: VercelRequest, res: VercelResponse, authUser: any) {
  try {
    const {
      material_type,
      color_family = 'OTHER',
      description,
      quantity_label,
      price_in_paise,
      purchase_date,
      vendor_name,
      notes,
    } = req.body || {};

    if (!material_type || !VALID_MATERIAL_TYPES.includes(material_type)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing material_type.' });
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required.' });
    }

    if (!quantity_label || typeof quantity_label !== 'string' || !quantity_label.trim()) {
      return res.status(400).json({ success: false, message: 'Quantity / weight is required (e.g. 100gm, 100 pcs).' });
    }

    const priceNum = Number(price_in_paise);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive price_in_paise is required.' });
    }

    const dateStr = purchase_date || new Date().toISOString().slice(0, 10);

    const newRecord = {
      material_type,
      color_family: VALID_COLORS.includes(color_family) ? color_family : 'OTHER',
      description: description.trim(),
      quantity_label: quantity_label.trim(),
      price_in_paise: Math.round(priceNum),
      purchase_date: dateStr,
      vendor_name: vendor_name?.trim() || null,
      notes: notes?.trim() || null,
    };

    const { data, error } = await supabaseAdmin
      .from('raw_material_procurements')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.error('[Materials API] Insert error:', error);
      return res.status(500).json({ success: false, message: 'Failed to record procurement: ' + error.message });
    }

    // Audit logging
    await logAuditEvent({
      actor_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.role,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entity: 'raw_material_procurements',
      entity_id: data.id,
      new_values: newRecord,
      reason: `Procured ${newRecord.description} (${newRecord.quantity_label}) for ₹${(newRecord.price_in_paise / 100).toFixed(2)}`,
    });

    return res.status(201).json({
      success: true,
      procurement: data,
      message: 'Raw material procurement logged successfully.',
    });
  } catch (err: any) {
    console.error('[Materials API] Unexpected POST error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
}

// 3. DELETE: Remove a procurement entry
async function handleDeleteMaterial(req: VercelRequest, res: VercelResponse, authUser: any) {
  try {
    const id = req.query.id as string || (req.body && req.body.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Procurement ID is required for deletion.' });
    }

    // Fetch existing for audit log
    const { data: existing } = await supabaseAdmin
      .from('raw_material_procurements')
      .select('*')
      .eq('id', id)
      .single();

    const { error: delErr } = await supabaseAdmin
      .from('raw_material_procurements')
      .delete()
      .eq('id', id);

    if (delErr) {
      console.error('[Materials API] Delete error:', delErr);
      return res.status(500).json({ success: false, message: 'Failed to delete procurement: ' + delErr.message });
    }

    if (existing) {
      await logAuditEvent({
        actor_id: authUser.id,
        actor_email: authUser.email,
        actor_role: authUser.role,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entity: 'raw_material_procurements',
        entity_id: id,
        old_values: existing,
        reason: `Deleted procurement entry: ${existing.description}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Procurement entry deleted successfully.',
    });
  } catch (err: any) {
    console.error('[Materials API] Unexpected DELETE error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
}
