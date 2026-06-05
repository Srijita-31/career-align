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

const getUploadPath = (upload) => (typeof upload === 'string' ? upload : upload?.path);

const detectFileType = async (upload, data) => {
  const originalName = typeof upload === 'string' ? upload : upload?.originalname;
  const mimeType = typeof upload === 'string' ? '' : upload?.mimetype;
  const ext = path.extname(originalName || getUploadPath(upload) || '').toLowerCase();
  const header = data.subarray(0, 8).toString('binary');

  if (mimeType === 'application/pdf' || ext === '.pdf' || header.startsWith('%PDF')) {
    return 'pdf';
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx' ||
    header.startsWith('PK')
  ) {
    return 'docx';
  }
  return 'text';
};

const cleanResumeText = (text) => normalize(text)
  .replace(/\b(?:obj|endobj|stream|endstream|xref|trailer|flatedecode|mediabox|font|xobject)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const extractTextFromFile = async (upload) => {
  const filePath = getUploadPath(upload);
  if (!filePath) {
    return '';
  }

  const data = await fs.readFile(filePath);
  const type = await detectFileType(upload, data);

  if (type === 'pdf') {
    const parsed = await pdfParse(data);
    return parsed.text || '';
  }
  if (type === 'docx') {
    const result = await mammoth.extractRawText({ buffer: data });
    return result.value || '';
  }
  return data.toString('utf8');
};

const extractSkills = (text) => {
  const normalized = normalize(text);
  const rawText = String(text || '').toLowerCase();
  const candidateSkills = new Set();

  defaultSkills.forEach((skill) => {
    const rawSkill = String(skill || '').toLowerCase();
    const normalizedSkill = normalize(skill);

    if (rawSkill === 'c++' || rawSkill === 'c#') {
      const escaped = rawSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(rawText)) {
        candidateSkills.add(skill);
      }
      return;
    }

    if (!normalizedSkill || normalizedSkill.length <= 1) {
      return;
    }

    const escaped = normalizedSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    if (new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'i').test(normalized)) {
      candidateSkills.add(skill);
    }
  });

  return Array.from(candidateSkills);
};

const parseResume = async (form, upload) => {
  let resumeText = '';
  if (upload) {
    resumeText = await extractTextFromFile(upload);
  }

  const cleanedResumeText = cleanResumeText(resumeText);
  const skillsFromResume = extractSkills(cleanedResumeText);
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
    summary: cleanResumeText(`${form.summary || ''} ${cleanedResumeText}`).slice(0, 6000),
    resumeDiagnostics: {
      originalName: typeof upload === 'string' ? '' : upload?.originalname || '',
      mimeType: typeof upload === 'string' ? '' : upload?.mimetype || '',
      extractedCharacters: resumeText.length,
      cleanedCharacters: cleanedResumeText.length,
      parsedAsBinaryNoise: /^pdf\s+\d|obj type catalog|endstream endobj/.test(cleanedResumeText),
    },
  });
};

module.exports = { detectFileType, extractTextFromFile, parseResume };
