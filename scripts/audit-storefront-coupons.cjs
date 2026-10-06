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

const sampleCatalog = [
  { id: 'p1', code: 'PB-BOUQ-01', name: 'Royal Crimson Velvet Bouquet', price: 2499, price_in_paise: 249900, category_slug: 'bouquets', occasions: ['diwali', 'anniversary'], images: ['/placeholder-bloom.svg'], is_active: true },
  { id: 'p2', code: 'PB-FLOW-01', name: 'Fresh Morning Rose Stem', price: 299, price_in_paise: 29900, category_slug: 'flowers', occasions: ['casual'], images: ['/placeholder-bloom.svg'], is_active: true },
];

async function setupPageRoutes(page) {
  await page.route('**/rest/v1/products*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sampleCatalog),
    });
  });

  await page.route('**/rest/v1/store_settings*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 's1',
        occasion_banner: { is_active: false },
        feature_flags: { enableCoupons: true },
        free_shipping_threshold_in_paise: 299900,
        standard_shipping_cost_in_paise: 15000,
        priority_shipping_cost_in_paise: 29900,
      }]),
    });
  });

  await page.route('**/api/settings/store*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        featureFlags: { enableCoupons: true },
        occasionBanner: { is_active: false },
        freeShippingThresholdInPaise: 299900,
        shippingFeeInPaise: 15000,
        expressShippingFeeInPaise: 29900,
      }),
    });
  });

  await page.route('**/api/coupons/validate', async (route) => {
    const postData = JSON.parse(route.request().postData() || '{}');
    const { code, items } = postData;

    if (code === 'BOUQUET20') {
      const hasBouquet = items && items.some((i) => i.code === 'PB-BOUQ-01');
      if (hasBouquet) {
        // 20% off the ₹2,499 bouquet = ₹500
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            code: 'BOUQUET20',
            discountType: 'PERCENT',
            discountValue: 20,
            discountInPaise: 49980,
            discountInRupees: 500,
            eligibleProductCodes: ['PB-BOUQ-01'],
            eligibleItemsCount: 1,
            eligibleSubtotalInPaise: 249900,
            description: '20% off luxury bouquets',
          }),
        });
      } else {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'This coupon is valid only on items in: Bouquets. Add an eligible bouquet to claim!',
          }),
        });
      }
    } else {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Invalid coupon code.' }),
      });
    }
  });
}

async function run() {
  const PORT = 34569;
  const server = await startServer(PORT);
  console.log(`Storefront static server running on http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Test
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopContext.newPage();

  await desktopPage.addInitScript(() => {
    const cartItems = [
      {
        code: 'PB-BOUQ-01',
        name: 'Royal Crimson Velvet Bouquet',
        image: '/placeholder-bloom.svg',
        price: 2499,
        quantity: 1,
      },
      {
        code: 'PB-FLOW-01',
        name: 'Fresh Morning Rose Stem',
        image: '/placeholder-bloom.svg',
        price: 299,
        quantity: 1,
      },
    ];
    localStorage.setItem('tpb-cart', JSON.stringify(cartItems));
  });

  await setupPageRoutes(desktopPage);

  console.log(`Navigating to desktop storefront...`);
  await desktopPage.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(600);

  // Click cart button in Navbar
  await desktopPage.click('button[aria-label*="Cart with"]');
  await desktopPage.waitForTimeout(600);

  // Open offers section
  await desktopPage.click('button:has-text("Coupons & Express Delivery")');
  await desktopPage.waitForTimeout(400);

  // Type BOUQUET20 and apply
  await desktopPage.fill('input[placeholder*="coupon" i]', 'BOUQUET20');
  await desktopPage.click('button:has-text("Apply")');
  await desktopPage.waitForTimeout(800);

  // Capture Desktop Cart with Coupon Applied & Eligible Badge
  await desktopPage.screenshot({ path: path.join(outputDir, 'cart-drawer-coupon-applied-desktop.png') });
  console.log('✅ Captured cart-drawer-coupon-applied-desktop.png');

  // Expand price breakdown
  const subtotalToggle = await desktopPage.locator('button:has-text("Subtotal")').first();
  if (await subtotalToggle.isVisible()) {
    await subtotalToggle.click();
    await desktopPage.waitForTimeout(400);
    await desktopPage.screenshot({ path: path.join(outputDir, 'cart-drawer-price-breakdown.png') });
    console.log('✅ Captured cart-drawer-price-breakdown.png');
  }

  // 2. Mobile Context Test
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.addInitScript(() => {
    const cartItems = [
      {
        code: 'PB-BOUQ-01',
        name: 'Royal Crimson Velvet Bouquet',
        image: '/placeholder-bloom.svg',
        price: 2499,
        quantity: 1,
      },
      {
        code: 'PB-FLOW-01',
        name: 'Fresh Morning Rose Stem',
        image: '/placeholder-bloom.svg',
        price: 299,
        quantity: 1,
      },
    ];
    localStorage.setItem('tpb-cart', JSON.stringify(cartItems));
  });

  await setupPageRoutes(mobilePage);

  console.log(`Navigating to mobile storefront...`);
  await mobilePage.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(600);

  // Open mobile cart via bottom nav "Bag" button
  await mobilePage.click('a:has-text("Bag"), button:has-text("Bag")');
  await mobilePage.waitForTimeout(600);

  // Open offers section
  await mobilePage.click('button:has-text("Coupons & Express Delivery")');
  await mobilePage.waitForTimeout(400);

  // Apply BOUQUET20 on mobile
  await mobilePage.fill('input[placeholder*="coupon" i]', 'BOUQUET20');
  await mobilePage.click('button:has-text("Apply")');
  await mobilePage.waitForTimeout(800);

  await mobilePage.screenshot({ path: path.join(outputDir, 'cart-drawer-coupon-applied-mobile.png') });
  console.log('✅ Captured cart-drawer-coupon-applied-mobile.png');

  await browser.close();
  server.close();
  console.log('🎉 Storefront cart audit completed successfully!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
