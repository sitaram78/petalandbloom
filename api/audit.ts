import type { VercelRequest, VercelResponse } from '@vercel/node';
import listAuditHandler from '../server/handlers/audit/list';
import logAuditHandler from '../server/handlers/audit/log';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname.includes('/log')) {
    return logAuditHandler(req, res);
  }

  return listAuditHandler(req, res);
}
