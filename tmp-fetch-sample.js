const urls = [
  'https://remoteok.com/remote-software-developer-jobs',
  'https://weworkremotely.com/remote-jobs/search?term=software%20developer',
  'https://internshala.com/internships/software-developer?location=India',
  'https://www.foundit.in/jobs?searchTerm=software%20developer&location=India',
  'https://www.naukri.com/software-developer-jobs-in-india',
];

(async () => {
  try {
    for (const url of urls) {
      console.log('URL:', url);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      });
      console.log('status', res.status);
      const text = await res.text();
      console.log(text.slice(0, 2000).replace(/\n/g, ' '));
      console.log('---');
    }
  } catch (err) {
    console.error(err);
  }
})();