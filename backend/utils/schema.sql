-- Complete Career Align Portal Schema
-- Run this after basic setup to ensure all required tables exist

-- Extension for vector search
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (extended for all roles)
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'recruiter', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Companies table (for recruiters/companies)
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
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- Recruiter Profiles (company representatives)
CREATE TABLE IF NOT EXISTS recruiter_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  full_name TEXT,
  phone TEXT,
  designation TEXT,
  department TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruiter_profiles_user_id ON recruiter_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_profiles_company_id ON recruiter_profiles(company_id);

-- Student Profiles
CREATE TABLE IF NOT EXISTS student_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  work_preference TEXT NOT NULL DEFAULT '',
  experience_level TEXT NOT NULL DEFAULT '',
  location_preference TEXT NOT NULL DEFAULT '',
  profile_completion_percentage INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id ON student_profiles(user_id);

-- Resumes (store multiple versions)
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
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_is_primary ON resumes(is_primary) WHERE is_primary = true;

-- Jobs (extended with company owner info)
CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  url_hash TEXT UNIQUE NOT NULL,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  recruiter_id BIGINT REFERENCES recruiter_profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'internal',
  source_platform TEXT NOT NULL DEFAULT 'internal',
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  salary_min DECIMAL(12,2),
  salary_max DECIMAL(12,2),
  salary_currency TEXT DEFAULT 'USD',
  job_type TEXT NOT NULL DEFAULT 'Full-time',
  work_mode TEXT NOT NULL DEFAULT 'Flexible',
  remote_type TEXT NOT NULL DEFAULT 'Flexible',
  apply_url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  posted_date TEXT NOT NULL DEFAULT '',
  role_family TEXT NOT NULL DEFAULT '',
  seniority TEXT NOT NULL DEFAULT '',
  minimum_experience_years INT NOT NULL DEFAULT 0,
  required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  nice_to_have_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  embedding_text_version INT NOT NULL DEFAULT 2,
  embedding vector(384) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_id ON jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_embedding_hnsw ON jobs USING hnsw (embedding vector_cosine_ops);

-- Applications (student applies to jobs)
CREATE TABLE IF NOT EXISTS applications (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id BIGINT REFERENCES resumes(id) ON DELETE SET NULL,
  match_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  matched_skills JSONB DEFAULT '[]'::jsonb,
  missing_skills JSONB DEFAULT '[]'::jsonb,
  recruiter_notes TEXT,
  current_status TEXT NOT NULL DEFAULT 'applied' CHECK (current_status IN ('applied', 'under_review', 'shortlisted', 'rejected', 'interview', 'selected')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_student_id ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_current_status ON applications(current_status);

-- Application Status History (track all status changes)
CREATE TABLE IF NOT EXISTS application_status_history (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_status_history_application_id ON application_status_history(application_id);

-- Notifications
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
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Recommendation Feedback (existing)
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  job_url_hash TEXT REFERENCES jobs(url_hash) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  profile_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  job_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scraper Runs (existing)
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
);

-- Scraper Source Results (existing)
CREATE TABLE IF NOT EXISTS scraper_source_results (
  id BIGSERIAL PRIMARY KEY,
  scraper_run_id BIGINT REFERENCES scraper_runs(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  cards_seen INT NOT NULL DEFAULT 0,
  jobs_extracted INT NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes on commonly queried columns
CREATE INDEX IF NOT EXISTS idx_recruiter_profiles_company_id_verified ON recruiter_profiles(company_id, is_verified);
CREATE INDEX IF NOT EXISTS idx_jobs_active_created ON jobs(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_student_status_created ON applications(student_id, current_status, created_at DESC);
