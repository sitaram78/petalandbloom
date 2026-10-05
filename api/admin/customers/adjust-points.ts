import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseServer';
import { requireAuth } from '../../lib/authMiddleware';
import { logAuditEvent, AUDIT_ACTIONS } from '../../lib/auditService';
import { resolveLoyaltyTier } from '../../../src/services/loyaltyService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  // 1. Authenticate Staff Member (Admins or Super Admins)
  const authUser = await requireAuth(req, res, {
    allowedRoles: ['super_admin', 'admin'],
  });
  if (!authUser) return;

  try {
    const { customerId, pointsDelta, pointsType = 'ADD', reason } = req.body || {};

    if (!customerId || pointsDelta === undefined || pointsDelta === null) {
      return res.status(400).json({ success: false, message: 'customerId and pointsDelta are required.' });
    }

    const rawDelta = Math.abs(Number(pointsDelta) || 0);
    if (rawDelta === 0) {
      return res.status(400).json({ success: false, message: 'Points adjustment must be greater than zero.' });
    }

    const delta = pointsType === 'ADD' ? rawDelta : -rawDelta;
    const noteText = reason?.trim() || `Administrative points adjustment (${pointsType}) by ${authUser.email}`;

    // 2. Fetch current loyalty account
    const { data: acc } = await supabaseAdmin
      .from('loyalty_accounts')
      .select('points_balance, lifetime_points_earned, tier')
      .eq('customer_id', customerId)
      .maybeSingle();

    const oldBalance = acc?.points_balance || 0;
    const oldLifetime = acc?.lifetime_points_earned || 0;
    const oldTier = acc?.tier || 'FLORET';

    const newBalance = Math.max(0, oldBalance + delta);
    const newLifetime = pointsType === 'ADD' ? oldLifetime + delta : oldLifetime;
    const newTier = resolveLoyaltyTier(newLifetime);

    // 3. Record transaction in loyalty_transactions ledger
    await supabaseAdmin.from('loyalty_transactions').insert({
      customer_id: customerId,
      type: pointsType === 'ADD' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      points: delta,
      description: noteText,
    });

    // 4. Update or insert loyalty_account
    if (acc) {
      await supabaseAdmin
        .from('loyalty_accounts')
        .update({
          points_balance: newBalance,
          lifetime_points_earned: newLifetime,
          tier: newTier,
          updated_at: new Date().toISOString(),
        })
        .eq('customer_id', customerId);
    } else {
      await supabaseAdmin.from('loyalty_accounts').insert({
        customer_id: customerId,
        points_balance: newBalance,
        lifetime_points_earned: newLifetime,
        tier: newTier,
      });
    }

    // 5. Server-Enforced Tamper-Proof Audit Logging
    await logAuditEvent({
      actor_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.role,
      action: AUDIT_ACTIONS.POINTS_ADJUSTED,
      entity: 'loyalty_accounts',
      entity_id: customerId,
      old_values: { points_balance: oldBalance, tier: oldTier },
      new_values: {
        points_balance: newBalance,
        lifetime_points_earned: newLifetime,
        tier: newTier,
        delta,
        type: pointsType,
      },
      reason: noteText,
    });

    return res.status(200).json({
      success: true,
      pointsBalance: newBalance,
      lifetimePoints: newLifetime,
      tier: newTier,
      message: `Successfully adjusted points. New balance: ${newBalance} Petal Points.`,
    });
  } catch (err: any) {
    console.error('[Admin Points Adjustment Error]:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to adjust points.' });
  }
}
