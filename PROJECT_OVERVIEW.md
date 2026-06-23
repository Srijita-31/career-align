# Career Align — Project Overview

A full-stack job recommendation portal with multi-role authentication (students, recruiters, admins). It scrapes job listings from configured job boards, converts jobs and candidate profiles into vector embeddings, stores jobs in PostgreSQL with `pgvector`, and ranks recommendations using semantic similarity combined with structured fit signals.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Data Flow](#data-flow)
4. [Scraper System](#scraper-system)
5. [Recommendation Engine](#recommendation-engine)
6. [Database Schema](#database-schema)
7. [Authentication & Authorization](#authentication--authorization)
8. [Frontend Overview](#frontend-overview)
9. [Configuration](#configuration)
10. [Background Jobs & Scheduling](#background-jobs--scheduling)

---

## Architecture

```
                          ┌─────────────────────┐
                          │   Next.js Frontend   │  (port 3000)
                          │  (React/TypeScript)  │
                          └──────────┬──────────┘
                                     │  API calls (JWT via httpOnly cookie)
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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js 18+, Express 4, JWT, bcrypt, cookie-parser |
| **Frontend** | Next.js 16.2.7, React 19.2.4, TypeScript 5, Tailwind CSS 4, Recharts, Lucide React |
| **Database** | PostgreSQL 16 + pgvector extension |
| **Scraping** | Crawlee (CheerioCrawler + PlaywrightCrawler) |
| **Embeddings** | Local deterministic (SHA-256 → `Xenova/all-MiniLM-L6-v2`-dimension vectors) or OpenAI |
| **File Parsing** | pdf-parse, mammoth (DOCX), multer |
| **Email** | Nodemailer (console driver by default) |
| **Scheduling** | node-cron (every 6 hours) |

---

## Data Flow

### 1. Job Ingestion Flow (Scraper → Database)

```
Job Boards (LinkedIn, Indeed, Internshala, etc.)
        │
        ▼
  Crawlee Crawler (Cheerio or Playwright)
        │
        ▼
  Raw Job Extraction (title, company, location, salary, description, skills, apply_url)
        │
        ▼
  Source-level Deduplication (per source, by URL)
        │
        ▼
  Description Enrichment (fetch full job description from apply_url if truncated)
        │
        ▼
  Cross-source Deduplication (by title+company+location and URL hash)
        │
        ▼
  Job Normalization (normalizeJob in db.js)
    • URL hashing (SHA-256 of apply URL)
    • Field normalization
    • Enrichment:
        - role_family (AI/ML, Backend, Frontend, etc.)
        - seniority (Intern, Entry, Mid, Senior)
        - remote_type (Remote, Hybrid, Onsite)
        - minimum_experience_years
        - required_skills / nice_to_have_skills
        │
        ▼
  Embedding Generation (createEmbedding)
    • Build text from: title, role_family, skills, seniority, location, description
    • Generate 384-dim vector using SHA-256-based deterministic embedding
        │
        ▼
  PostgreSQL INSERT ON CONFLICT (url_hash)
    • New jobs → inserted
    • Existing jobs → updated (source, title, company, etc.)
```

### 2. Student Recommendation Flow

```
Student fills profile (skills, target_roles, location_preference, etc.)
        │
        ▼
  GET /api/recommendations/matches (or /api/student/matches)
        │
        ▼
  Build Profile Query (buildProfileQuery in jobAggregator.js)
    • Constructs structured text: Role, Domain, Skills, Experience, Location, etc.
        │
        ▼
  Generate Profile Embedding (same createEmbedding function)
        │
        ▼
  PostgreSQL pgvector Search
    • `SELECT *, 1 - (embedding <=> $1::vector) AS score`
    • Cosine distance similarity search
    • HNSW index (jobs_embedding_hnsw_idx) for acceleration
        │
        ▼
  Multi-factor Scoring (enrichJob / jobAggregator.js)
    • Weights:
        - Skills match: 32%
        - Semantic similarity: 32%
        - Seniority fit: 12%
        - Role family: 10%
        - Location: 10%
        - Work mode: 4%
    • Hard filters (seniority, role family mismatch)
    • Score ceilings and caps
        │
        ▼
  Ranking & Deduplication
    • Sort by final score descending
    • Deduplicate by title+company+location
    • Return top N (default 25)
        │
        ▼
  Response to Frontend
    • Each job includes: score, matchBreakdown, matchedSkills, missingSkills,
      requiredSkills, why (explanations), skillGap, recommendedNextSkills
```

### 3. Application Flow

```
Student clicks "Apply" on a job card
        │
        ▼
  POST /api/applications/apply { jobId }
        │
        ▼
  Check: already applied? (409 if duplicate)
  Check: job exists? student profile exists?
        │
        ▼
  Skills Matching (basic overlap calculation)
    • matchScore = (matchedSkills / jobSkills.length) * 60 + 20
        │
        ▼
  Create Application record (status: 'applied')
        │
        ▼
  Notification sent to job's recruiter (if recruiter_id exists)
        │
        ▼
  Response: { message, application }
```

---

## Scraper System

### Architecture

The scraper system is built on **Crawlee** and supports two crawler types:

| Type | Tool | Sources |
|------|------|---------|
| **CheerioCrawler** | Cheerio (fast, lightweight HTML parsing) | LinkedIn, WeWorkRemotely |
| **PlaywrightCrawler** | Headless Chromium (JS rendering) | RemoteOK, Internshala, Indeed, Glassdoor, Wellfound, Foundit, Naukri |

### Active Sources (default)

| Source | URL Template | Crawler Type |
|--------|-------------|-------------|
| **LinkedIn** | `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={{term}}&location={{location}}` | Cheerio |
| **Internshala** | `https://internshala.com/internships/{{termSlug}}?location={{location}}` | Playwright |
| **Indeed** | `https://in.indeed.com/jobs?q={{term}}&l={{location}}` | Playwright |
| **Glassdoor** | `https://www.glassdoor.co.in/Job/india-{{termSlug}}-jobs-SRCH_IL.0,5_IN115_KO6.htm` | Playwright |
| **WeWorkRemotely** | `https://weworkremotely.com/remote-jobs/search?term={{term}}` | Cheerio |
| **RemoteOK** | `https://remoteok.com/remote-{{termSlug}}-jobs` | Playwright |
| **Wellfound** | `https://wellfound.com/jobs?query={{term}}&remote=true&locations={{location}}` | Playwright |
| **Foundit** | `https://www.foundit.in/jobs?searchTerm={{term}}&location={{location}}` | Playwright |
| **Naukri** | `https://www.naukri.com/{{termSlug}}-jobs-in-india` | Playwright |

### Search Terms Construction

Built dynamically per scrape run from:
1. `profile.desiredRole` (e.g., "software engineer")
2. `profile.skills` (first 3 skills)
3. `appConfig.defaultSearchTerms` (11 default terms)
4. Deduplicated and limited to `JOB_TERM_LIMIT` (default: 6)

Default search terms: `software engineer`, `frontend developer`, `backend developer`, `python developer`, `react developer`, `AI/ML intern`, `data analyst`, `cloud engineer`, `internship`, `fresher`, `entry level`

### Scraper Input Profile

```json
{
  "desiredRole": "software engineer",
  "skills": ["javascript", "python", "react"],
  "location": "India",
  "workPreference": "remote"
}
```

### Extraction Pipeline (per source)

1. **Build URLs** — Generate search URLs from templates using search terms
2. **Crawl** — Navigate to each URL, wait for selectors, extract job cards
3. **Extract** — Parse job fields from DOM:
   - `title`, `company`, `location`, `salary`
   - `job_type` (Full-time / Internship — inferred)
   - `work_mode` (Remote / Hybrid / Onsite — inferred via `inferWorkMode`)
   - `apply_url` (absolute URL)
   - `description` (from card or fetched full page)
   - `skills` (from tags, badges, skill pills)
   - `posted_date` (if available)
   - `source_platform` (set to source name)
4. **Filter** — Remove jobs without title or valid apply URL
5. **Log source result** — Record cards_seen, jobs_extracted, status

### Raw Job Object (pre-normalization)

```json
{
  "id": "linkedin-software-engineer-abc123",
  "title": "Software Engineer",
  "company": "Google",
  "location": "Bangalore, India",
  "salary": "",
  "job_type": "Full-time",
  "work_mode": "Hybrid",
  "apply_url": "https://www.linkedin.com/jobs/view/123456",
  "description": "We are looking for...",
  "skills": ["Python", "Java", "SQL"],
  "source_platform": "LinkedIn",
  "source": "LinkedIn",
  "posted_date": "2024-01-15"
}
```

### Post-Processing (after all sources scraped)

1. **Cross-source Deduplication** — By apply_url (without query params) or fallback title|company|location
2. **Description Enrichment** — For jobs with description < 500 chars, fetch full page HTML and extract description from platform-specific selectors
3. **Normalization** — `normalizeJob()` in `db.js`:
   - SHA-256 hash of apply URL → `url_hash`
   - Apply enrichment rules (role_family, seniority, remote_type, experience_years, required/nice-to-have skills)
   - Build embedding text → create embedding vector → store in PostgreSQL

### Normalized Job Object (stored in DB)

```json
{
  "url_hash": "a1b2c3d4e5f6...",
  "source": "LinkedIn",
  "source_platform": "LinkedIn",
  "title": "Software Engineer",
  "company": "Google",
  "location": "Bangalore, India",
  "salary": "",
  "job_type": "Full-time",
  "work_mode": "Hybrid",
  "apply_url": "https://www.linkedin.com/jobs/view/123456",
  "description": "We are looking for...",
  "skills": ["Python", "Java", "SQL"],
  "posted_date": "2024-01-15",
  "role_family": "Backend Engineering",
  "seniority": "Mid Level",
  "remote_type": "Hybrid",
  "minimum_experience_years": 2,
  "required_skills": ["Python", "Java", "SQL"],
  "nice_to_have_skills": ["Docker", "Kubernetes"],
  "embedding_text_version": 2,
  "embedding": [0.012, -0.345, ..., 0.078],
  "is_active": true
}
```

### Embedding Generation

**Default provider: `local`**

Uses a deterministic hash-based approach:
1. Clean input text (collapse whitespace)
2. SHA-256 hash → 32 bytes
3. Expand bytes to 384 dimensions by repeating
4. Map each byte (0–255) to float [-1, 1]
5. Normalize to unit length

**Optional provider: `openai`**
- Uses `text-embedding-3-small` (1536 dimensions)
- Requires `OPENAI_API_KEY`

Embedding text format (built by `buildJobText`):
```
Role: Software Engineer
Domain: Backend Engineering
Skills: Python Java SQL
Seniority: Mid Level
Minimum experience years: 2
Work mode: Hybrid
Location: Bangalore, India
Summary: We are looking for...
```

---

## Recommendation Engine

### Profile Enrichment (`enrichProfile`)

Input: Raw profile fields → enriched with:
- `skills` — Normalized using skill aliases (e.g., "react" → "ReactJS")
- `roleFamily` — Inferred from text + skills
- `seniority` — Inferred from experience level

### Profile Query (for vector search)

```text
Role: Frontend Developer
Domain: Frontend Engineering
Skills: ReactJS TypeScript CSS
Experience: Entry Level
Preferred Roles: frontend, react, ui
Education: B.Tech Computer Science
Preferred location: Bangalore
Work preference: remote
Summary: ...
```

### Scoring Weights (from `config/scoring.json`)

| Factor | Weight | Description |
|--------|--------|-------------|
| **Semantic** | 32% | Cosine similarity from pgvector search |
| **Skills** | 32% | Overlap of normalized skills with weighted importance |
| **Seniority** | 12% | Level alignment (Intern/Entry/Mid/Senior) |
| **Role Family** | 10% | Domain match (e.g., Frontend vs Backend) |
| **Location** | 10% | Geographic preference alignment |
| **Work Mode** | 4% | Remote/Hybrid/Onsite preference |

### Scoring Sub-Components

**Semantic Score:**
- Raw cosine distance from pgvector: `1 - (embedding <=> $1::vector)`
- Normalized: `max(0, (cosine - 0.15) / 0.5)`
- Also computed via text overlap score as fallback

**Skills Score:**
- High-priority skills (Python, ML, NLP, SQL, LLM, etc.) weighted 1.35x
- Low-priority skills (HTML, CSS, Tailwind, Sass) weighted 0.7x
- Confidence tiers based on number of detected required skills
- Capped when role family is weak or evidence is thin

**Seniority Fit Score:**
- Exact match = 1.0
- Adjacent levels = 0.85–1.0
- Fresher vs Senior role = 0.1–0.2
- Inferred from title, seniority field, and minimum_experience_years

**Role Family Score:**
- Exact match = 1.0
- Adjacent (AI/ML ↔ Data, Backend ↔ Full Stack) = 0.65
- Mismatch = 0.4

**Location Score:**
- Remote jobs score higher for remote preference
- India jobs score higher for India preference
- Exact location match = 1.0
- Mismatch = 0.1

**Work Mode Score:**
- Exact match = 1.0
- Remote ↔ Hybrid = 0.55
- Mismatch = 0.25

### Hard Filters & Penalties

| Filter | Condition | Effect |
|--------|-----------|--------|
| Seniority hard filter | Fresher profile × Senior role (5+ yrs or senior signals) | **Removed** (hardFiltered = true) |
| Seniority penalty | Fresher × Mid level (2+ yrs) | 0.75x penalty |
| Role hard filter | Role family mismatch | 0.7x penalty on overall score |

### Score Ceilings

| Condition | Ceiling |
|-----------|---------|
| Role family weak (< 0.5) | 54% |
| Role family adjacent (< 0.65) | 68% |
| Semantic very low (< 0.15) | 58% |
| Semantic low (< 0.3) | 72% |
| Low evidence + high skill score | 65% |

### Final Score Calculation

```
weightedScore = (semantic * 32) + (skills * 32) + (roleFamily * 10)
              + (seniority * 12) + (location * 10) + (workMode * 4)

cappedScore = min(weightedScore, ceiling * 100)
finalScore = cappedScore * hardFilterPenalty

matchConfidence = 
    finalScore >= 85 → "Strong Match"
    finalScore >= 70 → "Good Match"
    finalScore >= 55 → "Stretch Match"
    else            → "Weak Match"
```

### Recommendation Response Format

```json
{
  "status": "ok",
  "jobs": [
    {
      // All job fields (title, company, location, salary, etc.)
      "score": 87,
      "unpenalizedScore": 91,
      "cappedScore": 87,
      "matchConfidence": "Strong Match",
      "rawSemanticScore": 0.7421,
      "matchBreakdown": {
        "skills": 85,
        "semantic": 78,
        "roleFamily": 100,
        "seniority": 90,
        "location": 70,
        "workMode": 100
      },
      "requiredSkills": ["ReactJS", "TypeScript", "CSS"],
      "niceToHaveSkills": ["GraphQL"],
      "matchedSkills": ["ReactJS", "TypeScript"],
      "missingSkills": ["CSS"],
      "skillEvidence": {
        "matchedRequiredCount": 2,
        "detectedRequiredCount": 3,
        "confidence": "high",
        "rawCoverage": 85
      },
      "skillGap": {
        "matched": ["ReactJS", "TypeScript"],
        "missing": ["CSS"],
        "recommended": ["CSS"]
      },
      "recommendedNextSkills": ["CSS"],
      "scoreCaps": [],
      "filterReasons": [],
      "why": [
        "Matched 2 of 3 detected required skills: ReactJS, TypeScript.",
        "Helped by a Frontend Engineering role classification and Entry Level seniority.",
        "Missing skills include CSS."
      ],
      "hardFiltered": false,
      "source_platform": "LinkedIn",
      "apply_url": "https://..."
    }
  ]
}
```

---

## Database Schema

### Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts (student, recruiter, admin) | `id`, `email`, `password_hash`, `role` |
| `student_profiles` | Student details | `user_id`, `full_name`, `skills`, `target_roles`, `resume_text`, `work_preference`, `experience_level`, `location_preference`, `education`, `experience`, `projects` |
| `recruiter_profiles` | Recruiter details | `user_id`, `company_id`, `full_name`, `is_verified` |
| `companies` | Company information | `id`, `name`, `website`, `industry`, `size` |
| `jobs` | Scraped and recruiter-posted jobs | `id`, `url_hash` (unique), `title`, `company`, `embedding vector(384)`, `role_family`, `seniority`, `required_skills`, etc. |
| `applications` | Student applications | `student_id`, `job_id`, `match_score`, `current_status`, `matched_skills`, `missing_skills` |
| `application_status_history` | Audit log | `application_id`, `old_status`, `new_status`, `changed_by_user_id` |
| `resumes` | Uploaded resume files | `user_id`, `file_name`, `extracted_text`, `parsed_data` |
| `notifications` | User notifications | `user_id`, `type`, `title`, `message`, `is_read` |
| `recommendation_feedback` | Feedback on recommendations | `job_url_hash`, `action`, `reason` |
| `scraper_runs` | Scraper execution logs | `status`, `reason`, `scraped_count`, `inserted_count`, `updated_count` |
| `scraper_source_results` | Per-source scraping results | `scraper_run_id`, `source`, `status`, `cards_seen`, `jobs_extracted` |

### Indexes

- `jobs_embedding_hnsw_idx` — HNSW index on `jobs.embedding` (vector_cosine_ops)
- `recruiter_profiles` — on user_id, company_id
- `resumes` — on user_id, is_primary
- `applications` — on student_id, job_id, current_status
- `application_status_history` — on application_id
- `notifications` — on user_id, is_read

---

## Authentication & Authorization

### JWT Token

- Algorithm: HS256
- Secret: `JWT_SECRET` env var (default: `replace-with-strong-secret`)
- Expiry: 7 days
- Payload: `{ id, role }`
- Transport: httpOnly cookie (`token`) + Authorization Bearer header fallback

### Auth Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register (student or recruiter) |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/forgot-password` | No | Send reset email |
| POST | `/api/auth/reset-password` | No | Reset password |
| GET | `/api/auth/me` | Yes | Current user info |

### Role Guards

| Guard | Middleware | Access |
|-------|-----------|--------|
| `authMiddleware` | JWT verification | Any authenticated user |
| `requireAdmin` | Role check `req.user.role === 'admin'` | Admin only |
| Inline checks | `req.user.role !== 'student'` → 403 | Role-specific routes |

### Registration Input

**Student:**
```json
{
  "email": "student@example.com",
  "password": "securePass123",
  "role": "student"
}
```

**Recruiter:**
```json
{
  "email": "recruiter@example.com",
  "password": "securePass123",
  "role": "recruiter",
  "company_name": "Acme Corp",
  "full_name": "John Doe",
  "designation": "HR Manager"
}
```

### Registration Response

```json
{
  "status": "ok",
  "token": "eyJhbGciOiJI...",
  "user": { "id": 1, "email": "student@example.com", "role": "student" }
}
```

### Login Input

```json
{
  "email": "student@example.com",
  "password": "securePass123"
}
```

### Login Response

```json
{
  "status": "ok",
  "token": "eyJhbGciOiJI...",
  "user": { "id": 1, "email": "student@example.com", "role": "student" }
}
```

---

## Frontend Overview

### Pages

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/` | `page.tsx` | No | Landing page (Login / Register links) |
| `/login` | — | No | Login form |
| `/register/student` | — | No | Student registration |
| `/register/recruiter` | — | No | Recruiter registration |
| `/forgot-password` | — | No | Password reset |
| `/dashboard` | `DashboardContent.tsx` | Yes | Role-based dashboard |
| `/student/dashboard` | — | Yes (student) | Student dashboard with job matches |
| `/student/profile` | — | Yes (student) | Student profile management |
| `/recruiter/` | — | Yes (recruiter) | Recruiter pages |

### API Client (`src/lib/api.ts`)

- Base URL: `NEXT_PUBLIC_API_URL` env var or `http://localhost:4001`
- Uses `credentials: 'include'` for httpOnly cookie auth
- No Authorization header (cookie is auto-sent)
- Helper: `apiFetch<T>(path, options)` — wraps fetch with error handling

---

## Configuration

All JSON config files live in `backend/config/`:

| File | Purpose |
|------|---------|
| `app.json` | Default profile, job sources, search terms, scheduler settings |
| `rules.json` | Skill aliases (200+), phrase skills, role family patterns, seniority rules, resume skills (250+) |
| `scoring.json` | Weights, normalization, thresholds, location priority |
| `sources.json` | Source enablement, crawler type, search URL templates (9 sources) |
| `index.js` | Config loader — merges JSON with env var overrides |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4001 | API Gateway port |
| `DATABASE_URL` | `postgres://career_align:career_align@localhost:5432/career_align` | PostgreSQL connection |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |
| `JWT_SECRET` | `replace-with-strong-secret` | JWT signing secret |
| `EMBEDDING_PROVIDER` | `local` | `local` or `openai` |
| `EMBEDDING_DIMENSIONS` | 384 | Vector dimension (384 for local, 1536 for OpenAI) |
| `LOCAL_EMBEDDING_MODEL` | `Xenova/all-MiniLM-L6-v2` | (reserved) |
| `JOB_SOURCES` | All 9 sources | Comma-separated active sources |
| `JOB_TERM_LIMIT` | 6 | Max search terms per scrape |
| `JOB_SOURCE_URL_LIMIT` | — | Max URLs per source (2 for playwright, term limit for cheerio) |
| `JOB_SOURCE_TIMEOUT_MS` | 90000 | Per-source timeout |
| `SCRAPE_CRON` | `0 */6 * * *` | Cron schedule |
| `SCRAPE_TIMEZONE` | `Asia/Kolkata` | Cron timezone |
| `MAIL_DRIVER` | `console` | Email driver (`console` or `smtp`) |

---

## Background Jobs & Scheduling

### Scrape Scheduler

- Started on API Gateway boot
- Cron: every 6 hours (`0 */6 * * *`) in Asia/Kolkata
- Spawns a child process (`jobRefreshWorker.js`) via `fork()`

### Job Refresh Worker

Separate process that runs:
1. Re-embed stale jobs (if embedding_text_version changed)
2. Crawl all active sources for fresh jobs
3. Store/update jobs in PostgreSQL
4. Close database pool and exit

### Manual Triggers

| Command | Description |
|---------|-------------|
| `npm run scrape` | Run scrape in-process |
| `npm run worker:refresh` | Fork worker process |
| `npm run reembed` | Re-embed all jobs |
| `POST /api/admin/refresh-jobs` | Queue background refresh via API |

### Scrape State Management (`scrapeState.js`)

- Tracks current in-progress scrape promise
- `waitForScrape(timeout)` — waits for current scrape to finish
- `getScrapeStatus()` — returns `{ running, lastScrapeTime, lastScrapeResult }`
