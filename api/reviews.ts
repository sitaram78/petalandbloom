import type { VercelRequest, VercelResponse } from '@vercel/node';
import listReviewsHandler from './_handlers/reviews/list';
import submitReviewHandler from './_handlers/reviews/submit';
import moderateReviewHandler from './_handlers/reviews/moderate';

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
