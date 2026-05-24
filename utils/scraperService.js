require('dotenv').config({ quiet: true });

const { crawlJobSources } = require('./sourceCrawlers');
const { getJobCount, storeJobs } = require('./db');

const DEFAULT_PROFILE = {
  desiredRole: 'software engineer',
  skills: ['javascript', 'python', 'react'],
  location: 'India',
  workPreference: 'remote',
};

const refreshJobs = async (profile = DEFAULT_PROFILE) => {
  const effectiveProfile = {
    ...DEFAULT_PROFILE,
    ...profile,
    skills: profile.skills?.length ? profile.skills : DEFAULT_PROFILE.skills,
  };

  const jobs = await crawlJobSources(effectiveProfile);
  const summary = await storeJobs(jobs);
  const totalPersisted = await getJobCount();

  console.log(`[SCRAPER] Scraped ${jobs.length} jobs from live sources`);
  console.log(`[DB] Inserted ${summary.inserted}, updated ${summary.updated}, invalid ${summary.invalid}`);

  return { scrapedCount: jobs.length, totalPersisted, ...summary };
};

if (require.main === module) {
  refreshJobs()
    .then((result) => {
      console.log('[SCRAPER] Completed refresh', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('[SCRAPER] Refresh failed', error);
      process.exit(1);
    });
}

module.exports = { refreshJobs };
