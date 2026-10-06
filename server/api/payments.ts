import type { VercelRequest, VercelResponse } from '@vercel/node';
import verifyPaymentHandler from '../handlers/payments/verify';
import refundPaymentHandler from '../handlers/payments/refund';
import webhookPaymentHandler from '../handlers/payments/cashfree-webhook';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname.includes('/verify')) {
    return verifyPaymentHandler(req, res);
  }
  if (pathname.includes('/refund')) {
    return refundPaymentHandler(req, res);
  }
  if (pathname.includes('/webhook') || pathname.includes('/cashfree-webhook')) {
    return webhookPaymentHandler(req, res);
  }

  return res.status(404).json({ success: false, message: `Route not found on payments domain: ${pathname}` });
}
