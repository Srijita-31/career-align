const fetch = global.fetch;
const cheerio = require('cheerio');
(async () => {
  const url = 'https://cutshort.io/jobs?search=software%20developer';
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const $ = cheerio.load(html);
  const nextDataRaw = $('script#__NEXT_DATA__').html();
  if (!nextDataRaw) {
    console.log('no next data');
    return;
  }
  const nextData = JSON.parse(nextDataRaw);
  console.log(Object.keys(nextData.props.pageProps));
  const state = nextData.props.pageProps.dehydratedState;
  console.log('queries len', state.queries.length);
  const top = state.queries[0].state.data;
  console.log(Object.keys(top));
  const data = top.data;
  console.log('data keys', Object.keys(data).slice(0, 20));
  console.log('type', typeof data.jobListings);
  console.log('sample job', JSON.stringify(data.jobListings?.slice(0, 2).map((job) => ({ title: job.title, company: job.company?.name, location: job.location, apply_url: job.actionLink })), null, 2));
})();