const { crawlJobSources } = require('./sourceCrawlers');
const { getAllJobs, getJobCount, searchSimilarJobs } = require('./db');
const {
  enrichJob: enrichStructuredJob,
  extractSkillTerms,
  normalizeKeyPart,
  unique,
} = require('./enrichment');
const { queueJobRefresh } = require('./jobRefreshQueue');
const { scoring } = require('../config');

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into',
  'is', 'it', 'of', 'on', 'or', 'our', 'the', 'to', 'with', 'you', 'your',
  'we', 'will', 'work', 'team', 'role', 'job', 'candidate', 'experience',
]);

const HIGH_PRIORITY_SKILLS = new Set([
  'python',
  'machine learning',
  'natural language processing',
  'nlp',
  'deep learning',
  'data science',
  'tensorflow',
  'pytorch',
  'scikit learn',
  'sql',
  'llm',
  'rag',
]);

const LOW_PRIORITY_SKILLS = new Set([
  'html',
  'css',
  'tailwind css',
  'sass',
]);

const buildProfileQuery = (profile) => [
  `Role: ${profile.desiredRole || profile.semanticSearch || profile.roleFamily || 'Technology candidate'}`,
  profile.roleFamily && `Domain: ${profile.roleFamily}`,
  profile.skills?.length && `Skills: ${profile.skills.join(' ')}`,
  `Experience: ${profile.seniority || profile.experienceLevel || 'Fresher'}`,
  profile.semanticSearch && `Preferred Roles: ${profile.semanticSearch}`,
  profile.education && `Education: ${profile.education}`,
  profile.location && `Preferred location: ${profile.location}`,
  profile.workPreference && `Work preference: ${profile.workPreference}`,
  profile.summary && `Summary: ${profile.summary}`,
].filter(Boolean).join('\n');

const ensureJobsAvailable = async (profile) => {
  const count = await getJobCount();
  if (count > 0) {
    return { scraped: false, totalPersisted: count };
  }

  const queued = queueJobRefresh(profile, 'empty_inventory');
  console.log('[AGGREGATOR] No persisted jobs found; queued background refresh', queued);
  return { scraped: false, queuedRefresh: queued, totalPersisted: count };
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

const canonicalSkillKey = (skill) => normalizeKeyPart(skill);

const skillWeight = (skill) => {
  const key = canonicalSkillKey(skill);
  if (HIGH_PRIORITY_SKILLS.has(key)) return 1.35;
  if (LOW_PRIORITY_SKILLS.has(key)) return 0.7;
  return 1;
};

const getMatchedSkills = (candidateSkills, requiredSkills) => {
  const required = new Set(requiredSkills.map(normalizeKeyPart));

  return candidateSkills
    .filter((skill) => {
      const normalized = normalizeKeyPart(skill);
      return normalized.length > 1 && required.has(normalized);
    })
    .slice(0, 8);
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
  const location = normalizeKeyPart(job.location || '');
  const description = normalizeKeyPart(job.description || '');
  const mode = normalizeKeyPart(`${job.work_mode || job.workMode || ''} ${job.remote_type || ''}`);
  const isRemote = mode.includes('remote') || location.includes('remote') || description.includes('remote');
  const isIndiaJob = location.includes('india') || /bangalore|bengaluru|mumbai|delhi|pune|hyderabad|chennai|kolkata|gurugram|gurgaon|noida/.test(location);
  const prefersRemote = preferred.includes('remote');
  if (!preferred || preferred === 'anywhere') {
    return isRemote ? 0.55 : 0.7;
  }
  if (preferred === 'india') {
    if (isIndiaJob) return 0.7;
    if (isRemote) return 0.4;
    return 0.1;
  }
  if (preferred === 'outside india') {
    if (isRemote) return 0.7;
    if (!isIndiaJob) return 0.7;
    return 0.1;
  }
  if (prefersRemote && isRemote) {
    return 1;
  }
  if (location.includes(preferred) || preferred.includes(location)) {
    return 1;
  }
  if (isIndiaJob && preferred.includes('india')) {
    return 0.7;
  }
  if (isRemote) {
    return prefersRemote ? 1 : 0.4;
  }
  return 0.1;
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
  return Math.max(0, Math.min(1, (cosine - scoring.semanticNormalization.minimumCosine) / scoring.semanticNormalization.range));
};

const roleFamilyScore = (profile, job) => {
  if (!profile.roleFamily || !job.role_family) {
    return 0.6;
  }
  const profileFamily = normalizeKeyPart(profile.roleFamily);
  const jobFamily = normalizeKeyPart(job.role_family);
  if (profileFamily === jobFamily) {
    return 1;
  }
  if (
    (profileFamily === 'ai and machine learning' && jobFamily === 'data and analytics') ||
    (profileFamily === 'data and analytics' && jobFamily === 'ai and machine learning') ||
    (profileFamily === 'backend engineering' && jobFamily === 'full stack engineering') ||
    (profileFamily === 'frontend engineering' && jobFamily === 'full stack engineering')
  ) {
    return 0.65;
  }
  return 0.4;
};

const seniorityFitScore = (profile, job) => {
  const profileLevel = normalizeKeyPart(profile.seniority || profile.experienceLevel);
  const jobLevel = normalizeKeyPart(job.seniority);
  const years = Number(job.minimum_experience_years) || 0;
  if (!profileLevel || !jobLevel) {
    return experienceScore(profile.experienceLevel, job);
  }
  if (profileLevel === jobLevel) {
    return 1;
  }
  if (/student|intern|fresher|entry/.test(profileLevel)) {
    if (/intern|entry/.test(jobLevel) || years <= 1) return 1;
    if (/mid/.test(jobLevel) || years < 5) return 0.5;
    if (/senior|lead|principal|staff|architect/.test(jobLevel) || years >= 5) return 0.1;
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

const skillFitDetails = (matchedSkills, requiredSkills, roleComponent) => {
  if (!requiredSkills.length) {
    return {
      score: matchedSkills.length ? 0.25 : 0,
      detectedRequiredCount: 0,
      matchedRequiredCount: 0,
      evidenceConfidence: 'low',
      notes: ['Skill score is low-confidence because required skills were not clearly detected.'],
    };
  }
  const matchedKeys = new Set(matchedSkills.map(canonicalSkillKey));
  const totalWeight = requiredSkills.reduce((sum, skill) => sum + skillWeight(skill), 0);
  const matchedWeight = requiredSkills.reduce((sum, skill) => (
    matchedKeys.has(canonicalSkillKey(skill)) ? sum + skillWeight(skill) : sum
  ), 0);
  const rawScore = totalWeight ? matchedWeight / totalWeight : 0;
  const matchedRequiredCount = requiredSkills.filter((skill) => matchedKeys.has(canonicalSkillKey(skill))).length;
  const evidenceConfidence = requiredSkills.length >= 4 ? 'high' : requiredSkills.length >= 3 ? 'medium' : 'low';
  const thinEvidenceCap = requiredSkills.length === 1 ? 0.55 : requiredSkills.length === 2 ? 0.7 : 1;
  const crossRoleCap = roleComponent < 0.65 ? 0.8 : 1;
  const score = Math.min(rawScore, thinEvidenceCap, crossRoleCap);
  const notes = [];

  if (rawScore > score && evidenceConfidence === 'low') {
    notes.push(`Skill coverage was capped because only ${requiredSkills.length} required skill${requiredSkills.length === 1 ? '' : 's'} were detected.`);
  }
  if (rawScore > score && roleComponent < 0.65) {
    notes.push('Skill coverage was capped because the role family is not a close match.');
  }

  return {
    score,
    rawScore,
    detectedRequiredCount: requiredSkills.length,
    matchedRequiredCount,
    evidenceConfidence,
    notes,
  };
};

const isFresherProfile = (profile) => /student|intern|fresher|entry|graduate/i
  .test(`${profile.seniority || ''} ${profile.experienceLevel || ''}`);

const seniorityHardFilter = (profile, job) => {
  if (!isFresherProfile(profile)) {
    return { keep: true, penalty: 1, reasons: [] };
  }
  const text = normalizeKeyPart(`${job.title || ''} ${job.seniority || ''} ${job.description || ''}`);
  const years = Number(job.minimum_experience_years) || 0;
  const seniorSignals = /senior|lead|principal|staff|architect|manager/.test(text);
  if (years >= 5 || seniorSignals) {
    return {
      keep: false,
      penalty: 0.25,
      reasons: [`Filtered because it appears senior-level${years >= 5 ? ` and asks for ${years}+ years` : ''}.`],
    };
  }
  if (/mid level/.test(text) || years >= 2) {
    return {
      keep: true,
      penalty: 0.75,
      reasons: [`Reduced because the role is mid-level while the candidate is fresher.`],
    };
  }
  return { keep: true, penalty: 1, reasons: [] };
};

const roleHardFilter = (profile, job) => {
  const roleScore = roleFamilyScore(profile, job);
  if (roleScore >= 0.65) {
    return { keep: true, penalty: 1, reasons: [] };
  }
  if (!profile.roleFamily || !job.role_family) {
    return { keep: true, penalty: 1, reasons: [] };
  }
  return {
    keep: true,
    penalty: 0.7,
    reasons: [`Reduced because ${job.role_family} is outside the candidate's ${profile.roleFamily} target domain.`],
  };
};

const applyHardFilters = (profile, job) => {
  const filters = [seniorityHardFilter(profile, job), roleHardFilter(profile, job)];
  return {
    keep: filters.every((filter) => filter.keep),
    penalty: filters.reduce((value, filter) => value * filter.penalty, 1),
    reasons: filters.flatMap((filter) => filter.reasons),
  };
};

const confidenceTier = (score) => {
  if (score >= 85) return 'Strong Match';
  if (score >= 70) return 'Good Match';
  if (score >= 55) return 'Stretch Match';
  return 'Weak Match';
};

const scoreCeiling = ({ semanticComponent, roleComponent, skillDetails }) => {
  const ceilings = [1];
  const notes = [];

  if (roleComponent < 0.5) {
    ceilings.push(0.54);
    notes.push('Overall score capped because the role family is a weak match.');
  } else if (roleComponent < 0.65) {
    ceilings.push(0.68);
    notes.push('Overall score capped because the role family is only adjacent to the target role.');
  }

  if (semanticComponent < 0.15) {
    ceilings.push(0.58);
    notes.push('Overall score capped because semantic similarity is very low.');
  } else if (semanticComponent < 0.3) {
    ceilings.push(0.72);
    notes.push('Overall score capped because semantic similarity is weak.');
  }

  if (skillDetails.evidenceConfidence === 'low' && skillDetails.rawScore >= 0.95) {
    ceilings.push(0.65);
    notes.push('Overall score capped because the skill match is based on limited detected requirements.');
  }

  return {
    value: Math.min(...ceilings),
    notes,
  };
};

const buildExplanation = (profile, job, matchedSkills, missingSkills, components, penalties, skillDetails, ceilingNotes) => {
  const role = profile.desiredRole || profile.semanticSearch || 'your target role';
  const strongest = matchedSkills.slice(0, 3);
  const missing = missingSkills.slice(0, 2);
  const bits = [];

  if (strongest.length) {
    bits.push(`Matched ${skillDetails.matchedRequiredCount} of ${skillDetails.detectedRequiredCount || 'unknown'} detected required skills: ${strongest.join(', ')}.`);
  } else {
    bits.push(`Matched mainly through semantic similarity to ${role}, with limited explicit skill overlap.`);
  }

  skillDetails.notes.forEach((note) => {
    if (!bits.includes(note)) bits.push(note);
  });

  if (components.roleFamily < 70) {
    bits.push(`Reduced because the role domain is ${job.role_family || 'unclear'}, not a direct ${profile.roleFamily || 'target role'} match.`);
  } else if (job.role_family) {
    bits.push(`Helped by a ${job.role_family} role classification and ${job.seniority || 'unspecified'} seniority.`);
  }

  if (components.seniority <= 50) {
    bits.push(`Reduced because the seniority fit is weaker for a ${profile.experienceLevel || profile.seniority || 'fresher'} candidate.`);
  }

  if (components.location <= 40) {
    bits.push(`Reduced because the location does not closely match ${profile.location || 'the stated preference'}.`);
  }

  penalties.forEach((reason) => {
    if (!bits.includes(reason)) bits.push(reason);
  });

  ceilingNotes.forEach((reason) => {
    if (!bits.includes(reason)) bits.push(reason);
  });

  if (components.semantic >= 70) {
    bits.push(`Helped by strong semantic similarity after comparing structured role, skills, seniority, and domain text.`);
  }

  if (missing.length) {
    bits.push(`Missing skills include ${missing.join(', ')}.`);
  }

  return bits.slice(0, 4);
};

const recommendNextSkills = (missingSkills) => missingSkills.slice(0, 3);

const enrichJob = (profile, job) => {
  const structured = enrichStructuredJob(job);
  const enrichedSource = { ...job, ...structured };
  const hardFilter = applyHardFilters(profile, enrichedSource);
  const candidateSkills = extractSkillTerms(profile.skills || []);
  const requiredSkills = extractRequiredSkills(enrichedSource);
  const matchedSkills = getMatchedSkills(candidateSkills, requiredSkills);
  const missingSkills = requiredSkills
    .filter((skill) => !matchedSkills.map(normalizeKeyPart).includes(normalizeKeyPart(skill)))
    .slice(0, 5);

  const semanticComponent = Math.max(
    normalizedSemanticScore(enrichedSource.score),
    overlapScore(`${profile.desiredRole || ''} ${profile.semanticSearch || ''} ${profile.roleFamily || ''}`, `${enrichedSource.title || ''} ${enrichedSource.role_family || ''}`)
  );
  const roleComponent = roleFamilyScore(profile, enrichedSource);
  const skillDetails = skillFitDetails(matchedSkills, requiredSkills, roleComponent);
  const skillComponent = skillDetails.score;
  const seniorityComponent = seniorityFitScore(profile, enrichedSource);
  const locationComponent = locationScore(profile.location, enrichedSource);
  const workModeComponent = workModeScore(profile.workPreference, enrichedSource);
  const weightedScore =
    (semanticComponent * scoring.weights.semantic) +
    (skillComponent * scoring.weights.skills) +
    (roleComponent * scoring.weights.roleFamily) +
    (seniorityComponent * scoring.weights.seniority) +
    (locationComponent * scoring.weights.location) +
    (workModeComponent * scoring.weights.workMode);
  const ceiling = scoreCeiling({ semanticComponent, roleComponent, skillDetails });
  const cappedScore = Math.min(weightedScore, ceiling.value * 100);
  const penalizedScore = cappedScore * hardFilter.penalty;
  const score = Math.max(0, Math.min(100, Math.round(weightedScore)));
  const finalScore = Math.max(0, Math.min(100, Math.round(penalizedScore)));
  const matchBreakdown = {
    skills: Math.round(skillComponent * 100),
    semantic: Math.round(semanticComponent * 100),
    roleFamily: Math.round(roleComponent * 100),
    seniority: Math.round(seniorityComponent * 100),
    location: Math.round(locationComponent * 100),
    workMode: Math.round(workModeComponent * 100),
  };

  return {
    ...enrichedSource,
    hardFiltered: !hardFilter.keep,
    filterReasons: hardFilter.reasons,
    source_platform: enrichedSource.source_platform || enrichedSource.source,
    apply_url: enrichedSource.apply_url || enrichedSource.url,
    requiredSkills,
    niceToHaveSkills: enrichedSource.nice_to_have_skills || [],
    matchedSkills: matchedSkills.slice(0, 5),
    missingSkills,
    skillEvidence: {
      matchedRequiredCount: skillDetails.matchedRequiredCount,
      detectedRequiredCount: skillDetails.detectedRequiredCount,
      confidence: skillDetails.evidenceConfidence,
      rawCoverage: Math.round((skillDetails.rawScore || skillDetails.score) * 100),
    },
    scoreCaps: ceiling.notes,
    recommendedNextSkills: recommendNextSkills(missingSkills),
    skillGap: {
      matched: matchedSkills.slice(0, 5),
      missing: missingSkills,
      recommended: recommendNextSkills(missingSkills),
    },
    score: finalScore,
    unpenalizedScore: score,
    cappedScore: Math.round(cappedScore),
    matchConfidence: confidenceTier(finalScore),
    rawSemanticScore: Number((Number(enrichedSource.score) || 0).toFixed(4)),
    matchBreakdown,
    why: buildExplanation(
      profile,
      enrichedSource,
      matchedSkills,
      missingSkills,
      matchBreakdown,
      hardFilter.reasons,
      skillDetails,
      ceiling.notes
    ),
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

const localRankJobs = (profile, jobs, limit = 25) => dedupeJobs(jobs.map((job) => enrichJob(profile, { ...job, score: 0.35 }))
  .filter((job) => !job.hardFiltered))
  .sort((a, b) => b.score - a.score)
  .slice(0, limit);

const matchJobs = async (profile, limit = scoring.resultLimit) => {
  const query = buildProfileQuery(profile);
  if (!query) {
    return [];
  }

  try {
    await ensureJobsAvailable(profile);
    const jobs = await searchSimilarJobs(query, limit * 4);
    return dedupeJobs(jobs.map((job) => enrichJob(profile, job))
      .filter((job) => !job.hardFiltered))
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
