import type { VercelRequest, VercelResponse } from '@vercel/node';
import trackHandler from './_handlers/orders/track';
import cancelHandler from './_handlers/orders/cancel';
import notifyHandler from './_handlers/orders/notify';
import expirePendingHandler from './_handlers/orders/expire-pending';
import createAdminOrderHandler from './_handlers/admin/orders/create';
import updateStatusHandler from './_handlers/admin/orders/update-status';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname.includes('/track')) {
    return trackHandler(req, res);
  }
  if (pathname.includes('/cancel')) {
    return cancelHandler(req, res);
  }
  if (pathname.includes('/notify')) {
    return notifyHandler(req, res);
  }
  if (pathname.includes('/expire-pending')) {
    return expirePendingHandler(req, res);
  }
  if (pathname.includes('/create')) {
    return createAdminOrderHandler(req, res);
  }
  if (pathname.includes('/update-status')) {
    return updateStatusHandler(req, res);
  }

  return res.status(404).json({ success: false, message: `Route not found on orders domain: ${pathname}` });
}
