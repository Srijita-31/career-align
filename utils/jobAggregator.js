const { crawlJobSources } = require('./sourceCrawlers');
const { getAllJobs, getJobCount, searchSimilarJobs, storeJobs } = require('./db');
const {
  enrichJob: enrichStructuredJob,
  extractSkillTerms,
  normalizeKeyPart,
  unique,
} = require('./enrichment');

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into',
  'is', 'it', 'of', 'on', 'or', 'our', 'the', 'to', 'with', 'you', 'your',
  'we', 'will', 'work', 'team', 'role', 'job', 'candidate', 'experience',
]);

const buildProfileQuery = (profile) => [
  profile.semanticSearch && `Search intent: ${profile.semanticSearch}`,
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

const isOpenAIQuotaError = (error) => {
  const message = String(error?.message || '');
  return error?.status === 429 || /quota|billing|rate limit/i.test(message);
};

const tokenize = (value) => normalizeKeyPart(value)
  .split(/\s+/)
  .filter((token) => token.length > 1 && !STOPWORDS.has(token));

const includesPhrase = (text, phrase) => {
  const escaped = normalizeKeyPart(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|\\b)${escaped}(\\b|$)`, 'i').test(normalizeKeyPart(text));
};

const extractRequiredSkills = (job) => {
  const explicit = Array.isArray(job.required_skills) && job.required_skills.length
    ? job.required_skills
    : Array.isArray(job.skills) ? job.skills : [];
  const text = [
    job.title,
    job.description,
    job.role_family,
    explicit.join(' '),
  ].join(' ');
  const skills = [...extractSkillTerms(explicit)];

  return unique([...skills, ...extractSkillTerms(text)]).slice(0, 12);
};

const getMatchedSkills = (candidateSkills, requiredSkills, job) => {
  const text = normalizeKeyPart([
    job.title,
    job.description,
    ...(job.skills || []),
  ].join(' '));
  const required = new Set(requiredSkills.map(normalizeKeyPart));

  return candidateSkills
    .filter((skill) => {
      const normalized = normalizeKeyPart(skill);
      return normalized.length > 1 && (required.has(normalized) || includesPhrase(text, normalized));
    })
    .slice(0, 5);
};

const overlapScore = (left, right) => {
  const leftTerms = new Set(tokenize(left));
  const rightTerms = new Set(tokenize(right));
  if (!leftTerms.size || !rightTerms.size) {
    return 0;
  }
  const hits = [...leftTerms].filter((term) => rightTerms.has(term)).length;
  return hits / Math.max(leftTerms.size, rightTerms.size);
};

const experienceScore = (profileLevel, job) => {
  const level = normalizeKeyPart(profileLevel);
  const text = normalizeKeyPart(`${job.title} ${job.description} ${job.job_type || ''}`);
  if (!level) {
    return 0.5;
  }
  if (text.includes(level)) {
    return 1;
  }
  if (/student|intern|fresher|entry/.test(level) && /intern|junior|fresher|entry|graduate/.test(text)) {
    return 0.9;
  }
  if (/mid/.test(level) && /mid|software engineer|developer/.test(text) && !/senior|lead|principal/.test(text)) {
    return 0.75;
  }
  if (/senior/.test(level) && /senior|lead|principal|staff/.test(text)) {
    return 0.9;
  }
  if (/senior|staff|lead|principal/.test(text) && /student|intern|fresher|entry/.test(level)) {
    return 0.2;
  }
  return 0.55;
};

const locationScore = (preference, job) => {
  const preferred = normalizeKeyPart(preference);
  const location = normalizeKeyPart(`${job.location || ''} ${job.description || ''}`);
  const mode = normalizeKeyPart(job.work_mode || job.workMode);
  if (!preferred || preferred === 'anywhere') {
    return 0.7;
  }
  if (preferred === 'india') {
    if (location.includes('india')) {
      return 1;
    }
    if (mode.includes('remote') || location.includes('remote')) {
      return 0.75;
    }
    return 0.45;
  }
  if (preferred === 'outside india') {
    if (mode.includes('remote') || location.includes('remote')) {
      return 0.85;
    }
    if (!location.includes('india')) {
      return 0.8;
    }
    return 0.35;
  }
  if (preferred.includes('remote') && (location.includes('remote') || mode.includes('remote'))) {
    return 1;
  }
  if (location.includes(preferred) || preferred.includes(location)) {
    return 1;
  }
  return 0.35;
};

const workModeScore = (preference, job) => {
  const preferred = normalizeKeyPart(preference);
  const mode = normalizeKeyPart(`${job.work_mode || job.workMode || ''} ${job.location || ''}`);
  if (!preferred) {
    return 0.7;
  }
  if (mode.includes(preferred)) {
    return 1;
  }
  if (preferred === 'remote' && mode.includes('hybrid')) {
    return 0.55;
  }
  return 0.25;
};

const normalizedSemanticScore = (score) => {
  const cosine = Math.max(-1, Math.min(1, Number(score) || 0));
  return Math.max(0, Math.min(1, (cosine - 0.2) / 0.55));
};

const roleFamilyScore = (profile, job) => {
  if (!profile.roleFamily || !job.role_family) {
    return 0.6;
  }
  return normalizeKeyPart(profile.roleFamily) === normalizeKeyPart(job.role_family) ? 1 : 0.45;
};

const seniorityFitScore = (profile, job) => {
  const profileLevel = normalizeKeyPart(profile.seniority || profile.experienceLevel);
  const jobLevel = normalizeKeyPart(job.seniority);
  if (!profileLevel || !jobLevel) {
    return experienceScore(profile.experienceLevel, job);
  }
  if (profileLevel === jobLevel) {
    return 1;
  }
  if (/student|intern|fresher|entry/.test(profileLevel) && /intern|entry/.test(jobLevel)) {
    return 0.9;
  }
  if (/mid/.test(profileLevel) && /entry|mid/.test(jobLevel)) {
    return 0.85;
  }
  if (/senior/.test(profileLevel) && /mid|senior/.test(jobLevel)) {
    return 0.85;
  }
  if (/senior|lead|principal/.test(jobLevel) && /student|intern|fresher|entry/.test(profileLevel)) {
    return 0.15;
  }
  return 0.55;
};

const buildExplanation = (profile, job, matchedSkills, missingSkills) => {
  const role = profile.desiredRole || profile.semanticSearch || 'your target role';
  const strongest = matchedSkills.slice(0, 3);
  const missing = missingSkills.slice(0, 2);
  const bits = [];

  if (strongest.length) {
    bits.push(`This role matches your ${strongest.join(', ')} experience and lines up with your interest in ${role}.`);
  } else {
    bits.push(`This role is semantically close to your ${role} search, especially based on the job title and description.`);
  }

  if (job.role_family) {
    bits.push(`It is classified as ${job.role_family}${job.seniority ? ` at ${job.seniority} level` : ''}, then compared against your role, location, and work mode preferences.`);
  } else {
    bits.push(`Your ${profile.experienceLevel || 'candidate'} profile is compared against the role requirements, location preference, and work mode to produce this ranking.`);
  }

  if (missing.length) {
    bits.push(`Building ${missing.join(', ')} would make you a stronger fit.`);
  }

  return bits.slice(0, 3).join(' ');
};

const recommendNextSkills = (missingSkills) => missingSkills.slice(0, 3);

const enrichJob = (profile, job) => {
  const structured = enrichStructuredJob(job);
  const enrichedSource = { ...job, ...structured };
  const candidateSkills = extractSkillTerms(profile.skills || []);
  const requiredSkills = extractRequiredSkills(enrichedSource);
  const matchedSkills = getMatchedSkills(candidateSkills, requiredSkills, enrichedSource);
  const missingSkills = requiredSkills
    .filter((skill) => !matchedSkills.map(normalizeKeyPart).includes(normalizeKeyPart(skill)))
    .slice(0, 5);

  const skillComponent = requiredSkills.length
    ? Math.max(
      matchedSkills.length / requiredSkills.length,
      matchedSkills.length / Math.max(candidateSkills.length, 1)
    )
    : matchedSkills.length ? 0.8 : 0;
  const roleComponent = Math.max(
    overlapScore(`${profile.desiredRole || ''} ${profile.semanticSearch || ''}`, enrichedSource.title),
    normalizedSemanticScore(enrichedSource.score)
  );
  const weightedScore =
    (skillComponent * 35) +
    (roleComponent * 25) +
    (roleFamilyScore(profile, enrichedSource) * 10) +
    (seniorityFitScore(profile, enrichedSource) * 12) +
    (locationScore(profile.location, enrichedSource) * 10) +
    (workModeScore(profile.workPreference, enrichedSource) * 8);
  const score = Math.max(0, Math.min(100, Math.round(weightedScore)));

  return {
    ...enrichedSource,
    source_platform: enrichedSource.source_platform || enrichedSource.source,
    apply_url: enrichedSource.apply_url || enrichedSource.url,
    requiredSkills,
    niceToHaveSkills: enrichedSource.nice_to_have_skills || [],
    matchedSkills: matchedSkills.slice(0, 5),
    missingSkills,
    recommendedNextSkills: recommendNextSkills(missingSkills),
    skillGap: {
      matched: matchedSkills.slice(0, 5),
      missing: missingSkills,
      recommended: recommendNextSkills(missingSkills),
    },
    score,
    rawSemanticScore: Number((Number(enrichedSource.score) || 0).toFixed(4)),
    matchBreakdown: {
      skills: Math.round(skillComponent * 100),
      semantic: Math.round(roleComponent * 100),
      roleFamily: Math.round(roleFamilyScore(profile, enrichedSource) * 100),
      seniority: Math.round(seniorityFitScore(profile, enrichedSource) * 100),
      location: Math.round(locationScore(profile.location, enrichedSource) * 100),
      workMode: Math.round(workModeScore(profile.workPreference, enrichedSource) * 100),
    },
    why: [buildExplanation(profile, enrichedSource, matchedSkills, missingSkills)],
  };
};

const newestTimestamp = (job) => new Date(job.updated_at || job.created_at || job.posted_date || 0).getTime() || 0;

const mergeArrays = (...arrays) => unique(arrays.flat().filter(Boolean));

const dedupeJobs = (jobs) => {
  const byKey = new Map();

  jobs.forEach((job) => {
    const key = [
      normalizeKeyPart(job.title),
      normalizeKeyPart(job.company),
      normalizeKeyPart(job.location),
    ].join('|');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, job);
      return;
    }

    const winner = Number(job.score) > Number(existing.score) ? job : existing;
    const other = winner === job ? existing : job;
    byKey.set(key, {
      ...other,
      ...winner,
      source: mergeArrays(existing.source, job.source).join(', '),
      source_platform: mergeArrays(existing.source_platform, job.source_platform).join(', '),
      skills: mergeArrays(existing.skills || [], job.skills || []),
      requiredSkills: mergeArrays(existing.requiredSkills || [], job.requiredSkills || []),
      matchedSkills: mergeArrays(existing.matchedSkills || [], job.matchedSkills || []).slice(0, 5),
      missingSkills: mergeArrays(existing.missingSkills || [], job.missingSkills || []).slice(0, 5),
      recommendedNextSkills: mergeArrays(existing.recommendedNextSkills || [], job.recommendedNextSkills || []).slice(0, 3),
      updated_at: newestTimestamp(job) > newestTimestamp(existing) ? job.updated_at : existing.updated_at,
      created_at: newestTimestamp(job) > newestTimestamp(existing) ? job.created_at : existing.created_at,
    });
  });

  return [...byKey.values()];
};

const localRankJobs = (profile, jobs, limit = 25) => dedupeJobs(jobs.map((job) => enrichJob(profile, { ...job, score: 0.35 })))
  .sort((a, b) => b.score - a.score)
  .slice(0, limit);

const matchJobs = async (profile, limit = 25) => {
  const query = buildProfileQuery(profile);
  if (!query) {
    return [];
  }

  try {
    await ensureJobsAvailable(profile);
    const jobs = await searchSimilarJobs(query, limit * 4);
    return dedupeJobs(jobs.map((job) => enrichJob(profile, job)))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    if (!isOpenAIQuotaError(error)) {
      throw error;
    }

    console.warn('[AGGREGATOR] OpenAI quota unavailable; using local overlap ranking');
    const persistedJobs = await getAllJobs().catch(() => []);
    const jobs = persistedJobs.length ? persistedJobs : await crawlJobSources(profile);
    return localRankJobs(profile, jobs, limit);
  }
};

module.exports = { buildProfileQuery, ensureJobsAvailable, matchJobs };
