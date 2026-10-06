import type { VercelRequest, VercelResponse } from '@vercel/node';
import { expireStalePendingOrders } from '../../lib/orderExpirationService';
import { verifyAuth } from '../../lib/authMiddleware';

/**
 * Sweeper endpoint to clean up abandoned PENDING_PAYMENT checkouts older than 60 minutes.
 * Can be triggered periodically by Vercel Cron or administrative dashboard refresh.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Authorization Guard: Vercel Cron header, CRON_SECRET, or staff session token
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.query.secret || (req.headers.authorization?.replace(/^Bearer\s+/i, ''));
  const isSecretValid = Boolean(cronSecret && providedSecret === cronSecret);

  let isAuthorized = isVercelCron || isSecretValid;

  if (!isAuthorized && req.headers.authorization) {
    const auth = await verifyAuth(req);
    if (auth.user && (auth.user.role === 'super_admin' || auth.user.role === 'admin' || auth.user.role === 'operations')) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Sweeper requires administrative credentials or valid cron secret.',
    });
  }

  try {
    const olderThanMinutes = Number(req.query.minutes || req.body?.minutes) || 60;
    const result = await expireStalePendingOrders(olderThanMinutes);

    return res.status(200).json({
      success: true,
      message: `Cleaned up ${result.expiredCount} expired checkouts.`,
      result,
    });
  } catch (err: any) {
    console.error('[Expire Pending Endpoint Error]:', err);
    return res.status(500).json({ success: false, message: err.message || 'Sweeper failed' });
  }
}
