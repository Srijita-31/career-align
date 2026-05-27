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

const inferRoleFamily = (text) => {
  const normalized = normalizeKeyPart(text);
  return ROLE_FAMILIES.find((role) => role.pattern.test(normalized))?.name || 'General Technology';
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
    role_family: job.role_family || inferRoleFamily(text),
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
    roleFamily: inferRoleFamily(text),
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
