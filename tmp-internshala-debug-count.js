const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://internshala.com/internships/software-engineer?location=India', { waitUntil: 'domcontentloaded' });
  const count = await page.evaluate(() => document.querySelectorAll('div.internship_meta').length);
  console.log('count', count);
  await browser.close();
})();