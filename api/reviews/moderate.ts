import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';
import { requireAuth } from '../lib/authMiddleware';
import { localReviewsCache } from './submit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  // Enforce staff/admin authentication
  const authUser = await requireAuth(req, res, { allowedRoles: ['super_admin', 'admin', 'support'] });
  if (!authUser) return;

  try {
    const { reviewId, action } = req.body || {};

    if (!reviewId || !action) {
      return res.status(400).json({ success: false, error: 'reviewId and action are required.' });
    }

    if (action === 'delete') {
      try {
        await supabaseAdmin.from('product_reviews').delete().eq('id', reviewId);
      } catch {}

      const idx = localReviewsCache.findIndex((r) => r.id === reviewId);
      if (idx !== -1) localReviewsCache.splice(idx, 1);

      return res.status(200).json({ success: true, message: 'Review deleted successfully.' });
    }

    if (action === 'approve' || action === 'unapprove') {
      const isApproved = action === 'approve';

      try {
        await supabaseAdmin
          .from('product_reviews')
          .update({ is_approved: isApproved })
          .eq('id', reviewId);
      } catch {}

      const review = localReviewsCache.find((r) => r.id === reviewId);
      if (review) review.is_approved = isApproved;

      return res.status(200).json({
        success: true,
        message: `Review ${isApproved ? 'approved and published' : 'unapproved'}.`,
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid action.' });
  } catch (err: any) {
    console.error('[Moderate Review Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Action failed.' });
  }
}
