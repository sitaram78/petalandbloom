import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    const { code, cartSubtotalInPaise } = req.body || {};

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'Coupon code is required.' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const subtotal = Math.max(0, Number(cartSubtotalInPaise) || 0);

    const { data: coupon, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', normalizedCode)
      .eq('active', true)
      .maybeSingle();

    if (error || !coupon) {
      return res.status(404).json({ success: false, message: 'Invalid coupon code.' });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
      return res.status(400).json({ success: false, message: 'This coupon has expired.' });
    }

    if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
      return res.status(400).json({ success: false, message: 'This coupon has reached its total usage limit.' });
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
