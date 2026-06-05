const normalizeText = (value) => String(value || '').toLowerCase();
const { rules } = require('../config');

const normalizeKeyPart = (value) => normalizeText(value)
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9+#.]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const unique = (values) => Array.from(new Set(values.filter(Boolean)));

const titleCase = (value) => String(value || '')
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
  .join(' ');

const SKILL_ALIASES = new Map(Object.entries(rules.skillAliases));
const PHRASE_SKILLS = rules.phraseSkills;
const COMMON_JOB_SKILLS = [...SKILL_ALIASES.keys(), ...rules.commonJobSkills];
const ROLE_FAMILIES = rules.roleFamilies.map((role) => ({
  ...role,
  pattern: new RegExp(role.pattern),
}));
const SENIORITY_RULES = rules.seniorityRules.map((rule) => ({
  ...rule,
  pattern: new RegExp(rule.pattern),
}));

const includesPhrase = (text, phrase) => {
  const normalizedText = normalizeKeyPart(text);
  const normalizedPhrase = normalizeKeyPart(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|\\b)${normalizedPhrase}(\\b|$)`, 'i').test(normalizedText);
};

const canonicalSkill = (skill) => {
  const normalized = normalizeKeyPart(skill);
  if (!normalized || normalized.length <= 1) {
    return '';
  }
  return SKILL_ALIASES.get(normalized) || titleCase(normalized);
};

const extractSkillTerms = (values) => {
  const text = Array.isArray(values) ? values.join(' ') : String(values || '');
  const skills = [];

  PHRASE_SKILLS.forEach((phrase) => {
    if (includesPhrase(text, phrase)) {
      skills.push(canonicalSkill(phrase));
    }
  });

  String(text || '')
    .split(/[;,\n/|]+/)
    .flatMap((part) => {
      const normalized = normalizeKeyPart(part);
      if (SKILL_ALIASES.has(normalized)) {
        return [normalized];
      }
      return normalized.split(/\s+/);
    })
    .forEach((token) => {
      const skill = canonicalSkill(token);
      if (skill && COMMON_JOB_SKILLS.includes(normalizeKeyPart(skill))) {
        skills.push(skill);
      }
    });

  return unique(skills);
};

const ROLE_FAMILY_KEYWORDS = new Map([
  ['AI and Machine Learning', ['machine learning', 'deep learning', 'natural language processing', 'nlp', 'llm', 'large language model', 'computer vision', 'image processing', 'tensorflow', 'pytorch', 'scikit learn', 'opencv', 'data scientist', 'data science', 'ai engineer', 'ml engineer']],
  ['Backend Engineering', ['backend', 'back end', 'api', 'server side', 'java', 'spring boot', 'node.js', 'express', 'django', 'flask', 'fastapi', 'microservice', 'rest api', 'graphql']],
  ['Frontend Engineering', ['frontend', 'front end', 'react', 'reactjs', 'javascript', 'html', 'css', 'typescript', 'redux', 'vue', 'vuejs', 'angular', 'ui developer', 'web developer', 'ui engineer']],
  ['Full Stack Engineering', ['full stack', 'fullstack', 'mern', 'mean stack', 'full-stack']],
  ['Data and Analytics', ['data analyst', 'analytics', 'business analyst', 'tableau', 'power bi', 'excel', 'business intelligence', 'bi developer', 'reporting']],
  ['Data Engineering', ['data engineer', 'etl', 'airflow', 'spark', 'kafka', 'big data', 'data pipeline', 'databricks', 'hadoop', 'data warehouse']],
  ['Cloud and DevOps', ['devops', 'cloud engineer', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'sre', 'site reliability', 'terraform', 'jenkins', 'ci cd', 'infrastructure', 'platform engineer']],
  ['Cybersecurity', ['cybersecurity', 'security analyst', 'security engineer', 'soc', 'siem', 'incident response', 'network security', 'penetration testing', 'vulnerability', 'infosec']],
  ['Mobile Engineering', ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin']],
  ['Product and Design', ['product manager', 'ui ux', 'ux designer', 'product designer', 'figma', 'user research']],
]);

const inferRoleFamily = (text, skills = []) => {
  const normalized = normalizeKeyPart(text);
  const skillKeys = new Set((Array.isArray(skills) ? skills : []).map(normalizeKeyPart));

  const scores = [];
  for (const [familyName, keywords] of ROLE_FAMILY_KEYWORDS) {
    let score = 0;
    for (const keyword of keywords) {
      const kNorm = normalizeKeyPart(keyword);
      if (skillKeys.has(kNorm)) {
        score += 5; // strong signal: skill explicitly extracted
      } else if (normalized.includes(kNorm)) {
        score += 2; // text mention
      }
    }
    // Also check ROLE_FAMILIES regex patterns for an additional boost
    const rolePattern = ROLE_FAMILIES.find((r) => r.name === familyName);
    if (rolePattern && rolePattern.pattern.test(normalized)) {
      score += 3;
    }
    if (score > 0) scores.push({ name: familyName, score });
  }

  if (!scores.length) return 'General Technology';
  scores.sort((a, b) => b.score - a.score);
  return scores[0].score >= 2 ? scores[0].name : 'General Technology';
};

const inferSeniority = (text, fallback = 'Entry Level') => {
  const normalized = normalizeKeyPart(text);
  return SENIORITY_RULES.find((rule) => rule.pattern.test(normalized))?.level || fallback;
};

const inferRemoteType = (job) => {
  const text = normalizeKeyPart(`${job.work_mode || job.workMode || ''} ${job.location || ''} ${job.description || ''}`);
  if (/remote|work from home|wfh/.test(text)) return 'Remote';
  if (/hybrid/.test(text)) return 'Hybrid';
  if (/onsite|on site|office/.test(text)) return 'Onsite';
  return job.work_mode || job.workMode || 'Hybrid';
};

const inferMinimumExperienceYears = (text) => {
  const normalized = normalizeText(text);
  const explicit = normalized.match(/(\d+)\+?\s*(?:years|yrs|yr)/);
  if (explicit) {
    return Number(explicit[1]);
  }
  const seniority = inferSeniority(text);
  if (seniority === 'Intern') return 0;
  if (seniority === 'Entry Level') return 0;
  if (seniority === 'Mid Level') return 2;
  if (seniority === 'Senior') return 5;
  return 0;
};

const splitRequiredAndNiceSkills = (text, skills) => {
  const normalized = normalizeKeyPart(text);
  const niceHints = /nice to have|preferred|bonus|good to have|plus/.test(normalized);
  if (!niceHints) {
    return { required: skills.slice(0, 10), niceToHave: skills.slice(10, 14) };
  }

  const preferredIndex = normalized.search(/nice to have|preferred|bonus|good to have|plus/);
  const requiredText = normalized.slice(0, preferredIndex);
  const required = skills.filter((skill) => includesPhrase(requiredText, skill));
  return {
    required: (required.length ? required : skills.slice(0, Math.max(1, Math.ceil(skills.length * 0.7)))).slice(0, 10),
    niceToHave: skills.filter((skill) => !required.includes(skill)).slice(0, 6),
  };
};

const enrichJob = (job) => {
  const text = [
    job.title,
    job.company,
    job.location,
    job.job_type || job.jobType,
    job.work_mode || job.workMode,
    job.description,
    ...(job.skills || []),
  ].join(' ');
  const skills = unique([
    ...extractSkillTerms(job.skills || []),
    ...extractSkillTerms(text),
  ]);
  const skillBuckets = splitRequiredAndNiceSkills(text, skills);

  return {
    role_family: job.role_family || inferRoleFamily(text, skills),
    seniority: job.seniority || inferSeniority(text, job.job_type === 'Internship' ? 'Intern' : 'Entry Level'),
    remote_type: job.remote_type || inferRemoteType(job),
    minimum_experience_years: Number.isFinite(Number(job.minimum_experience_years))
      ? Number(job.minimum_experience_years)
      : inferMinimumExperienceYears(text),
    required_skills: unique(job.required_skills || skillBuckets.required).slice(0, 10),
    nice_to_have_skills: unique(job.nice_to_have_skills || skillBuckets.niceToHave).slice(0, 6),
  };
};

const enrichProfile = (profile) => {
  const text = [
    profile.desiredRole,
    profile.semanticSearch,
    profile.experienceLevel,
    profile.education,
    profile.summary,
    ...(profile.skills || []),
  ].join(' ');
  const skills = unique([
    ...extractSkillTerms(profile.skills || []),
    ...extractSkillTerms(text),
  ]);

  return {
    ...profile,
    skills: skills.length ? skills.map((skill) => skill.toLowerCase()) : profile.skills || [],
    roleFamily: inferRoleFamily(text, skills),
    seniority: inferSeniority(`${profile.experienceLevel || ''} ${text}`, profile.experienceLevel || 'Student'),
  };
};

module.exports = {
  COMMON_JOB_SKILLS,
  SKILL_ALIASES,
  canonicalSkill,
  enrichJob,
  enrichProfile,
  extractSkillTerms,
  inferRoleFamily,
  inferSeniority,
  normalizeKeyPart,
  unique,
};
