require('dotenv').config({ quiet: true });

const { crawlJobSources } = require('./sourceCrawlers');
const {
  createScraperRun,
  finishScraperRun,
  getJobCount,
  reembedStaleJobEmbeddings,
  storeJobs,
} = require('./db');
const { appConfig } = require('../config');

const DEFAULT_PROFILE = appConfig.defaultProfile;

const refreshJobs = async (profile = DEFAULT_PROFILE, options = {}) => {
  const effectiveProfile = {
    ...DEFAULT_PROFILE,
    ...profile,
    skills: profile.skills?.length ? profile.skills : DEFAULT_PROFILE.skills,
  };
  const run = await createScraperRun({ profile: effectiveProfile, reason: options.reason || 'worker' });

  try {
    const reembedded = options.reembedExisting === false
      ? { updated: 0 }
      : await reembedStaleJobEmbeddings({ batchSize: options.reembedBatchSize || 50 });
    const jobs = await crawlJobSources(effectiveProfile, { runId: run.id });
    const summary = await storeJobs(jobs);
    const totalPersisted = await getJobCount();
    const report = { scrapedCount: jobs.length, totalPersisted, reembeddedCount: reembedded.updated, ...summary };

    await finishScraperRun({ runId: run.id, status: 'completed', summary: report });

    console.log(`[SCRAPER] Scraped ${jobs.length} jobs from live sources`);
    console.log(`[DB] Re-embedded ${reembedded.updated} stale jobs`);
    console.log(`[DB] Inserted ${summary.inserted}, updated ${summary.updated}, invalid ${summary.invalid}`);

    return { runId: run.id, ...report };
  } catch (error) {
    await finishScraperRun({ runId: run.id, status: 'failed', errorMessage: error.message });
    throw error;
  }
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
