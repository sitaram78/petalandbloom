import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';
import { verifyCashfreeSignature } from '../lib/cashfreeServer';

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
      .select('id, order_number, total_in_paise, customer_id, guest_phone, applied_coupon_code, order_status, loyalty_points_redeemed')
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
      // Transition Order State Machine
      await supabaseAdmin
        .from('orders')
        .update({
          order_status: 'PAYMENT_CONFIRMED',
          payment_status: 'SUCCESS',
        })
        .eq('id', order.id);

      // Update Payment Record
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'SUCCESS',
          cf_payment_id: cfPaymentId,
          payment_method: payment.payment_group || payment.payment_method || 'ONLINE',
          payment_details: payment,
        })
        .eq('order_id', order.id);

      // Audit Log Status Transition
      await supabaseAdmin.from('order_status_history').insert({
        order_id: order.id,
        previous_status: order.order_status,
        new_status: 'PAYMENT_CONFIRMED',
        note: `Payment successfully captured via Cashfree (Payment ID: ${cfPaymentId})`,
        created_by: 'cashfree_webhook',
      });

      // Handle Coupon Usage Increment & Redemption Record
      if (order.applied_coupon_code) {
        const { data: coupon } = await supabaseAdmin
          .from('coupons')
          .select('id, usage_count')
          .eq('code', order.applied_coupon_code)
          .maybeSingle();

        if (coupon) {
          await supabaseAdmin
            .from('coupons')
            .update({ usage_count: (coupon.usage_count || 0) + 1 })
            .eq('id', coupon.id);

          await supabaseAdmin.from('coupon_redemptions').insert({
            coupon_id: coupon.id,
            order_id: order.id,
            customer_id: order.customer_id,
            customer_phone: order.guest_phone,
            discount_applied_in_paise: 0,
          });
        }
      }

      // Decrement Inventory for Ordered Items
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', order.id);

      if (items && items.length > 0) {
        for (const item of items) {
          if (item.product_id) {
            const { data: currentProd } = await supabaseAdmin
              .from('products')
              .select('inventory_count')
              .eq('id', item.product_id)
              .single();

            if (currentProd) {
              const newCount = Math.max(0, (currentProd.inventory_count || 0) - item.quantity);
              await supabaseAdmin
                .from('products')
                .update({ inventory_count: newCount })
                .eq('id', item.product_id);
            }
          }
        }
      }

      // Award Loyalty Points if Registered Customer (1 point per ₹10 spent)
      if (order.customer_id) {
        const pointsEarned = Math.floor(order.total_in_paise / 1000); // 1 pt per ₹10
        if (pointsEarned > 0) {
          await supabaseAdmin.from('loyalty_transactions').insert({
            customer_id: order.customer_id,
            order_id: order.id,
            type: 'EARN_PURCHASE',
            points: pointsEarned,
            description: `Earned for Order ${order.order_number}`,
          });

          const { data: loyaltyAcc } = await supabaseAdmin
            .from('loyalty_accounts')
            .select('points_balance, lifetime_points_earned')
            .eq('customer_id', order.customer_id)
            .maybeSingle();

          if (loyaltyAcc) {
            await supabaseAdmin
              .from('loyalty_accounts')
              .update({
                points_balance: (loyaltyAcc.points_balance || 0) + pointsEarned,
                lifetime_points_earned: (loyaltyAcc.lifetime_points_earned || 0) + pointsEarned,
              })
              .eq('customer_id', order.customer_id);
          } else {
            await supabaseAdmin.from('loyalty_accounts').insert({
              customer_id: order.customer_id,
              points_balance: pointsEarned,
              lifetime_points_earned: pointsEarned,
              tier: 'FLORET',
            });
          }
        }
      }

      // Deduct Redeemed Loyalty Points if Any (and not already deducted at order placement)
      if (order.customer_id && order.loyalty_points_redeemed > 0) {
        const { data: existingRedeem } = await supabaseAdmin
          .from('loyalty_transactions')
          .select('id')
          .eq('order_id', order.id)
          .eq('type', 'REDEEM_PURCHASE')
          .maybeSingle();

        if (!existingRedeem) {
          await supabaseAdmin.from('loyalty_transactions').insert({
            customer_id: order.customer_id,
            order_id: order.id,
            type: 'REDEEM_PURCHASE',
            points: -order.loyalty_points_redeemed,
            description: `Redeemed on Order ${order.order_number}`,
          });

          const { data: loyaltyAcc } = await supabaseAdmin
            .from('loyalty_accounts')
            .select('points_balance')
            .eq('customer_id', order.customer_id)
            .maybeSingle();

          if (loyaltyAcc) {
            await supabaseAdmin
              .from('loyalty_accounts')
              .update({
                points_balance: Math.max(0, (loyaltyAcc.points_balance || 0) - order.loyalty_points_redeemed),
              })
              .eq('customer_id', order.customer_id);
          }
        }
      }
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
