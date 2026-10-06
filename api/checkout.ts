import type { VercelRequest, VercelResponse } from '@vercel/node';
import createOrderHandler from '../server/handlers/checkout/create-order';
import validateCouponHandler from '../server/handlers/coupons/validate';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname.includes('/coupon') || pathname.includes('/validate')) {
    return validateCouponHandler(req, res);
  }

  return createOrderHandler(req, res);
}
