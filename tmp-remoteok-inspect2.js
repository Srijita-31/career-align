const fetch = global.fetch;
const cheerio = require('cheerio');
(async () => {
  const remoteOkUrl = 'https://remoteok.com/remote-software-developer-jobs';
  const html = await fetch(remoteOkUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const $ = cheerio.load(html);
  console.log('jobs count', $('tr.job').length);
  $('tr.job').each((i, el) => {
    console.log('--- row', i, 'class', $(el).attr('class'), 'data-id', $(el).attr('data-id'), 'data-company', $(el).attr('data-company'), 'data-position', $(el).attr('data-position'));
    console.log($(el).html().slice(0, 500));
  });
})();