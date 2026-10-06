import type { VercelRequest, VercelResponse } from '@vercel/node';
import storeSettingsHandler from '../handlers/settings/store';
import sitemapHandler from '../handlers/sitemap';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname.includes('/sitemap')) {
    return sitemapHandler(req, res);
  }

  return storeSettingsHandler(req, res);
}
