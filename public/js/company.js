// public/js/company.js

// Utility: get JWT from localStorage
function getToken() {
  return localStorage.getItem('jwt');
}

function setToken(token) {
  localStorage.setItem('jwt', token);
}

function showMessage(el, msg, isError = false) {
  el.textContent = msg;
  el.style.color = isError ? '#ef4444' : '#10b981';
}

// Login handling
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const payload = {
      email: formData.get('email'),
      password: formData.get('password')
    };
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setToken(data.token);
        window.location.href = '/company/dashboard.html';
      } else {
        showMessage(loginMessage, data.message || 'Login failed', true);
      }
    } catch (err) {
      showMessage(loginMessage, err.message, true);
    }
  });
}

// Dashboard: fetch and list jobs
async function loadJobs() {
  const token = getToken();
  if (!token) return;
  const resp = await fetch('/api/company/jobs', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await resp.json();
  const list = document.getElementById('jobList');
  if (!list) return;
  if (data.status !== 'ok') {
    list.innerHTML = `<p class="msg" style="color:#ef4444;">${data.message}</p>`;
    return;
  }
  list.innerHTML = data.jobs.map(job => `
    <div class="job-card">
      <h3>${job.title}</h3>
      <p>${job.company}</p>
      <a href="${job.apply_url}" target="_blank" class="apply-link">Apply</a>
    </div>
  `).join('');
}

if (window.location.pathname.endsWith('dashboard.html')) {
  document.addEventListener('DOMContentLoaded', loadJobs);
}

// Job creation wizard (simple)
const jobForm = document.getElementById('jobForm');
if (jobForm) {
  jobForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return alert('Not authenticated');
    const fd = new FormData(jobForm);
    const payload = {
      title: fd.get('title'),
      company: fd.get('company'),
      location: fd.get('location'),
      salary: fd.get('salary'),
      job_type: fd.get('job_type'),
      work_mode: fd.get('work_mode'),
      apply_url: fd.get('apply_url'),
      description: fd.get('description'),
      skills: fd.get('skills') ? fd.get('skills').split(',').map(s=>s.trim()) : []
    };
    const res = await fetch('/api/company/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'ok') {
      alert('Job created!');
      window.location.href = '/company/dashboard.html';
    } else {
      alert(data.message || 'Error creating job');
    }
  });
}
