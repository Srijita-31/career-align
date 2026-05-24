const { crawlJobSources } = require('./sourceCrawlers');
const { getJobCount, searchSimilarJobs, storeJobs } = require('./db');

const buildProfileQuery = (profile) => [
  profile.desiredRole && `Desired role: ${profile.desiredRole}`,
  profile.skills?.length && `Skills: ${profile.skills.join(', ')}`,
  profile.experienceLevel && `Experience level: ${profile.experienceLevel}`,
  profile.education && `Education: ${profile.education}`,
  profile.location && `Preferred location: ${profile.location}`,
  profile.workPreference && `Work preference: ${profile.workPreference}`,
  profile.summary && `Resume summary: ${profile.summary}`,
].filter(Boolean).join('\n');

const ensureJobsAvailable = async (profile) => {
  const count = await getJobCount();
  if (count > 0) {
    return { scraped: false, totalPersisted: count };
  }

  console.log('[AGGREGATOR] No persisted jobs found; scraping sources before matching');
  const scrapedJobs = await crawlJobSources(profile);
  const summary = await storeJobs(scrapedJobs);
  const totalPersisted = await getJobCount();
  console.log(`[AGGREGATOR] Scraped ${scrapedJobs.length}; inserted ${summary.inserted}; updated ${summary.updated}; invalid ${summary.invalid}`);
  return { scraped: true, scrapedCount: scrapedJobs.length, totalPersisted, ...summary };
};

const matchJobs = async (profile, limit = 25) => {
  await ensureJobsAvailable(profile);
  const query = buildProfileQuery(profile);
  if (!query) {
    return [];
  }

  const jobs = await searchSimilarJobs(query, limit);
  return jobs.map((job) => ({
    ...job,
    why: ['Embedding similarity between your profile and this scraped job'],
    matchedSkills: (profile.skills || []).filter((skill) => {
      const text = `${job.title} ${job.description} ${(job.skills || []).join(' ')}`.toLowerCase();
      return text.includes(String(skill).toLowerCase());
    }),
    missingSkills: [],
  }));
};

module.exports = { buildProfileQuery, ensureJobsAvailable, matchJobs };
