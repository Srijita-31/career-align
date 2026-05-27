const form = document.getElementById('matchForm');
const resultsEl = document.getElementById('results');
const resultsDescription = document.getElementById('resultsDescription');
let latestProfile = {};
let latestJobs = [];

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

const confidenceLabel = (job) => job.matchConfidence || (
  getScore(job) >= 85 ? 'Strong Match'
    : getScore(job) >= 70 ? 'Good Match'
      : getScore(job) >= 55 ? 'Stretch Match'
        : 'Weak Match'
);

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

const scoreTone = (value) => {
  const score = Number(value);
  if (score >= 75) return 'strong';
  if (score >= 55) return 'mixed';
  return 'weak';
};

const scoreLabel = (value) => {
  const score = Number(value);
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Partial';
  return 'Weak';
};

const renderBreakdown = (breakdown = {}) => {
  const rows = [
    ['Skills coverage', breakdown.skills],
    ['Semantic fit', breakdown.semantic],
    ['Role fit', breakdown.roleFamily],
    ['Seniority fit', breakdown.seniority],
    ['Location fit', breakdown.location],
  ].filter(([, value]) => Number.isFinite(Number(value)));

  if (!rows.length) {
    return '';
  }

  return `
    <div class="match-breakdown">
      ${rows.map(([label, value]) => `
        <div class="score-${scoreTone(value)}">
          <span>${escapeHtml(label)}</span>
          <strong>${Math.round(Number(value))}%</strong>
          <small>${scoreLabel(value)}</small>
        </div>
      `).join('')}
    </div>
  `;
};

const renderTrustNotes = (job) => {
  const notes = [];
  const evidence = job.skillEvidence || {};

  if (Number.isFinite(Number(evidence.detectedRequiredCount))) {
    notes.push(`Skills: ${Number(evidence.matchedRequiredCount || 0)} of ${Number(evidence.detectedRequiredCount || 0)} detected requirements matched${evidence.confidence ? ` (${evidence.confidence} confidence)` : ''}.`);
  }

  (job.scoreCaps || []).forEach((note) => notes.push(note));

  if (!notes.length) {
    return '';
  }

  return `
    <div class="trust-notes">
      ${notes.slice(0, 3).map((note) => `<div>${escapeHtml(note)}</div>`).join('')}
    </div>
  `;
};

const renderJobs = (jobs) => {
  latestJobs = jobs;
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
      const explanations = Array.isArray(job.why) && job.why.length
        ? job.why
        : ['This job is ranked by employability fit across skills, role, seniority, location, and semantic similarity.'];
      const roleMeta = [job.role_family, job.seniority, job.remote_type].filter(Boolean);

      return `
        <article class="job-card ${index === 0 ? 'best-card' : ''}">
          <div class="job-card-top">
            <span class="source-badge">${escapeHtml(logo)}</span>
            <span class="badge ${scorePercentage >= 70 ? 'best-match' : ''}">${escapeHtml(confidenceLabel(job))}</span>
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
            <div><strong>Fit score:</strong> ${scorePercentage}%</div>
            <div><strong>Matched skills:</strong> ${renderChips(job.matchedSkills || [], 'No strong overlap detected')}</div>
            <div><strong>Missing skills:</strong> ${renderChips(job.missingSkills || [], 'No major missing skills detected')}</div>
          </div>
          ${renderBreakdown(job.matchBreakdown)}
          ${renderTrustNotes(job)}
          <div class="recommendation-why">
            <strong>Why recommended:</strong>
            <ul>
              ${explanations.map((explanation) => `<li>${escapeHtml(explanation)}</li>`).join('')}
            </ul>
          </div>
          <div class="job-actions">
            <a class="apply-link" href="${escapeHtml(applyUrl)}" target="_blank" rel="noopener noreferrer">Apply</a>
            <div class="feedback-actions" data-job-index="${index}">
              <button type="button" data-feedback="relevant">Relevant</button>
              <button type="button" data-feedback="not_relevant">Not relevant</button>
              <button type="button" data-feedback="too_senior">Too senior</button>
              <button type="button" data-feedback="wrong_location">Wrong location</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
};

resultsEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-feedback]');
  if (!button) {
    return;
  }

  const wrapper = button.closest('.feedback-actions');
  const job = latestJobs[Number(wrapper?.dataset.jobIndex)];
  if (!job) {
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Saved';

  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobUrlHash: job.url_hash,
        action: button.dataset.feedback,
        profile: latestProfile,
        job,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Unable to save feedback');
    }
  } catch (error) {
    button.disabled = false;
    button.textContent = originalText;
    console.error(error);
  }
});

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
    latestProfile = data.profile || {};
    resultsDescription.textContent = jobs.length
      ? `Showing ${jobs.length} fit-ranked jobs for ${data.profile?.name || 'your profile'}.`
      : 'No jobs matched this profile yet.';
    renderJobs(jobs);
  } catch (error) {
    resultsEl.innerHTML = '<p>Unable to retrieve matches. Please try again later.</p>';
    resultsDescription.textContent = error.message || '';
    console.error(error);
  }
});
