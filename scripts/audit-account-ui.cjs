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
  const session = await getAdminSession();
  const browser = await chromium.launch({ headless: true });

  // 1. Logged Out View (Desktop & Mobile)
  const loggedOutContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const loggedOutPage = await loggedOutContext.newPage();
  await loggedOutPage.goto('http://localhost:5173/account', { waitUntil: 'networkidle' });
  await loggedOutPage.waitForTimeout(1000);
  await loggedOutPage.screenshot({ path: path.join(outputDir, 'customer-account-logged-out-desktop.png') });

  const loggedOutMobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const loggedOutMobilePage = await loggedOutMobileContext.newPage();
  await loggedOutMobilePage.goto('http://localhost:5173/account', { waitUntil: 'networkidle' });
  await loggedOutMobilePage.waitForTimeout(1000);
  await loggedOutMobilePage.screenshot({ path: path.join(outputDir, 'customer-account-logged-out-mobile.png') });

  // 2. Logged In View (Desktop)
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto('http://localhost:5173/');
  await desktopPage.evaluate((sess) => {
    localStorage.setItem('sb-bikivygxfjbdgpwieszs-auth-token', JSON.stringify(sess));
  }, session);

  await desktopPage.goto('http://localhost:5173/account', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(2000);

  // Tab 1: Orders
  await desktopPage.screenshot({ path: path.join(outputDir, 'customer-account-tab-orders-desktop.png') });

  // Tab 2: Loyalty
  const loyaltyTab = desktopPage.locator('button:has-text("Patron Tier & Points"), button:has-text("Loyalty")').first();
  if (await loyaltyTab.isVisible()) {
    await loyaltyTab.click();
    await desktopPage.waitForTimeout(500);
    await desktopPage.screenshot({ path: path.join(outputDir, 'customer-account-tab-loyalty-desktop.png') });
  }

  // Tab 3: Referrals
  const referralTab = desktopPage.locator('button:has-text("Referrals"), button:has-text("Invite Friends")').first();
  if (await referralTab.isVisible()) {
    await referralTab.click();
    await desktopPage.waitForTimeout(500);
    await desktopPage.screenshot({ path: path.join(outputDir, 'customer-account-tab-referrals-desktop.png') });
  }

  // Tab 4: Addresses
  const addressTab = desktopPage.locator('button:has-text("Addresses"), button:has-text("Delivery Addresses")').first();
  if (await addressTab.isVisible()) {
    await addressTab.click();
    await desktopPage.waitForTimeout(500);
    await desktopPage.screenshot({ path: path.join(outputDir, 'customer-account-tab-addresses-desktop.png') });
  }

  // Tab 5: Profile
  const profileTab = desktopPage.locator('button:has-text("Profile"), button:has-text("Account Details")').first();
  if (await profileTab.isVisible()) {
    await profileTab.click();
    await desktopPage.waitForTimeout(500);
    await desktopPage.screenshot({ path: path.join(outputDir, 'customer-account-tab-profile-desktop.png') });
  }

  // 3. Logged In Mobile View
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:5173/');
  await mobilePage.evaluate((sess) => {
    localStorage.setItem('sb-bikivygxfjbdgpwieszs-auth-token', JSON.stringify(sess));
  }, session);

  await mobilePage.goto('http://localhost:5173/account', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: path.join(outputDir, 'customer-account-mobile-overview.png') });

  await browser.close();
  console.log('Account audit screenshots captured.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
