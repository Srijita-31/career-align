const fetch = global.fetch;
const cheerio = require('cheerio');
(async () => {
  const url = 'https://cutshort.io/jobs?search=software%20developer';
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  console.log('len', html.length);
  const $ = cheerio.load(html);
  console.log('script tags', $('script').length);
  const nextData = $('script#__NEXT_DATA__').html();
  console.log('nextData', nextData ? nextData.slice(0, 2000) : 'none');
  console.log('job card count', $('.job-card').length);
  $('script').each((i, el) => {
    const text = $(el).html() || '';
    if (text.includes('jobs') && text.length > 100) {
      console.log('script', i, 'len', text.length);
    }
  });
})();