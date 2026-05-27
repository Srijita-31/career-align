const fs = require('fs/promises');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { enrichProfile } = require('./enrichment');
const { appConfig, rules } = require('../config');

const defaultSkills = rules.resumeSkills;

const normalize = (text) => text
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const extractTextFromFile = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const data = await fs.readFile(filePath);
    const parsed = await pdfParse(data);
    return parsed.text || '';
  }
  if (ext === '.docx') {
    const data = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer: data });
    return result.value || '';
  }
  return await fs.readFile(filePath, 'utf8');
};

const extractSkills = (text) => {
  const normalized = normalize(text);
  const candidateSkills = new Set();
  defaultSkills.forEach((skill) => {
    const normalizedSkill = normalize(skill);
    if (normalized.includes(normalizedSkill)) {
      candidateSkills.add(skill);
    }
  });
  return Array.from(candidateSkills);
};

const parseResume = async (form, resumePath) => {
  let resumeText = '';
  if (resumePath) {
    resumeText = await extractTextFromFile(resumePath);
  }

  const skillsFromResume = extractSkills(resumeText);
  const rawSkills = String(form.skills || '')
    .split(/[;,\n]/)
    .map((skill) => skill.trim())
    .filter(Boolean);

  const skills = Array.from(new Set([...skillsFromResume, ...rawSkills].map((s) => s.toLowerCase())));
  const locationScope = form.locationScope || 'india';
  const location = locationScope === 'outside-india' ? 'Outside India' : appConfig.defaultLocation;

  return enrichProfile({
    name: form.name || 'Student',
    email: form.email || '',
    desiredRole: form.desiredRole || '',
    semanticSearch: form.semanticSearch || '',
    location,
    locationScope,
    workPreference: form.workPreference || appConfig.defaultWorkPreference,
    education: form.education || '',
    experienceLevel: form.experienceLevel || 'Student',
    skills,
    summary: normalize(`${form.summary || ''} ${resumeText}`)
  });
};

module.exports = { parseResume };
