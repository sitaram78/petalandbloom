import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';
import { createCashfreePGOrder } from '../lib/cashfreeServer';
import { getCachedStoreSettings } from '../settings/store';
import { evaluateCoupon } from '../lib/couponEngine';

interface CheckoutItemRequest {
  code: string;
  quantity: number;
  color?: string;
  giftWrap?: boolean;
  message?: string;
}

interface CreateOrderRequestBody {
  items: CheckoutItemRequest[];
  customer: {
    name: string;
    phone: string;
    email?: string;
    customerId?: string;
  };
  shippingAddress: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  couponCode?: string;
  customerNote?: string;
  paymentMethod?: 'MANUAL_UPI' | 'CASHFREE';
  isExpress?: boolean;
  redeemPoints?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    const storeConfig = getCachedStoreSettings();
    if (storeConfig.featureFlags?.storeMaintenanceMode) {
      return res.status(503).json({
        success: false,
        message: 'The studio checkout is temporarily undergoing scheduled maintenance. Please check back shortly.',
      });
    }

    const body = req.body as CreateOrderRequestBody;
    const { items, customer, shippingAddress, couponCode, customerNote } = body;

    // 1. Validate customer and address fields
    if (!customer?.name?.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required.' });
    }
    const cleanPhone = (customer.phone || '').replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'A valid 10-digit mobile number is required.' });
    }
    if (!shippingAddress?.addressLine1?.trim() || !shippingAddress?.city?.trim() || !shippingAddress?.state?.trim()) {
      return res.status(400).json({ success: false, message: 'Complete delivery address is required.' });
    }
    const cleanPincode = (shippingAddress.pincode || '').replace(/\D/g, '');
    if (cleanPincode.length !== 6) {
      return res.status(400).json({ success: false, message: 'A valid 6-digit postal PIN code is required.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart cannot be empty.' });
    }

    // 2. Fetch authoritative prices & details from database
    const KNOWN_ADDONS: Record<string, { name: string; priceInPaise: number; image?: string }> = {
      'ADDON-Greeting Card': { name: 'Greeting Card', priceInPaise: 4900, image: '/greeting.avif' },
      'ADDON-Personalised Message': { name: 'Personalised Message', priceInPaise: 3900, image: '/message.avif' },
      'ADDON-Name Customisation': { name: 'Name Customisation', priceInPaise: 7900 },
      'ADDON-Premium Ribbon': { name: 'Premium Ribbon', priceInPaise: 4900, image: '/ribbon.avif' },
      'ADDON-Premium Wrapping': { name: 'Premium Wrapping', priceInPaise: 7900, image: '/wrapping.avif' },
      'ADDON-Extra Flower': { name: 'Extra Flower', priceInPaise: 19900 },
    };

    const catalogItems = items.filter((i) => !i.code?.startsWith('ADDON-'));
    const addonItems = items.filter((i) => i.code?.startsWith('ADDON-'));

    const productMap = new Map<string, any>();

    if (catalogItems.length > 0) {
      const rawCodes = catalogItems.map((i) => (i.code || '').trim()).filter(Boolean);
      const queryCodes = Array.from(new Set([
        ...rawCodes,
        ...rawCodes.map((c) => c.toUpperCase()),
        ...rawCodes.map((c) => c.toLowerCase()),
      ]));

      const { data: dbProducts, error: prodError } = await supabaseAdmin
        .from('products')
        .select('id, code, name, price_in_paise, inventory_count, is_active, images, category_slug, occasions')
        .in('code', queryCodes);

      if (prodError) {
        console.error('[Verify Catalog DB Error]', prodError);
        return res.status(500).json({
          success: false,
          message: `Database error verifying catalog items: ${prodError.message}`,
        });
      }

      if (dbProducts) {
        for (const p of dbProducts) {
          productMap.set(p.code, p);
          productMap.set(p.code.toUpperCase(), p);
          productMap.set(p.code.toLowerCase(), p);
        }
      }
    }

    let subtotalInPaise = 0;
    let giftWrapTotalInPaise = 0;
    const resolvedOrderItems = [];

    // Process catalog items
    for (const item of catalogItems) {
      const trimmedCode = (item.code || '').trim();
      const prod = productMap.get(trimmedCode) || productMap.get(trimmedCode.toUpperCase()) || productMap.get(trimmedCode.toLowerCase());

      if (!prod) {
        console.error(`[Checkout] Missing product in catalog: "${item.code}"`);
        return res.status(400).json({
          success: false,
          message: `The item "${item.code}" was not found in the current catalog. Please clear your cart and select from the current collection.`,
        });
      }

      if (!prod.is_active) {
        return res.status(400).json({ success: false, message: `Product "${prod.name}" (${prod.code}) is currently inactive.` });
      }

      const qty = Math.max(1, Math.min(20, Math.floor(Number(item.quantity) || 1)));

      // Strictly check inventory for ready-to-ship pieces (bypass for Made to Order)
      if (!prod.is_made_to_order && (prod.inventory_count !== null && prod.inventory_count !== undefined) && prod.inventory_count < qty) {
        return res.status(400).json({
          success: false,
          message: `Only ${prod.inventory_count} piece(s) of "${prod.name}" remain in stock. Please adjust your cart quantity.`,
        });
      }

      const unitPriceInPaise = prod.price_in_paise;
      const itemSubtotal = unitPriceInPaise * qty;
      subtotalInPaise += itemSubtotal;

      const giftWrapFee = storeConfig.businessRules?.giftWrapFeePaise ?? 7900;
      if (item.giftWrap) {
        giftWrapTotalInPaise += giftWrapFee * qty;
      }

      resolvedOrderItems.push({
        product_id: prod.id,
        product_code: prod.code,
        product_name: prod.name,
        unit_price_in_paise: unitPriceInPaise,
        quantity: qty,
        total_price_in_paise: itemSubtotal,
        selected_color: item.color || null,
        gift_wrap: Boolean(item.giftWrap),
        personal_message: item.message || null,
        item_image: Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : null,
      });
    }

    // Process add-on items
    for (const item of addonItems) {
      const addonMeta = KNOWN_ADDONS[item.code];
      const qty = Math.max(1, Math.min(20, Math.floor(Number(item.quantity) || 1)));
      const unitPriceInPaise = addonMeta ? addonMeta.priceInPaise : 4900;
      const itemSubtotal = unitPriceInPaise * qty;
      subtotalInPaise += itemSubtotal;

      resolvedOrderItems.push({
        product_id: null,
        product_code: item.code,
        product_name: addonMeta ? addonMeta.name : item.code.replace('ADDON-', ''),
        unit_price_in_paise: unitPriceInPaise,
        quantity: qty,
        total_price_in_paise: itemSubtotal,
        selected_color: null,
        gift_wrap: false,
        personal_message: null,
        item_image: addonMeta?.image || null,
      });
    }

    // 3. Server-side Coupon Evaluation
    let discountInPaise = 0;
    let validatedCouponId: string | null = null;
    let validatedCouponCode: string | null = null;

    if (couponCode && couponCode.trim()) {
      const normalizedCode = couponCode.trim().toUpperCase();
      let { data: coupon, error: couponErr } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('code', normalizedCode)
        .eq('active', true)
        .maybeSingle();

      if (!coupon && (normalizedCode === 'FLAT' || normalizedCode === 'FLAT10' || normalizedCode === 'FALT')) {
        const { data: fallbackCoupons } = await supabaseAdmin
          .from('coupons')
          .select('*')
          .in('code', ['FLAT', 'FLAT10', 'FALT'])
          .eq('active', true)
          .limit(1);
        if (fallbackCoupons && fallbackCoupons.length > 0) {
          coupon = fallbackCoupons[0];
        }
      }

      if (couponErr || !coupon) {
        return res.status(400).json({
          success: false,
          message: `The coupon code '${normalizedCode}' is invalid or no longer active.`,
        });
      }

      if (coupon.per_customer_limit && coupon.per_customer_limit > 0 && cleanPhone) {
        const { count, error: countErr } = await supabaseAdmin
          .from('coupon_redemptions')
          .select('id', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .ilike('customer_phone', `%${cleanPhone}%`);

        if (!countErr && count !== null && count >= coupon.per_customer_limit) {
          return res.status(400).json({
            success: false,
            message: 'You have already redeemed this promotional code the maximum number of times.',
          });
        }
      }

      const evaluation = evaluateCoupon({
        coupon,
        items: catalogItems.map((i) => ({ code: i.code, quantity: i.quantity })),
        productsMap: productMap,
        cartSubtotalInPaise: subtotalInPaise,
      });

      if (!evaluation.isValid) {
        return res.status(400).json({
          success: false,
          message: evaluation.message || 'The applied coupon is no longer valid for your cart items. Please review your order.',
        });
      }

      if (evaluation.discountInPaise <= 0) {
        return res.status(400).json({
          success: false,
          message: 'The applied coupon provides zero discount for the selected items.',
        });
      }

      validatedCouponId = coupon.id;
      validatedCouponCode = coupon.code;
      discountInPaise = evaluation.discountInPaise;
    }

    // 4. Loyalty Points Redemption (if authenticated customer)
    let loyaltyPointsRedeemed = 0;
    let loyaltyDiscountInPaise = 0;

    const isLoyaltyEnabled = storeConfig.featureFlags?.enableLoyalty ?? true;
    const minPointsOrder = storeConfig.businessRules?.minLoyaltyOrderPaise ?? 29900;
    const pointValuePaise = storeConfig.businessRules?.loyaltyPointRedemptionPaise ?? 50;

    const meetsPointsMinThreshold = subtotalInPaise >= minPointsOrder;

    if (isLoyaltyEnabled && meetsPointsMinThreshold && customer.customerId && req.body.redeemPoints && Number(req.body.redeemPoints) > 0) {
      const { data: loyaltyAcc } = await supabaseAdmin
        .from('loyalty_accounts')
        .select('points_balance')
        .eq('customer_id', customer.customerId)
        .maybeSingle();

      if (loyaltyAcc && (loyaltyAcc.points_balance || 0) > 0) {
        loyaltyPointsRedeemed = Math.min(loyaltyAcc.points_balance, Math.floor(Number(req.body.redeemPoints)));
        const maxRedeemablePaise = Math.max(0, subtotalInPaise - discountInPaise);
        loyaltyDiscountInPaise = Math.min(loyaltyPointsRedeemed * pointValuePaise, maxRedeemablePaise);
      }
    }

    // 5. Dynamic Shipping Calculation from Store Settings
    const freeShippingThreshold = storeConfig.businessRules?.freeShippingThresholdPaise ?? 120000;
    const standardShippingFee = storeConfig.businessRules?.standardShippingFeePaise ?? 6900;
    const expressShippingFee = storeConfig.businessRules?.expressShippingFeePaise ?? 4900;
    const isExpress = Boolean(req.body.isExpress);

    const baseShippingFee = subtotalInPaise >= freeShippingThreshold ? 0 : standardShippingFee;
    const shippingFeeInPaise = baseShippingFee + (isExpress ? expressShippingFee : 0);

    const totalInPaise = Math.max(0, subtotalInPaise - discountInPaise - loyaltyDiscountInPaise + shippingFeeInPaise + giftWrapTotalInPaise);

    // 6. Generate human-readable Order Number
    const orderNumber = `TPB-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 7. Create Pending Order in Supabase
    const addressSnapshot = {
      recipientName: shippingAddress.recipientName || customer.name,
      phone: shippingAddress.phone || cleanPhone,
      addressLine1: shippingAddress.addressLine1.trim(),
      addressLine2: (shippingAddress.addressLine2 || '').trim(),
      city: shippingAddress.city.trim(),
      state: shippingAddress.state.trim(),
      pincode: cleanPincode,
    };

    const { data: newOrder, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customer.customerId || null,
        guest_name: customer.name.trim(),
        guest_phone: cleanPhone,
        guest_email: customer.email?.trim() || null,
        shipping_address_snapshot: addressSnapshot,
        subtotal_in_paise: subtotalInPaise,
        discount_in_paise: discountInPaise,
        loyalty_points_redeemed: loyaltyPointsRedeemed,
        loyalty_discount_in_paise: loyaltyDiscountInPaise,
        shipping_fee_in_paise: shippingFeeInPaise + giftWrapTotalInPaise,
        total_in_paise: totalInPaise,
        order_status: 'PENDING_PAYMENT',
        payment_status: 'PENDING',
        applied_coupon_code: validatedCouponCode,
        customer_note: customerNote || null,
      })
      .select('id, order_number, total_in_paise')
      .single();

    if (orderErr || !newOrder) {
      console.error('[Create Order DB Error]', orderErr);
      return res.status(500).json({ success: false, message: 'Could not create order.' });
    }

    // 7. Insert Order Items snapshots
    const itemsToInsert = resolvedOrderItems.map((item) => ({
      ...item,
      order_id: newOrder.id,
    }));
    await supabaseAdmin.from('order_items').insert(itemsToInsert);

    // 8. Record Order Status History
    await supabaseAdmin.from('order_status_history').insert({
      order_id: newOrder.id,
      previous_status: null,
      new_status: 'PENDING_PAYMENT',
      note: 'Order initiated via online checkout',
      created_by: 'system',
    });

    // 8b. Deduct Redeemed Loyalty Points Immediately (if customer redeemed points)
    if (customer.customerId && loyaltyPointsRedeemed > 0) {
      try {
        await supabaseAdmin.from('loyalty_transactions').insert({
          customer_id: customer.customerId,
          order_id: newOrder.id,
          type: 'REDEEM_PURCHASE',
          points: -loyaltyPointsRedeemed,
          description: `Redeemed on Order ${orderNumber}`,
        });

        const { data: loyaltyAcc } = await supabaseAdmin
          .from('loyalty_accounts')
          .select('points_balance')
          .eq('customer_id', customer.customerId)
          .maybeSingle();

        if (loyaltyAcc) {
          await supabaseAdmin
            .from('loyalty_accounts')
            .update({
              points_balance: Math.max(0, (loyaltyAcc.points_balance || 0) - loyaltyPointsRedeemed),
            })
            .eq('customer_id', customer.customerId);
        }
      } catch (loyaltyErr) {
        console.error('[Loyalty Deduction Error]', loyaltyErr);
      }
    }

    // 8c. Auto-save Address to Customer Profile if Authenticated
    if (customer.customerId && shippingAddress?.addressLine1) {
      try {
        const { data: existingAddrs } = await supabaseAdmin
          .from('customer_addresses')
          .select('id, address_line1, pincode')
          .eq('customer_id', customer.customerId);

        const alreadyExists = (existingAddrs || []).some(
          (a) =>
            a.address_line1.trim().toLowerCase() === shippingAddress.addressLine1.trim().toLowerCase() &&
            a.pincode.replace(/\D/g, '') === cleanPincode
        );

        if (!alreadyExists) {
          await supabaseAdmin.from('customer_addresses').insert({
            customer_id: customer.customerId,
            recipient_name: shippingAddress.recipientName || customer.name,
            phone: cleanPhone,
            address_line1: shippingAddress.addressLine1.trim(),
            address_line2: (shippingAddress.addressLine2 || '').trim() || null,
            city: shippingAddress.city.trim(),
            state: shippingAddress.state.trim(),
            pincode: cleanPincode,
            is_default: (existingAddrs || []).length === 0,
          });
        }
      } catch (addrErr) {
        console.warn('[Auto-save Address Error in create-order]:', addrErr);
      }
    }

    // 9. Payment Session Handling (Default to MANUAL_UPI for offline / WhatsApp concierge settlement)
    const requestedPaymentMethod = body.paymentMethod || 'MANUAL_UPI';

    if (requestedPaymentMethod === 'CASHFREE') {
      try {
        const origin = req.headers.origin || 'https://thepetalandbloom.vercel.app';
        const returnUrl = `${origin}/order-confirmation?order_id=${newOrder.order_number}`;

        const cfOrder = await createCashfreePGOrder({
          orderId: newOrder.order_number,
          orderAmount: totalInPaise / 100,
          customerDetails: {
            customerId: customer.customerId || `cust_${cleanPhone}`,
            customerName: customer.name.trim(),
            customerPhone: cleanPhone,
            customerEmail: customer.email?.trim(),
          },
          returnUrl,
        });

        await supabaseAdmin.from('payments').insert({
          order_id: newOrder.id,
          provider: 'CASHFREE',
          cf_order_id: cfOrder.cfOrderId,
          cf_payment_session_id: cfOrder.paymentSessionId,
          amount_in_paise: totalInPaise,
          currency: 'INR',
          status: 'PENDING',
        });

        return res.status(200).json({
          success: true,
          orderId: newOrder.id,
          orderNumber: newOrder.order_number,
          totalInPaise,
          totalInRupees: totalInPaise / 100,
          paymentMethod: 'CASHFREE',
          paymentSessionId: cfOrder.paymentSessionId,
          isSimulated: cfOrder.isSimulated,
        });
      } catch (cfErr) {
        console.warn('[Cashfree PG Session Warning, falling back to MANUAL_UPI]:', cfErr);
      }
    }

    // Default: Record as Manual UPI / WhatsApp settlement
    const { error: payErr } = await supabaseAdmin.from('payments').insert({
      order_id: newOrder.id,
      provider: 'MANUAL_UPI',
      cf_order_id: `manual_${newOrder.order_number}`,
      cf_payment_session_id: `manual_session_${newOrder.order_number}`,
      amount_in_paise: totalInPaise,
      currency: 'INR',
      status: 'PENDING',
    });

    if (payErr) {
      console.warn('[Manual UPI Payment Record Warning]:', payErr);
    }

    return res.status(200).json({
      success: true,
      orderId: newOrder.id,
      orderNumber: newOrder.order_number,
      totalInPaise,
      totalInRupees: totalInPaise / 100,
      paymentMethod: 'MANUAL_UPI',
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING_PAYMENT',
    });
  } catch (err: any) {
    console.error('[Create Order Error]', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'An unexpected error occurred during order creation.',
    });
  }
}
