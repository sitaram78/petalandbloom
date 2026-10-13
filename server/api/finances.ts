import type { VercelRequest, VercelResponse } from '@vercel/node';
import materialsHandler from './materials';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return materialsHandler(req, res);
}
