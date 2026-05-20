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

const renderChips = (chips) =>
  chips
    .filter(Boolean)
    .map((value) => `<span class="chip">${value}</span>`)
    .join('');

const renderJobs = (jobs) => {
  if (!jobs.length) {
    resultsEl.innerHTML = '<p>No jobs found from live sources.</p>';
    return;
  }

  resultsEl.innerHTML = jobs
    .map((job, index) => {
      const source = job.source_platform || job.source || 'Live';
      const applyUrl = job.apply_url || job.url;
      const logo = sourceLogos[source] || source.slice(0, 2).toUpperCase();
      const matchedSkills = job.matchedSkills?.length ? job.matchedSkills.join(', ') : 'None yet';
      const missingSkills = job.missingSkills?.length ? job.missingSkills.join(', ') : 'Not enough detail available';
      const reasons = job.why?.map((reason) => `<li>${reason}</li>`).join('') || '<li>Relevant match</li>';
      const scorePercentage = Math.round((job.score || 0) * 100);
      const description = job.description ? `<p>${job.description.slice(0, 220)}...</p>` : '';

      return `
        <article class="job-card ${index === 0 ? 'best-card' : ''}">
          <div class="job-card-top">
            <span class="source-badge">${logo}</span>
            ${scorePercentage >= 75 ? '<span class="badge best-match">Best Match</span>' : ''}
            <span class="match-score">${scorePercentage}%</span>
          </div>
          <h3><a href="${applyUrl}" target="_blank" rel="noopener noreferrer">${job.title}</a></h3>
          <div class="job-meta small">
            <span>${job.company}</span>
            <span>${job.location}</span>
            <span>${source}</span>
          </div>
          <div class="chips-row">
            ${renderChips([job.work_mode || job.workMode, job.job_type || job.jobType, job.location])}
          </div>
          ${description}
          <div class="job-details">
            <div><strong>Matched Skills:</strong> ${matchedSkills}</div>
            <div><strong>Missing Skills:</strong> ${missingSkills}</div>
          </div>
          <div class="recommendation-why">
            <strong>Why recommended:</strong>
            <ul>${reasons}</ul>
          </div>
          <a class="apply-link" href="${applyUrl}" target="_blank" rel="noopener noreferrer">Apply</a>
        </article>
      `;
    })
    .join('');
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  renderSkeletons();
  resultsDescription.textContent = 'Searching and ranking jobs based on your profile, location, and role preference.';

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

    if (data.success === false) {
      resultsDescription.textContent = data.message || 'No live jobs found from real sources.';
      renderJobs([]);
      return;
    }

    const jobs = data.jobs || data.recommendations || [];
    if (jobs.length) {
      resultsDescription.textContent = `Showing ${jobs.length} live recommendations for ${data.profile?.name || 'your profile'}.`;
    } else {
      resultsDescription.textContent = 'No high-quality matches were found. Adjust your preferences and try again.';
    }
    renderJobs(jobs);
  } catch (error) {
    resultsEl.innerHTML = `<p>Unable to retrieve matches. Please try again later.</p>`;
    resultsDescription.textContent = error.message || '';
    console.error(error);
  }
});
