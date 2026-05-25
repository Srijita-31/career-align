CREATE EXTENSION IF NOT EXISTS vector;

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
  embedding vector(384) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jobs_embedding_hnsw_idx
  ON jobs USING hnsw (embedding vector_cosine_ops);
