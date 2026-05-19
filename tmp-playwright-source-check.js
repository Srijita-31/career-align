const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const urls = [
    { name: 'RemoteOK', url: 'https://remoteok.com/remote-software-developer-jobs' },
    { name: 'WeWorkRemotely', url: 'https://weworkremotely.com/remote-jobs/search?term=software%20developer' },
    { name: 'Internshala', url: 'https://internshala.com/internships/software-developer?location=India' },
  ];

  for (const { name, url } of urls) {
    console.log('---', name, url);
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('status', response?.status());
    if (name === 'RemoteOK') {
      const jobs = await page.$$eval('tr.job', (els) => els.map((el) => ({
        cls: el.className,
        data: {
          id: el.getAttribute('data-id'),
          company: el.getAttribute('data-company'),
          position: el.getAttribute('data-position'),
        },
        title: el.querySelector('td.position h2')?.innerText.trim(),
      })));
      console.log('jobs count', jobs.length);
      console.log(JSON.stringify(jobs.slice(0, 5), null, 2));
    }
    if (name === 'WeWorkRemotely') {
      const count = await page.$$eval('section.jobs article ul li', (nodes) => nodes.length);
      console.log('count', count);
      const sample = await page.$$eval('section.jobs article ul li', (nodes) => nodes.slice(0, 3).map((node) => ({
        title: node.querySelector('span.title')?.innerText,
        company: node.querySelector('span.company')?.innerText,
        region: node.querySelector('span.region')?.innerText,
        href: node.querySelector('a')?.href,
      })));
      console.log(JSON.stringify(sample, null, 2));
    }
    if (name === 'Internshala') {
      const count = await page.$$eval('div.internship_meta', (nodes) => nodes.length);
      console.log('count', count);
      const sample = await page.$$eval('div.internship_meta', (nodes) => nodes.slice(0, 3).map((node) => ({
        title: node.querySelector('div.profile h3')?.innerText,
        company: node.querySelector('div.company_name a')?.innerText,
        location: node.querySelector('div.location_link span')?.innerText,
        href: node.querySelector('a.profile')?.href,
      })));
      console.log(JSON.stringify(sample, null, 2));
    }
  }

  await browser.close();
})();