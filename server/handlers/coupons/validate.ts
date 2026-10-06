import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseServer';
import { getCachedStoreSettings } from '../settings/store';
import { evaluateCoupon, CatalogProductMeta } from '../../lib/couponEngine';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    const storeConfig = getCachedStoreSettings();
    if (storeConfig.featureFlags && storeConfig.featureFlags.enableCoupons === false) {
      return res.status(400).json({ success: false, message: 'Coupons and promotional discounts are currently paused.' });
    }

    const { code, items, cartSubtotalInPaise, customerPhone, customerEmail } = req.body || {};

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'Coupon code is required.' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const subtotal = Math.max(0, Number(cartSubtotalInPaise) || 0);

    let { data: coupon, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', normalizedCode)
      .eq('active', true)
      .maybeSingle();

    // Resilient fallback for common transpositions / typos (e.g. FLAT, FLAT10, FALT)
    if (!coupon && (normalizedCode === 'FLAT' || normalizedCode === 'FLAT10' || normalizedCode === 'FALT')) {
      const { data: fallbackCoupons } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .in('code', ['FLAT', 'FLAT10', 'FALT'])
        .eq('active', true)
        .limit(1);
      if (fallbackCoupons && fallbackCoupons.length > 0) {
        coupon = fallbackCoupons[0];
        // Automatically self-heal the typo in the database so it becomes FLAT10
        if (coupon.code === 'FALT') {
          void supabaseAdmin
            .from('coupons')
            .update({ code: 'FLAT10' })
            .eq('id', coupon.id);
        }
      }
    }

    if (error || !coupon) {
      return res.status(404).json({ success: false, message: 'Invalid coupon code.' });
    }

    // Enforce per-customer usage limit (e.g. single-use coupons)
    if (coupon.per_customer_limit && coupon.per_customer_limit > 0 && customerPhone) {
      const cleanPhone = String(customerPhone).replace(/\D/g, '').slice(-10);
      if (cleanPhone) {
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
    }

    // Build product map if items array is provided
    const productsMap = new Map<string, CatalogProductMeta>();
    if (Array.isArray(items) && items.length > 0) {
      const rawCodes = items.map((i: any) => (i.code || '').trim()).filter(Boolean);
      const queryCodes = Array.from(new Set([
        ...rawCodes,
        ...rawCodes.map((c) => c.toUpperCase()),
        ...rawCodes.map((c) => c.toLowerCase()),
      ]));

      const { data: dbProducts } = await supabaseAdmin
        .from('products')
        .select('id, code, name, price_in_paise, category_slug, occasions, is_active')
        .in('code', queryCodes);

      if (dbProducts) {
        for (const p of dbProducts) {
          productsMap.set(p.code, p);
          productsMap.set(p.code.toUpperCase(), p);
          productsMap.set(p.code.toLowerCase(), p);
        }
      }
    }

    // Evaluate coupon using the centralized zero-leakage engine
    const evaluation = evaluateCoupon({
      coupon,
      items: Array.isArray(items) ? items : undefined,
      productsMap: productsMap.size > 0 ? productsMap : undefined,
      cartSubtotalInPaise: subtotal,
    });

    if (!evaluation.isValid) {
      return res.status(400).json({
        success: false,
        message: evaluation.message || 'This coupon cannot be applied to your cart.',
      });
    }

    return res.status(200).json({
      success: true,
      code: coupon.code,
      discountType: evaluation.discountType,
      discountValue: evaluation.discountValue,
      discountInPaise: evaluation.discountInPaise,
      discountInRupees: evaluation.discountInRupees,
      eligibleProductCodes: evaluation.eligibleProductCodes,
      eligibleItemsCount: evaluation.eligibleItemsCount,
      description:
        evaluation.description ||
        coupon.description ||
        (coupon.discount_type === 'PERCENT'
          ? `${coupon.discount_value}% off eligible items`
          : `Flat ₹${Math.round(evaluation.discountInRupees)} off`),
    });
  } catch (err: any) {
    console.error('[Coupon Validation Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to validate coupon.' });
  }
}
