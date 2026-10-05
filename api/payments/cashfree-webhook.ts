import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';
import { verifyCashfreeSignature } from '../lib/cashfreeServer';
import { confirmOrderPayment } from '../lib/orderPaymentService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed. Use POST.' });
  }

  try {
    const signature = (req.headers['x-webhook-signature'] as string) || '';
    const timestamp = (req.headers['x-webhook-timestamp'] as string) || '';
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventType = payload.type || payload.event_type || 'PAYMENT_SUCCESS_WEBHOOK';
    const data = payload.data || payload;

    // 1. Cryptographic Signature Verification (bypass only for explicitly simulated developer tests)
    const isSimulated = payload.is_simulated === true || data?.payment?.payment_group === 'UPI_SIMULATED' || req.headers['x-simulated-event'] === 'true';
    if (!isSimulated) {
      const isSignatureValid = verifyCashfreeSignature(signature, timestamp, rawBody);
      if (!isSignatureValid) {
        console.warn('[Webhook Warning] Invalid signature rejected.');
        return res.status(401).json({ message: 'Invalid webhook signature.' });
      }
    }

    const orderId = data.order?.order_id || data.order_id;
    const payment = data.payment || {};
    const cfPaymentId = payment.cf_payment_id ? String(payment.cf_payment_id) : `pay_${Date.now()}`;
    const eventId = `${eventType}_${orderId}_${cfPaymentId}`;

    if (!orderId) {
      return res.status(400).json({ message: 'Missing order_id in webhook payload.' });
    }

    // 2. Idempotency Check: Don't process the same event twice
    const { data: existingEvent } = await supabaseAdmin
      .from('payment_events')
      .select('id, is_processed')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent && existingEvent.is_processed) {
      console.log(`[Webhook] Duplicate event ${eventId} safely ignored.`);
      return res.status(200).json({ received: true, note: 'Already processed' });
    }

    // Record incoming webhook event
    if (!existingEvent) {
      await supabaseAdmin.from('payment_events').insert({
        event_id: eventId,
        cf_order_id: orderId,
        event_type: eventType,
        raw_payload: payload,
        is_processed: false,
      });
    }

    // 3. Find the matching Order in Database
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        subtotal_in_paise,
        discount_in_paise,
        loyalty_discount_in_paise,
        shipping_fee_in_paise,
        total_in_paise,
        customer_id,
        guest_name,
        guest_phone,
        guest_email,
        shipping_address_snapshot,
        applied_coupon_code,
        order_status,
        loyalty_points_redeemed
      `)
      .eq('order_number', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      console.error(`[Webhook Error] Order ${orderId} not found in database.`);
      return res.status(404).json({ message: 'Order not found.' });
    }

    // 4. Process Payment Success
    const isPaymentSuccessful =
      eventType.includes('SUCCESS') ||
      payment.payment_status === 'SUCCESS' ||
      payload.order_status === 'PAID';

    if (isPaymentSuccessful) {
      await confirmOrderPayment(
        order.order_number,
        {
          cfPaymentId,
          paymentMethod: payment.payment_group || payment.payment_method || 'ONLINE',
          paymentDetails: payment,
        },
        'cashfree_webhook'
      );
    } else {
      // Payment Failed or Dropped
      await supabaseAdmin
        .from('orders')
        .update({
          order_status: 'PAYMENT_FAILED',
          payment_status: 'FAILED',
        })
        .eq('id', order.id);

      await supabaseAdmin
        .from('payments')
        .update({
          status: 'FAILED',
          error_message: payment.payment_message || 'Payment was not completed',
        })
        .eq('order_id', order.id);

      await supabaseAdmin.from('order_status_history').insert({
        order_id: order.id,
        previous_status: order.order_status,
        new_status: 'PAYMENT_FAILED',
        note: `Payment failed or dropped: ${payment.payment_message || 'Unknown reason'}`,
        created_by: 'cashfree_webhook',
      });
    }

    // 5. Mark Event as processed
    await supabaseAdmin
      .from('payment_events')
      .update({ is_processed: true })
      .eq('event_id', eventId);

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[Cashfree Webhook Handler Exception]', err);
    return res.status(500).json({ message: 'Internal server error processing webhook.' });
  }
}
