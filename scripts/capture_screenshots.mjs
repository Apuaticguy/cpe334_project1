import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function capture() {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 1. Navigate to App
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

    // Wait for backend health to be online
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Backend: Online');
    }, { timeout: 10000 });
    console.log('Backend health verified: Online');

    // Login as Customer
    console.log('Logging in as Customer...');
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent && b.textContent.includes('customer1@example.com'));
    }, { timeout: 10000 });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const customerBtn = btns.find(b => b.textContent && b.textContent.includes('customer1@example.com'));
      if (customerBtn) customerBtn.click();
    });

    await page.waitForFunction(() => document.body.innerText.includes('Browse Catalog & Menu'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // Increase Matcha Latte (item 1) qty to 2
    console.log('Adding items to cart...');
    const plusButtons = await page.$$('button[aria-label="Increase quantity"]');
    if (plusButtons.length >= 2) {
      await plusButtons[0].click(); // Matcha: 1
      await new Promise(r => setTimeout(r, 300));
      await plusButtons[0].click(); // Matcha: 2
      await new Promise(r => setTimeout(r, 300));
      await plusButtons[1].click(); // Croissant: 1
      await new Promise(r => setTimeout(r, 500));
    }

    // Save Screenshot 1: Catalog & Cart Summary
    const file1 = path.join(SCREENSHOT_DIR, 'screenshot_catalog_cart.png');
    await page.screenshot({ path: file1, fullPage: false });
    console.log(`Saved: ${file1}`);

    // Click "Place Order"
    console.log('Placing order...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const po = btns.find(b => b.textContent && b.textContent.includes('Place Order'));
      if (po) po.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('Order Placed Successfully'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // Click "My Order History" tab
    console.log('Navigating to Order History...');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button.nav-link'));
      const oh = tabs.find(t => t.textContent && t.textContent.includes('Order History'));
      if (oh) oh.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('Order #'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // Save Screenshot 2: Order History
    const file2 = path.join(SCREENSHOT_DIR, 'screenshot_order_history.png');
    await page.screenshot({ path: file2, fullPage: false });
    console.log(`Saved: ${file2}`);

    // Switch back to "Browse Catalog"
    console.log('Testing stock validation...');
    await page.evaluate(() => {
      const allTabs = Array.from(document.querySelectorAll('button.nav-link'));
      const catTab = allTabs.find(t => t.textContent && t.textContent.includes('Catalog'));
      if (catTab) catTab.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Type 999 into KMUTT Hoodie input
    const inputs = await page.$$('input[type="number"]');
    if (inputs.length >= 3) {
      // Third item is Hoodie
      await inputs[2].click({ clickCount: 3 });
      await inputs[2].type('999');
      await new Promise(r => setTimeout(r, 300));
    }

    // Click Place Order
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const poBtn = btns.find(b => b.textContent && b.textContent.includes('Place Order'));
      if (poBtn) poBtn.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('Insufficient stock'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // Save Screenshot 3: Stock Validation Error
    const file3 = path.join(SCREENSHOT_DIR, 'screenshot_stock_validation.png');
    await page.screenshot({ path: file3, fullPage: false });
    console.log(`Saved: ${file3}`);

    // Click "Sign Out"
    console.log('Logging in as Operator...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const soBtn = btns.find(b => b.textContent && b.textContent.includes('Sign Out'));
      if (soBtn) soBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Login as Operator
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const opBtn = btns.find(b => b.textContent && b.textContent.includes('operator1@example.com'));
      if (opBtn) opBtn.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('Operator Order Queue'), { timeout: 10000 });
    console.log('Operator dashboard loaded.');
    await new Promise(r => setTimeout(r, 1000));

    // In operator dashboard, click "Accept Order" on first submitted order
    console.log('Accepting order...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const acBtn = btns.find(b => b.textContent && b.textContent.includes('Accept Order'));
      if (acBtn) acBtn.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('successfully accepted'), { timeout: 10000 });
    console.log('Order accepted successfully.');
    await new Promise(r => setTimeout(r, 1000));

    // Save Screenshot 4: Operator Queue
    const file4 = path.join(SCREENSHOT_DIR, 'screenshot_operator_queue.png');
    await page.screenshot({ path: file4, fullPage: false });
    console.log(`Saved: ${file4}`);

    console.log('All 4 UI screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

capture().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
