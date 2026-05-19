const cron = require('node-cron');
const { refreshJobs } = require('../utils/scraperService');

const DEFAULT_PROFILE = {
  desiredRole: 'software engineer',
  skills: ['javascript', 'python', 'react'],
  location: 'India',
  workPreference: 'remote',
};

const startScrapeScheduler = () => {
  cron.schedule('0 */6 * * *', async () => {
    console.log('[SCHEDULER] Running scheduled scraper at', new Date().toISOString());
    try {
      await refreshJobs(DEFAULT_PROFILE);
      console.log('[SCHEDULER] Scraper completed successfully');
    } catch (error) {
      console.error('[SCHEDULER] Scraper failed', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });

  console.log('[SCHEDULER] Job refresh scheduler is active and will run every 6 hours');
};

module.exports = { startScrapeScheduler };
