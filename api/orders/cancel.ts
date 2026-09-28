import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    const { orderId, reason } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required.' });
    }

    // 1. Fetch order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, order_status, customer_id, loyalty_points_redeemed')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
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

    // 2. Restore Inventory for each item
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', order.id);

    if (items && items.length > 0) {
      for (const item of items) {
        if (item.product_id) {
          const { data: prod } = await supabaseAdmin
            .from('products')
            .select('inventory_count')
            .eq('id', item.product_id)
            .maybeSingle();

          if (prod) {
            await supabaseAdmin
              .from('products')
              .update({ inventory_count: (prod.inventory_count || 0) + item.quantity })
              .eq('id', item.product_id);
          }
        }
      }
    }

    // 3. Restore redeemed Petal Points to customer if any
    if (order.customer_id && (order.loyalty_points_redeemed || 0) > 0) {
      const pointsToRestore = order.loyalty_points_redeemed;

      await supabaseAdmin.from('loyalty_transactions').insert({
        customer_id: order.customer_id,
        order_id: order.id,
        type: 'REFUND_RESTORE',
        points: pointsToRestore,
        description: `Restored ${pointsToRestore} Petal Points from cancelled Order ${order.order_number}`,
      });

      const { data: acc } = await supabaseAdmin
        .from('loyalty_accounts')
        .select('points_balance')
        .eq('customer_id', order.customer_id)
        .maybeSingle();

      if (acc) {
        await supabaseAdmin
          .from('loyalty_accounts')
          .update({ points_balance: (acc.points_balance || 0) + pointsToRestore })
          .eq('customer_id', order.customer_id);
      }
    }

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
      created_by: 'admin_or_customer',
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
