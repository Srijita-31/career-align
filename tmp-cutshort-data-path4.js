const fetch = global.fetch;
const cheerio = require('cheerio');
(async () => {
  const url = 'https://cutshort.io/jobs?search=software%20developer';
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const $ = cheerio.load(html);
  const nextDataRaw = $('script#__NEXT_DATA__').html();
  const nextData = JSON.parse(nextDataRaw);
  const jobs = nextData.props.pageProps.dehydratedState.queries[0].state.data.data.pageData.jobsList;
  console.log('jobsList', Array.isArray(jobs), jobs?.length);
  if (Array.isArray(jobs)) {
    console.log('first keys', Object.keys(jobs[0] || {}).slice(0, 50));
    console.log('first sample', JSON.stringify(jobs[0], null, 2).slice(0, 2000));
  }
})();