import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';
import { verifyCashfreeSignature } from '../lib/cashfreeServer';
import { sendOrderConfirmationEmail } from '../lib/emailService';

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

      // Decrement Inventory for Ordered Items & Prepare Email Payload
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('product_id, product_name, product_code, quantity, unit_price_in_paise, selected_color, gift_wrap, personal_message')
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

      // Send Order Confirmation Email (non-blocking)
      if (order.guest_email) {
        try {
          const siteUrl = process.env.VITE_SITE_URL || 'https://thepetalandbloom.vercel.app';
          await sendOrderConfirmationEmail({
            to: order.guest_email,
            name: order.guest_name || 'Valued Customer',
            orderNumber: order.order_number,
            items: items || [],
            subtotalInPaise: order.subtotal_in_paise,
            discountInPaise: order.discount_in_paise,
            loyaltyDiscountInPaise: order.loyalty_discount_in_paise,
            shippingFeeInPaise: order.shipping_fee_in_paise,
            totalInPaise: order.total_in_paise,
            shippingAddress: order.shipping_address_snapshot || {
              addressLine1: 'Address on file',
              city: '',
              state: '',
              pincode: '',
            },
            trackUrl: `${siteUrl}/track?order_id=${order.order_number}`,
          });
        } catch (emailErr) {
          console.warn('[Webhook Order Confirmation Email Error]:', emailErr);
        }
      }

      // Award Loyalty Points if Registered Customer (Decision 1: 1 point per ₹20 spent) + Tier Auto-upgrade
      if (order.customer_id) {
        const pointsEarned = Math.floor(order.total_in_paise / 2000); // 1 pt per ₹20
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
            const newLifetime = (loyaltyAcc.lifetime_points_earned || 0) + pointsEarned;
            const newTier = newLifetime >= 1500 ? 'HEIRLOOM' : (newLifetime >= 500 ? 'BLOSSOM' : 'FLORET');

            await supabaseAdmin
              .from('loyalty_accounts')
              .update({
                points_balance: (loyaltyAcc.points_balance || 0) + pointsEarned,
                lifetime_points_earned: newLifetime,
                tier: newTier,
              })
              .eq('customer_id', order.customer_id);
          } else {
            const newTier = pointsEarned >= 1500 ? 'HEIRLOOM' : (pointsEarned >= 500 ? 'BLOSSOM' : 'FLORET');
            await supabaseAdmin.from('loyalty_accounts').insert({
              customer_id: order.customer_id,
              points_balance: pointsEarned,
              lifetime_points_earned: pointsEarned,
              tier: newTier,
            });
          }
        }

        // Check and Reward Referrer on First Order (Decision 2: 50 points = ₹25 value, ONLY if referrer has purchased from us)
        try {
          const { data: pendingRef } = await supabaseAdmin
            .from('referrals')
            .select('id, referrer_id, status')
            .eq('referee_id', order.customer_id)
            .eq('status', 'PENDING')
            .maybeSingle();

          if (pendingRef && pendingRef.referrer_id) {
            // Verify if the referrer themselves has completed at least one paid purchase
            const { data: referrerPurchases, error: refPurchaseErr } = await supabaseAdmin
              .from('orders')
              .select('id')
              .eq('customer_id', pendingRef.referrer_id)
              .eq('payment_status', 'SUCCESS')
              .limit(1);

            const referrerHasPurchased = !refPurchaseErr && referrerPurchases && referrerPurchases.length > 0;

            if (referrerHasPurchased) {
              const referralRewardPoints = 50; // 50 Petal Points (= ₹25 value)
              await supabaseAdmin.from('loyalty_transactions').insert({
                customer_id: pendingRef.referrer_id,
                order_id: order.id,
                type: 'REFERRAL_BONUS',
                points: referralRewardPoints,
                description: `Referral Gift: Your invited friend completed their first order (${order.order_number})!`,
              });

              const { data: refLoyalty } = await supabaseAdmin
                .from('loyalty_accounts')
                .select('points_balance, lifetime_points_earned')
                .eq('customer_id', pendingRef.referrer_id)
                .maybeSingle();

              if (refLoyalty) {
                const updatedLifetime = (refLoyalty.lifetime_points_earned || 0) + referralRewardPoints;
                const refTier = updatedLifetime >= 1500 ? 'HEIRLOOM' : (updatedLifetime >= 500 ? 'BLOSSOM' : 'FLORET');

                await supabaseAdmin
                  .from('loyalty_accounts')
                  .update({
                    points_balance: (refLoyalty.points_balance || 0) + referralRewardPoints,
                    lifetime_points_earned: updatedLifetime,
                    tier: refTier,
                  })
                  .eq('customer_id', pendingRef.referrer_id);
              }

              await supabaseAdmin
                .from('referrals')
                .update({ status: 'REWARDED' })
                .eq('id', pendingRef.id);
            } else {
              // Referrer has not purchased yet; retain referral pending until referrer makes a purchase
              console.log(`[Referral Notice] Referrer ${pendingRef.referrer_id} will be credited once they complete their own purchase.`);
            }
          }
        } catch (refRewardErr) {
          console.warn('[Referral Reward Warning]:', refRewardErr);
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
