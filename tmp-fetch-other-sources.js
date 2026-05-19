const urls = [
  'https://cutshort.io/jobs?search=software%20developer',
  'https://www.apna.co/jobs',
  'https://angel.co/jobs?refinementList%5Bremote%5D%5B0%5D=Remote',
];

(async () => {
  for (const url of urls) {
    console.log('URL:', url);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });
      console.log('status', res.status);
      const text = await res.text();
      console.log(text.slice(0, 2000).replace(/\n/g, ' '));
    } catch (error) {
      console.error(error.message);
    }
    console.log('---');
  }
})();