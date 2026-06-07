// integration test script for Career Align API
// Run with: node test.js

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); // fallback if needed

(async () => {
  const base = 'http://localhost:4001';
  const json = async (res) => {
    const txt = await res.text();
    try { return JSON.parse(txt); } catch { return txt; }
  };
  try {
    // Register a company user
    let res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'company@example.com', password: 'Pass123!', role: 'company' })
    });
    const compReg = await json(res);
    console.log('Company register:', compReg);
    const compToken = compReg.token;

    // Register a student user
    res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.com', password: 'Pass123!', role: 'student' })
    });
    const studReg = await json(res);
    console.log('Student register:', studReg);
    const studToken = studReg.token;

    // Company creates a job
    res = await fetch(`${base}/api/company/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${compToken}` },
      body: JSON.stringify({ title: 'Software Engineer', description: 'Full stack dev', apply_url: 'https://example.com/apply', remote_type: 'remote', minimum_experience_years: 2, required_skills: ['javascript', 'nodejs'] })
    });
    const jobCreate = await json(res);
    console.log('Job created:', jobCreate);
    const jobId = jobCreate.job?.id;

    // Student creates profile (no resume upload for simplicity)
    res = await fetch(`${base}/api/student/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studToken}` },
      body: JSON.stringify({ resumePath: null, skills: ['javascript', 'nodejs'] })
    });
    const profile = await json(res);
    console.log('Student profile created:', profile);

    // Student requests matches
    res = await fetch(`${base}/api/student/matches`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${studToken}` }
    });
    const matches = await json(res);
    console.log('Matches response:', matches);
  } catch (e) {
    console.error('Test error:', e);
  }
})();
