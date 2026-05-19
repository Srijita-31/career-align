const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://internshala.com/internships/software-engineer?location=India', { waitUntil: 'domcontentloaded' });
  const html = await page.evaluate(() => {
    const node = Array.from(document.querySelectorAll('div.internship_meta'))[1];
    return node ? node.innerHTML : 'no node';
  });
  console.log(html.slice(0, 2000));
  await browser.close();
})();