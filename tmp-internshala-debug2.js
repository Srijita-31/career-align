const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = 'https://internshala.com/internships/software-engineer?location=India';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const samples = await page.$$eval('div.internship_meta', (nodes) => nodes.slice(0, 5).map((node) => ({ html: node.innerHTML.slice(0, 1000), text: node.innerText.slice(0, 300) })));
  console.log(JSON.stringify(samples, null, 2));
  await browser.close();
})();