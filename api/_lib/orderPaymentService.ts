import { supabaseAdmin } from './supabaseServer';
import { sendOrderConfirmationEmail, sendReferralRewardEmail } from './emailService';
import { getCachedStoreSettings } from '../_handlers/settings/store';

export interface PaymentDetailsInput {
  cfPaymentId?: string;
  paymentMethod?: string;
  paymentDetails?: any;
}

export interface ConfirmPaymentResult {
  success: boolean;
  message?: string;
  alreadyConfirmed?: boolean;
  order?: any;
  error?: any;
}

/**
 * Centrally confirms an order's payment.
 * Transitions order state to PAYMENT_CONFIRMED, marks payment_status SUCCESS,
 * increments coupon usage & redemptions, decrements inventory, awards loyalty points,
 * and sends confirmation emails. Fully idempotent: safe to call multiple times.
 */
export async function confirmOrderPayment(
  orderIdentifier: string,
  paymentInput?: PaymentDetailsInput,
  source: string = 'system'
): Promise<ConfirmPaymentResult> {
  try {
    // 1. Fetch target order
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
        payment_status,
        loyalty_points_redeemed
      `)
      .or(`order_number.eq.${orderIdentifier},id.eq.${orderIdentifier}`)
      .maybeSingle();

    if (orderErr || !order) {
      return { success: false, message: 'Order not found', error: orderErr };
    }

    // Idempotency: If already confirmed as SUCCESS, do not duplicate actions
    if (order.payment_status === 'SUCCESS') {
      return { success: true, alreadyConfirmed: true, order };
    }

    const cfPaymentId = paymentInput?.cfPaymentId || `pay_${Date.now()}`;
    const paymentMethod = paymentInput?.paymentMethod || 'ONLINE';
    const paymentDetails = paymentInput?.paymentDetails || {};

    // 2. Determine appropriate order_status
    // Preserve advanced fulfillment statuses if already progressed
    const newOrderStatus = ['CANCELLED', 'RETURNED', 'REFUNDED'].includes(order.order_status)
      ? order.order_status
      : (['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.order_status)
          ? order.order_status
          : 'PAYMENT_CONFIRMED');

    const { error: updateOrderErr } = await supabaseAdmin
      .from('orders')
      .update({
        order_status: newOrderStatus,
        payment_status: 'SUCCESS',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateOrderErr) {
      console.error('[confirmOrderPayment] Error updating order table:', updateOrderErr);
    }

    // 3. Upsert / Update payments table
    try {
      const { data: existingPayment } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle();

      if (existingPayment) {
        await supabaseAdmin
          .from('payments')
          .update({
            status: 'SUCCESS',
            cf_payment_id: cfPaymentId,
            payment_method: paymentMethod,
            payment_details: paymentDetails,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPayment.id);
      } else {
        await supabaseAdmin
          .from('payments')
          .insert({
            order_id: order.id,
            amount_in_paise: order.total_in_paise,
            status: 'SUCCESS',
            cf_payment_id: cfPaymentId,
            payment_method: paymentMethod,
            payment_details: paymentDetails,
          });
      }
    } catch (payErr) {
      console.warn('[confirmOrderPayment] Payment record error:', payErr);
    }

    // 4. Record order_status_history
    try {
      await supabaseAdmin.from('order_status_history').insert({
        order_id: order.id,
        previous_status: order.order_status,
        new_status: newOrderStatus,
        note: `Payment successfully captured via ${source} (Payment ID: ${cfPaymentId})`,
        created_by: source,
      });
    } catch (histErr) {
      console.warn('[confirmOrderPayment] History insert warning:', histErr);
    }

    // 5. Handle Coupon Usage Increment & Redemption Record
    if (order.applied_coupon_code) {
      try {
        const { data: coupon } = await supabaseAdmin
          .from('coupons')
          .select('id, usage_count')
          .eq('code', order.applied_coupon_code)
          .maybeSingle();

        if (coupon) {
          const { data: existingRedemption } = await supabaseAdmin
            .from('coupon_redemptions')
            .select('id')
            .eq('coupon_id', coupon.id)
            .eq('order_id', order.id)
            .maybeSingle();

          if (!existingRedemption) {
            await supabaseAdmin
              .from('coupons')
              .update({ usage_count: (coupon.usage_count || 0) + 1 })
              .eq('id', coupon.id);

            await supabaseAdmin.from('coupon_redemptions').insert({
              coupon_id: coupon.id,
              order_id: order.id,
              customer_id: order.customer_id,
              customer_phone: order.guest_phone,
              discount_applied_in_paise: order.discount_in_paise || 0,
            });
          }
        }
      } catch (couponErr) {
        console.warn('[confirmOrderPayment] Coupon redemption error:', couponErr);
      }
    }

    // 6. Decrement Inventory for Ordered Items
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('product_id, product_name, product_code, quantity, unit_price_in_paise, selected_color, gift_wrap, personal_message')
      .eq('order_id', order.id);

    if (items && items.length > 0) {
      for (const item of items) {
        if (item.product_id) {
          try {
            const { data: currentProd } = await supabaseAdmin
              .from('products')
              .select('inventory_count, is_made_to_order')
              .eq('id', item.product_id)
              .maybeSingle();

            if (currentProd && !currentProd.is_made_to_order) {
              const newCount = Math.max(0, (currentProd.inventory_count || 0) - item.quantity);
              await supabaseAdmin
                .from('products')
                .update({ inventory_count: newCount })
                .eq('id', item.product_id);
            }
          } catch (invErr) {
            console.warn('[confirmOrderPayment] Inventory decrement error:', invErr);
          }
        }
      }
    }

    // 7. Send Order Confirmation Email (non-blocking)
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
        console.warn('[confirmOrderPayment] Order confirmation email error:', emailErr);
      }
    }

    // 8. Resolve Customer Profile & Award Loyalty / Referral Points
    let effectiveCustomerId = order.customer_id;
    if (!effectiveCustomerId && order.guest_phone) {
      try {
        const cleanPhone = order.guest_phone.replace(/\D/g, '').slice(-10);
        if (cleanPhone) {
          const { data: matchedProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .ilike('phone', `%${cleanPhone}%`)
            .maybeSingle();

          if (matchedProfile?.id) {
            effectiveCustomerId = matchedProfile.id;
            await supabaseAdmin
              .from('orders')
              .update({ customer_id: effectiveCustomerId })
              .eq('id', order.id);
          }
        }
      } catch (linkErr) {
        console.warn('[confirmOrderPayment] Customer link warning:', linkErr);
      }
    }

    // Loyalty points allocation
    const storeConfig = getCachedStoreSettings();
    const isLoyaltyActive = storeConfig.featureFlags?.enableLoyalty !== false;
    const spendPerPt = storeConfig.businessRules?.loyaltySpendPerPointPaise || 2000;

    if (effectiveCustomerId && isLoyaltyActive) {
      const pointsEarned = Math.floor(order.total_in_paise / spendPerPt);
      if (pointsEarned > 0) {
        try {
          await supabaseAdmin.from('loyalty_transactions').insert({
            customer_id: effectiveCustomerId,
            order_id: order.id,
            type: 'EARN_PURCHASE',
            points: pointsEarned,
            description: `Earned for Order ${order.order_number}`,
          });

          const { data: loyaltyAcc } = await supabaseAdmin
            .from('loyalty_accounts')
            .select('points_balance, lifetime_points_earned')
            .eq('customer_id', effectiveCustomerId)
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
              .eq('customer_id', effectiveCustomerId);
          } else {
            const newTier = pointsEarned >= 1500 ? 'HEIRLOOM' : (pointsEarned >= 500 ? 'BLOSSOM' : 'FLORET');
            await supabaseAdmin.from('loyalty_accounts').insert({
              customer_id: effectiveCustomerId,
              points_balance: pointsEarned,
              lifetime_points_earned: pointsEarned,
              tier: newTier,
            });
          }
        } catch (loyaltyErr) {
          console.warn('[confirmOrderPayment] Loyalty points error:', loyaltyErr);
        }
      }

      // Referral milestone check
      try {
        const { data: pendingRef } = await supabaseAdmin
          .from('referrals')
          .select('id, referrer_id, status')
          .eq('referee_id', effectiveCustomerId)
          .eq('status', 'PENDING')
          .maybeSingle();

        if (pendingRef && pendingRef.referrer_id) {
          const { data: referrerPurchases, error: refPurchaseErr } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('customer_id', pendingRef.referrer_id)
            .eq('payment_status', 'SUCCESS')
            .limit(1);

          const referrerHasPurchased = !refPurchaseErr && referrerPurchases && referrerPurchases.length > 0;

          if (referrerHasPurchased) {
            const referralRewardPoints = 100; // 100 Petal Points
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
            } else {
              await supabaseAdmin.from('loyalty_accounts').insert({
                customer_id: pendingRef.referrer_id,
                points_balance: referralRewardPoints,
                lifetime_points_earned: referralRewardPoints,
                tier: 'FLORET',
              });
            }

            await supabaseAdmin
              .from('referrals')
              .update({ status: 'REWARDED' })
              .eq('id', pendingRef.id);

            try {
              const { data: referrerProfile } = await supabaseAdmin
                .from('profiles')
                .select('email, full_name')
                .eq('id', pendingRef.referrer_id)
                .maybeSingle();

              if (referrerProfile?.email) {
                const siteUrl = process.env.VITE_SITE_URL || 'https://thepetalandbloom.vercel.app';
                const finalPointsBalance = refLoyalty
                  ? (refLoyalty.points_balance || 0) + referralRewardPoints
                  : referralRewardPoints;

                await sendReferralRewardEmail({
                  to: referrerProfile.email,
                  name: referrerProfile.full_name || 'Valued Collector',
                  pointsEarned: referralRewardPoints,
                  totalPointsBalance: finalPointsBalance,
                  refereeName: order.guest_name || undefined,
                  accountUrl: `${siteUrl}/account`,
                });
              }
            } catch (refEmailErr) {
              console.warn('[confirmOrderPayment] Referral email error:', refEmailErr);
            }
          }
        }
      } catch (refErr) {
        console.warn('[confirmOrderPayment] Referral bonus error:', refErr);
      }
    }

    // Return the updated order
    const { data: updatedOrder } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order.id)
      .single();

    return { success: true, order: updatedOrder || order };
  } catch (err: any) {
    console.error('[confirmOrderPayment Critical Error]:', err);
    return { success: false, message: err.message, error: err };
  }
}
