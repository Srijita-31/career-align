const { crawlJobSources } = require('./sourceCrawlers');
const { storeJobs } = require('./db');

const DEFAULT_PROFILE = {
  desiredRole: 'software engineer',
  skills: ['javascript', 'python', 'react'],
  location: 'India',
  workPreference: 'remote',
};

const refreshJobs = async (profile = DEFAULT_PROFILE) => {
  const effectiveProfile = {
    desiredRole: profile.desiredRole || DEFAULT_PROFILE.desiredRole,
    skills: profile.skills && profile.skills.length ? profile.skills : DEFAULT_PROFILE.skills,
    location: profile.location || DEFAULT_PROFILE.location,
    workPreference: profile.workPreference || DEFAULT_PROFILE.workPreference,
  };

  const jobs = await crawlJobSources(effectiveProfile);
  const summary = await storeJobs(jobs);
  console.log(`[DB] Inserted ${summary.inserted} new jobs`);
  console.log(`[DB] Updated ${summary.updated} existing jobs`);
  console.log(`[DB] Skipped ${summary.skipped} duplicates`);
  return { scrapedCount: jobs.length, ...summary };
};

if (require.main === module) {
  (async () => {
    try {
      const result = await refreshJobs();
      console.log('[SCRAPER] Completed refresh', result);
      process.exit(0);
    } catch (error) {
      console.error('[SCRAPER] Refresh failed', error);
      process.exit(1);
    }
  })();
}

module.exports = { refreshJobs };
