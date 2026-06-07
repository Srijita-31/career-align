// Cleaned up db.js implementation
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
  // Validate that the URL starts with http/https and is not a placeholder or local address
  return /^https?:\/\//i.test(url) && !/localhost|127\.0\.0\.1|example\.com|example\.|placeholder|dummy|fallback/i.test(url);
};

const toVector = (embedding) => `[${embedding.join(',')}]`;

const normalizeJob = (job) => {
  const applyUrl = job.apply_url || job.url || '';
  let urlKey = applyUrl;
  try {
    const u = new URL(applyUrl);
    const tracking = ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source'];
    tracking.forEach(p => u.searchParams.delete(p));
    urlKey = u.toString();
  } catch (e) {}
  const fallbackKey = `${String(job.title).trim().toLowerCase()}|${String(job.company).trim().toLowerCase()}|${String(job.location).trim().toLowerCase()}`;
  const finalKey = urlKey || fallbackKey;
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
    skills: Array.isArray(job.skills) ? job.skills.filter(Boolean).map(s => String(s).trim()) : [],
    posted_date: String(job.posted_date || '').trim(),
  };
  const enriched = enrichJob({ ...baseJob, ...job });
  return {
    url_hash: hashUrl(finalKey),
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
  `).catch(err => {
    if (err.code === '42P01') return { rows: [] };
    throw err;
  });
  const typmod = result.rows[0]?.typmod;
  return typmod && typmod > 0 ? typmod : null;
};

const alignEmbeddingDimensions = async () => {
  const dim = await getExistingEmbeddingDimensions();
  if (!dim || dim === EMBEDDING_DIMENSIONS) return;
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM jobs');
  if (count.rows[0].count > 0) {
    throw new Error(`Existing jobs use ${dim}-dim embeddings, but provider expects ${EMBEDDING_DIMENSIONS}.`);
  }
  await pool.query('DROP INDEX IF EXISTS jobs_embedding_hnsw_idx');
  await pool.query(`ALTER TABLE jobs ALTER COLUMN embedding TYPE vector(${EMBEDDING_DIMENSIONS})`);
};

const ensureSchema = async () => {
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      website TEXT,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id BIGSERIAL PRIMARY KEY,
      url_hash TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL DEFAULT 'unknown',
      source_platform TEXT NOT NULL DEFAULT 'unknown',
      title TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
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
  await pool.query('TRUNCATE TABLE jobs RESTART IDENTITY CASCADE');
  await alignEmbeddingDimensions();
  await pool.query('CREATE INDEX IF NOT EXISTS jobs_embedding_hnsw_idx ON jobs USING hnsw (embedding vector_cosine_ops)');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_profiles (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT,
      resume_text TEXT,
      resume_path TEXT,
      skills JSONB DEFAULT '[]'::jsonb,
      target_roles JSONB DEFAULT '[]'::jsonb,
      extracted_skills JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
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
  const res = await pool.query('SELECT COUNT(*)::int AS count FROM jobs');
  return res.rows[0].count;
};

const storeJobs = async (jobs) => {
  await ensureSchema();
  let inserted = 0, updated = 0, invalid = 0;
  for (const raw of jobs) {
    const job = normalizeJob(raw);
    if (!job.title || !isValidUrl(job.apply_url)) { invalid++; continue; }
    const exists = await pool.query('SELECT url_hash FROM jobs WHERE url_hash = $1', [job.url_hash]);
    const embedding = await createEmbedding(buildJobText(job));
    await pool.query(`
      INSERT INTO jobs (
        url_hash, source, source_platform, title, company, location, salary,
        job_type, work_mode, apply_url, description, skills, posted_date,
        role_family, seniority, remote_type, minimum_experience_years,
        required_skills, nice_to_have_skills, embedding_text_version, embedding
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20,$21::vector
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
      toVector(embedding)
    ]);
    if (exists.rowCount) updated++; else inserted++;
  }
  return { inserted, updated, invalid };
};

const createJob = async (job, userId) => {
  await ensureSchema();
  const norm = normalizeJob(job);
  const embedding = await createEmbedding(buildJobText(norm));
  const res = await pool.query(`
    INSERT INTO jobs (
      url_hash, source, source_platform, title, company, company_id, location, salary,
      job_type, work_mode, apply_url, description, skills, posted_date,
      role_family, seniority, remote_type, minimum_experience_years,
      required_skills, nice_to_have_skills, embedding_text_version, embedding
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
    ) RETURNING *
  `, [
    norm.url_hash,
    norm.source,
    norm.source_platform,
    norm.title,
    norm.company,
    userId,
    norm.location,
    norm.salary,
    norm.job_type,
    norm.work_mode,
    norm.apply_url,
    norm.description,
    JSON.stringify(norm.skills),
    norm.posted_date,
    norm.role_family,
    norm.seniority,
    norm.remote_type,
    norm.minimum_experience_years,
    JSON.stringify(norm.required_skills),
    JSON.stringify(norm.nice_to_have_skills),
    EMBEDDING_TEXT_VERSION,
    toVector(embedding)
  ]);
  return res.rows[0];
};

const countStaleJobEmbeddings = async () => {
  await ensureSchema();
  const r = await pool.query('SELECT COUNT(*)::int AS count FROM jobs WHERE embedding_text_version < $1', [EMBEDDING_TEXT_VERSION]);
  return r.rows[0].count;
};

const reembedStaleJobEmbeddings = async ({ batchSize = 50 } = {}) => {
  await ensureSchema();
  let updated = 0;
  const limit = Math.max(1, Math.min(Number(batchSize) || 50, 200));
  for (;;) {
    const res = await pool.query(`
      SELECT * FROM jobs WHERE embedding_text_version < $1 ORDER BY updated_at DESC LIMIT $2
    `, [EMBEDDING_TEXT_VERSION, limit]);
    if (!res.rows.length) break;
    for (const row of res.rows) {
      const job = { ...row, skills: row.skills || [], required_skills: row.required_skills || [], nice_to_have_skills: row.nice_to_have_skills || [] };
      const emb = await createEmbedding(buildJobText(job));
      await pool.query('UPDATE jobs SET embedding = $2::vector, embedding_text_version = $3, updated_at = NOW() WHERE url_hash = $1', [job.url_hash, toVector(emb), EMBEDDING_TEXT_VERSION]);
      updated++;
    }
  }
  return { updated, embeddingTextVersion: EMBEDDING_TEXT_VERSION };
};

const searchSimilarJobs = async (query, limit = 25) => {
  await ensureSchema();
  const emb = await createEmbedding(query);
  const r = await pool.query(`
    SELECT *, GREATEST(0, LEAST(1, 1 - (embedding <=> $1::vector))) AS score
    FROM jobs ORDER BY embedding <=> $1::vector LIMIT $2
  `, [toVector(emb), limit]);
  return r.rows.map(j => ({ ...j, score: Number(Number(j.score).toFixed(4)), skills: Array.isArray(j.skills) ? j.skills : [], required_skills: Array.isArray(j.required_skills) ? j.required_skills : [], nice_to_have_skills: Array.isArray(j.nice_to_have_skills) ? j.nice_to_have_skills : [] }));
};

const getAllJobs = async () => {
  await ensureSchema();
  const r = await pool.query(`
    SELECT * FROM jobs ORDER BY updated_at DESC
  `);
  return r.rows.map(j => ({ ...j, skills: Array.isArray(j.skills) ? j.skills : [], required_skills: Array.isArray(j.required_skills) ? j.required_skills : [], nice_to_have_skills: Array.isArray(j.nice_to_have_skills) ? j.nice_to_have_skills : [] }));
};

const saveRecommendationFeedback = async ({ jobUrlHash, action, reason = '', profile = {}, job = {} }) => {
  await ensureSchema();
  const act = String(action || '').trim().toLowerCase();
  const ok = ['relevant', 'not_relevant', 'too_senior', 'wrong_location', 'saved', 'applied'];
  if (!ok.includes(act)) throw new Error('Unsupported feedback action.');
  const res = await pool.query(`
    INSERT INTO recommendation_feedback (job_url_hash, action, reason, profile_snapshot, job_snapshot)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb) RETURNING id, created_at
  `, [jobUrlHash || null, act, String(reason).slice(0, 500), JSON.stringify(profile), JSON.stringify(job)]);
  return res.rows[0];
};

const createScraperRun = async ({ profile = {}, reason = '' } = {}) => {
  await ensureSchema();
  const r = await pool.query(`
    INSERT INTO scraper_runs (reason, profile_snapshot)
    VALUES ($1, $2::jsonb) RETURNING id, status, started_at
  `, [String(reason).slice(0, 100), JSON.stringify(profile)]);
  return r.rows[0];
};

const recordScraperSourceResult = async ({ runId, source, status, cardsSeen = 0, jobsExtracted = 0, errorMessage = '' }) => {
  if (!runId) return null;
  await ensureSchema();
  const r = await pool.query(`
    INSERT INTO scraper_source_results (scraper_run_id, source, status, cards_seen, jobs_extracted, error_message)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
  `, [runId, String(source).slice(0, 100), String(status).slice(0, 40), Number(cardsSeen) || 0, Number(jobsExtracted) || 0, String(errorMessage).slice(0, 1000)]);
  return r.rows[0];
};

const finishScraperRun = async ({ runId, status, summary = {}, errorMessage = '' }) => {
  if (!runId) return null;
  await ensureSchema();
  const r = await pool.query(`
    UPDATE scraper_runs SET status = $2, scraped_count = $3, inserted_count = $4, updated_count = $5, invalid_count = $6, error_message = $7, finished_at = NOW() WHERE id = $1 RETURNING *
  `, [runId, status, Number(summary.scrapedCount) || 0, Number(summary.inserted) || 0, Number(summary.updated) || 0, Number(summary.invalid) || 0, String(errorMessage).slice(0, 1000)]);
  return r.rows[0];
};

const getRecentScraperRuns = async (limit = 10) => {
  await ensureSchema();
  const runs = await pool.query('SELECT * FROM scraper_runs ORDER BY started_at DESC LIMIT $1', [Math.max(1, Math.min(Number(limit) || 10, 50))]);
  const ids = runs.rows.map(r => r.id);
  if (!ids.length) return [];
  const src = await pool.query('SELECT * FROM scraper_source_results WHERE scraper_run_id = ANY($1::bigint[]) ORDER BY created_at ASC', [ids]);
  const map = new Map();
  src.rows.forEach(s => { const arr = map.get(s.scraper_run_id) || []; arr.push(s); map.set(s.scraper_run_id, arr); });
  return runs.rows.map(r => ({ ...r, sources: map.get(r.id) || [] }));
};

const getJobStats = async () => {
  await ensureSchema();
  const r = await pool.query(`
    SELECT COUNT(*)::int AS total_jobs,
      SUM(CASE WHEN location ILIKE '%india%' OR location ~* '\\m(bangalore|bengaluru|mumbai|delhi|pune|hyderabad|chennai|kolkata|gurugram|gurgaon|noida)\\m' THEN 1 ELSE 0 END)::int AS india_jobs,
      SUM(CASE WHEN NOT (location ILIKE '%india%' OR location ~* '\\m(bangalore|bengaluru|mumbai|delhi|pune|hyderabad|chennai|kolkata|gurugram|gurgaon|noida)\\m') AND location != '' THEN 1 ELSE 0 END)::int AS outside_india_jobs,
      SUM(CASE WHEN remote_type = 'Remote' THEN 1 ELSE 0 END)::int AS remote_jobs,
      SUM(CASE WHEN remote_type = 'Hybrid' THEN 1 ELSE 0 END)::int AS hybrid_jobs,
      SUM(CASE WHEN remote_type = 'Onsite' THEN 1 ELSE 0 END)::int AS onsite_jobs,
      SUM(CASE WHEN LENGTH(description) > 500 THEN 1 ELSE 0 END)::int AS full_description_jobs,
      SUM(CASE WHEN LENGTH(description) >= 150 AND LENGTH(description) <= 500 THEN 1 ELSE 0 END)::int AS partial_description_jobs,
      SUM(CASE WHEN LENGTH(description) < 150 THEN 1 ELSE 0 END)::int AS preview_description_jobs,
      ROUND(AVG(LENGTH(description)))::int AS avg_description_length,
      SUM(CASE WHEN jsonb_array_length(required_skills) = 0 THEN 1 ELSE 0 END)::int AS jobs_with_no_skills,
      ROUND(AVG(jsonb_array_length(required_skills)), 1) AS avg_skills_per_job
    FROM jobs
  `);
  const stats = r.rows[0] || {};
  const srcRes = await pool.query(`SELECT source_platform, COUNT(*)::int AS count FROM jobs WHERE source_platform IS NOT NULL AND source_platform != '' GROUP BY source_platform ORDER BY count DESC`);
  const roleRes = await pool.query(`SELECT role_family, COUNT(*)::int AS count FROM jobs WHERE role_family IS NOT NULL AND role_family != '' GROUP BY role_family ORDER BY count DESC LIMIT 10`);
  const bySource = {};
  srcRes.rows.forEach(row => { bySource[row.source_platform] = row.count; });
  const byRole = {};
  roleRes.rows.forEach(row => { byRole[row.role_family] = row.count; });
  return {
    total_jobs: stats.total_jobs || 0,
    location_distribution: { india_jobs: stats.india_jobs || 0, outside_india_jobs: stats.outside_india_jobs || 0 },
    work_mode_distribution: { remote_jobs: stats.remote_jobs || 0, hybrid_jobs: stats.hybrid_jobs || 0, onsite_jobs: stats.onsite_jobs || 0 },
    description_quality: { full: stats.full_description_jobs || 0, partial: stats.partial_description_jobs || 0, preview: stats.preview_description_jobs || 0, avg_length: stats.avg_description_length || 0 },
    skill_extraction: { jobs_with_no_skills: stats.jobs_with_no_skills || 0, avg_skills_per_job: parseFloat(stats.avg_skills_per_job) || 0 },
    jobs_by_source: bySource,
    jobs_by_role_family: byRole,
  };
};

const closePool = () => pool.end();

// User management
const createUser = async (email, passwordHash, role = 'student') => {
  await ensureSchema();
  const r = await pool.query(`INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING *`, [email, passwordHash, role]);
  return r.rows[0];
};

const findUserByEmail = async (email) => {
  await ensureSchema();
  const r = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
  return r.rows[0] || null;
};

const createStudentProfile = async (userId, resumePath, extractedSkills) => {
  await ensureSchema();
  const r = await pool.query(`INSERT INTO student_profiles (user_id, resume_path, extracted_skills) VALUES ($1, $2, $3::jsonb) RETURNING *`, [userId, resumePath, JSON.stringify(extractedSkills || [])]);
  return r.rows[0];
};

const getStudentProfileByUserId = async (userId) => {
  await ensureSchema();
  const r = await pool.query(`SELECT * FROM student_profiles WHERE user_id = $1`, [userId]);
  return r.rows[0] || null;
};

module.exports = {
  ensureSchema,
  getJobCount,
  getJobStats,
  storeJobs,
  createJob,
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
  createUser,
  findUserByEmail,
  createStudentProfile,
  getStudentProfileByUserId,
};
