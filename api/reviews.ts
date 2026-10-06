import type { VercelRequest, VercelResponse } from '@vercel/node';
import listReviewsHandler from '../server/handlers/reviews/list';
import submitReviewHandler from '../server/handlers/reviews/submit';
import moderateReviewHandler from '../server/handlers/reviews/moderate';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname.includes('/submit')) {
    return submitReviewHandler(req, res);
  }
  if (pathname.includes('/moderate')) {
    return moderateReviewHandler(req, res);
  }

  return listReviewsHandler(req, res);
}
