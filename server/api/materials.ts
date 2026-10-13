import type { VercelRequest, VercelResponse } from '@vercel/node';
import materialsCrudHandler from '../handlers/admin/materials/index';
import financialSummaryHandler from '../handlers/admin/materials/summary';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname.includes('/summary')) {
    return financialSummaryHandler(req, res);
  }

  return materialsCrudHandler(req, res);
}
