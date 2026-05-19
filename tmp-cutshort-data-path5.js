const fetch = global.fetch;
const cheerio = require('cheerio');
(async () => {
  const url = 'https://cutshort.io/jobs?search=software%20developer';
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const $ = cheerio.load(html);
  const nextDataRaw = $('script#__NEXT_DATA__').html();
  const nextData = JSON.parse(nextDataRaw);
  const jobs = nextData.props.pageProps.dehydratedState.queries[1].state.data.data.pageData.jobs;
  console.log('jobs length', jobs.length);
  console.log('first keys', Object.keys(jobs[0] || {}).slice(0, 40));
  console.log(JSON.stringify({ title: jobs[0].title, company: jobs[0].company?.name, location: jobs[0].location, description: jobs[0].description?.slice(0, 100), apply_url: jobs[0].actionLink }, null, 2));
})();