import type { VercelRequest, VercelResponse } from '@vercel/node';
import signupHandler from '../server/handlers/account/signup';
import recoverHandler from '../server/handlers/account/recover';
import linkOrdersHandler from '../server/handlers/account/link-orders';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname.includes('/signup')) {
    return signupHandler(req, res);
  }
  if (pathname.includes('/recover')) {
    return recoverHandler(req, res);
  }
  if (pathname.includes('/link-orders')) {
    return linkOrdersHandler(req, res);
  }

  return res.status(404).json({ success: false, message: `Route not found on account domain: ${pathname}` });
}
