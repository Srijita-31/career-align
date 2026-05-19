const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://internshala.com/internships/software-engineer?location=India', { waitUntil: 'domcontentloaded' });
  const sample = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('div.internship_meta'));
    return nodes.slice(1, 4).map((node) => ({
      innerText: node.innerText.replace(/\n+/g, ' | ').slice(0, 300),
      locationLink: node.querySelector('div.location_link span')?.innerText,
      companyName: node.querySelector('p.company-name')?.innerText,
      title: node.querySelector('h2.job-internship-name a.job-title-href')?.innerText,
      details: Array.from(node.querySelectorAll('div.other_details_item span')).map(el => el.innerText),
      allSpans: Array.from(node.querySelectorAll('span')).slice(0, 20).map(el => el.innerText)
    }));
  });
  console.log(JSON.stringify(sample, null, 2));
  await browser.close();
})();