require('dotenv').config({ quiet: true });

const { refreshJobs } = require('../utils/scraperService');
const { closePool } = require('../utils/db');

const parseProfile = () => {
  if (!process.env.JOB_REFRESH_PROFILE) {
    return undefined;
  }
  try {
    return JSON.parse(process.env.JOB_REFRESH_PROFILE);
  } catch (error) {
    console.warn('[WORKER] Ignoring invalid JOB_REFRESH_PROFILE payload:', error.message);
    return undefined;
  }
};

refreshJobs(parseProfile(), {
  reason: process.env.JOB_REFRESH_REASON || 'worker',
  reembedExisting: process.env.JOB_REFRESH_REEMBED_EXISTING !== 'false',
})
  .then((result) => {
    console.log('[WORKER] Job refresh completed', result);
  })
  .catch((error) => {
    console.error('[WORKER] Job refresh failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => undefined);
  });
