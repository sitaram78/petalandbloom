import type { VercelRequest, VercelResponse } from '@vercel/node';
import adjustPointsHandler from '../server/handlers/admin/customers/adjust-points';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return adjustPointsHandler(req, res);
}
