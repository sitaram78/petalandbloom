const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    let k = trimmed.slice(0, idx).trim();
    let v = trimmed.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
}

const supabaseAdmin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const outputDir = '/home/sitaram/.gemini/antigravity/brain/1eb51fd3-bcd0-4844-9670-e5c97372dee7/visual-audit';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function getAdminSession() {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'admin@thepetalandbloom.in'
  });
  if (error) throw error;

  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const verifyRes = await client.auth.verifyOtp({
    token_hash: data.properties?.hashed_token,
    type: 'email'
  });
  if (verifyRes.error) throw verifyRes.error;
  return verifyRes.data.session;
}

async function run() {
  console.log('Generating admin session...');
  const session = await getAdminSession();
  console.log('Admin session acquired for:', session.user.email);

  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Context
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const desktopPage = await desktopContext.newPage();

  // Inject session into localStorage
  await desktopPage.goto('http://localhost:5173/');
  await desktopPage.evaluate((sess) => {
    localStorage.setItem('sb-bikivygxfjbdgpwieszs-auth-token', JSON.stringify(sess));
  }, session);

  // 2. Mobile Context
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:5173/');
  await mobilePage.evaluate((sess) => {
    localStorage.setItem('sb-bikivygxfjbdgpwieszs-auth-token', JSON.stringify(sess));
  }, session);

  const captures = [
    // Admin Desktop
    { page: desktopPage, name: 'admin-dashboard-desktop', url: 'http://localhost:5173/admin/dashboard', wait: 2500 },
    { page: desktopPage, name: 'admin-orders-desktop', url: 'http://localhost:5173/admin/orders', wait: 2500 },
    { page: desktopPage, name: 'admin-messages-desktop', url: 'http://localhost:5173/admin/messages', wait: 2000 },
    { page: desktopPage, name: 'admin-customers-desktop', url: 'http://localhost:5173/admin/customers', wait: 2000 },
    { page: desktopPage, name: 'admin-reviews-desktop', url: 'http://localhost:5173/admin/reviews', wait: 2000 },
    { page: desktopPage, name: 'admin-coupons-desktop', url: 'http://localhost:5173/admin/coupons', wait: 2000 },
    { page: desktopPage, name: 'admin-influencers-desktop', url: 'http://localhost:5173/admin/influencers', wait: 2000 },
    { page: desktopPage, name: 'admin-settings-desktop', url: 'http://localhost:5173/admin/settings', wait: 2000 },
    { page: desktopPage, name: 'admin-audit-logs-desktop', url: 'http://localhost:5173/admin/audit-logs', wait: 2000 },

    // Admin Mobile
    { page: mobilePage, name: 'admin-dashboard-mobile', url: 'http://localhost:5173/admin/dashboard', wait: 2500 },
    { page: mobilePage, name: 'admin-orders-mobile', url: 'http://localhost:5173/admin/orders', wait: 2500 },
    { page: mobilePage, name: 'admin-messages-mobile', url: 'http://localhost:5173/admin/messages', wait: 2000 },

    // Storefront Key Pages
    { page: desktopPage, name: 'storefront-home-desktop', url: 'http://localhost:5173/', wait: 2000 },
    { page: mobilePage, name: 'storefront-home-mobile', url: 'http://localhost:5173/', wait: 2000 },
    { page: desktopPage, name: 'storefront-shop-desktop', url: 'http://localhost:5173/shop', wait: 2000 },
    { page: desktopPage, name: 'storefront-product-desktop', url: 'http://localhost:5173/product/TPB-FL-001', wait: 2000 },
  ];

  for (const item of captures) {
    try {
      console.log(`Capturing ${item.name}...`);
      await item.page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await item.page.waitForTimeout(item.wait);
      const filePath = path.join(outputDir, `${item.name}.png`);
      await item.page.screenshot({ path: filePath, fullPage: false });
      console.log(`Saved: ${filePath}`);
    } catch (e) {
      console.error(`Failed to capture ${item.name}:`, e.message);
    }
  }

  // Also capture Order Details Drawer on desktop
  try {
    console.log('Capturing order drawer...');
    await desktopPage.goto('http://localhost:5173/admin/orders', { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForTimeout(2500);
    // Click on the first order row or card to open drawer
    const row = await desktopPage.$('tr.cursor-pointer, [data-order-row], tbody tr');
    if (row) {
      await row.click();
      await desktopPage.waitForTimeout(1000);
      await desktopPage.screenshot({
        path: path.join(outputDir, 'admin-orders-drawer.png'),
        fullPage: false
      });
      console.log('Saved order drawer screenshot!');
    }
  } catch (drawerErr) {
    console.warn('Could not capture drawer:', drawerErr.message);
  }

  await browser.close();
  console.log('Visual audit capture complete!');
}

run().catch(console.error);
