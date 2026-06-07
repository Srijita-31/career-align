// public/js/student.js

function getToken() {
  return localStorage.getItem('jwt');
}
function setToken(tok) { 
  localStorage.setItem('jwt', tok); 
}

// Alert utility with Tailwind classes
function showAlert(containerId, msg, isError = false) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = msg;
  el.className = `mb-6 p-4 rounded-lg text-sm font-medium text-left ${isError ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`;
  el.classList.remove('hidden');
}

// Student Login (login.html)
const loginForm = document.getElementById('loginForm');
if(loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Signing in...';
    btn.disabled = true;

    const fd = new FormData(loginForm);
    const payload = { email: fd.get('email'), password: fd.get('password') };
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if(data.status === 'ok') {
        setToken(data.token);
        window.location.href = '/student/dashboard.html';
      } else {
        showAlert('loginMessage', data.message || 'Login failed. Check credentials.', true);
      }
    } catch(err) {
      showAlert('loginMessage', err.message, true);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
}

// Student Registration (register.html)
const registerForm = document.getElementById('registerForm');
if(registerForm) {
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = registerForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Signing up...';
    btn.disabled = true;

    const fd = new FormData(registerForm);
    const payload = { email: fd.get('email'), password: fd.get('password'), role: 'student' };
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if(data.status === 'ok' || data.status === 201) {
        setToken(data.token);
        window.location.href = '/student/dashboard.html';
      } else {
        showAlert('registerMessage', data.message || 'Registration failed.', true);
      }
    } catch(err) {
      showAlert('registerMessage', err.message, true);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
}

// Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('jwt');
    window.location.href = '/student/login.html';
  });
}

// Student Dashboard Flow
const dashboardForm = document.getElementById('dashboardForm');
const heroSection = document.getElementById('heroSection');
const resultsSection = document.getElementById('resultsSection');
const editProfileBtn = document.getElementById('editProfileBtn');
const resumeUpload = document.getElementById('resumeUpload');
const resumeFileName = document.getElementById('resumeFileName');

if(resumeUpload && resumeFileName) {
  resumeUpload.addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
      resumeFileName.textContent = e.target.files[0].name;
    } else {
      resumeFileName.textContent = 'Upload a file';
    }
  });
}

if(dashboardForm) {
  if (!getToken()) {
    window.location.href = '/student/login.html';
  }

  dashboardForm.addEventListener('submit', async e => {
    e.preventDefault();
    const token = getToken();
    if (!token) return window.location.href = '/student/login.html';
    
    const btn = document.getElementById('findMatchesBtn');
    const originalBtnText = btn.textContent;
    btn.textContent = 'Analyzing Profile & Matching...';
    btn.disabled = true;
    
    const formData = new FormData(dashboardForm);
    
    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if(data.success) {
        renderDashboardResults(data.profile, data.jobs);
        heroSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
      } else {
        showAlert('heroAlert', data.message || 'Error processing resume', true);
      }
    } catch (err) {
      showAlert('heroAlert', err.message, true);
    } finally {
      btn.textContent = originalBtnText;
      btn.disabled = false;
    }
  });
}

if (editProfileBtn) {
  editProfileBtn.addEventListener('click', () => {
    resultsSection.classList.add('hidden');
    heroSection.classList.remove('hidden');
  });
}

// Map score to Tailwind classes for the badge
function getScoreBadgeDetails(score) {
  if (score >= 90) return { text: 'Excellent Match', cls: 'bg-green-100 text-green-800 border-green-200' };
  if (score >= 75) return { text: 'Good Match', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
  if (score >= 60) return { text: 'Stretch Match', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  return { text: 'Weak Match', cls: 'bg-red-100 text-red-800 border-red-200' };
}

function renderDashboardResults(profile, jobs) {
  const candidateSkills = profile.skills || [];
  
  // Stats
  const validJobs = jobs || [];
  document.getElementById('statMatchedJobs').textContent = validJobs.length;
  document.getElementById('statStrongMatches').textContent = validJobs.filter(j => j.score >= 75).length;
  
  // Profile Detected Skills
  const skillsContainer = document.getElementById('detectedSkillsList');
  skillsContainer.innerHTML = '';
  candidateSkills.forEach(s => {
    const el = document.createElement('span');
    // Tailwind pills for detected skills
    el.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200';
    el.textContent = s;
    skillsContainer.appendChild(el);
  });
  
  // Job Cards
  const jobsList = document.getElementById('jobsList');
  jobsList.innerHTML = '';
  
  if (validJobs.length === 0) {
    jobsList.innerHTML = '<div class="bg-white p-6 rounded-xl border border-gray-200 text-center text-gray-500">No jobs matched your profile. Try adding more skills or a different resume.</div>';
    return;
  }
  
  const template = document.getElementById('jobCardTemplate');
  
  validJobs.forEach(job => {
    const clone = template.content.cloneNode(true);
    
    clone.querySelector('.job-title').textContent = job.title;
    clone.querySelector('.job-company').textContent = job.company || 'Unknown Company';
    
    // Meta fields
    if (job.location) {
      const el = clone.querySelector('.meta-location');
      el.classList.remove('hidden');
      el.querySelector('.location-text').textContent = job.location;
    }
    if (job.work_mode) {
      const el = clone.querySelector('.meta-mode');
      el.classList.remove('hidden');
      el.querySelector('.mode-text').textContent = job.work_mode;
    }
    if (job.seniority) {
      const el = clone.querySelector('.meta-seniority');
      el.classList.remove('hidden');
      el.querySelector('.seniority-text').textContent = job.seniority;
    }
    
    // Score Badge
    const badgeEl = clone.querySelector('.score-badge');
    const badgeInfo = getScoreBadgeDetails(job.score || 0);
    badgeEl.textContent = badgeInfo.text;
    badgeEl.className = `score-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap border ${badgeInfo.cls}`;
    
    // Skills Alignment
    const alignmentContainer = clone.querySelector('.alignment-pills');
    const jobSkills = Array.isArray(job.skills) ? job.skills : (job.required_skills || []);
    
    if (jobSkills.length === 0) {
      clone.querySelector('.job-skills-container').classList.add('hidden');
    } else {
      jobSkills.forEach(js => {
        const p = document.createElement('span');
        const isMatched = candidateSkills.some(cs => cs.toLowerCase() === js.toLowerCase());
        
        // Tailwind classes for matched (green) vs missing (gray/red)
        if (isMatched) {
          p.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200';
        } else {
          p.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200';
        }
        p.textContent = js;
        alignmentContainer.appendChild(p);
      });
    }
    
    // Apply Link
    const applyLnk = clone.querySelector('.apply-link');
    if (job.apply_url) {
      applyLnk.classList.remove('hidden');
      applyLnk.href = job.apply_url;
    }
    
    jobsList.appendChild(clone);
  });
}
