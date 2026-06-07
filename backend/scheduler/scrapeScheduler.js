const cron = require('node-cron');
const { queueJobRefresh } = require('../utils/jobRefreshQueue');
const { appConfig, getScheduler } = require('../config');

const DEFAULT_PROFILE = appConfig.defaultProfile;

const startScrapeScheduler = () => {
  const scheduler = getScheduler();
  cron.schedule(scheduler.cron, async () => {
    console.log('[SCHEDULER] Running scheduled scraper at', new Date().toISOString());
    try {
      const queued = queueJobRefresh(DEFAULT_PROFILE, 'schedule');
      console.log('[SCHEDULER] Background scraper status', queued);
    } catch (error) {
      console.error('[SCHEDULER] Unable to queue scraper', error);
    }
  }, {
    scheduled: true,
    timezone: scheduler.timezone,
  });

  console.log(`[SCHEDULER] Job refresh scheduler is active and will run ${scheduler.description || scheduler.cron}`);
};

module.exports = { startScrapeScheduler };
