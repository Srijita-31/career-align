const form = document.getElementById('matchForm');
const resultsEl = document.getElementById('results');
const resultsDescription = document.getElementById('resultsDescription');

const sourceLogos = {
  LinkedIn: 'LI',
  Naukri: 'NK',
  Internshala: 'IN',
  RemoteOK: 'RO',
  WeWorkRemotely: 'WW',
  Foundit: 'FI',
  Glassdoor: 'GD',
  Indeed: 'ID',
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const getScore = (job) => Math.round(Number(job.score || 0));

const renderSkeletons = () => {
  const skeletons = Array.from({ length: 4 }, () => `
    <article class="skeleton-card">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line long"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-chip-row">
        <span class="skeleton-chip"></span>
        <span class="skeleton-chip"></span>
        <span class="skeleton-chip"></span>
      </div>
    </article>
  `);
  resultsEl.innerHTML = skeletons.join('');
};

const renderChips = (chips, emptyText = '') => {
  const values = (chips || []).filter(Boolean);
  if (!values.length && emptyText) {
    return `<span class="muted">${escapeHtml(emptyText)}</span>`;
  }
  return values
    .map((value) => `<span class="chip">${escapeHtml(value)}</span>`)
    .join('');
};

const renderBreakdown = (breakdown = {}) => {
  const rows = [
    ['Skills', breakdown.skills],
    ['Semantic', breakdown.semantic],
    ['Role', breakdown.roleFamily],
    ['Seniority', breakdown.seniority],
    ['Location', breakdown.location],
    ['Mode', breakdown.workMode],
  ].filter(([, value]) => Number.isFinite(Number(value)));

  if (!rows.length) {
    return '';
  }

  return `
    <div class="match-breakdown">
      ${rows.map(([label, value]) => `
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${Math.round(Number(value))}%</strong>
        </div>
      `).join('')}
    </div>
  `;
};

const renderJobs = (jobs) => {
  if (!jobs.length) {
    resultsEl.innerHTML = '<p>No matching jobs found yet. Try adding more skills or changing the work mode.</p>';
    return;
  }

  resultsEl.innerHTML = jobs
    .map((job, index) => {
      const source = job.source_platform || job.source || 'Live';
      const applyUrl = job.apply_url || job.url || '#';
      const logo = sourceLogos[source] || source.slice(0, 2).toUpperCase();
      const scorePercentage = getScore(job);
      const description = job.description ? `<p>${escapeHtml(job.description.slice(0, 220))}...</p>` : '';
      const explanation = job.why?.[0] || 'This job is ranked by semantic similarity to your profile.';
      const roleMeta = [job.role_family, job.seniority, job.remote_type].filter(Boolean);

      return `
        <article class="job-card ${index === 0 ? 'best-card' : ''}">
          <div class="job-card-top">
            <span class="source-badge">${escapeHtml(logo)}</span>
            ${scorePercentage >= 75 ? '<span class="badge best-match">High Similarity</span>' : ''}
            <span class="match-score">${scorePercentage}%</span>
          </div>
          <h3><a href="${escapeHtml(applyUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(job.title)}</a></h3>
          <div class="job-meta small">
            <span>${escapeHtml(job.company)}</span>
            <span>${escapeHtml(job.location)}</span>
            <span>${escapeHtml(source)}</span>
          </div>
          <div class="chips-row">
            ${renderChips([job.work_mode || job.workMode, job.job_type || job.jobType, job.location])}
          </div>
          ${roleMeta.length ? `<div class="chips-row role-row">${renderChips(roleMeta)}</div>` : ''}
          ${description}
          <div class="job-details">
            <div><strong>Similarity score:</strong> ${scorePercentage}%</div>
            <div><strong>Detected overlap:</strong> ${renderChips(job.matchedSkills || [], 'No strong overlap detected')}</div>
          </div>
          ${renderBreakdown(job.matchBreakdown)}
          <div class="recommendation-why">
            <strong>Why recommended:</strong>
            <p>${escapeHtml(explanation)}</p>
          </div>
          <a class="apply-link" href="${escapeHtml(applyUrl)}" target="_blank" rel="noopener noreferrer">Apply</a>
        </article>
      `;
    })
    .join('');
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  renderSkeletons();
  resultsDescription.textContent = 'Comparing your skills with available job matches.';

  const formData = new FormData(form);
  try {
    const response = await fetch('/api/match', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    const jobs = data.jobs || data.recommendations || [];
    resultsDescription.textContent = jobs.length
      ? `Showing ${jobs.length} similarity-ranked jobs for ${data.profile?.name || 'your profile'}.`
      : 'No jobs matched this profile yet.';
    renderJobs(jobs);
  } catch (error) {
    resultsEl.innerHTML = '<p>Unable to retrieve matches. Please try again later.</p>';
    resultsDescription.textContent = error.message || '';
    console.error(error);
  }
});
