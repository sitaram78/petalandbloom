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
  const PORT = 34571;
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

  const mockOccasions = [
    {
      id: 'occ-1',
      name: 'Diwali & Festive',
      slug: 'diwali',
      emoji: '🪔',
      description: 'Luminous festive hampers and celebration blooms',
      is_active: true,
      display_order: 1,
    },
    {
      id: 'occ-2',
      name: "Valentine's Day",
      slug: 'valentines',
      emoji: '❤️',
      description: 'Romantic rose bouquets and intimate handcrafted gifts',
      is_active: true,
      display_order: 2,
    },
    {
      id: 'occ-3',
      name: 'Birthday',
      slug: 'birthday',
      emoji: '🎂',
      description: 'Celebratory arrangements for their special milestone',
      is_active: true,
      display_order: 3,
    },
    {
      id: 'occ-4',
      name: 'Anniversary',
      slug: 'anniversary',
      emoji: '🥂',
      description: 'Enduring everlasting florals for timeless love',
      is_active: true,
      display_order: 4,
    },
    {
      id: 'occ-5',
      name: "Mother's Day",
      slug: 'mothers-day',
      emoji: '🌷',
      description: 'Delicate pastel blooms honoring maternal warmth',
      is_active: true,
      display_order: 5,
    },
    {
      id: 'occ-6',
      name: 'Weddings & Ceremonies',
      slug: 'wedding',
      emoji: '💍',
      description: 'Grand artisanal floral decor and bridal arrangements',
      is_active: true,
      display_order: 6,
    },
  ];

  const mockProducts = [
    {
      id: 'p1',
      code: 'PB-ROSE-01',
      name: 'Classic Velvet Crimson Rose',
      category_slug: 'flowers',
      price_in_paise: 249900,
      images: ['/placeholder-bloom.svg'],
      occasions: ['valentines', 'anniversary'],
      is_active: true,
    },
    {
      id: 'p2',
      code: 'PB-DIWALI-HAMP',
      name: 'Shubh Deepawali Imperial Floral Hamper',
      category_slug: 'hampers',
      price_in_paise: 499900,
      images: ['/placeholder-bloom.svg'],
      occasions: ['diwali'],
      is_active: true,
    },
    {
      id: 'p3',
      code: 'PB-PEONY-01',
      name: 'Pastel Blush Peony Cascade',
      category_slug: 'bouquets',
      price_in_paise: 389900,
      images: ['/placeholder-bloom.svg'],
      occasions: ['birthday', 'mothers-day'],
      is_active: true,
    },
    {
      id: 'p4',
      code: 'PB-LOTUS-DIWALI',
      name: 'Golden Marigold & Silk Lotus Thali Bloom',
      category_slug: 'festive',
      price_in_paise: 299900,
      images: ['/placeholder-bloom.svg'],
      occasions: ['diwali'],
      is_active: true,
    },
    {
      id: 'p5',
      code: 'PB-TULIP-02',
      name: 'Royal Orchid & Violet Harmony',
      category_slug: 'flowers',
      price_in_paise: 189900,
      images: ['/placeholder-bloom.svg'],
      occasions: [],
      is_active: true,
    },
  ];

  let currentOccasions = [...mockOccasions];

  await page.route('**/rest/v1/occasions*', (route) => {
    const url = route.request().url();
    let responseData = currentOccasions;
    if (url.includes('is_active=eq.true')) {
      responseData = currentOccasions.filter((o) => o.is_active);
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    });
  });

  await page.route('**/rest/v1/products*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockProducts),
    });
  });

  const mockSiteAssets = [
    { section_key: 'occasion_diwali_hero', label: 'Diwali & Festive Hero', description: '', image_url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80&w=1200' },
    { section_key: 'occasion_valentines_hero', label: "Valentine's Day Hero", description: '', image_url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&q=80&w=1200' },
    { section_key: 'occasion_birthday_hero', label: 'Birthday Hero', description: '', image_url: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&q=80&w=1200' },
    { section_key: 'occasion_anniversary_hero', label: 'Anniversary Hero', description: '', image_url: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&q=80&w=1200' },
    { section_key: 'occasion_mothers-day_hero', label: "Mother's Day Hero", description: '', image_url: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&q=80&w=1200' },
    { section_key: 'occasion_friendship_hero', label: 'Friendship Day Hero', description: '', image_url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80&w=1200' },
    { section_key: 'occasion_just-because_hero', label: 'Just Because Hero', description: '', image_url: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&q=80&w=1200' },
  ];

  await page.route('**/rest/v1/site_assets*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSiteAssets),
    });
  });

  // 1. Visit /admin/occasions
  console.log('Navigating to /admin/occasions...');
  await page.goto(`http://127.0.0.1:${PORT}/admin/occasions`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(outputDir, 'admin-occasions-grid-view.png'),
    fullPage: true,
  });
  console.log('Captured admin-occasions-grid-view.png');

  // 2. Switch to Table View
  const tableBtn = page.locator('button[title="Table view"]');
  if (await tableBtn.isVisible()) {
    await tableBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(outputDir, 'admin-occasions-table-view.png'),
      fullPage: true,
    });
    console.log('Captured admin-occasions-table-view.png');
  }

  // 3. Switch back to grid and open Bulk Linker for Diwali
  const gridBtn = page.locator('button[title="Grid view"]');
  if (await gridBtn.isVisible()) {
    await gridBtn.click();
    await page.waitForTimeout(500);
  }

  const linkPiecesBtn = page.locator('button:has-text("Manage Linked Pieces")').first();
  if (await linkPiecesBtn.isVisible()) {
    await linkPiecesBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(outputDir, 'admin-occasions-bulk-linker-drawer.png'),
      fullPage: true,
    });
    console.log('Captured admin-occasions-bulk-linker-drawer.png');

    // Close drawer
    const closeBtn = page.locator('button[title="Close drawer (Esc)"]');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // 4. Open Add Occasion Modal
  const addOccasionBtn = page.locator('button:has-text("Add Occasion")');
  if (await addOccasionBtn.isVisible()) {
    await addOccasionBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(outputDir, 'admin-occasions-create-modal.png'),
      fullPage: true,
    });
    console.log('Captured admin-occasions-create-modal.png');
  }

  // 4b. Navigate to /admin/assets (Studio Visuals) to verify Occasion Hero Banners group
  console.log('Navigating to /admin/assets...');
  await page.goto(`http://127.0.0.1:${PORT}/admin/assets`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Scroll down to Occasion Hero Banners section
  const occHeroSection = page.locator('text=Shop Page — Occasion Hero Banners');
  if (await occHeroSection.isVisible()) {
    await occHeroSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }

  await page.screenshot({
    path: path.join(outputDir, 'admin-assets-occasion-banners.png'),
    fullPage: false,
  });
  console.log('Captured admin-assets-occasion-banners.png');

  // 5. Navigate to /admin/editor to capture interactive occasion pills
  console.log('Navigating to /admin/editor...');
  await page.goto(`http://127.0.0.1:${PORT}/admin/editor`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Scroll down to Occasions section
  const occasionsSection = page.locator('text=Occasions & Festive Tags');
  if (await occasionsSection.isVisible()) {
    await occasionsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Click Diwali & Festive pill to show active state
    const diwaliPill = page.locator('button:has-text("Diwali & Festive")');
    if (await diwaliPill.isVisible()) {
      await diwaliPill.click();
      await page.waitForTimeout(300);
    }
  }

  await page.screenshot({
    path: path.join(outputDir, 'admin-editor-occasions-pills.png'),
    fullPage: false,
  });
  console.log('Captured admin-editor-occasions-pills.png');

  // 6. Navigate to /gift-finder to verify dynamic occasions step
  console.log('Navigating to /gift-finder...');
  await page.goto(`http://127.0.0.1:${PORT}/gift-finder`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=What\'s the occasion?', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(outputDir, 'gift-finder-occasions.png'),
    fullPage: false,
  });
  console.log('Captured gift-finder-occasions.png');

  // 7. Navigate to /shop (Desktop) to verify dynamic occasion filter chips
  console.log('Navigating to /shop (Desktop)...');
  await page.goto(`http://127.0.0.1:${PORT}/shop`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Scroll down slightly to show category chips and occasion chips toolbar clearly
  await page.evaluate(() => window.scrollBy(0, 320));
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(outputDir, 'shop-desktop-occasions-chips.png'),
    fullPage: false,
  });
  console.log('Captured shop-desktop-occasions-chips.png');

  // Click the Diwali & Festive occasion chip to show active state & filtering
  const diwaliChip = page.locator('button:has-text("Diwali & Festive")').first();
  if (await diwaliChip.isVisible()) {
    await diwaliChip.click();
    await page.waitForTimeout(600);
    // Scroll to top so the occasion hero banner and title are in view
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(outputDir, 'shop-desktop-occasion-diwali-active.png'),
      fullPage: false,
    });
    console.log('Captured shop-desktop-occasion-diwali-active.png');
  }

  // 8. Mobile Viewport Shop Verification
  console.log('Testing /shop on Mobile viewport (390x844)...');
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.route('**/rest/v1/occasions*', (route) => {
    const url = route.request().url();
    let responseData = currentOccasions;
    if (url.includes('is_active=eq.true')) {
      responseData = currentOccasions.filter((o) => o.is_active);
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    });
  });

  await mobilePage.route('**/rest/v1/products*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockProducts),
    });
  });

  await mobilePage.route('**/rest/v1/site_assets*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await mobilePage.goto(`http://127.0.0.1:${PORT}/shop`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  // Scroll to toolbar on mobile
  await mobilePage.evaluate(() => window.scrollBy(0, 250));
  await mobilePage.waitForTimeout(400);

  // Capture horizontal occasion rail directly on mobile view
  await mobilePage.screenshot({
    path: path.join(outputDir, 'shop-mobile-occasions-slider.png'),
    fullPage: false,
  });
  console.log('Captured shop-mobile-occasions-slider.png');

  // Click "Filters" button to expand mobile drawer
  const mobileFilterBtn = mobilePage.locator('button:has-text("Filters")');
  if (await mobileFilterBtn.isVisible()) {
    await mobileFilterBtn.click();
    await mobilePage.waitForTimeout(600);
  }

  await mobilePage.screenshot({
    path: path.join(outputDir, 'shop-mobile-occasions-filter.png'),
    fullPage: false,
  });
  console.log('Captured shop-mobile-occasions-filter.png');

  // 9. Verify Active vs Inactive Checkbox on Storefront:
  // Turn off "Weddings & Ceremonies" (is_active = false)
  console.log('Verifying Deactivation: unchecking Weddings & Ceremonies...');
  currentOccasions = currentOccasions.map((o) =>
    o.slug === 'wedding' ? { ...o, is_active: false } : o
  );

  // Reload desktop /shop to observe that Weddings & Ceremonies is no longer shown
  await page.goto(`http://127.0.0.1:${PORT}/shop`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollBy(0, 320));
  await page.waitForTimeout(400);

  const weddingChipVisible = await page.locator('button:has-text("Weddings & Ceremonies")').isVisible();
  console.log('Is Weddings & Ceremonies visible on storefront after deactivation?', weddingChipVisible);

  await page.screenshot({
    path: path.join(outputDir, 'shop-desktop-occasions-after-deactivation.png'),
    fullPage: false,
  });
  console.log('Captured shop-desktop-occasions-after-deactivation.png');

  await mobileContext.close();
  await browser.close();
  server.close();
  console.log('Visual audit completed successfully!');
}

run().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
