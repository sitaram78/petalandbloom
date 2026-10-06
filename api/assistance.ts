import type { VercelRequest, VercelResponse } from '@vercel/node';
import conversationsHandler from './_handlers/assistance/conversations';
import messagesHandler from './_handlers/assistance/messages';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname.includes('/messages')) {
    return messagesHandler(req, res);
  }

  return conversationsHandler(req, res);
}
