import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';
import { getCachedStoreSettings } from '../settings/store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    const storeConfig = getCachedStoreSettings();
    if (storeConfig.featureFlags && storeConfig.featureFlags.enableCoupons === false) {
      return res.status(400).json({ success: false, message: 'Coupons and promotional discounts are currently paused.' });
    }

    const { code, cartSubtotalInPaise, customerPhone, customerEmail } = req.body || {};

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
          supabaseAdmin
            .from('coupons')
            .update({ code: 'FLAT10' })
            .eq('id', coupon.id)
            .then(() => {})
            .catch(() => {});
        }
      }
    }

    if (error || !coupon) {
      return res.status(404).json({ success: false, message: 'Invalid coupon code.' });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
      return res.status(400).json({ success: false, message: 'This coupon has expired.' });
    }

    if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
      return res.status(400).json({ success: false, message: 'This coupon has reached its total usage limit.' });
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

    if (subtotal < (coupon.min_order_in_paise || 0)) {
      const minOrderRupees = (coupon.min_order_in_paise || 0) / 100;
      return res.status(400).json({
        success: false,
        message: `This coupon requires a minimum order of ₹${minOrderRupees}.`,
      });
    }

    let discountInPaise = 0;
    if (coupon.discount_type === 'PERCENT') {
      const rawDiscount = Math.round((subtotal * coupon.discount_value) / 100);
      discountInPaise = coupon.max_discount_in_paise
        ? Math.min(rawDiscount, coupon.max_discount_in_paise)
        : rawDiscount;
    } else {
      discountInPaise = Math.min(subtotal, coupon.discount_value);
    }

    return res.status(200).json({
      success: true,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountInPaise,
      discountInRupees: discountInPaise / 100,
      description: coupon.description || `${coupon.discount_value}% off your order`,
    });
  } catch (err: any) {
    console.error('[Coupon Validation Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to validate coupon.' });
  }
}
