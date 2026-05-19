const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://internshala.com/internships/software-engineer?location=India', { waitUntil: 'domcontentloaded' });
  const sample = await page.evaluate(() => {
    const node = document.querySelector('div.internship_meta:nth-of-type(1)');
    if (!node) return null;
    return {
      title: node.querySelector('h2.job-internship-name a.job-title-href')?.innerText,
      company: node.querySelector('p.company-name')?.innerText,
      location1: node.querySelector('div.location_link span')?.innerText,
      location2: Array.from(node.querySelectorAll('div.internship_logo span')).map(el => el.innerText),
      description: node.querySelector('div.i')?.innerText,
      html: node.innerHTML.slice(0, 1000)
    };
  });
  console.log(JSON.stringify(sample, null, 2));
  await browser.close();
})();