const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://internshala.com/internships/software-engineer?location=India', { waitUntil: 'domcontentloaded' });
  const sample = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('div.internship_meta'));
    return nodes.slice(0, 3).map((node) => ({ exists: !!node, title: node.querySelector('h2.job-internship-name a.job-title-href')?.innerText }));
  });
  console.log(JSON.stringify(sample, null, 2));
  await browser.close();
})();