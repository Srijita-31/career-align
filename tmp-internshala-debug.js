const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = 'https://internshala.com/internships/software-engineer?location=India';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const html = await page.$$eval('div.internship_meta', (nodes) => nodes.slice(0, 1).map((node) => node.outerHTML));
  console.log(html[0].slice(0, 3000));
  await browser.close();
})();