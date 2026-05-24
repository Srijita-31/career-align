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
    resultsEl.innerHTML = '<p>No embedded jobs found yet. Refresh scraped jobs and try again.</p>';
    return;
  }

  resultsEl.innerHTML = jobs
    .map((job, index) => {
      const source = job.source_platform || job.source || 'Live';
      const applyUrl = job.apply_url || job.url;
      const logo = sourceLogos[source] || source.slice(0, 2).toUpperCase();
      const matchedSkills = job.matchedSkills?.length ? job.matchedSkills.join(', ') : 'Not detected';
      const reasons = job.why?.map((reason) => `<li>${reason}</li>`).join('') || '<li>Relevant match</li>';
      const scorePercentage = Math.round((job.score || 0) * 100);
      const description = job.description ? `<p>${job.description.slice(0, 220)}...</p>` : '';

      return `
        <article class="job-card ${index === 0 ? 'best-card' : ''}">
          <div class="job-card-top">
            <span class="source-badge">${logo}</span>
            ${scorePercentage >= 75 ? '<span class="badge best-match">High Similarity</span>' : ''}
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
            <div><strong>Similarity score:</strong> ${scorePercentage}%</div>
            <div><strong>Detected overlap:</strong> ${matchedSkills}</div>
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
  resultsDescription.textContent = 'Embedding your input and comparing it with stored job embeddings.';

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
      resultsDescription.textContent = `Showing ${jobs.length} similarity-ranked jobs for ${data.profile?.name || 'your profile'}.`;
    } else {
      resultsDescription.textContent = 'No embedded jobs are available yet. Refresh scraped jobs and try again.';
    }
    renderJobs(jobs);
  } catch (error) {
    resultsEl.innerHTML = `<p>Unable to retrieve matches. Please try again later.</p>`;
    resultsDescription.textContent = error.message || '';
    console.error(error);
  }
});
