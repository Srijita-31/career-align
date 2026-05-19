const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://internshala.com/internships/software-engineer?location=India', { waitUntil: 'domcontentloaded' });
  const sample = await page.evaluate(() => {
    const node = document.querySelector('div.internship_meta:nth-of-type(2)');
    return {
      desc: node.querySelector('div.internship_description')?.innerText,
      desc2: node.querySelector('div.about_company')?.innerText,
      containsDescriptionClass: node.innerHTML.includes('internship_description'),
      spans: Array.from(node.querySelectorAll('span')).map((s) => s.innerText.trim()).filter(Boolean).slice(0, 10),
      innerText: node.innerText.replace(/\n+/g, ' | ').slice(0, 400),
    };
  });
  console.log(JSON.stringify(sample, null, 2));
  await browser.close();
})();