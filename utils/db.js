const crypto = require('crypto');
const { Pool } = require('pg');
const { createEmbedding, EMBEDDING_DIMENSIONS } = require('./embeddings');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://career_align:career_align@localhost:5432/career_align',
});

const hashUrl = (url) => crypto.createHash('sha256').update(String(url || '')).digest('hex');

const isValidUrl = (value) => {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) && !/localhost|127\.0\.0\.1|example\.com|example\.|placeholder|dummy|fallback/i.test(url);
};

const toVector = (embedding) => `[${embedding.join(',')}]`;

const normalizeJob = (job) => {
  const applyUrl = job.apply_url || job.url || '';
  return {
    url_hash: hashUrl(applyUrl),
    source: job.source || job.source_platform || 'unknown',
    source_platform: job.source_platform || job.source || 'unknown',
    title: String(job.title || '').trim(),
    company: String(job.company || '').trim(),
    location: String(job.location || '').trim(),
    salary: String(job.salary || '').trim(),
    job_type: String(job.job_type || job.jobType || '').trim(),
    work_mode: String(job.work_mode || job.workMode || '').trim(),
    apply_url: applyUrl,
    description: String(job.description || '').trim(),
    skills: Array.isArray(job.skills) ? job.skills.filter(Boolean).map((skill) => String(skill).trim()) : [],
    posted_date: String(job.posted_date || '').trim(),
  };
};

const buildJobText = (job) => [
  job.title,
  job.company,
  job.location,
  job.job_type,
  job.work_mode,
  job.description,
  job.skills.join(', '),
].filter(Boolean).join('\n');

const ensureSchema = async () => {
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id BIGSERIAL PRIMARY KEY,
      url_hash TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL DEFAULT 'unknown',
      source_platform TEXT NOT NULL DEFAULT 'unknown',
      title TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      salary TEXT NOT NULL DEFAULT '',
      job_type TEXT NOT NULL DEFAULT '',
      work_mode TEXT NOT NULL DEFAULT '',
      apply_url TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      skills JSONB NOT NULL DEFAULT '[]'::jsonb,
      posted_date TEXT NOT NULL DEFAULT '',
      embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS jobs_embedding_hnsw_idx ON jobs USING hnsw (embedding vector_cosine_ops)');
};

const getJobCount = async () => {
  await ensureSchema();
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM jobs');
  return result.rows[0].count;
};

const storeJobs = async (jobs) => {
  await ensureSchema();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let invalid = 0;

  for (const rawJob of jobs) {
    const job = normalizeJob(rawJob);
    if (!job.title || !isValidUrl(job.apply_url)) {
      invalid += 1;
      continue;
    }

    const existing = await pool.query('SELECT url_hash FROM jobs WHERE url_hash = $1', [job.url_hash]);
    const embedding = await createEmbedding(buildJobText(job));

    await pool.query(`
      INSERT INTO jobs (
        url_hash, source, source_platform, title, company, location, salary,
        job_type, work_mode, apply_url, description, skills, posted_date, embedding
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14::vector)
      ON CONFLICT (url_hash) DO UPDATE SET
        source = EXCLUDED.source,
        source_platform = EXCLUDED.source_platform,
        title = EXCLUDED.title,
        company = EXCLUDED.company,
        location = EXCLUDED.location,
        salary = EXCLUDED.salary,
        job_type = EXCLUDED.job_type,
        work_mode = EXCLUDED.work_mode,
        apply_url = EXCLUDED.apply_url,
        description = EXCLUDED.description,
        skills = EXCLUDED.skills,
        posted_date = EXCLUDED.posted_date,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
    `, [
      job.url_hash,
      job.source,
      job.source_platform,
      job.title,
      job.company,
      job.location,
      job.salary,
      job.job_type,
      job.work_mode,
      job.apply_url,
      job.description,
      JSON.stringify(job.skills),
      job.posted_date,
      toVector(embedding),
    ]);

    if (existing.rowCount) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  return { inserted, updated, skipped, invalid };
};

const searchSimilarJobs = async (queryText, limit = 25) => {
  await ensureSchema();
  const embedding = await createEmbedding(queryText);
  const result = await pool.query(`
    SELECT
      id,
      source,
      source_platform,
      title,
      company,
      location,
      salary,
      job_type,
      work_mode,
      apply_url,
      apply_url AS url,
      description,
      skills,
      posted_date,
      created_at,
      updated_at,
      GREATEST(0, LEAST(1, 1 - (embedding <=> $1::vector))) AS score
    FROM jobs
    ORDER BY embedding <=> $1::vector
    LIMIT $2
  `, [toVector(embedding), limit]);

  return result.rows.map((job) => ({
    ...job,
    score: Number(Number(job.score).toFixed(4)),
    skills: Array.isArray(job.skills) ? job.skills : [],
  }));
};

const getAllJobs = async () => {
  await ensureSchema();
  const result = await pool.query(`
    SELECT source, source_platform, title, company, location, salary, job_type,
      work_mode, apply_url, apply_url AS url, description, skills, posted_date,
      created_at, updated_at
    FROM jobs
    ORDER BY updated_at DESC
  `);
  return result.rows.map((job) => ({
    ...job,
    skills: Array.isArray(job.skills) ? job.skills : [],
  }));
};

const closePool = () => pool.end();

module.exports = { ensureSchema, getJobCount, storeJobs, searchSimilarJobs, getAllJobs, closePool };
