const fetch = global.fetch;
const cheerio = require('cheerio');
(async () => {
  const url = 'https://cutshort.io/jobs?search=software%20developer';
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const $ = cheerio.load(html);
  const nextDataRaw = $('script#__NEXT_DATA__').html();
  const nextData = JSON.parse(nextDataRaw);
  const pageData = nextData.props.pageProps.dehydratedState.queries[0].state.data.data.pageData;
  console.log('pageData keys', Object.keys(pageData));
  console.log('searchResponse keys', Object.keys(pageData.searchResponse || {}));
  console.log('jobListingDtos exists', Array.isArray(pageData.searchResponse?.jobListingDtos), pageData.searchResponse?.jobListingDtos?.length);
  if (pageData.searchResponse?.jobListingDtos) {
    console.log(JSON.stringify(pageData.searchResponse.jobListingDtos.slice(0,2).map((j) => ({ title: j.title, company: j.company?.name, location: j.location, applyUrl: j.actionLink })), null, 2));
  }
})();