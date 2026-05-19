const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const url = 'https://internshala.com/internships/software-developer?location=India';
  console.log('Internshala:', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  const count = await page.$$eval('div.internship_meta', (nodes) => nodes.length);
  console.log('count', count);
  const samples = await page.$$eval('div.internship_meta', (nodes) => nodes.slice(0, 3).map((node) => ({
    outer: node.outerHTML.slice(0, 2000),
    title: node.querySelector('div.profile h3')?.innerText,
    company: node.querySelector('div.company_name a')?.innerText,
    location: node.querySelector('div.location_link span')?.innerText,
    href: node.querySelector('a.profile')?.href,
    desc: node.querySelector('div.internship_description')?.innerText,
    tags: Array.from(node.querySelectorAll('div.profile .info, .internship_tags li')).map((tag) => tag.innerText.trim()),
  })));
  console.log(JSON.stringify(samples, null, 2));

  const url2 = 'https://weworkremotely.com/remote-jobs/search?term=software%20developer';
  console.log('WeWorkRemotely:', url2);
  await page.goto(url2, { waitUntil: 'networkidle', timeout: 60000 });
  const count2 = await page.$$eval('section.jobs article ul li', (nodes) => nodes.length);
  console.log('count2', count2);
  const sample2 = await page.$$eval('section.jobs article ul li', (nodes) => nodes.slice(0, 10).map((node) => ({
    outer: node.outerHTML.slice(0, 800),
    title: node.querySelector('span.title')?.innerText,
    company: node.querySelector('span.company')?.innerText,
    region: node.querySelector('span.region')?.innerText,
    href: node.querySelector('a')?.href,
  })));
  console.log(JSON.stringify(sample2, null, 2));

  await browser.close();
})();