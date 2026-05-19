const fetch = global.fetch;
const cheerio = require('cheerio');
(async () => {
  const url = 'https://cutshort.io/jobs?search=software%20developer';
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const $ = cheerio.load(html);
  const nextDataRaw = $('script#__NEXT_DATA__').html();
  const nextData = JSON.parse(nextDataRaw);
  const queries = nextData.props.pageProps.dehydratedState.queries;
  console.log('queries', queries.length);
  queries.forEach((q, idx) => {
    console.log('--- query', idx, 'keys', Object.keys(q.state));
    if (q.state && q.state.data && q.state.data.data) {
      console.log('  data keys', Object.keys(q.state.data.data).slice(0, 20));
      if (q.state.data.data.pageData) {
        console.log('  pageData keys', Object.keys(q.state.data.data.pageData).slice(0, 20));
      }
      if (q.state.data.data.searchResponse) {
        console.log('  searchResponse keys', Object.keys(q.state.data.data.searchResponse).slice(0,20));
      }
    }
  });
})();