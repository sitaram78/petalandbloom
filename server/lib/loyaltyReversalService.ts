import { supabaseAdmin } from './supabaseServer';

export interface LoyaltyReversalResult {
  restoredRedeemed: number;
  reversedEarned: number;
  customerId: string | null;
}

/**
 * Handles automatic, bidirectional loyalty point reversals whenever an order
 * is cancelled, refunded, or expired.
 *
 * Rules:
 * 1. If customer redeemed points on this order -> points are credited back to their balance (RESTORE_CANCELLED).
 * 2. If customer earned points from this order -> points are reclaimed from their balance (REVERSAL_CANCELLED).
 * 3. Prevents duplicate reversals by verifying existing transaction logs for this order_id.
 * 4. Ensures points_balance never falls below zero.
 */
export async function reverseOrderLoyalty(
  orderId: string,
  reversalReason: string = 'Order cancelled or refunded',
  isRefund: boolean = false
): Promise<LoyaltyReversalResult> {
  const result: LoyaltyReversalResult = {
    restoredRedeemed: 0,
    reversedEarned: 0,
    customerId: null,
  };

  try {
    // 1. Fetch order details
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, customer_id, loyalty_points_redeemed, loyalty_discount_in_paise')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order || !order.customer_id) {
      return result;
    }

    const customerId = order.customer_id;
    result.customerId = customerId;

    // 2. Step A: Restore redeemed points back to customer if any
    const pointsRedeemed = order.loyalty_points_redeemed || 0;
    if (pointsRedeemed > 0) {
      // Check if already restored
      const { data: existingRestore } = await supabaseAdmin
        .from('loyalty_transactions')
        .select('id')
        .eq('order_id', order.id)
        .in('type', ['REFUND_RESTORE', 'RESTORE_CANCELLED'])
        .maybeSingle();

      if (!existingRestore) {
        await supabaseAdmin.from('loyalty_transactions').insert({
          customer_id: customerId,
          order_id: order.id,
          type: isRefund ? 'REFUND_RESTORE' : 'RESTORE_CANCELLED',
          points: pointsRedeemed,
          description: `Restored ${pointsRedeemed} Petal Points from ${isRefund ? 'refunded' : 'cancelled'} Order ${order.order_number}`,
        });

        // Credit to loyalty balance
        const { data: acc } = await supabaseAdmin
          .from('loyalty_accounts')
          .select('points_balance')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (acc) {
          await supabaseAdmin
            .from('loyalty_accounts')
            .update({
              points_balance: (acc.points_balance || 0) + pointsRedeemed,
              updated_at: new Date().toISOString(),
            })
            .eq('customer_id', customerId);
        }

        result.restoredRedeemed = pointsRedeemed;
      }
    }

    // 3. Step B: Reclaim any points earned on this order
    const { data: earnedTx } = await supabaseAdmin
      .from('loyalty_transactions')
      .select('id, points')
      .eq('order_id', order.id)
      .eq('type', 'EARN_PURCHASE')
      .maybeSingle();

    if (earnedTx && earnedTx.points > 0) {
      const reversalType = isRefund ? 'REVERSAL_REFUND' : 'REVERSAL_CANCELLED';

      // Check if already reversed
      const { data: existingReversal } = await supabaseAdmin
        .from('loyalty_transactions')
        .select('id')
        .eq('order_id', order.id)
        .eq('type', reversalType)
        .maybeSingle();

      if (!existingReversal) {
        const pointsToReclaim = earnedTx.points;

        await supabaseAdmin.from('loyalty_transactions').insert({
          customer_id: customerId,
          order_id: order.id,
          type: reversalType,
          points: -pointsToReclaim,
          description: `Reversal of ${pointsToReclaim} Petal Points from ${isRefund ? 'refunded' : 'cancelled'} Order ${order.order_number}: ${reversalReason}`,
        });

        // Deduct from balance & lifetime earned
        const { data: acc } = await supabaseAdmin
          .from('loyalty_accounts')
          .select('points_balance, lifetime_points_earned')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (acc) {
          const newBalance = Math.max(0, (acc.points_balance || 0) - pointsToReclaim);
          const newLifetime = Math.max(0, (acc.lifetime_points_earned || 0) - pointsToReclaim);
          const newTier = newLifetime >= 1500 ? 'HEIRLOOM' : (newLifetime >= 500 ? 'BLOSSOM' : 'FLORET');

          await supabaseAdmin
            .from('loyalty_accounts')
            .update({
              points_balance: newBalance,
              lifetime_points_earned: newLifetime,
              tier: newTier,
              updated_at: new Date().toISOString(),
            })
            .eq('customer_id', customerId);
        }

        result.reversedEarned = pointsToReclaim;
      }
    }
  } catch (err) {
    console.error('[Loyalty Reversal Service Error]:', err);
  }

  return result;
}
