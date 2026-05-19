const fetch = global.fetch;
const cheerio = require('cheerio');
(async () => {
  const url = 'https://cutshort.io/jobs?search=software%20developer';
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const $ = cheerio.load(html);
  const nextDataRaw = $('script#__NEXT_DATA__').html();
  const nextData = JSON.parse(nextDataRaw);
  const jobs = nextData.props.pageProps.dehydratedState.queries[1].state.data.data.pageData.jobs;
  const j = jobs[0];
  console.log('headline', j.headline);
  console.log('publicUrl', j.publicUrl);
  console.log('companyDetails name', j.companyDetails?.name);
  console.log('locationsText', j.locationsText);
  console.log('salaryRangeText', j.salaryRangeText);
  console.log('sanitizedComment', typeof j.sanitizedComment, j.sanitizedComment?.slice(0, 100));
  console.log('authApplyUrl', j.authApplyUrl);
})();