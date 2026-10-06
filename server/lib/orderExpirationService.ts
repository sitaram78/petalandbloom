import { supabaseAdmin } from './supabaseServer';
import { reverseOrderLoyalty } from './loyaltyReversalService';

export interface ExpirationResult {
  expiredCount: number;
  restoredPointsCount: number;
  expiredOrderNumbers: string[];
}

/**
 * Sweeps and transitions stale PENDING_PAYMENT orders older than the cutoff (default 60 mins)
 * to PAYMENT_EXPIRED. Automatically restores any redeemed loyalty points to the customer.
 */
export async function expireStalePendingOrders(olderThanMinutes: number = 60): Promise<ExpirationResult> {
  const result: ExpirationResult = {
    expiredCount: 0,
    restoredPointsCount: 0,
    expiredOrderNumbers: [],
  };

  try {
    const cutoffDate = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

    // 1. Fetch stale pending orders
    const { data: staleOrders, error } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, customer_id, loyalty_points_redeemed, created_at, payments(provider)')
      .eq('order_status', 'PENDING_PAYMENT')
      .lt('created_at', cutoffDate)
      .limit(100);

    if (error || !staleOrders || staleOrders.length === 0) {
      return result;
    }

    const manualCutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    for (const order of staleOrders) {
      const isManualUpi = (order as any).payments?.some?.((p: any) => p.provider === 'MANUAL_UPI');
      // Manual UPI orders have a 48-hour settlement window before auto-expiration
      if (isManualUpi && order.created_at > manualCutoffDate) {
        continue;
      }

      // Step A: Restore redeemed loyalty points if customer redeemed any
      if (order.customer_id && (order.loyalty_points_redeemed || 0) > 0) {
        try {
          const rev = await reverseOrderLoyalty(order.id, 'Expired checkout; points refunded', false);
          result.restoredPointsCount += rev.restoredRedeemed;
        } catch (revErr) {
          console.warn(`[Order Expiration] Failed to restore points for order ${order.order_number}:`, revErr);
        }
      }

      // Step B: Update status to PAYMENT_EXPIRED
      const { error: updateErr } = await supabaseAdmin
        .from('orders')
        .update({
          order_status: 'PAYMENT_EXPIRED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (!updateErr) {
        result.expiredCount++;
        result.expiredOrderNumbers.push(order.order_number);

        // Record status history audit
        await supabaseAdmin.from('order_status_history').insert({
          order_id: order.id,
          previous_status: 'PENDING_PAYMENT',
          new_status: 'PAYMENT_EXPIRED',
          note: `Automatically expired after ${olderThanMinutes} minutes of payment inactivity.`,
          created_by: 'system_sweeper',
        });
      }
    }
  } catch (err) {
    console.error('[Expire Stale Orders Error]:', err);
  }

  return result;
}
