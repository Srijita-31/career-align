const crypto = require('crypto');
const { Pool } = require('pg');
const { createEmbedding, EMBEDDING_DIMENSIONS } = require('./embeddings');
const { enrichJob } = require('./enrichment');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://career_align:career_align@localhost:5432/career_align',
});

const EMBEDDING_TEXT_VERSION = 2;

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
  `Role: ${job.title}`,
  job.role_family && `Domain: ${job.role_family}`,
  job.required_skills?.length && `Skills: ${job.required_skills.join(' ')}`,
  job.nice_to_have_skills?.length && `Nice to have: ${job.nice_to_have_skills.join(' ')}`,
  job.seniority && `Seniority: ${job.seniority}`,
  Number.isFinite(Number(job.minimum_experience_years)) && `Minimum experience years: ${job.minimum_experience_years}`,
  job.remote_type && `Work mode: ${job.remote_type}`,
  job.location && `Location: ${job.location}`,
  job.description && `Summary: ${String(job.description).slice(0, 500)}`,
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
      embedding_text_version INT NOT NULL DEFAULT ${EMBEDDING_TEXT_VERSION},
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
  await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS embedding_text_version INT NOT NULL DEFAULT 0");
  await alignEmbeddingDimensions();
  await pool.query('CREATE INDEX IF NOT EXISTS jobs_embedding_hnsw_idx ON jobs USING hnsw (embedding vector_cosine_ops)');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recommendation_feedback (
      id BIGSERIAL PRIMARY KEY,
      job_url_hash TEXT REFERENCES jobs(url_hash) ON DELETE SET NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      profile_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      job_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scraper_runs (
      id BIGSERIAL PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'running',
      reason TEXT NOT NULL DEFAULT '',
      profile_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      scraped_count INT NOT NULL DEFAULT 0,
      inserted_count INT NOT NULL DEFAULT 0,
      updated_count INT NOT NULL DEFAULT 0,
      invalid_count INT NOT NULL DEFAULT 0,
      error_message TEXT NOT NULL DEFAULT '',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scraper_source_results (
      id BIGSERIAL PRIMARY KEY,
      scraper_run_id BIGINT REFERENCES scraper_runs(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      cards_seen INT NOT NULL DEFAULT 0,
      jobs_extracted INT NOT NULL DEFAULT 0,
      error_message TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
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
        required_skills, nice_to_have_skills, embedding_text_version, embedding
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13,
        $14, $15, $16, $17, $18::jsonb, $19::jsonb, $20, $21::vector
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
        embedding_text_version = EXCLUDED.embedding_text_version,
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
      EMBEDDING_TEXT_VERSION,
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

const countStaleJobEmbeddings = async () => {
  await ensureSchema();
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM jobs WHERE embedding_text_version < $1',
    [EMBEDDING_TEXT_VERSION]
  );
  return result.rows[0].count;
};

const reembedStaleJobEmbeddings = async ({ batchSize = 50 } = {}) => {
  await ensureSchema();
  let updated = 0;
  const limit = Math.max(1, Math.min(Number(batchSize) || 50, 200));

  for (;;) {
    const result = await pool.query(`
      SELECT
        url_hash, title, company, location, salary, job_type, work_mode,
        apply_url, description, skills, role_family, seniority, remote_type,
        minimum_experience_years, required_skills, nice_to_have_skills
      FROM jobs
      WHERE embedding_text_version < $1
      ORDER BY updated_at DESC
      LIMIT $2
    `, [EMBEDDING_TEXT_VERSION, limit]);

    if (!result.rows.length) {
      break;
    }

    for (const row of result.rows) {
      const job = {
        ...row,
        skills: Array.isArray(row.skills) ? row.skills : [],
        required_skills: Array.isArray(row.required_skills) ? row.required_skills : [],
        nice_to_have_skills: Array.isArray(row.nice_to_have_skills) ? row.nice_to_have_skills : [],
      };
      const embedding = await createEmbedding(buildJobText(job));
      await pool.query(`
        UPDATE jobs
        SET embedding = $2::vector,
          embedding_text_version = $3,
          updated_at = NOW()
        WHERE url_hash = $1
      `, [job.url_hash, toVector(embedding), EMBEDDING_TEXT_VERSION]);
      updated += 1;
    }
  }

  return { updated, embeddingTextVersion: EMBEDDING_TEXT_VERSION };
};

const searchSimilarJobs = async (queryText, limit = 25) => {
  await ensureSchema();
  const embedding = await createEmbedding(queryText);
  const result = await pool.query(`
    SELECT
      id,
      url_hash,
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
      embedding_text_version,
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
      work_mode, url_hash, apply_url, apply_url AS url, description, skills, posted_date,
      role_family, seniority, remote_type, minimum_experience_years,
      required_skills, nice_to_have_skills, embedding_text_version, created_at, updated_at
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

const saveRecommendationFeedback = async ({ jobUrlHash, action, reason = '', profile = {}, job = {} }) => {
  await ensureSchema();
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (!['relevant', 'not_relevant', 'too_senior', 'wrong_location', 'saved', 'applied'].includes(normalizedAction)) {
    throw new Error('Unsupported feedback action.');
  }

  const result = await pool.query(`
    INSERT INTO recommendation_feedback (
      job_url_hash, action, reason, profile_snapshot, job_snapshot
    )
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
    RETURNING id, created_at
  `, [
    jobUrlHash || null,
    normalizedAction,
    String(reason || '').slice(0, 500),
    JSON.stringify(profile || {}),
    JSON.stringify(job || {}),
  ]);

  return result.rows[0];
};

const createScraperRun = async ({ profile = {}, reason = '' } = {}) => {
  await ensureSchema();
  const result = await pool.query(`
    INSERT INTO scraper_runs (reason, profile_snapshot)
    VALUES ($1, $2::jsonb)
    RETURNING id, status, started_at
  `, [String(reason || '').slice(0, 100), JSON.stringify(profile || {})]);
  return result.rows[0];
};

const recordScraperSourceResult = async ({ runId, source, status, cardsSeen = 0, jobsExtracted = 0, errorMessage = '' }) => {
  if (!runId) {
    return null;
  }
  await ensureSchema();
  const result = await pool.query(`
    INSERT INTO scraper_source_results (
      scraper_run_id, source, status, cards_seen, jobs_extracted, error_message
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `, [
    runId,
    String(source || 'unknown').slice(0, 100),
    String(status || 'unknown').slice(0, 40),
    Number(cardsSeen) || 0,
    Number(jobsExtracted) || 0,
    String(errorMessage || '').slice(0, 1000),
  ]);
  return result.rows[0];
};

const finishScraperRun = async ({ runId, status, summary = {}, errorMessage = '' }) => {
  if (!runId) {
    return null;
  }
  await ensureSchema();
  const result = await pool.query(`
    UPDATE scraper_runs
    SET status = $2,
      scraped_count = $3,
      inserted_count = $4,
      updated_count = $5,
      invalid_count = $6,
      error_message = $7,
      finished_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [
    runId,
    status,
    Number(summary.scrapedCount) || 0,
    Number(summary.inserted) || 0,
    Number(summary.updated) || 0,
    Number(summary.invalid) || 0,
    String(errorMessage || '').slice(0, 1000),
  ]);
  return result.rows[0];
};

const getRecentScraperRuns = async (limit = 10) => {
  await ensureSchema();
  const runs = await pool.query(`
    SELECT *
    FROM scraper_runs
    ORDER BY started_at DESC
    LIMIT $1
  `, [Math.max(1, Math.min(Number(limit) || 10, 50))]);
  const runIds = runs.rows.map((run) => run.id);
  if (!runIds.length) {
    return [];
  }

  const sources = await pool.query(`
    SELECT *
    FROM scraper_source_results
    WHERE scraper_run_id = ANY($1::bigint[])
    ORDER BY created_at ASC
  `, [runIds]);
  const byRun = new Map();
  sources.rows.forEach((source) => {
    const values = byRun.get(source.scraper_run_id) || [];
    values.push(source);
    byRun.set(source.scraper_run_id, values);
  });

  return runs.rows.map((run) => ({
    ...run,
    sources: byRun.get(run.id) || [],
  }));
};

module.exports = {
  ensureSchema,
  getJobCount,
  storeJobs,
  searchSimilarJobs,
  getAllJobs,
  countStaleJobEmbeddings,
  reembedStaleJobEmbeddings,
  saveRecommendationFeedback,
  createScraperRun,
  recordScraperSourceResult,
  finishScraperRun,
  getRecentScraperRuns,
  closePool,
};
