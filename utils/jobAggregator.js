const { crawlJobSources } = require('./sourceCrawlers');
const { getAllJobs, storeJobs } = require('./db');

const normalize = (value) => String(value || '').toLowerCase();
const splitTerms = (text = '') => normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
const isValidUrl = (value) => {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) && !/localhost|127\.0\.0\.1|example\.com|example\.|placeholder|dummy|fallback/i.test(url);
};

const citiesIndia = [
  'bangalore', 'hyderabad', 'pune', 'chennai', 'mumbai', 'kolkata', 'gurgaon', 'noida', 'delhi', 'ahmedabad', 'remote india', 'india',
];
const avoidRegions = ['usa', 'us', 'canada', 'europe', 'australia', 'uk', 'germany', 'france', 'america'];
const seniorKeywords = /senior|lead|staff|principal|manager|director|vp|vice president/;
const entryKeywords = /intern|internship|trainee|junior|associate|graduate|fresher|entry level|student/;

const roleBoostSets = [
  {
    match: /software engineer|software developer|swe|developer|programmer|coding engineer/,
    boosts: [/backend developer/, /full stack developer/, /full-stack developer/, /python developer/, /software developer/, /swe intern/, /frontend developer/, /web developer/, /software engineer/],
    penalties: [/managerial|manager|architect|principal|director|data scientist|business analyst|consultant|staff engineer/],
  },
  {
    match: /data analyst|business analyst|analytics|data science|ml|machine learning/,
    boosts: [/data analyst/, /data science/, /analytics/, /machine learning/, /data engineer/, /business analyst/],
    penalties: [/managerial|manager|architect|principal|director|product manager/],
  },
];

const commonSkills = [
  'javascript', 'react', 'node', 'express', 'html', 'css', 'python', 'django', 'flask',
  'java', 'spring', 'sql', 'postgresql', 'mysql', 'mongodb', 'aws', 'azure', 'docker',
  'kubernetes', 'git', 'rest api', 'graphql', 'tableau', 'power bi', 'pandas', 'numpy',
  'tensorflow', 'machine learning', 'jquery', 'bootstrap', 'linux', 'firebase', 'c++', 'c#',
  'data analysis', 'excel', 'spark', 'hadoop', 'seo', 'docker-compose', 'ci/cd', 'reactjs', 'node.js'
];

const normalizeSkill = (skill) => normalize(skill).replace(/\s+/g, ' ');
const buildJobSkillSet = (job) => {
  const text = normalize(`${job.title} ${job.description} ${job.skills?.join(' ') || ''}`);
  return Array.from(new Set(commonSkills.filter((skill) => text.includes(normalizeSkill(skill)))));
};

const getCandidateLevel = (experienceLevel) => {
  const normalized = normalize(experienceLevel);
  if (/intern|student|fresher|trainee|entry/.test(normalized)) return 'entry';
  if (/mid|associate|experienced/.test(normalized)) return 'mid';
  if (/senior|lead|manager|principal/.test(normalized)) return 'senior';
  return 'entry';
};

const getJobSeniority = (job) => {
  const text = normalize(`${job.title} ${job.description} ${job.skills?.join(' ') || ''}`);
  if (seniorKeywords.test(text)) return 'senior';
  if (entryKeywords.test(text)) return 'entry';
  return 'mid';
};

const getRoleAffinity = (desiredRole, job) => {
  const jobText = normalize(`${job.title} ${job.description} ${job.skills?.join(' ') || ''}`);
  const roleText = normalize(desiredRole);
  const group = roleBoostSets.find((entry) => entry.match.test(roleText));
  const directMatch = roleText && jobText.includes(roleText) ? 1 : 0;
  const partialMatch = roleText && roleText.split(' ').every((term) => term && jobText.includes(term)) ? 0.85 : 0;
  if (!group) return Math.max(directMatch, partialMatch);

  const boost = group.boosts.some((pattern) => pattern.test(jobText));
  const penalty = group.penalties.some((pattern) => pattern.test(jobText));
  const affinity = Math.max(directMatch, partialMatch, boost ? 1 : 0);
  return Math.max(0, Math.min(1, affinity - (penalty ? 0.5 : 0)));
};

const getLocationScore = (profile, job) => {
  const desired = normalize(`${profile.location} ${profile.workPreference}`);
  const jobText = normalize(`${job.location} ${job.description} ${job.title}`);

  const isIndiaPref = /india|anywhere in india|remote india|indian/.test(desired);
  const isRemotePref = /remote/.test(desired);
  const isHybridPref = /hybrid/.test(desired);

  const inIndianCity = citiesIndia.some((city) => jobText.includes(city));
  const hasRemote = /remote|work from home|wfh|work-from-home/.test(jobText);
  const isOffshoreAvoid = avoidRegions.some((region) => jobText.includes(region));

  if (isIndiaPref) {
    if (inIndianCity) return 1;
    if (hasRemote && /india/.test(jobText)) return 0.9;
    if (hasRemote) return 0.7;
    if (isOffshoreAvoid) return 0;
    return 0.5;
  }

  if (isRemotePref) {
    if (hasRemote) return 1;
    if (normalize(job.location).includes('remote')) return 1;
    return 0.4;
  }

  if (isHybridPref) {
    if (/hybrid/.test(jobText)) return 1;
    if (hasRemote) return 0.8;
  }

  if (profile.location) {
    const locationMatch = normalize(job.location || '').includes(normalize(profile.location));
    if (locationMatch) return 1;
    if (inIndianCity && /india/.test(desired)) return 0.8;
  }

  if (isOffshoreAvoid) return 0.1;
  return 0.5;
};

const getWorkModeScore = (profile, job) => {
  const preference = normalize(profile.workPreference);
  const jobMode = normalize(`${job.work_mode || ''}`);

  if (preference === 'remote') return /remote|wfh/.test(jobMode) ? 1 : 0.4;
  if (preference === 'hybrid') return /hybrid/.test(jobMode) ? 1 : /remote|wfh/.test(jobMode) ? 0.8 : 0.6;
  if (preference === 'onsite') return /onsite|office/.test(jobMode) ? 1 : 0.5;
  return 0.6;
};

const dedupeJobs = (jobs) => {
  const seen = new Map();
  return jobs.filter((job) => {
    const key = `${normalize(job.title)}|${normalize(job.company)}|${normalize(job.location)}|${normalize(job.source_platform || job.source)}|${normalize(job.apply_url || job.url)}`;
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
};

const aggregateJobs = async (profile) => {
  const storedJobs = await getAllJobs();
  if (storedJobs.length > 0) {
    console.log(`[AGGREGATOR] Returning ${storedJobs.length} persisted live jobs`);
    return dedupeJobs(storedJobs);
  }

  console.log('[AGGREGATOR] No persisted jobs available; scraping live sources for this match request');
  const scrapedJobs = await crawlJobSources(profile);
  const summary = await storeJobs(scrapedJobs);
  const refreshedJobs = await getAllJobs();
  console.log(`[AGGREGATOR] Scraped ${scrapedJobs.length} live jobs; inserted ${summary.inserted}, updated ${summary.updated}, invalid ${summary.invalid}`);
  console.log(`[AGGREGATOR] Matcher can read ${refreshedJobs.length} persisted jobs after scrape`);
  return dedupeJobs(refreshedJobs);
};

const computeMatchScore = (profile, job) => {
  const profileSkills = new Set((profile.skills || []).map(normalize).filter(Boolean));
  const jobSkills = buildJobSkillSet(job);
  const matchedSkills = jobSkills.filter((skill) => profileSkills.has(normalize(skill)));
  const missingSkills = jobSkills.filter((skill) => !profileSkills.has(normalize(skill))).slice(0, 5);

  const skillOverlap = profileSkills.size ? matchedSkills.length / profileSkills.size : 0;
  const skillCoverage = jobSkills.length ? matchedSkills.length / jobSkills.length : 0;
  const skillScore = Math.min(1, skillOverlap * 0.55 + skillCoverage * 0.45);

  const roleScore = getRoleAffinity(profile.desiredRole || '', job);
  const locationScore = getLocationScore(profile, job);
  const workModeScore = getWorkModeScore(profile, job);

  const candidateLevel = getCandidateLevel(profile.experienceLevel || 'entry');
  const jobLevel = getJobSeniority(job);
  let levelScore = 0.6;
  if (candidateLevel === 'entry') {
    levelScore = jobLevel === 'entry' ? 1 : jobLevel === 'mid' ? 0.6 : 0;
  } else if (candidateLevel === 'mid') {
    levelScore = jobLevel === 'entry' ? 0.6 : jobLevel === 'mid' ? 1 : 0.75;
  } else {
    levelScore = jobLevel === 'senior' ? 1 : jobLevel === 'mid' ? 0.75 : 0.4;
  }

  const matchedSenior = candidateLevel === 'entry' && seniorKeywords.test(normalize(`${job.title} ${job.description}`));

  let rawScore =
    skillScore * 0.38 +
    roleScore * 0.22 +
    levelScore * 0.2 +
    locationScore * 0.13 +
    workModeScore * 0.07;

  if (matchedSenior) {
    rawScore = Math.max(0, rawScore - 0.35);
  }

  const calibrated = Math.min(1, Math.max(0, rawScore + 0.12));
  const score = Number(calibrated.toFixed(2));

  const reasons = [];
  if (matchedSkills.length) {
    reasons.push(`Strong ${matchedSkills.slice(0, 3).join(', ')} overlap`);
  }
  if (roleScore >= 0.8) reasons.push('Role-specific match');
  if (locationScore >= 0.85) reasons.push('Location preference aligned');
  if (workModeScore >= 0.8) reasons.push('Work mode match');
  if (candidateLevel === 'entry' && jobLevel === 'entry') reasons.push('Entry-level friendly');
  if (!reasons.length) reasons.push('Relevant skills and role alignment');

  return {
    score,
    matchedSkills,
    missingSkills,
    why: reasons,
    candidateLevel,
    jobLevel,
    locationScore,
    roleScore,
    workModeScore,
  };
};

const matchJobs = (profile, jobs, threshold = 0.4) => {
  const validJobs = jobs.filter((job) => {
    const sourcePlatform = String(job.source_platform || job.source || '').toLowerCase();
    return job.title && job.apply_url && isValidUrl(job.apply_url) && sourcePlatform !== 'fallback';
  });

  console.log(`[AGGREGATOR] Matching ${validJobs.length} live jobs against profile with threshold ${threshold}`);

  const scored = validJobs
    .map((job) => ({ ...job, ...computeMatchScore(profile, job) }))
    .filter((job) => job.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  console.log(`[AGGREGATOR] ${scored.length} jobs passed the threshold`);
  return scored;
};

module.exports = { aggregateJobs, matchJobs, computeMatchScore };
