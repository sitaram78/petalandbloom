import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const baseUrl = process.env.VITE_SITE_URL || 'https://thepetalandbloom.vercel.app';

  try {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('code, updated_at')
      .eq('is_active', true);

    const staticRoutes = [
      '',
      '/shop',
      '/about',
      '/contact',
      '/custom',
      '/custom-bouquet',
      '/gift-finder',
      '/privacy',
      '/terms',
      '/refund',
    ];

    const staticUrls = staticRoutes
      .map(
        (route) => `
  <url>
    <loc>${baseUrl}${route}</loc>
    <changefreq>weekly</changefreq>
    <priority>${route === '' ? '1.0' : '0.8'}</priority>
  </url>`
      )
      .join('');

    const productUrls = (products || [])
      .map(
        (p) => `
  <url>
    <loc>${baseUrl}/product/${p.code}</loc>
    <lastmod>${new Date(p.updated_at || Date.now()).toISOString().slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`
      )
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticUrls}
  ${productUrls}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).send(xml);
  } catch (err: any) {
    console.error('[Sitemap Generation Error]', err);
    return res.status(500).send('Error generating sitemap');
  }
}
