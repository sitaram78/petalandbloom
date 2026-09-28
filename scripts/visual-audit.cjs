const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function capture() {
  const url = 'http://localhost:4173';
  const outputDir = path.join(__dirname, '../visual-audit');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const routes = [
    { name: 'home', path: '/', scroll: true },
    { name: 'shop', path: '/shop', scroll: true },
    { name: 'flowers', path: '/flowers', scroll: true },
    { name: 'bouquets', path: '/bouquets', scroll: true },
    { name: 'gifts', path: '/gifts', scroll: true },
    { name: 'bags', path: '/bags', scroll: true },
    { name: 'decor', path: '/decor', scroll: true },
    { name: 'gift-boxes', path: '/gift-boxes', scroll: true },
    { name: 'custom', path: '/custom', scroll: true },
    { name: 'custom-bouquet', path: '/custom-bouquet', scroll: true },
    { name: 'gift-finder', path: '/gift-finder', scroll: true },
    { name: 'about', path: '/about', scroll: true },
    { name: 'care-guide', path: '/care-guide', scroll: true },
    { name: 'shipping', path: '/shipping', scroll: true },
    { name: 'contact', path: '/contact', scroll: true },
    { name: 'product-detail', path: '/product/TPB-FL-001', scroll: true },
    { name: 'privacy', path: '/privacy', scroll: true },
    { name: 'terms', path: '/terms', scroll: true },
    { name: 'refund', path: '/refund', scroll: true },
  ];

  try {
    for (const route of routes) {
      console.log(`Navigating to ${route.name}...`);
      await page.goto(`${url}${route.path}`, { waitUntil: 'networkidle' });

      // Be patient: Wait for animations and assets to fully load
      await page.waitForTimeout(5000);

      if (route.scroll) {
        // Capture the full page first
        await page.screenshot({
          path: path.join(outputDir, `${route.name}_full.png`),
          fullPage: true
        });

        // Capture "slices" of the page to satisfy the "20 screenshots" request
        // We'll take a screenshot every 800px
        const bodyHandle = await page.$('body');
        const { height } = await bodyHandle.boundingBox();

        let currentScroll = 0;
        let sliceIndex = 1;
        while (currentScroll < height) {
          await page.evaluate((y) => window.scrollTo(0, y), currentScroll);
          await page.waitForTimeout(500); // Let it settle
          await page.screenshot({
            path: path.join(outputDir, `${route.name}_slice_${sliceIndex}.png`)
          });
          currentScroll += 800;
          sliceIndex++;
          if (sliceIndex > 20) break; // Cap at 20 per page
        }
      } else {
        await page.screenshot({
          path: path.join(outputDir, `${route.name}.png`),
          fullPage: true
        });
      }
    }
    console.log('Comprehensive audit captured successfully in visual-audit/');
  } catch (err) {
    console.error('Capture failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

capture();
