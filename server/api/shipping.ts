import type { VercelRequest, VercelResponse } from '@vercel/node';
import bookShipmentHandler from '../handlers/shipping/book-shipment';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return bookShipmentHandler(req, res);
}
