const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const distDir = path.join(__dirname, '../dist');
const outputDir = '/home/sitaram/.gemini/antigravity/brain/1eb51fd3-bcd0-4844-9670-e5c97372dee7/visual-audit';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function startServer(port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      let filePath = path.join(distDir, reqPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(500);
          res.end('Error loading file');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        }
      });
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function run() {
  const PORT = 34567;
  const server = await startServer(PORT);
  console.log(`Embedded static server started on http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Inject authenticated admin session
  await page.addInitScript(() => {
    const session = {
      access_token: 'fake-access-token',
      refresh_token: 'fake-refresh-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      token_type: 'bearer',
      user: {
        id: 'admin-usr-uuid',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'admin@thepetalandbloom.in',
        app_metadata: { provider: 'email' },
        user_metadata: {}
      }
    };
    localStorage.setItem('sb-bikivygxfjbdgpwieszs-auth-token', JSON.stringify(session));
  });

  // Intercept and mock Supabase API calls
  await page.route('**/rest/v1/profiles*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ role: 'admin' }),
    });
  });

  await page.route('**/rest/v1/coupons*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'c1',
          code: 'BLOOM10',
          recipient_name: 'VIP Welcome Campaign',
          discount_type: 'PERCENT',
          discount_value: 10,
          discount_percent: 10,
          scope_type: 'ALL',
          usage_count: 14,
          usage_limit: 100,
          active: true,
          expires_at: '2026-12-31T23:59:59.000Z',
        },
        {
          id: 'c2',
          code: 'DIWALI20',
          recipient_name: 'Diwali Festive Bouquets',
          discount_type: 'PERCENT',
          discount_value: 20,
          discount_percent: 20,
          scope_type: 'OCCASION',
          applicable_occasions: ['diwali'],
          usage_count: 5,
          active: true,
          expires_at: '2026-11-15T23:59:59.000Z',
        },
        {
          id: 'c3',
          code: 'BOUQUETS300',
          recipient_name: 'Luxury Bouquets Offer',
          discount_type: 'FLAT',
          discount_value: 30000,
          scope_type: 'CATEGORIES',
          applicable_categories: ['bouquets'],
          min_product_price_in_paise: 99900,
          usage_count: 22,
          active: true,
        },
      ]),
    });
  });

  await page.route('**/rest/v1/products*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'p1', code: 'PB-BOUQ-01', name: 'Royal Crimson Velvet Bouquet', price_in_paise: 249900, category_slug: 'bouquets', occasions: ['diwali', 'anniversary'], images: ['/placeholder-bloom.svg'], is_active: true },
        { id: 'p2', code: 'PB-BOUQ-02', name: 'Ivory Blossom Romance', price_in_paise: 189900, category_slug: 'bouquets', occasions: ['valentines', 'birthday'], images: ['/placeholder-bloom.svg'], is_active: true },
        { id: 'p3', code: 'PB-FLOW-01', name: 'Fresh Morning Rose Stem', price_in_paise: 29900, category_slug: 'flowers', occasions: ['casual'], images: ['/placeholder-bloom.svg'], is_active: true },
        { id: 'p4', code: 'PB-BOX-01', name: 'Imperial Festive Gift Box', price_in_paise: 399900, category_slug: 'giftboxes', occasions: ['diwali'], images: ['/placeholder-bloom.svg'], is_active: true },
      ]),
    });
  });

  await page.route('**/rest/v1/orders*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]', headers: { 'content-range': '0-0/0' } });
  });

  await page.route('**/rest/v1/assistance_conversations*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]', headers: { 'content-range': '0-0/0' } });
  });

  await page.route('**/rest/v1/product_reviews*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]', headers: { 'content-range': '0-0/0' } });
  });

  console.log(`Navigating to http://127.0.0.1:${PORT}/admin/coupons ...`);
  await page.goto(`http://127.0.0.1:${PORT}/admin/coupons`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Capture Table View
  await page.screenshot({ path: path.join(outputDir, 'admin-coupons-table-view.png') });
  console.log('✅ Captured admin-coupons-table-view.png');

  // 2. Open Create Coupon Drawer
  await page.waitForSelector('button:has-text("Create Coupon")');
  await page.click('button:has-text("Create Coupon")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outputDir, 'admin-coupons-create-drawer.png') });
  console.log('✅ Captured admin-coupons-create-drawer.png');

  // 3. Select Category Scope
  await page.click('button:has-text("Category Only")');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Bouquets")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outputDir, 'admin-coupons-scope-categories.png') });
  console.log('✅ Captured admin-coupons-scope-categories.png');

  // 4. Select Price Tier Scope
  await page.click('button:has-text("Price Tier")');
  await page.waitForTimeout(400);
  await page.fill('input[placeholder*="999"]', '1500');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outputDir, 'admin-coupons-scope-price-tier.png') });
  console.log('✅ Captured admin-coupons-scope-price-tier.png');

  // 5. Select Festive Occasion Scope
  await page.click('button:has-text("Festive / Occasion")');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Diwali & Festive")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outputDir, 'admin-coupons-scope-occasion.png') });
  console.log('✅ Captured admin-coupons-scope-occasion.png');

  // 6. Select Handpicked Items Scope
  await page.click('button:has-text("Handpicked Items")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outputDir, 'admin-coupons-scope-handpicked.png') });
  console.log('✅ Captured admin-coupons-scope-handpicked.png');

  await browser.close();
  server.close();
  console.log('🎉 Visual audit successfully completed!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
