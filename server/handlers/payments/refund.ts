import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseServer';
import { logAuditEvent, AUDIT_ACTIONS } from '../../lib/auditService';
import { requireAuth } from '../../lib/authMiddleware';
import { reverseOrderLoyalty } from '../../lib/loyaltyReversalService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  // Enforce Super Admin only authorization for issuing monetary refunds
  const authUser = await requireAuth(req, res, { allowedRoles: ['super_admin'] });
  if (!authUser) return;

  try {
    const { orderId, amountInRupees, reason } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required.' });
    }

    // 1. Fetch order & payment record
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, total_in_paise, payment_status')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, cf_payment_id, status, amount_in_paise')
      .eq('order_id', order.id)
      .maybeSingle();

    const refundAmount = amountInRupees ? Number(amountInRupees) : order.total_in_paise / 100;
    const refundId = `ref_${order.order_number}_${Date.now()}`;

    const appId = process.env.CASHFREE_APP_ID || '';
    const secretKey = process.env.CASHFREE_SECRET_KEY || '';
    const env = (process.env.CASHFREE_ENVIRONMENT || 'SANDBOX').toUpperCase();
    const baseUrl = env === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

    let cfRefundResponse: any = null;

    if (appId && secretKey && payment?.cf_payment_id && !payment.cf_payment_id.startsWith('sim_')) {
      // Call official Cashfree Refund API
      const response = await fetch(`${baseUrl}/orders/${order.order_number}/refunds`, {
        method: 'POST',
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': '2023-08-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refund_amount: Number(refundAmount.toFixed(2)),
          refund_id: refundId,
          refund_note: reason || 'Customer requested refund via Atelier Admin',
        }),
      });

      cfRefundResponse = await response.json();
    } else {
      // Sandbox / Test Simulator Mode
      cfRefundResponse = {
        cf_refund_id: `sim_ref_${Date.now()}`,
        refund_status: 'SUCCESS',
        refund_amount: refundAmount,
      };
    }

    // Record refund status in database
    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      previous_status: order.payment_status,
      new_status: 'REFUNDED',
      note: `Refund of ₹${refundAmount} processed (${reason || 'Atelier refund'}). Ref ID: ${cfRefundResponse.cf_refund_id || refundId}`,
      created_by: authUser.email,
    });

    if (payment) {
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'REFUNDED',
          payment_details: {
            ...payment,
            refund: cfRefundResponse,
          },
        })
        .eq('id', payment.id);
    }

    // Automated Bidirectional Loyalty Points Reversal
    await reverseOrderLoyalty(order.id, reason || 'Order refunded', true);

    // Central Audit Logging with verified actor
    await logAuditEvent({
      actor_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.role,
      action: AUDIT_ACTIONS.PAYMENT_REFUNDED,
      entity: 'payments',
      entity_id: order.order_number || order.id,
      old_values: { payment_status: order.payment_status, total_in_paise: order.total_in_paise },
      new_values: { refund_amount: refundAmount, refund_id: cfRefundResponse.cf_refund_id || refundId },
      reason: reason || 'Customer requested refund via Atelier Admin',
    });

    return res.status(200).json({
      success: true,
      message: `Refund of ₹${refundAmount} initiated successfully.`,
      refundId: cfRefundResponse.cf_refund_id || refundId,
      details: cfRefundResponse,
    });
  } catch (err: any) {
    console.error('[Refund API Error]', err);
    return res.status(500).json({ success: false, message: err.message || 'Refund failed.' });
  }
}
