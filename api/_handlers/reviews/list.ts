import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../_lib/supabaseServer';
import { localReviewsCache } from './submit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use GET.' });
  }

  try {
    const { productCode, admin, eligibility, userId, userEmail } = req.query || {};

    // 1. ELIGIBILITY CHECK
    if (eligibility === 'true') {
      const code = typeof productCode === 'string' ? productCode.trim().toLowerCase() : '';
      const uid = typeof userId === 'string' ? userId.trim() : '';
      const email = typeof userEmail === 'string' ? userEmail.trim() : '';

      if (!code || (!uid && !email)) {
        return res.status(200).json({
          success: true,
          eligible: false,
          reason: 'Sign in to verify purchase history.',
        });
      }

      let isPurchased = false;

      try {
        let query = supabaseAdmin
          .from('orders')
          .select(`
            id,
            guest_name,
            guest_email,
            order_status,
            order_items (
              product_code
            )
          `)
          .in('order_status', [
            'PAYMENT_CONFIRMED',
            'ORDER_CONFIRMED',
            'PROCESSING',
            'PACKED',
            'SHIPPED',
            'OUT_FOR_DELIVERY',
            'DELIVERED'
          ]);

        if (uid) {
          query = query.eq('customer_id', uid);
        } else if (email) {
          query = query.eq('guest_email', email);
        }

        const { data: customerOrders } = await query;

        if (customerOrders && customerOrders.length > 0) {
          for (const ord of customerOrders) {
            const items = ord.order_items || [];
            if (
              items.some(
                (item: any) =>
                  item.product_code?.toLowerCase().trim() === code
              )
            ) {
              isPurchased = true;
              break;
            }
          }
        }
      } catch (e) {
        // Fallback
      }

      // Check if user already reviewed
      const alreadyReviewed = localReviewsCache.some(
        (r) =>
          r.product_code === code &&
          ((uid && r.customer_id === uid) || (email && r.customer_email === email))
      );

      return res.status(200).json({
        success: true,
        eligible: isPurchased,
        alreadyReviewed,
        reason: isPurchased
          ? 'Verified purchaser'
          : 'Reviews are only open to customers who have ordered this product.',
      });
    }

    // 2. ADMIN LIST (All reviews)
    if (admin === 'true') {
      let allReviews = [...localReviewsCache];

      try {
        const { data: dbReviews, error } = await supabaseAdmin
          .from('product_reviews')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && dbReviews && dbReviews.length > 0) {
          allReviews = dbReviews;
        }
      } catch {
        // Fallback
      }

      return res.status(200).json({
        success: true,
        reviews: allReviews,
      });
    }

    // 3. PRODUCT REVIEWS LIST
    const code = typeof productCode === 'string' ? productCode.trim().toLowerCase() : '';
    let filteredReviews = localReviewsCache.filter(
      (r) => (!code || r.product_code === code) && r.is_approved
    );

    try {
      let query = supabaseAdmin
        .from('product_reviews')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (code) {
        query = query.eq('product_code', code);
      }

      const { data: dbReviews, error } = await query;

      if (!error && dbReviews && dbReviews.length > 0) {
        filteredReviews = dbReviews;
      }
    } catch {
      // Fallback
    }

    // Compute Metrics
    const totalReviews = filteredReviews.length;
    const ratingBreakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let ratingSum = 0;

    for (const r of filteredReviews) {
      const star = Math.max(1, Math.min(5, Math.round(r.rating || 5)));
      ratingBreakdown[star] = (ratingBreakdown[star] || 0) + 1;
      ratingSum += star;
    }

    const averageRating = totalReviews > 0 ? Number((ratingSum / totalReviews).toFixed(1)) : 5.0;

    return res.status(200).json({
      success: true,
      productCode: code,
      totalReviews,
      averageRating,
      ratingBreakdown,
      reviews: filteredReviews,
    });
  } catch (err: any) {
    console.error('[List Reviews Error]', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch reviews.',
    });
  }
}
