import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseServer';
import { createCashfreePGOrder } from '../../lib/cashfreeServer';
import { getCachedStoreSettings } from '../settings/store';
import { evaluateCoupon } from '../../lib/couponEngine';
import { verifyAuth } from '../../lib/authMiddleware';

interface CheckoutItemRequest {
  code: string;
  name?: string;
  price?: number;
  image?: string;
  quantity: number;
  color?: string;
  giftWrap?: boolean;
  message?: string;
  packagingTier?: 'standard' | 'luxury_wrap' | 'bouquet_wrap' | 'gift_box';
  packagingLabel?: string;
  hasGreetingCard?: boolean;
  greetingCardMessage?: string;
  hasPersonalNote?: boolean;
  personalNoteMessage?: string;
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

    // 2. Fetch authoritative prices & business rules from database
    const { data: storeSettingsRow } = await supabaseAdmin
      .from('store_settings')
      .select('business_rules')
      .eq('id', 'primary')
      .maybeSingle();

    const liveRules = storeSettingsRow?.business_rules || storeConfig.businessRules || {};
    const companionGifts: Array<{ id: string; name: string; description?: string; priceRupees: number }> =
      Array.isArray(liveRules.companionGifts) && liveRules.companionGifts.length > 0
        ? liveRules.companionGifts
        : [
            { id: 'addon-flower', name: 'Extra Handcrafted Flower', priceRupees: 199 },
            { id: 'addon-charm', name: 'Name Customisation Charm', priceRupees: 79 },
            { id: 'addon-vase', name: 'Petite Ceramic Bud Vase', priceRupees: 249 },
            { id: 'addon-pouch', name: 'Linen Keepsake Storage Pouch', priceRupees: 129 },
          ];

    // Build dynamic and resilient add-ons map
    const addonsMap = new Map<string, { name: string; priceInPaise: number; image: string | null }>();

    for (const g of companionGifts) {
      const pPaise = Math.round(Number(g.priceRupees || 0) * 100);
      const cleanId = (g.id || '').replace(/^addon-/i, '').toLowerCase();
      const img = '/placeholder-bloom.svg';

      const variants = [
        g.id.toLowerCase(),
        `addon-${cleanId}`,
        `ADDON-${cleanId.toUpperCase()}`,
        `ADDON-ADDON-${cleanId.toUpperCase()}`,
        `ADDON-${g.name.toUpperCase().replace(/\s+/g, '-')}`,
        `ADDON-${g.name.toUpperCase()}`,
        cleanId.toUpperCase(),
      ];

      for (const v of variants) {
        addonsMap.set(v, { name: g.name, priceInPaise: pPaise, image: img });
      }
    }

    const standardAddonsList = [
      {
        codes: ['ADDON-GREETING-CARD', 'ADDON-GREETING CARD', 'ADDON-CARD'],
        name: 'Greeting Card',
        priceInPaise: liveRules.greetingCardFeePaise ?? 4900,
        image: '/greeting.avif',
      },
      {
        codes: ['ADDON-PERSONALISED-MESSAGE', 'ADDON-PERSONALIZED-MESSAGE', 'ADDON-PERSONAL NOTE', 'ADDON-PERSONALISED MESSAGE'],
        name: 'Personalised Message',
        priceInPaise: liveRules.personalisedMessageFeePaise ?? 3900,
        image: '/message.avif',
      },
      {
        codes: ['ADDON-NAME-CUSTOMISATION', 'ADDON-NAME CUSTOMISATION', 'ADDON-CHARM'],
        name: 'Name Customisation Charm',
        priceInPaise: 7900,
        image: null,
      },
      {
        codes: ['ADDON-PREMIUM-RIBBON', 'ADDON-PREMIUM RIBBON', 'ADDON-RIBBON'],
        name: 'Premium Ribbon',
        priceInPaise: 4900,
        image: '/ribbon.avif',
      },
      {
        codes: ['ADDON-PREMIUM-WRAPPING', 'ADDON-PREMIUM WRAPPING', 'ADDON-WRAPPING'],
        name: 'Premium Wrapping',
        priceInPaise: liveRules.giftWrapFeePaise ?? 7900,
        image: '/wrapping.avif',
      },
      {
        codes: ['ADDON-EXTRA-FLOWER', 'ADDON-EXTRA FLOWER', 'ADDON-FLOWER', 'ADDON-ADDON-FLOWER'],
        name: 'Extra Handcrafted Flower',
        priceInPaise: 19900,
        image: '/placeholder-bloom.svg',
      },
      {
        codes: ['ADDON-POUCH', 'ADDON-STORAGE-POUCH', 'ADDON-LINEN-KEEPSAKE-STORAGE-POUCH', 'ADDON-ADDON-POUCH'],
        name: 'Linen Keepsake Storage Pouch',
        priceInPaise: 12900,
        image: '/placeholder-bloom.svg',
      },
      {
        codes: ['ADDON-VASE', 'ADDON-BUD-VASE', 'ADDON-PETITE-CERAMIC-BUD-VASE', 'ADDON-ADDON-VASE'],
        name: 'Petite Ceramic Bud Vase',
        priceInPaise: 24900,
        image: '/placeholder-bloom.svg',
      },
    ];

    for (const sa of standardAddonsList) {
      for (const c of sa.codes) {
        if (!addonsMap.has(c)) {
          addonsMap.set(c, { name: sa.name, priceInPaise: sa.priceInPaise, image: sa.image });
        }
      }
    }

    const resolveAddon = (item: CheckoutItemRequest) => {
      const codeKey = (item.code || '').trim();
      const upper = codeKey.toUpperCase();
      const stripped = upper.replace(/^ADDON-(ADDON-)?/, '');

      let meta = addonsMap.get(codeKey) ||
        addonsMap.get(upper) ||
        addonsMap.get(`ADDON-${stripped}`) ||
        addonsMap.get(`ADDON-ADDON-${stripped}`) ||
        addonsMap.get(codeKey.toLowerCase());

      if (!meta && item.name) {
        const itemClean = item.name.trim().toLowerCase();
        for (const [_, val] of addonsMap.entries()) {
          if (val.name.toLowerCase() === itemClean) {
            meta = val;
            break;
          }
        }
      }

      const resolvedName = meta?.name || item.name || stripped.replace(/-/g, ' ');
      const resolvedPriceInPaise = meta
        ? meta.priceInPaise
        : typeof item.price === 'number' && item.price > 0
        ? Math.round(item.price * 100)
        : 4900;
      const resolvedImage = meta?.image || item.image || '/placeholder-bloom.svg';

      return {
        name: resolvedName,
        priceInPaise: resolvedPriceInPaise,
        image: resolvedImage,
      };
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

      // Dynamic packaging fees from store settings
      const bouquetLuxuryWrapUpgradeFeePaise = liveRules.bouquetLuxuryWrapUpgradeFeePaise ?? storeConfig.businessRules?.bouquetLuxuryWrapUpgradeFeePaise ?? 5900;
      const stemBouquetWrapFeePaise = liveRules.stemBouquetWrapFeePaise ?? storeConfig.businessRules?.stemBouquetWrapFeePaise ?? 7900;
      const luxuryGiftBoxFeePaise = liveRules.luxuryGiftBoxFeePaise ?? storeConfig.businessRules?.luxuryGiftBoxFeePaise ?? 14900;
      const greetingCardFeePaise = liveRules.greetingCardFeePaise ?? storeConfig.businessRules?.greetingCardFeePaise ?? 4900;
      const personalisedMessageFeePaise = liveRules.personalisedMessageFeePaise ?? storeConfig.businessRules?.personalisedMessageFeePaise ?? 3900;

      // Structured packaging & extras detection (with safe fallback for legacy payload)
      const packagingTier = item.packagingTier || (item.message?.includes('Luxury Silk Wrap') ? 'luxury_wrap' : item.message?.includes('Finished Bouquet') ? 'bouquet_wrap' : item.message?.includes('Rigid Gift Box') ? 'gift_box' : 'standard');
      const hasGreetingCard = Boolean(item.hasGreetingCard || item.greetingCardMessage || (!item.packagingTier && item.message?.includes('Greeting Card')));
      const hasPersonalNote = Boolean(item.hasPersonalNote || item.personalNoteMessage || (!item.packagingTier && item.message?.includes('Personal Note')));

      let unitPackagingFeeInPaise = 0;
      let flatPackagingFeeInPaise = 0;

      if (packagingTier === 'luxury_wrap') {
        // Bouquet luxury silk wrap applies per bouquet unit
        unitPackagingFeeInPaise = bouquetLuxuryWrapUpgradeFeePaise;
      } else if (packagingTier === 'bouquet_wrap') {
        // Loose stems bouquet assembly applies flat once per line item
        flatPackagingFeeInPaise = stemBouquetWrapFeePaise;
      } else if (packagingTier === 'gift_box') {
        // Luxury rigid gift box applies flat once per line item
        flatPackagingFeeInPaise = luxuryGiftBoxFeePaise;
      }

      // Greeting cards and personal notes are flat once per line item
      const cardFeeInPaise = hasGreetingCard ? greetingCardFeePaise : 0;
      const noteFeeInPaise = hasPersonalNote ? personalisedMessageFeePaise : 0;
      const flatExtrasInPaise = flatPackagingFeeInPaise + cardFeeInPaise + noteFeeInPaise;

      const unitPriceInPaise = prod.price_in_paise + unitPackagingFeeInPaise;
      const itemSubtotal = (unitPriceInPaise * qty) + flatExtrasInPaise;
      subtotalInPaise += itemSubtotal;

      const isGiftWrapped = packagingTier !== 'standard' || hasGreetingCard || hasPersonalNote || Boolean(item.giftWrap);

      let personalMessage = item.message?.trim() || null;
      if (!personalMessage && (item.packagingLabel || hasGreetingCard || hasPersonalNote)) {
        const parts: string[] = [];
        if (item.packagingLabel) {
          parts.push(`Packaging: ${item.packagingLabel}`);
        }
        if (hasGreetingCard) {
          parts.push(item.greetingCardMessage?.trim() ? `Greeting Card Note: "${item.greetingCardMessage.trim()}"` : 'Handwritten Greeting Card');
        }
        if (hasPersonalNote) {
          parts.push(item.personalNoteMessage?.trim() ? `Personal Note: "${item.personalNoteMessage.trim()}"` : 'Handwritten Personal Note');
        }
        personalMessage = parts.length > 0 ? parts.join(' | ') : null;
      }

      resolvedOrderItems.push({
        product_id: prod.id,
        product_code: prod.code,
        product_name: prod.name,
        unit_price_in_paise: Math.round(itemSubtotal / qty),
        quantity: qty,
        total_price_in_paise: itemSubtotal,
        selected_color: item.color || null,
        gift_wrap: isGiftWrapped,
        personal_message: personalMessage,
        item_image: Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : null,
      });
    }

    // Process add-on items
    for (const item of addonItems) {
      const resolved = resolveAddon(item);
      const qty = Math.max(1, Math.min(20, Math.floor(Number(item.quantity) || 1)));
      const unitPriceInPaise = resolved.priceInPaise;
      const itemSubtotal = unitPriceInPaise * qty;
      subtotalInPaise += itemSubtotal;

      resolvedOrderItems.push({
        product_id: null,
        product_code: item.code,
        product_name: resolved.name,
        unit_price_in_paise: unitPriceInPaise,
        quantity: qty,
        total_price_in_paise: itemSubtotal,
        selected_color: null,
        gift_wrap: false,
        personal_message: null,
        item_image: resolved.image,
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
        items: [
          ...catalogItems.map((i) => ({ code: i.code, quantity: i.quantity })),
          ...addonItems.map((i) => {
            const resolved = resolveAddon(i);
            return {
              code: i.code,
              quantity: i.quantity,
              price_in_paise: resolved.priceInPaise,
            };
          }),
        ],
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

    // 4. Loyalty Points Redemption (SEC-08: Enforce verified session matching customer)
    let loyaltyPointsRedeemed = 0;
    let loyaltyDiscountInPaise = 0;
    let verifiedCustomerId: string | null = null;

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader) {
      try {
        const auth = await verifyAuth(req);
        if (auth.user) {
          verifiedCustomerId = auth.user.id;
        }
      } catch {}
    }

    const isLoyaltyEnabled = storeConfig.featureFlags?.enableLoyalty ?? true;
    const minPointsOrder = storeConfig.businessRules?.minLoyaltyOrderPaise ?? 29900;
    const pointValuePaise = storeConfig.businessRules?.loyaltyPointRedemptionPaise ?? 50;

    const meetsPointsMinThreshold = subtotalInPaise >= minPointsOrder;

    if (isLoyaltyEnabled && meetsPointsMinThreshold && req.body.redeemPoints && Number(req.body.redeemPoints) > 0) {
      if (!verifiedCustomerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required: You must be signed in to your verified account to redeem loyalty points.',
        });
      }

      if (customer.customerId && customer.customerId !== verifiedCustomerId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Loyalty points can only be redeemed for your own authenticated account.',
        });
      }

      const { data: loyaltyAcc } = await supabaseAdmin
        .from('loyalty_accounts')
        .select('points_balance')
        .eq('customer_id', verifiedCustomerId)
        .maybeSingle();

      if (loyaltyAcc && (loyaltyAcc.points_balance || 0) > 0) {
        loyaltyPointsRedeemed = Math.min(loyaltyAcc.points_balance, Math.floor(Number(req.body.redeemPoints)));
        const maxRedeemablePaise = Math.max(0, subtotalInPaise - discountInPaise);
        loyaltyDiscountInPaise = Math.min(loyaltyPointsRedeemed * pointValuePaise, maxRedeemablePaise);
      }
    }

    // 5. Dynamic Shipping Calculation from Store Settings
    const freeShippingThreshold = liveRules.freeShippingThresholdPaise ?? storeConfig.businessRules?.freeShippingThresholdPaise ?? 120000;
    const standardShippingFee = liveRules.standardShippingFeePaise ?? storeConfig.businessRules?.standardShippingFeePaise ?? 6900;
    const expressShippingFee = liveRules.expressShippingFeePaise ?? storeConfig.businessRules?.expressShippingFeePaise ?? 4900;
    const isExpress = Boolean(req.body.isExpress);

    const baseShippingFee = subtotalInPaise >= freeShippingThreshold ? 0 : standardShippingFee;
    const shippingFeeInPaise = baseShippingFee + (isExpress ? expressShippingFee : 0);

    const totalInPaise = Math.max(0, subtotalInPaise - discountInPaise - loyaltyDiscountInPaise + shippingFeeInPaise);

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
      isExpress: isExpress,
      shippingMethod: isExpress ? 'EXPRESS_AIR' : 'STANDARD',
      shippingMethodLabel: isExpress ? 'Priority Express Courier (Air)' : 'Standard Studio Delivery',
    };

    const { data: newOrder, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: verifiedCustomerId || customer.customerId || null,
        guest_name: customer.name.trim(),
        guest_phone: cleanPhone,
        guest_email: customer.email?.trim() || null,
        shipping_address_snapshot: addressSnapshot,
        subtotal_in_paise: subtotalInPaise,
        discount_in_paise: discountInPaise,
        loyalty_points_redeemed: loyaltyPointsRedeemed,
        loyalty_discount_in_paise: loyaltyDiscountInPaise,
        shipping_fee_in_paise: shippingFeeInPaise,
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
