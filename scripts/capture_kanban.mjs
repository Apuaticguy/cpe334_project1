import puppeteer from 'puppeteer-core';
import path from 'path';

async function captureKanban() {
  console.log('Launching browser to capture kanban board...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    defaultViewport: { width: 2200, height: 1100 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    console.log('Navigating to https://github.com/users/Apuaticguy/projects/5 ...');
    await page.goto('https://github.com/users/Apuaticguy/projects/5', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for kanban board columns to render
    await new Promise(r => setTimeout(r, 4000));

    const outputPath = path.resolve('docs/screenshots/screenshot_github_kanban_board.png');
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log('Saved kanban screenshot to', outputPath);
  } finally {
    await browser.close();
  }
}

captureKanban().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
