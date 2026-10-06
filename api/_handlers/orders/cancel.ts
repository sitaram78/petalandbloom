import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../_lib/supabaseServer';
import { requireAuth } from '../../_lib/authMiddleware';
import { reverseOrderLoyalty } from '../../_lib/loyaltyReversalService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  // Enforce authentication
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  try {
    const { orderId, reason } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required.' });
    }

    // 1. Fetch order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, order_status, payment_status, customer_id, loyalty_points_redeemed')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Ownership & privilege check: only staff with 'orders.cancel' capability or the customer who placed this order can cancel
    const hasCancelPerm =
      authUser.role === 'super_admin' ||
      authUser.role === 'admin' ||
      authUser.role === 'operations' ||
      (Array.isArray(authUser.permissions) && authUser.permissions.includes('orders.cancel'));
    const isOwnerCustomer = Boolean(order.customer_id && order.customer_id === authUser.id);

    if (!hasCancelPerm && !isOwnerCustomer) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to cancel this order.',
      });
    }

    if (order.order_status === 'CANCELLED') {
      return res.status(200).json({ success: true, message: 'Order is already cancelled.' });
    }

    // Business Rule (Decision 7): Made-to-order creations cannot be cancelled once crafting or packaging has commenced
    const nonCancellableStatuses = ['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    if (nonCancellableStatuses.includes(order.order_status)) {
      return res.status(400).json({
        success: false,
        message: 'Crafting for this made-to-order piece is already in progress in our studio. Made-to-order creations cannot be cancelled once crafting has commenced.',
      });
    }

    // 2. Restore Inventory ONLY if it was previously decremented upon successful payment
    // Unpaid checkouts in PENDING_PAYMENT never decremented inventory, so restoring them would create phantom stock
    const wasInventoryDecremented = order.payment_status === 'SUCCESS' || order.order_status === 'PAYMENT_CONFIRMED';
    if (wasInventoryDecremented) {
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', order.id);

      if (items && items.length > 0) {
        for (const item of items) {
          if (item.product_id) {
            const { data: prod } = await supabaseAdmin
              .from('products')
              .select('inventory_count, is_made_to_order')
              .eq('id', item.product_id)
              .maybeSingle();

            if (prod && !prod.is_made_to_order) {
              await supabaseAdmin
                .from('products')
                .update({ inventory_count: (prod.inventory_count || 0) + item.quantity })
                .eq('id', item.product_id);
            }
          }
        }
      }
    }

    // 3. Automated Bidirectional Loyalty Points Reversal (restores redeemed + revokes earned)
    const loyaltyReversal = await reverseOrderLoyalty(order.id, reason || 'Order cancelled', false);

    // 4. Update order status
    await supabaseAdmin
      .from('orders')
      .update({ order_status: 'CANCELLED' })
      .eq('id', order.id);

    // 5. Add status history audit record
    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      previous_status: order.order_status,
      new_status: 'CANCELLED',
      note: reason || 'Order cancelled; stock and points restored.',
      created_by: authUser.email,
    });

    return res.status(200).json({
      success: true,
      message: `Order ${order.order_number} has been successfully cancelled.`,
    });
  } catch (err: any) {
    console.error('[Order Cancellation Error]', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to cancel order.' });
  }
}
