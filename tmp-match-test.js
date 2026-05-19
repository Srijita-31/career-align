const fetch = global.fetch;
(async () => {
  try {
    const form = new URLSearchParams();
    form.append('name', 'Test');
    form.append('email', 'test@example.com');
    form.append('desiredRole', 'software developer');
    form.append('location', 'India');
    form.append('workPreference', 'remote');
    form.append('skills', 'javascript, node, react');
    form.append('experienceLevel', 'Fresher');

    const res = await fetch('http://localhost:4000/api/match', {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    console.log('status', res.status);
    console.log(await res.text());
  } catch (err) {
    console.error(err);
  }
})();