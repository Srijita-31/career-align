const { chromium } = require('playwright');

(async () => {
  const urls = [
    'https://internshala.com/internships/software-developer?location=India',
    'https://www.foundit.in/jobs?searchTerm=software%20developer&location=India',
    'https://www.naukri.com/software-developer-jobs-in-india',
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  for (const url of urls) {
    console.log('URL:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const html = await page.content();
    console.log('length', html.length);
    console.log(html.slice(0, 3000).replace(/\n/g, ' '));
    if (url.includes('internshala')) {
      const count = await page.$$eval('div.internship_meta', (nodes) => nodes.length);
      console.log('intern count', count);
    }
    if (url.includes('foundit')) {
      const count = await page.$$eval('article.job-card, .job-tile, .job-card', (nodes) => nodes.length);
      console.log('foundit count', count);
    }
    if (url.includes('naukri')) {
      const count = await page.$$eval('div.jobTuple, .jobTuple', (nodes) => nodes.length);
      console.log('naukri count', count);
    }
    console.log('---');
  }

  await browser.close();
})();