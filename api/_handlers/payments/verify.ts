import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../_lib/supabaseServer';
import { fetchCashfreeOrder, fetchCashfreePayments } from '../../_lib/cashfreeServer';
import { confirmOrderPayment } from '../../_lib/orderPaymentService';

/**
 * Actively queries Cashfree Payment Gateway to verify payment status of an order.
 * If Cashfree confirms payment was successful, immediately synchronizes the database,
 * updates order state to PAYMENT_CONFIRMED, increments coupons, decrements stock, and awards points.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use GET or POST.' });
  }

  const orderId =
    (req.query.orderId as string) ||
    (req.query.order_id as string) ||
    req.body?.orderId ||
    req.body?.order_id;

  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ success: false, message: 'orderId is required.' });
  }

  const cleanOrderId = orderId.trim();

  try {
    // 1. Fetch current database record safely checking UUID vs order_number
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanOrderId);
    let orderQuery = supabaseAdmin
      .from('orders')
      .select('id, order_number, order_status, payment_status, total_in_paise');

    if (isUuid) {
      orderQuery = orderQuery.eq('id', cleanOrderId);
    } else {
      orderQuery = orderQuery.eq('order_number', cleanOrderId);
    }

    const { data: order, error: orderErr } = await orderQuery.maybeSingle();

    if (orderErr || !order) {
      return res.status(404).json({ success: false, message: 'Order record not found.' });
    }

    // Fast Path: Already verified and confirmed
    if (order.payment_status === 'SUCCESS') {
      return res.status(200).json({
        success: true,
        isPaid: true,
        paymentStatus: 'SUCCESS',
        orderStatus: order.order_status,
        order,
      });
    }

    // Check if the order was placed as MANUAL_UPI or offline settlement
    const { data: paymentRecord } = await supabaseAdmin
      .from('payments')
      .select('id, provider, status, cf_order_id, cf_payment_session_id')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentRecord?.provider === 'MANUAL_UPI' || paymentRecord?.cf_order_id?.startsWith('manual_') || (!paymentRecord?.cf_order_id && !paymentRecord?.cf_payment_session_id)) {
      return res.status(200).json({
        success: true,
        isPaid: order.payment_status === 'SUCCESS',
        paymentStatus: order.payment_status,
        orderStatus: order.order_status,
        provider: 'MANUAL_UPI',
        order,
      });
    }

    // 2. Actively fetch from Cashfree Gateway API
    const [cfOrder, cfPayments] = await Promise.all([
      fetchCashfreeOrder(order.order_number),
      fetchCashfreePayments(order.order_number),
    ]);

    const successfulPayment = Array.isArray(cfPayments)
      ? cfPayments.find((p: any) => p.payment_status === 'SUCCESS')
      : null;

    const isPaidOnCashfree =
      cfOrder?.order_status === 'PAID' ||
      Boolean(successfulPayment);

    if (isPaidOnCashfree) {
      const cfPaymentId = successfulPayment?.cf_payment_id
        ? String(successfulPayment.cf_payment_id)
        : (cfOrder?.cf_order_id ? String(cfOrder.cf_order_id) : `cf_sync_${Date.now()}`);

      const paymentMethod =
        successfulPayment?.payment_group ||
        successfulPayment?.payment_method ||
        'ONLINE';

      // Synchronize database state centrally
      const confirmResult = await confirmOrderPayment(
        order.order_number,
        {
          cfPaymentId,
          paymentMethod,
          paymentDetails: successfulPayment || cfOrder,
        },
        'cashfree_active_verify'
      );

      return res.status(200).json({
        success: true,
        isPaid: true,
        paymentStatus: 'SUCCESS',
        orderStatus: 'PAYMENT_CONFIRMED',
        order: confirmResult.order || order,
        verifiedWithCashfree: true,
      });
    }

    // Cashfree does not show this order as PAID yet
    return res.status(200).json({
      success: true,
      isPaid: false,
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      cashfreeStatus: cfOrder?.order_status || 'NOT_FOUND',
      order,
    });
  } catch (err: any) {
    console.error('[Verify API Error]:', err);
    return res.status(500).json({ success: false, message: err.message || 'Verification failed.' });
  }
}
