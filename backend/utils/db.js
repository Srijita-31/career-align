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
      logo_url TEXT,
      industry TEXT,
      size TEXT,
      founded_year INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
      recruiter_id BIGINT,
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
      is_active BOOLEAN NOT NULL DEFAULT true,
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
      phone TEXT,
      college TEXT,
      degree TEXT,
      major TEXT,
      graduation_year INT,
      resume_text TEXT,
      resume_path TEXT,
      skills JSONB DEFAULT '[]'::jsonb,
      target_roles JSONB DEFAULT '[]'::jsonb,
      extracted_skills JSONB DEFAULT '[]'::jsonb,
      education JSONB DEFAULT '[]'::jsonb,
      experience JSONB DEFAULT '[]'::jsonb,
      projects JSONB DEFAULT '[]'::jsonb,
      profile_completion_percentage INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  // New tables for full application workflow
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recruiter_profiles (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      full_name TEXT,
      phone TEXT,
      designation TEXT,
      is_verified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resumes (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INT NOT NULL,
      extracted_text TEXT,
      parsed_data JSONB DEFAULT '{}'::jsonb,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id BIGSERIAL PRIMARY KEY,
      student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      resume_id BIGINT REFERENCES resumes(id) ON DELETE SET NULL,
      match_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      matched_skills JSONB DEFAULT '[]'::jsonb,
      missing_skills JSONB DEFAULT '[]'::jsonb,
      recruiter_notes TEXT,
      current_status TEXT NOT NULL DEFAULT 'applied' CHECK (current_status IN ('applied', 'under_review', 'shortlisted', 'rejected', 'interview', 'selected', 'withdrawn')),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(student_id, job_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS application_status_history (
      id BIGSERIAL PRIMARY KEY,
      application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_entity_type TEXT,
      related_entity_id BIGINT,
      is_read BOOLEAN NOT NULL DEFAULT false,
      action_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Create indexes for better query performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_recruiter_profiles_user_id ON recruiter_profiles(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_recruiter_profiles_company_id ON recruiter_profiles(company_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_resumes_is_primary ON resumes(is_primary) WHERE is_primary = true`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_applications_student_id ON applications(student_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(current_status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_application_status_history_app_id ON application_status_history(application_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);
  
  // Add missing columns to existing tables if they don't exist
  try {
    await pool.query(`ALTER TABLE jobs ADD COLUMN company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE jobs ADD COLUMN recruiter_id BIGINT`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE jobs ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE companies ADD COLUMN logo_url TEXT`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE companies ADD COLUMN industry TEXT`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE companies ADD COLUMN size TEXT`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE companies ADD COLUMN founded_year INT`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE companies ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE student_profiles ADD COLUMN phone TEXT`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE student_profiles ADD COLUMN college TEXT`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE student_profiles ADD COLUMN degree TEXT`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE student_profiles ADD COLUMN major TEXT`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE student_profiles ADD COLUMN graduation_year INT`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE student_profiles ADD COLUMN education JSONB DEFAULT '[]'::jsonb`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE student_profiles ADD COLUMN experience JSONB DEFAULT '[]'::jsonb`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE student_profiles ADD COLUMN projects JSONB DEFAULT '[]'::jsonb`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE student_profiles ADD COLUMN profile_completion_percentage INT NOT NULL DEFAULT 0`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE student_profiles ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  } catch (e) {}
};
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
  const companyId = job.company_id || null;
  const recruiterId = job.recruiter_id || null;
  const res = await pool.query(`
    INSERT INTO jobs (
      url_hash, source, source_platform, title, company, company_id, recruiter_id, location, salary,
      job_type, work_mode, apply_url, description, skills, posted_date,
      role_family, seniority, remote_type, minimum_experience_years,
      required_skills, nice_to_have_skills, embedding_text_version, embedding
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
    ) RETURNING *
  `, [
    norm.url_hash,
    norm.source,
    norm.source_platform,
    norm.title,
    norm.company,
    companyId,
    recruiterId,
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

const updateUserPassword = async (email, passwordHash) => {
  await ensureSchema();
  const r = await pool.query(`UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING *`, [passwordHash, email]);
  return r.rows[0] || null;
};

// Company Management
const createCompany = async (name, website, description, industry, size) => {
  await ensureSchema();
  const r = await pool.query(`INSERT INTO companies (name, website, description, industry, size) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [name, website, description, industry, size]);
  return r.rows[0];
};

const getCompanyById = async (companyId) => {
  await ensureSchema();
  const r = await pool.query(`SELECT * FROM companies WHERE id = $1`, [companyId]);
  return r.rows[0] || null;
};

// Recruiter Profile Management
const createRecruiterProfile = async (userId, companyId, fullName, phone, designation) => {
  await ensureSchema();
  const r = await pool.query(`INSERT INTO recruiter_profiles (user_id, company_id, full_name, phone, designation) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [userId, companyId, fullName, phone, designation]);
  return r.rows[0];
};

const getRecruiterProfileByUserId = async (userId) => {
  await ensureSchema();
  const r = await pool.query(`SELECT * FROM recruiter_profiles WHERE user_id = $1`, [userId]);
  return r.rows[0] || null;
};

// Application Management
const createApplication = async (studentId, jobId, resumeId, matchScore, matchedSkills, missingSkills) => {
  await ensureSchema();
  const r = await pool.query(`INSERT INTO applications (student_id, job_id, resume_id, match_score, matched_skills, missing_skills) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [studentId, jobId, resumeId, matchScore, JSON.stringify(matchedSkills || []), JSON.stringify(missingSkills || [])]);
  return r.rows[0];
};

const getApplicationsByStudentId = async (studentId) => {
  await ensureSchema();
  const r = await pool.query(`SELECT a.*, j.title, j.company, j.location FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.student_id = $1 ORDER BY a.created_at DESC`, [studentId]);
  return r.rows;
};

const getApplicationsByJobId = async (jobId) => {
  await ensureSchema();
  const r = await pool.query(`SELECT a.*, u.email, sp.full_name FROM applications a JOIN users u ON a.student_id = u.id LEFT JOIN student_profiles sp ON a.student_id = sp.user_id WHERE a.job_id = $1 ORDER BY a.match_score DESC`, [jobId]);
  return r.rows;
};

const updateApplicationStatus = async (applicationId, newStatus, recruiterNotes = '') => {
  await ensureSchema();
  const app = await pool.query(`SELECT * FROM applications WHERE id = $1`, [applicationId]);
  if (app.rows.length === 0) throw new Error('Application not found');
  const oldStatus = app.rows[0].current_status;
  const r = await pool.query(`UPDATE applications SET current_status = $1, recruiter_notes = $2, updated_at = NOW() WHERE id = $3 RETURNING *`, [newStatus, recruiterNotes || null, applicationId]);
  await pool.query(`INSERT INTO application_status_history (application_id, old_status, new_status) VALUES ($1, $2, $3)`, [applicationId, oldStatus, newStatus]);
  return r.rows[0];
};

const checkApplicationExists = async (studentId, jobId) => {
  await ensureSchema();
  const r = await pool.query(`SELECT * FROM applications WHERE student_id = $1 AND job_id = $2`, [studentId, jobId]);
  return r.rows[0] || null;
};

// Dashboard Analytics
const getStudentDashboardData = async (studentId) => {
  await ensureSchema();
  const profile = await getStudentProfileByUserId(studentId);
  const appStats = await pool.query(`SELECT current_status, COUNT(*)::int as count FROM applications WHERE student_id = $1 GROUP BY current_status`, [studentId]);
  const applicationSummary = {};
  appStats.rows.forEach(row => { applicationSummary[row.current_status] = row.count; });
  return { profile, profileCompletionPercentage: profile?.profile_completion_percentage || 0, applicationSummary };
};

const getRecruiterDashboardData = async (recruiterId) => {
  await ensureSchema();
  const recruiter = await getRecruiterProfileByUserId(recruiterId);
  if (!recruiter) return null;
  const jobsRes = await pool.query(`SELECT COUNT(*)::int as count FROM jobs WHERE company_id = $1 AND is_active = true`, [recruiter.company_id]);
  const applicantsRes = await pool.query(`SELECT COUNT(*)::int as count FROM applications a JOIN jobs j ON a.job_id = j.id WHERE j.company_id = $1`, [recruiter.company_id]);
  const funnelRes = await pool.query(`SELECT current_status, COUNT(*)::int as count FROM applications a JOIN jobs j ON a.job_id = j.id WHERE j.company_id = $1 GROUP BY current_status`, [recruiter.company_id]);
  const hiringFunnel = {};
  funnelRes.rows.forEach(row => { hiringFunnel[row.current_status] = row.count; });
  return { recruiter, activeJobs: jobsRes.rows[0].count, totalApplicants: applicantsRes.rows[0].count, hiringFunnel };
};

const getAdminDashboardData = async () => {
  await ensureSchema();
  const studentsRes = await pool.query(`SELECT COUNT(*)::int as count FROM users WHERE role = 'student'`);
  const recruitersRes = await pool.query(`SELECT COUNT(*)::int as count FROM users WHERE role = 'recruiter'`);
  const jobsRes = await pool.query(`SELECT COUNT(*)::int as count FROM jobs WHERE is_active = true`);
  const applicationsRes = await pool.query(`SELECT COUNT(*)::int as count FROM applications`);
  const appStatus = await pool.query(`SELECT current_status, COUNT(*)::int as count FROM applications GROUP BY current_status`);
  const applicationStatusSummary = {};
  appStatus.rows.forEach(row => { applicationStatusSummary[row.current_status] = row.count; });
  return { totalStudents: studentsRes.rows[0].count, totalRecruiters: recruitersRes.rows[0].count, totalJobs: jobsRes.rows[0].count, totalApplications: applicationsRes.rows[0].count, applicationStatusSummary };
};

const calculateProfileCompletion = async (userId) => {
  await ensureSchema();
  const profile = await getStudentProfileByUserId(userId);
  if (!profile) return 0;
  let score = (profile.full_name ? 10 : 0) + (profile.phone ? 10 : 0) + (profile.college ? 10 : 0) + (profile.degree ? 10 : 0) + (profile.major ? 10 : 0) + (profile.graduation_year ? 10 : 0) + (profile.resume_text ? 20 : 0) + (Array.isArray(profile.extracted_skills) && profile.extracted_skills.length > 0 ? 10 : 0);
  await pool.query(`UPDATE student_profiles SET profile_completion_percentage = $1, updated_at = NOW() WHERE user_id = $2`, [score, userId]);
  return score;
};

const getJobsByCompanyId = async (companyId) => {
  await ensureSchema();
  const r = await pool.query(`SELECT * FROM jobs WHERE company_id = $1 AND is_active = true ORDER BY created_at DESC`, [companyId]);
  return r.rows;
};

// Call ensureSchema on module load
ensureSchema().catch(err => {
  console.error('[DB] Failed to initialize schema:', err);
  process.exit(1);
});

// Also ensure schema is called if the db module is imported after initial load
async function initializeDatabase() {
  try {
    await ensureSchema();
  } catch (error) {
    console.error('[DB] Schema initialization failed:', error);
  }
}

module.exports = {
  pool,
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
  updateUserPassword,
  createCompany,
  getCompanyById,
  createRecruiterProfile,
  getRecruiterProfileByUserId,
  createApplication,
  getApplicationsByStudentId,
  getApplicationsByJobId,
  updateApplicationStatus,
  checkApplicationExists,
  getStudentDashboardData,
  getRecruiterDashboardData,
  getAdminDashboardData,
  calculateProfileCompletion,
  getJobsByCompanyId,
};
