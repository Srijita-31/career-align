const form = document.getElementById('matchForm');
const resultsEl = document.getElementById('results');
const resultsDescription = document.getElementById('resultsDescription');

const sourceLogos = {
  LinkedIn: 'LI',
  Naukri: 'NK',
  Internshala: 'IN',
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
    resultsEl.innerHTML = '<p>No relevant jobs were found. Try broadening your skills, updating your role, or changing location preference.</p>';
    return;
  }

  resultsEl.innerHTML = jobs
    .map((job, index) => {
      const logo = sourceLogos[job.source] || job.source.slice(0, 2).toUpperCase();
      const matchedSkills = job.matchedSkills?.length ? job.matchedSkills.join(', ') : 'None yet';
      const missingSkills = job.missingSkills?.length ? job.missingSkills.join(', ') : 'Not enough detail available';
      const reasons = job.why?.map((reason) => `<li>${reason}</li>`).join('') || '<li>Relevant match</li>';
      const scorePercentage = Math.round((job.score || 0) * 100);

      return `
        <article class="job-card ${index === 0 ? 'best-card' : ''}">
          <div class="job-card-top">
            <span class="source-badge">${logo}</span>
            ${scorePercentage >= 75 ? '<span class="badge best-match">Best Match</span>' : ''}
            <span class="match-score">${scorePercentage}%</span>
          </div>
          <h3><a href="${job.url}" target="_blank" rel="noopener noreferrer">${job.title}</a></h3>
          <div class="job-meta small">
            <span>${job.company}</span>
            <span>${job.location}</span>
            <span>${job.source}</span>
          </div>
          <div class="chips-row">
            ${renderChips([job.workMode, job.jobType, job.location])}
          </div>
          <p>${job.description?.slice(0, 220) || 'No description available.'}...</p>
          <div class="job-details">
            <div><strong>Matched Skills:</strong> ${matchedSkills}</div>
            <div><strong>Missing Skills:</strong> ${missingSkills}</div>
          </div>
          <div class="recommendation-why">
            <strong>Why recommended:</strong>
            <ul>${reasons}</ul>
          </div>
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

    if (!response.ok) {
      throw new Error('Request failed');
    }

    const data = await response.json();
    if (data.recommendations?.length) {
      resultsDescription.textContent = `Showing ${data.recommendations.length} high-quality recommendations for ${data.profile.name}.`;
    } else {
      resultsDescription.textContent = 'No high-quality matches were found. Adjust your preferences and try again.';
    }
    renderJobs(data.recommendations || []);
  } catch (error) {
    resultsEl.innerHTML = `<p>Unable to retrieve matches. Please try again later.</p>`;
    resultsDescription.textContent = '';
    console.error(error);
  }
});
