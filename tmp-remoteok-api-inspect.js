const fetch = global.fetch;
(async () => {
  try {
    const url = 'https://remoteok.com/api';
    console.log('URL', url);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log('status', res.status);
    const data = await res.json();
    console.log('type', Array.isArray(data), 'len', data.length);
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
  } catch (err) {
    console.error(err);
  }
})();