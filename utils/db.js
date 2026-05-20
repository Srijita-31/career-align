const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const storageDir = path.join(__dirname, '..', 'storage');
const storagePath = path.join(storageDir, 'jobs.json');

const ensureStorage = async () => {
  try {
    await fs.mkdir(storageDir, { recursive: true });
    await fs.access(storagePath);
  } catch (error) {
    await fs.writeFile(storagePath, JSON.stringify({ jobs: [] }, null, 2), 'utf8');
  }
};

const hashUrl = (url) => crypto.createHash('sha256').update(String(url || '')).digest('hex');
const serializeSkills = (skills) => JSON.stringify(Array.isArray(skills) ? skills.filter(Boolean).map((value) => String(value).trim()) : []);
const isValidUrl = (value) => {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) && !/localhost|127\.0\.0\.1|example\.com|example\.|placeholder|dummy|fallback/i.test(url);
};

const readStorage = async () => {
  await ensureStorage();
  const file = await fs.readFile(storagePath, 'utf8');
  return JSON.parse(file);
};

const writeStorage = async (data) => {
  await fs.writeFile(storagePath, JSON.stringify(data, null, 2), 'utf8');
};

const normalizeJob = (job) => ({
  url_hash: hashUrl(job.apply_url || job.url || ''),
  source: job.source || job.source_platform || 'unknown',
  source_platform: job.source_platform || job.source || 'unknown',
  title: job.title || '',
  company: job.company || '',
  location: job.location || '',
  salary: job.salary || '',
  job_type: job.job_type || job.jobType || '',
  work_mode: job.work_mode || job.workMode || '',
  apply_url: job.apply_url || job.url || '',
  url: job.apply_url || job.url || '',
  description: job.description || '',
  skills: serializeSkills(job.skills),
  posted_date: job.posted_date || '',
  created_at: job.created_at || new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const storeJobs = async (jobs) => {
  const data = await readStorage();
  const existingMap = new Map(data.jobs.map((job) => [job.url_hash, job]));
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let invalid = 0;

  for (const job of jobs) {
    const normalized = normalizeJob(job);
    if (!isValidUrl(normalized.apply_url) || !normalized.title) {
      invalid += 1;
      continue;
    }

    const existing = existingMap.get(normalized.url_hash);
    if (!existing) {
      existingMap.set(normalized.url_hash, normalized);
      inserted += 1;
      continue;
    }

    const unchanged =
      existing.title === normalized.title &&
      existing.company === normalized.company &&
      existing.location === normalized.location &&
      existing.salary === normalized.salary &&
      existing.job_type === normalized.job_type &&
      existing.work_mode === normalized.work_mode &&
      existing.apply_url === normalized.apply_url &&
      existing.description === normalized.description &&
      existing.skills === normalized.skills &&
      existing.posted_date === normalized.posted_date;

    if (unchanged) {
      skipped += 1;
      continue;
    }

    normalized.created_at = existing.created_at || normalized.created_at;
    existingMap.set(normalized.url_hash, normalized);
    updated += 1;
  }

  await writeStorage({ jobs: Array.from(existingMap.values()) });
  return { inserted, updated, skipped, invalid };
};

const getAllJobs = async () => {
  const data = await readStorage();
  return data.jobs.map((row) => ({
    ...row,
    source: row.source_platform || row.source || 'unknown',
    source_platform: row.source_platform || row.source || 'unknown',
    apply_url: row.apply_url || row.url || '',
    url: row.url || row.apply_url || '',
    skills: JSON.parse(row.skills || '[]'),
  }));
};

module.exports = { storeJobs, getAllJobs };

