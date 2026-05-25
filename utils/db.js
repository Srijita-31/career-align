const crypto = require('crypto');
const { Pool } = require('pg');
const { createEmbedding, EMBEDDING_DIMENSIONS } = require('./embeddings');
const { enrichJob } = require('./enrichment');

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
  const baseJob = {
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
  const enriched = enrichJob({ ...baseJob, ...job });

  return {
    url_hash: hashUrl(applyUrl),
    ...baseJob,
    role_family: enriched.role_family,
    seniority: enriched.seniority,
    remote_type: enriched.remote_type,
    minimum_experience_years: enriched.minimum_experience_years,
    required_skills: enriched.required_skills,
    nice_to_have_skills: enriched.nice_to_have_skills,
  };
};

const buildJobText = (job) => [
  job.title,
  job.company,
  job.location,
  job.job_type,
  job.work_mode,
  job.role_family,
  job.seniority,
  job.remote_type,
  job.description,
  job.skills.join(', '),
  job.required_skills.join(', '),
  job.nice_to_have_skills.join(', '),
].filter(Boolean).join('\n');

const getExistingEmbeddingDimensions = async () => {
  const result = await pool.query(`
    SELECT atttypmod AS typmod
    FROM pg_attribute
    WHERE attrelid = 'jobs'::regclass
      AND attname = 'embedding'
      AND NOT attisdropped
  `).catch((error) => {
    if (error.code === '42P01') {
      return { rows: [] };
    }
    throw error;
  });

  const typmod = result.rows[0]?.typmod;
  return typmod && typmod > 0 ? typmod : null;
};

const alignEmbeddingDimensions = async () => {
  const dimensions = await getExistingEmbeddingDimensions();
  if (!dimensions || dimensions === EMBEDDING_DIMENSIONS) {
    return;
  }

  const count = await pool.query('SELECT COUNT(*)::int AS count FROM jobs');
  if (count.rows[0].count > 0) {
    throw new Error(
      `Existing jobs use ${dimensions}-dimension embeddings, but the active provider expects ${EMBEDDING_DIMENSIONS}. ` +
      'Clear or re-embed stored jobs before switching providers.'
    );
  }

  await pool.query('DROP INDEX IF EXISTS jobs_embedding_hnsw_idx');
  await pool.query(`ALTER TABLE jobs ALTER COLUMN embedding TYPE vector(${EMBEDDING_DIMENSIONS})`);
};

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
      role_family TEXT NOT NULL DEFAULT '',
      seniority TEXT NOT NULL DEFAULT '',
      remote_type TEXT NOT NULL DEFAULT '',
      minimum_experience_years INT NOT NULL DEFAULT 0,
      required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
      nice_to_have_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
      embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS role_family TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS seniority TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS remote_type TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS minimum_experience_years INT NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS required_skills JSONB NOT NULL DEFAULT '[]'::jsonb");
  await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS nice_to_have_skills JSONB NOT NULL DEFAULT '[]'::jsonb");
  await alignEmbeddingDimensions();
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
        job_type, work_mode, apply_url, description, skills, posted_date,
        role_family, seniority, remote_type, minimum_experience_years,
        required_skills, nice_to_have_skills, embedding
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13,
        $14, $15, $16, $17, $18::jsonb, $19::jsonb, $20::vector
      )
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
        role_family = EXCLUDED.role_family,
        seniority = EXCLUDED.seniority,
        remote_type = EXCLUDED.remote_type,
        minimum_experience_years = EXCLUDED.minimum_experience_years,
        required_skills = EXCLUDED.required_skills,
        nice_to_have_skills = EXCLUDED.nice_to_have_skills,
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
      job.role_family,
      job.seniority,
      job.remote_type,
      job.minimum_experience_years,
      JSON.stringify(job.required_skills),
      JSON.stringify(job.nice_to_have_skills),
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
      role_family,
      seniority,
      remote_type,
      minimum_experience_years,
      required_skills,
      nice_to_have_skills,
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
    required_skills: Array.isArray(job.required_skills) ? job.required_skills : [],
    nice_to_have_skills: Array.isArray(job.nice_to_have_skills) ? job.nice_to_have_skills : [],
  }));
};

const getAllJobs = async () => {
  await ensureSchema();
  const result = await pool.query(`
    SELECT source, source_platform, title, company, location, salary, job_type,
      work_mode, apply_url, apply_url AS url, description, skills, posted_date,
      role_family, seniority, remote_type, minimum_experience_years,
      required_skills, nice_to_have_skills, created_at, updated_at
    FROM jobs
    ORDER BY updated_at DESC
  `);
  return result.rows.map((job) => ({
    ...job,
    skills: Array.isArray(job.skills) ? job.skills : [],
    required_skills: Array.isArray(job.required_skills) ? job.required_skills : [],
    nice_to_have_skills: Array.isArray(job.nice_to_have_skills) ? job.nice_to_have_skills : [],
  }));
};

const closePool = () => pool.end();

module.exports = { ensureSchema, getJobCount, storeJobs, searchSimilarJobs, getAllJobs, closePool };
