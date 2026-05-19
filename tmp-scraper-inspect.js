const { chromium } = require('playwright');
const fetch = global.fetch;
const cheerio = require('cheerio');

(async () => {
  try {
    // RemoteOK sample
    const remoteOkUrl = 'https://remoteok.com/remote-software-developer-jobs';
    console.log('REMOTEOK URL', remoteOkUrl);
    const remoteOkHtml = await fetch(remoteOkUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
    }).then((r) => r.text());
    const $ = cheerio.load(remoteOkHtml);
    console.log('remoteok rows', $('table#jobsboard tr.job').length);
    console.log('first row title', $('table#jobsboard tr.job').first().find('td.position h2').text());
    console.log('first row company attr', $('table#jobsboard tr.job').first().attr('data-company'));    
    console.log('first row data-pos', $('table#jobsboard tr.job').first().attr('data-position'));
    console.log('first row url', $('table#jobsboard tr.job').first().find('td.company a.preventLink').attr('href'));
    console.log('first row desc', $('table#jobsboard tr.job').first().find('td.description').text().trim().slice(0,200));

    // Internshala via Playwright
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' });
    const internUrl = 'https://internshala.com/internships/software-developer?location=India';
    await page.goto(internUrl, { waitUntil: 'networkidle', timeout: 60000 });
    const count = await page.$$eval('div.internship_meta', (nodes) => nodes.length);
    console.log('intern count', count);
    const sample = await page.$$eval('div.internship_meta', (nodes) => nodes.slice(0, 2).map((node) => ({ 
      title: node.querySelector('div.profile h3')?.innerText,
      company: node.querySelector('div.company_name a')?.innerText,
      location: node.querySelector('div.location_link span')?.innerText,
      apply: node.querySelector('a.profile')?.href,
      desc: node.querySelector('div.internship_description')?.innerText,
      tags: Array.from(node.querySelectorAll('div.profile .info, .internship_tags li')).map((tag) => tag.innerText.trim()),
      posted: node.querySelector('div.other_details_item span')?.innerText,
    })));
    console.log(JSON.stringify(sample, null, 2));
    await browser.close();
  } catch (err) {
    console.error('error', err);
  }
})();