const appConfig = require('./app.json');
const rules = require('./rules.json');
const scoring = require('./scoring.json');
const sourceConfig = require('./sources.json');

const csv = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const getJobSources = () => {
  const envSources = csv(process.env.JOB_SOURCES);
  if (envSources.length) {
    return envSources;
  }
  const enabledSources = sourceConfig.sources
    .filter((source) => source.enabled)
    .map((source) => source.platform);
  return enabledSources.length ? enabledSources : appConfig.jobSources;
};

const getJobTermLimit = () => Number(process.env.JOB_TERM_LIMIT || appConfig.jobTermLimit);

const getScheduler = () => ({
  ...appConfig.scheduler,
  cron: process.env.SCRAPE_CRON || appConfig.scheduler.cron,
  timezone: process.env.SCRAPE_TIMEZONE || appConfig.scheduler.timezone,
});

module.exports = {
  appConfig,
  rules,
  scoring,
  sourceConfig,
  getJobSources,
  getJobTermLimit,
  getScheduler,
};
