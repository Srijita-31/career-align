const fetch = global.fetch;
const cheerio = require('cheerio');
(async () => {
  const remoteOkUrl = 'https://remoteok.com/remote-software-developer-jobs';
  const html = await fetch(remoteOkUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const $ = cheerio.load(html);
  console.log('jobs count', $('tr.job').length);
  const first = $('tr.job').first();
  console.log(first.html().slice(0, 600));
  console.log('data-pos', first.attr('data-position'));
  console.log('body length', $('body').html().length);
  console.log('script count', $('script').length);
  $('script').each((i, el) => {
    const text = $(el).html() || '';
    if (text.includes('jobs') || text.includes('RemoteOK')) {
      console.log('script index', i, 'len', text.length);
    }
  });
})();