# Career Align

Career Align is a full-stack job recommendation portal with multi-role authentication (students, recruiters, admins). It scrapes job listings from configured job boards, converts jobs and candidate profiles into vector embeddings, stores jobs in PostgreSQL with `pgvector`, and ranks recommendations using semantic similarity combined with structured fit signals (skills, role family, seniority, location, work mode).

By default the app uses a local embedding model (`Xenova/all-MiniLM-L6-v2`), so OpenAI billing is not required.

---

## Tech Stack

**Backend:** Node.js 18+, Express, PostgreSQL 16 + `pgvector`, Crawlee (Cheerio + Playwright), `@xenova/transformers`, bcrypt, JWT, cookie-parser, node-cron, multer, pdf-parse, mammoth, nodemailer

**Frontend (new):** Next.js 16.2.7, React 19.2.4, TypeScript 5, Tailwind CSS 4, recharts, lucide-react

**Frontend (legacy):** HTML, CSS, Vanilla JavaScript, Fetch API

**Infrastructure:** Docker, Render deployment

---

## Architecture

```
                          ┌─────────────────────┐
                          │   Next.js Frontend   │  (port 3000)
                          │  (React/TypeScript)  │
                          └──────────┬──────────┘
                                     │  API calls (JWT cookies)
                                     ▼
                          ┌─────────────────────┐
                          │    API Gateway       │  (port 4001)
                          │  gateway/index.js    │
                          └──┬────┬────┬────┬───┘
                             │    │    │    │
              ┌──────────────┼────┼────┼────┼──────────────┐
              ▼              ▼    ▼    ▼    ▼              ▼
         ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐
         │  Auth   │ │Student │ │Company │ │Recruiter│ │  Admin   │
         │ Service │ │Service │ │Service │ │ Service │ │ Service  │
         └─────────┘ └────────┘ └────────┘ └─────────┘ └──────────┘
              │                                            │
              ▼                                            ▼
         ┌─────────┐ ┌────────────┐ ┌────────┐ ┌──────────────┐
         │Matching │ │Recommendatn│ │Applic. │ │Notifications │
         │ Service │ │  Service   │ │Service │ │   Service    │
         └────┬────┘ └─────┬──────┘ └───┬────┘ └──────┬───────┘
              │            │            │              │
              └────────────┴────────────┴──────────────┘
                                  │
                                  ▼
                     ┌─────────────────────┐
                     │   PostgreSQL 16 +    │
                     │   pgvector (jobs,     │
                     │   users, profiles,    │
                     │   applications, etc.) │
                     └─────────────────────┘

  Background Pipeline (separate process):
     Crawlee scrapers → Job normalization → Enrichment
     → Embedding → PostgreSQL jobs table
     (triggered by cron every 6 hours or manually)
```

---

## Request Flow

1. A student registers/logs in via the Next.js frontend (or legacy HTML UI).
2. The student fills out their profile (skills, target roles, resume upload).
3. `GET /api/recommendations/matches` triggers the recommendation engine.
4. `utils/enrichment.js` enriches the student profile with normalized skills, role family, and seniority.
5. `utils/embeddings.js` generates an embedding for the profile query.
6. PostgreSQL `pgvector` searches stored job embeddings by cosine distance.
7. `utils/jobAggregator.js` reranks results using a multi-factor weighted score.
8. The frontend displays ranked job cards with match breakdown and an "Apply" button.
9. Applications are tracked through a full lifecycle: applied → under_review → shortlisted → interview → selected/rejected.

---

## API Routes

### Authentication (`/api/auth`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | No | Register as student, recruiter, or admin |
| POST | `/api/auth/login` | No | Login, returns JWT in httpOnly cookie |
| POST | `/api/auth/forgot-password` | No | Send password reset email |
| POST | `/api/auth/reset-password` | No | Reset password with token |
| GET | `/api/auth/me` | Yes | Get current authenticated user info |

### Student (`/api/student`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/student/profile` | Yes | Get student profile |
| POST | `/api/student/profile` | Yes | Create/update student profile |
| GET | `/api/student/dashboard` | Yes | Student dashboard data |
| GET | `/api/student/matches` | Yes | Get recommended jobs for student |

### Recruiter (`/api/recruiter`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/recruiter/profile` | Yes | Get recruiter profile |
| POST | `/api/recruiter/profile` | Yes | Create recruiter profile |
| GET | `/api/recruiter/dashboard` | Yes | Recruiter dashboard data |
| GET | `/api/recruiter/job/:jobId/applicants` | Yes | Get applicants for a job |
| PUT | `/api/recruiter/application/:appId/status` | Yes | Update application status |

### Company & Jobs (`/api/company`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/company/jobs` | Yes (recruiter) | Create a job posting |
| GET | `/api/company/jobs` | Yes (recruiter) | Get jobs for recruiter's company |
| GET | `/api/company/jobs/all` | No | Get all jobs (public) |
| PUT | `/api/company/jobs/:id` | Yes (recruiter) | Update a job |
| DELETE | `/api/company/jobs/:id` | Yes (recruiter) | Delete a job |

### Matching & Recommendations

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/match` | No | Match a candidate profile (resume upload + form fields) against stored jobs |
| GET | `/api/recommendations/matches` | Yes | Recommended jobs for authenticated student |

### Applications (`/api/applications`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/applications/apply` | Yes (student) | Apply to a job |
| GET | `/api/applications/my-applications` | Yes | Get student's applications |
| GET | `/api/applications/:id` | Yes | Get application details |
| POST | `/api/applications/:id/withdraw` | Yes (student) | Withdraw an application |

### Notifications (`/api/notifications`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/notifications` | Yes | Get user's notifications + unread count |
| PATCH | `/api/notifications/:id/read` | Yes | Mark notification as read |
| POST | `/api/notifications/read-all` | Yes | Mark all notifications as read |

### Admin (`/api/admin`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/admin/dashboard` | Yes (admin) | Platform analytics dashboard |
| GET | `/api/admin/students` | Yes (admin) | List all students |
| GET | `/api/admin/recruiters` | Yes (admin) | List all recruiters |
| PUT | `/api/admin/recruiters/:id/verify` | Yes (admin) | Verify a recruiter |
| GET | `/api/admin/jobs` | Yes (admin) | List all jobs |
| GET | `/api/admin/applications` | Yes (admin) | List all applications |
| PUT | `/api/admin/users/:id/suspend` | Yes (admin) | Suspend a user |
| POST | `/api/admin/refresh-jobs` | Yes | Queue a background job refresh |
| GET | `/api/admin/refresh-jobs/status` | No | Check if refresh worker is running |
| GET | `/api/admin/scraper-runs` | No | Recent scraper run logs |
| GET | `/api/admin/job-stats` | No | Job inventory statistics |

### System

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/feedback` | No | Submit recommendation feedback (relevant, not_relevant, too_senior, wrong_location, saved, applied) |
| GET | `/api/health` | No | Health check (database + schema) |

---

## Database

PostgreSQL 16 with `pgvector` extension. The schema is created and migrated at runtime by `ensureSchema()` in `backend/utils/db.js`.

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (student, recruiter, admin roles) |
| `student_profiles` | Student details, skills, resume text, profile completion |
| `recruiter_profiles` | Recruiter details linked to companies |
| `companies` | Company information |
| `jobs` | Scraped and recruiter-posted jobs with `embedding vector(384)` |
| `applications` | Student applications with status tracking |
| `application_status_history` | Audit log of status changes |
| `resumes` | Uploaded resume files and parsed data |
| `notifications` | Per-user notification feed |
| `recommendation_feedback` | Feedback on job recommendations |
| `scraper_runs` | Scraper execution logs |
| `scraper_source_results` | Per-source scraping results |

Vector search uses cosine distance:

```sql
ORDER BY embedding <=> $1::vector
```

An HNSW index accelerates similarity searches:

```sql
CREATE INDEX ON jobs USING hnsw (embedding vector_cosine_ops);
```

---

## Recommendation Scoring

The app combines semantic similarity with structured matching. Weights from `config/scoring.json`:

| Factor | Weight |
|--------|--------|
| Skills match | 32% |
| Semantic similarity | 32% |
| Seniority fit | 12% |
| Role family | 10% |
| Location | 10% |
| Work mode | 4% |

The frontend shows the final score and a match breakdown per job.

---

## Job Scraping

Jobs are scraped from configured live sources using Crawlee (Cheerio for static, Playwright for JavaScript-heavy sites).

**Default active sources:** LinkedIn, Internshala, Indeed, Glassdoor, WeWorkRemotely

**Also configured:** RemoteOK, Wellfound, Foundit, Naukri

Each source builds search URLs from a candidate/default profile, crawls result pages, extracts job fields, filters invalid URLs, and deduplicates results.

Extracted fields: title, company, location, salary, job type, work mode, apply URL, description, skills, source platform, posted date.

Active sources are controlled by the `JOB_SOURCES` environment variable. Source definitions (search URL templates, crawler type) are in `config/sources.json`.

---

## Enrichment

`utils/enrichment.js` adds structured fields to jobs and profiles using rules from `config/rules.json`. This is rule-based enrichment, not an LLM.

**For jobs:** role_family, seniority, remote_type, minimum_experience_years, required_skills, nice_to_have_skills

**For profiles:** Normalized skills, roleFamily, seniority

Role families include: Frontend Engineering, Backend Engineering, Full Stack Engineering, Data & Analytics, AI/ML, Cloud & DevOps, Mobile Engineering, Product & Design.

---

## Embeddings

Default (local, no-cost):

| Variable | Value |
|----------|-------|
| `EMBEDDING_PROVIDER` | `local` |
| `LOCAL_EMBEDDING_MODEL` | `Xenova/all-MiniLM-L6-v2` |
| `EMBEDDING_DIMENSIONS` | `384` |

Optional (OpenAI):

| Variable | Value |
|----------|-------|
| `EMBEDDING_PROVIDER` | `openai` |
| `OPENAI_API_KEY` | your key |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `EMBEDDING_DIMENSIONS` | `1536` |

When switching providers, ensure existing job embeddings match the new dimension or re-embed all jobs. No chat/completion LLM is used by default — explanations are deterministic.

---

## Background Worker

Scraping and embedding run in an isolated worker process (`workers/jobRefreshWorker.js`), keeping crawler work out of the request path. The scheduler (`scheduler/scrapeScheduler.js`) triggers a refresh every 6 hours via cron:

```
0 */6 * * * (Asia/Kolkata)
```

Run manually:

```powershell
npm run worker:refresh
npm run scrape
```

---

## Setup

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- npm

### Local Development

```powershell
# 1. Start PostgreSQL with pgvector
docker run -d --name career-align-db `
  -e POSTGRES_USER=career_align `
  -e POSTGRES_PASSWORD=career_align `
  -e POSTGRES_DB=career_align `
  -p 5432:5432 `
  pgvector/pgvector:pg16

# 2. Configure environment
copy .env.example .env
# Edit .env and set PORT=4001 (or keep 4000)

# 3. Install and start the backend API Gateway
cd backend
npm install
npm start
# API Gateway runs on http://localhost:4001

# 4. In a separate terminal — start the Next.js frontend
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

Visit `http://localhost:3000` for the frontend or `http://localhost:4001` for the API.

### Stop the application

```powershell
# Stop PostgreSQL
docker stop career-align-db
docker rm career-align-db

# Stop backend/frontend: press Ctrl+C in their terminals
```

### Environment Variables (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4001` | API Gateway port |
| `DATABASE_URL` | `postgres://career_align:career_align@localhost:5432/career_align` | PostgreSQL connection |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |
| `EMBEDDING_PROVIDER` | `local` | `local` or `openai` |
| `EMBEDDING_DIMENSIONS` | `384` | Must match the model |
| `JOB_SOURCES` | `LinkedIn,Internshala,Indeed,Glassdoor,WeWorkRemotely` | Active sources |
| `JOB_TERM_LIMIT` | `6` | Max search terms |
| `SCRAPE_CRON` | `0 */6 * * *` | Schedule |
| `SCRAPE_TIMEZONE` | `Asia/Kolkata` | Cron timezone |

Full example in `.env.example`.

---

## Useful Commands

```powershell
# Start backend in dev mode (auto-restart)
npm run dev

# Scrape jobs manually
npm run scrape

# Re-embed all jobs
npm run reembed

# Run background worker directly
npm run worker:refresh

# Smoke test recommendations
npm run test:recommendations

# Database
npm run db:up       # Start PostgreSQL
npm run db:down     # Stop PostgreSQL

# Health check
Invoke-RestMethod -Uri "http://localhost:4001/api/health"

# Trigger job refresh
Invoke-RestMethod -Uri "http://localhost:4001/api/admin/refresh-jobs" -Method Post
```

---

## Configuration

All tuning data lives in JSON config files under `backend/config/`:

| File | Purpose |
|------|---------|
| `app.json` | Default profile, job sources, search terms, scheduler settings |
| `rules.json` | Skill aliases, role family mapping, seniority rules, resume parsing rules |
| `scoring.json` | Recommendation weights, thresholds, result limits |
| `sources.json` | Source enablement, crawler type, search URL templates |

Environment variables override deployment-specific values (`JOB_SOURCES`, `JOB_TERM_LIMIT`, `SCRAPE_CRON`, etc.).

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/gateway/index.js` | API Gateway — entry point, route mounting, middleware |
| `backend/services/*/routes.js` | Microservice route modules (auth, student, company, recruiter, matching, recommendation, application, admin, notifications) |
| `backend/utils/db.js` | PostgreSQL client, schema creation, all CRUD operations |
| `backend/utils/embeddings.js` | Local/OpenAI embedding generation |
| `backend/utils/enrichment.js` | Skill, role, seniority enrichment |
| `backend/utils/jobAggregator.js` | Recommendation orchestration and scoring |
| `backend/utils/jobRefreshQueue.js` | Background worker lifecycle management |
| `backend/utils/sourceCrawlers.js` | Job board scrapers (Crawlee) |
| `backend/utils/resumeParser.js` | Resume text extraction (PDF, DOCX, TXT) |
| `backend/workers/jobRefreshWorker.js` | Isolated scraping and embedding worker |
| `backend/scheduler/scrapeScheduler.js` | Cron-based scheduler (every 6 hours) |
| `backend/utils/auth.js` | JWT auth, password hashing, role guard |
| `frontend/src/app/` | Next.js App Router pages |
| `frontend/src/components/` | React components (Navbar, Sidebar, JobCard, etc.) |
| `public/` | Legacy HTML/JS frontend |
| `db/init.sql` | Database initialization script |
| `render.yaml` | Render deployment configuration |

---

## Current Limitations

- Scraping can break if source websites change their markup or block crawlers.
- Some job boards expose limited details on search pages, so skill extraction may be incomplete.
- Recommendation explanations are deterministic templates, not LLM-generated.
- The background worker is process-based; a production version should use a durable queue (BullMQ, RabbitMQ).
- Feedback is stored but ranking does not yet learn from it automatically.

## Suggested Next Improvements

- Add filters for role, location, seniority, source, and work mode.
- Fetch full job-detail pages where possible.
- Add stale-job expiry.
- Add source reliability and job freshness scoring.
- Use stored feedback to adjust ranking weights per user and globally.
- Use an LLM for grounded enrichment/explanations while keeping embeddings as the source of truth.
