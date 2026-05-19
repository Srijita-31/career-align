const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = 'https://internshala.com/internships/software-engineer?location=India';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const count = await page.$$eval('div.internship_meta', (nodes) => nodes.length);
  const sample = await page.$$eval('div.internship_meta', (nodes) => nodes.slice(0, 2).map((n) => ({ title: n.querySelector('div.profile h3')?.innerText, company: n.querySelector('div.company_name a')?.innerText, apply: n.querySelector('a.profile')?.href })));
  console.log('count', count);
  console.log(JSON.stringify(sample, null, 2));
  await browser.close();
})();