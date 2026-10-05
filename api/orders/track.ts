import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';
import { fetchCashfreeOrder, fetchCashfreePayments } from '../lib/cashfreeServer';
import { confirmOrderPayment } from '../lib/orderPaymentService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    const { orderNumber, phone } = req.body || {};

    if (!orderNumber || typeof orderNumber !== 'string') {
      return res.status(400).json({ success: false, message: 'Order number is required.' });
    }

    const cleanOrderNumber = orderNumber.trim().toUpperCase();
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        order_status,
        payment_status,
        subtotal_in_paise,
        discount_in_paise,
        shipping_fee_in_paise,
        total_in_paise,
        shipping_address_snapshot,
        guest_name,
        guest_phone,
        applied_coupon_code,
        created_at
      `)
      .eq('order_number', cleanOrderNumber)
      .maybeSingle();

    if (orderErr || !order) {
      return res.status(404).json({ success: false, message: 'Order not found. Please check your order reference.' });
    }

    // Self-healing check: If order is still PENDING_PAYMENT, verify directly with Cashfree
    if (order.payment_status !== 'SUCCESS' && order.order_status === 'PENDING_PAYMENT') {
      try {
        const [cfOrder, cfPayments] = await Promise.all([
          fetchCashfreeOrder(order.order_number),
          fetchCashfreePayments(order.order_number),
        ]);

        const successfulPayment = Array.isArray(cfPayments)
          ? cfPayments.find((p: any) => p.payment_status === 'SUCCESS')
          : null;

        const isPaid =
          cfOrder?.order_status === 'PAID' ||
          Boolean(successfulPayment);

        if (isPaid) {
          const cfPaymentId = successfulPayment?.cf_payment_id
            ? String(successfulPayment.cf_payment_id)
            : (cfOrder?.cf_order_id ? String(cfOrder.cf_order_id) : `cf_sync_${Date.now()}`);
          const paymentMethod = successfulPayment?.payment_group || 'ONLINE';

          const syncResult = await confirmOrderPayment(
            order.order_number,
            { cfPaymentId, paymentMethod, paymentDetails: successfulPayment || cfOrder },
            'cashfree_track_sync'
          );

          if (syncResult.order) {
            order.order_status = syncResult.order.order_status;
            order.payment_status = syncResult.order.payment_status;
          }
        }
      } catch (syncErr) {
        console.warn('[Track Order Cashfree Sync Warning]:', syncErr);
      }
    }

    // Security check: Phone verification for guest or customer lookup
    if (cleanPhone) {
      const storedPhone = (order.guest_phone || '').replace(/\D/g, '').slice(-10);
      if (storedPhone !== cleanPhone) {
        return res.status(403).json({ success: false, message: 'The phone number provided does not match this order.' });
      }
    }

    // Fetch order items
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('product_code, product_name, unit_price_in_paise, quantity, selected_color, gift_wrap, item_image')
      .eq('order_id', order.id);

    // Fetch status history
    const { data: history } = await supabaseAdmin
      .from('order_status_history')
      .select('previous_status, new_status, note, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    // Fetch shipment tracking if present
    const { data: shipment } = await supabaseAdmin
      .from('shipments')
      .select('carrier, awb_number, tracking_url, status, estimated_delivery_date')
      .eq('order_id', order.id)
      .maybeSingle();

    return res.status(200).json({
      success: true,
      order: {
        orderNumber: order.order_number,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        subtotalInRupees: order.subtotal_in_paise / 100,
        discountInRupees: order.discount_in_paise / 100,
        shippingFeeInRupees: order.shipping_fee_in_paise / 100,
        totalInRupees: order.total_in_paise / 100,
        shippingAddress: order.shipping_address_snapshot,
        createdAt: order.created_at,
        items: items || [],
        history: history || [],
        shipment: shipment || null,
      },
    });
  } catch (err: any) {
    console.error('[Track Order Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve order tracking information.' });
  }
}
