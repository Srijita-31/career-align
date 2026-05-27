# Career Align

Career Align is a live job recommendation portal. It scrapes job listings from configured job boards, converts jobs and candidate profiles into embeddings, stores jobs in PostgreSQL with `pgvector`, and ranks recommendations using both semantic similarity and structured fit signals such as skills, role family, seniority, location, and work mode.

By default the app uses a local embedding model, so OpenAI billing is not required.

## Architecture

```text
Browser UI
  -> POST /api/match
  -> Express API
  -> Resume/profile parser
  -> Profile enrichment
  -> Profile embedding
  -> PostgreSQL pgvector similarity search
  -> Structured ranking layer
  -> Ranked job cards

Background refresh
  -> Crawlee job scrapers
  -> Job normalization
  -> Job enrichment
  -> Background job refresh worker
  -> Job embedding
  -> PostgreSQL jobs table
```

## Request Flow

1. The user fills out the browser form and optionally uploads a resume.
2. `public/app.js` submits the form to `POST /api/match`.
3. `server.js` receives the request and stores the uploaded file temporarily with `multer`.
4. `utils/resumeParser.js` extracts text from PDF, DOCX, or TXT resumes.
5. `utils/enrichment.js` enriches the candidate profile with normalized skills, role family, and seniority.
6. `utils/jobAggregator.js` builds a semantic profile query.
7. `utils/db.js` creates an embedding for the profile query.
8. PostgreSQL `pgvector` searches stored job embeddings by cosine distance.
9. `utils/jobAggregator.js` reranks results using semantic similarity plus structured fit signals.
10. The frontend renders ranked job cards with score, source, role metadata, explanation, and apply link.

## Tech Stack

Backend:

- Node.js
- Express
- PostgreSQL
- `pgvector`
- `pg`
- `multer`
- `pdf-parse`
- `mammoth`
- `node-cron`

Frontend:

- HTML
- CSS
- Vanilla JavaScript
- Fetch API

Scraping:

- Crawlee
- Cheerio crawler
- Playwright crawler
- Puppeteer dependency is installed but the active crawler implementation uses Crawlee with Cheerio/Playwright.

Embeddings:

- Local default: `Xenova/all-MiniLM-L6-v2`
- Optional OpenAI: `text-embedding-3-small`
- Local embedding dimensions: `384`
- OpenAI embedding dimensions: usually `1536` for `text-embedding-3-small`

Infrastructure:

- Docker Compose
- `pgvector/pgvector:pg16`

## Important Files

```text
server.js                         Express app and API routes
public/index.html                 Browser UI
public/app.js                     Form submission and result rendering
public/styles.css                 UI styling
utils/resumeParser.js             Resume and form profile parsing
utils/enrichment.js               Skill, role, seniority, and job metadata enrichment
utils/embeddings.js               Local/OpenAI embedding generation
utils/db.js                       PostgreSQL schema, storage, and vector search
utils/jobAggregator.js            Recommendation orchestration and scoring
utils/jobRefreshQueue.js          Starts and tracks the background refresh worker
utils/sourceCrawlers.js           Live job source crawlers
utils/scraperService.js           Manual scrape refresh entrypoint
scheduler/scrapeScheduler.js      Scheduled scrape refresh every 6 hours
workers/jobRefreshWorker.js       Isolated scraping and embedding worker process
config/app.json                   Job source, default profile, search, and scheduler config
config/rules.json                 Skill, role family, seniority, and resume parsing rules
config/scoring.json               Recommendation weights and result limits
config/sources.json               Source enablement, crawler type, and search URL templates
docker-compose.yml                App and PostgreSQL services
```

## API Routes

### `POST /api/match`

Accepts candidate profile fields and an optional resume file.

Returns:

- Parsed profile
- Ranked jobs
- Recommendation explanations
- Match breakdown fields

Main code path:

```text
server.js
  -> parseResume()
  -> matchJobs()
  -> searchSimilarJobs()
  -> enrich/rerank results
```

### `POST /api/admin/refresh-jobs`

Queues the background worker to scrape and embed refreshed jobs. The API returns immediately while the worker continues separately from the web server.

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/admin/refresh-jobs" -Method Post
```

### `GET /api/admin/refresh-jobs/status`

Checks whether a refresh worker is currently running.

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/admin/refresh-jobs/status"
```

### `GET /api/admin/scraper-runs`

Returns recent scraper runs with per-source status, cards seen, extracted jobs, and error messages.

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/admin/scraper-runs?limit=10"
```

### `POST /api/feedback`

Stores recommendation feedback for later ranking analysis.

Supported actions:

- `relevant`
- `not_relevant`
- `too_senior`
- `wrong_location`
- `saved`
- `applied`

### `GET /api/health`

Checks database connectivity and schema readiness.

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/health"
```

## Job Scraping

Jobs are accessed by scraping configured live job sources. The active sources are controlled by `JOB_SOURCES` in `.env`.

Default active sources:

```text
LinkedIn,Internshala,Indeed,Glassdoor,WeWorkRemotely
```

The crawler code also contains source definitions for:

- RemoteOK
- WeWorkRemotely
- Internshala
- LinkedIn
- Wellfound
- Foundit
- Naukri
- Indeed
- Glassdoor

Each source definition builds search URLs from the candidate/default profile, crawls result pages, extracts job fields, filters invalid URLs, and deduplicates results.

Extracted job fields include:

- Title
- Company
- Location
- Salary, when available
- Job type
- Work mode
- Apply URL
- Description
- Skills, when available
- Source platform
- Posted date, when available

## Configurable Rules

Most tuning data has been moved out of source code and into config files:

```text
config/app.json
config/rules.json
config/scoring.json
config/sources.json
```

Environment variables can still override deployment-specific values such as `JOB_SOURCES`, `JOB_TERM_LIMIT`, `SCRAPE_CRON`, and `SCRAPE_TIMEZONE`.

`config/sources.json` controls which sources are enabled, whether they use Cheerio or Playwright, and the search URL templates used for each platform. Source-specific extraction logic still lives in code because each site has different markup and interaction behavior, but simple source changes no longer require touching crawler code.

## Enrichment

`utils/enrichment.js` adds structured fields to jobs and profiles using rules loaded from `config/rules.json`. This is rule-based enrichment, not a chat LLM.

For jobs, it infers:

- `role_family`
- `seniority`
- `remote_type`
- `minimum_experience_years`
- `required_skills`
- `nice_to_have_skills`

For profiles, it infers:

- Normalized skills
- `roleFamily`
- `seniority`

Examples of role families:

- Frontend Engineering
- Backend Engineering
- Full Stack Engineering
- Data and Analytics
- AI and Machine Learning
- Cloud and DevOps
- Mobile Engineering
- Product and Design

## Embeddings and LLM Usage

The default `.env` uses local embeddings:

```text
EMBEDDING_PROVIDER=local
LOCAL_EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384
```

The local model is loaded through `@xenova/transformers`:

```text
pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2")
```

It uses mean pooling and normalized vectors.

No chat/completion LLM is used by default. Recommendation explanations are generated by deterministic JavaScript logic in `utils/jobAggregator.js`.

Optional OpenAI embeddings are supported:

```text
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

When using OpenAI embeddings, existing stored jobs must have matching vector dimensions. If the database already contains jobs embedded with a different dimension, clear or re-embed jobs before switching providers.

## Database

The app uses PostgreSQL with `pgvector`.

Main table: `jobs`

Important columns:

```text
id
url_hash
source
source_platform
title
company
location
salary
job_type
work_mode
apply_url
description
skills
posted_date
role_family
seniority
remote_type
minimum_experience_years
required_skills
nice_to_have_skills
embedding
created_at
updated_at
```

Scraper observability tables:

```text
scraper_runs
scraper_source_results
```

The embedding column is:

```text
embedding vector(384)
```

when using the default local MiniLM model.

Vector search uses cosine distance:

```sql
ORDER BY embedding <=> $1::vector
```

The schema is created and migrated at runtime by `ensureSchema()` in `utils/db.js`.

## Recommendation Scoring

The app does not display raw vector similarity as the final score. It combines semantic similarity with structured matching.

Current weighted score from `config/scoring.json`:

```text
35% skills
25% semantic similarity / role text overlap
10% role family
12% seniority fit
10% location
8% work mode
```

The frontend shows the final score and a match breakdown for each job.

Example:

```text
Score: 91
Role family: Frontend Engineering
Seniority: Entry Level
Remote type: Hybrid
Breakdown:
  Skills: 100
  Semantic: 77
  Role: 100
  Seniority: 100
  Location: 100
  Mode: 55
```

## Setup

Install dependencies:

```powershell
npm install
```

Start PostgreSQL:

```powershell
docker compose up -d postgres
```

Start the app:

```powershell
npm start
```

Open:

```text
http://localhost:4000
```

## Full Docker Run

Build and start the full stack:

```powershell
docker compose up --build
```

Stop the stack:

```powershell
docker compose down
```

## Useful Commands

Start in development mode:

```powershell
npm run dev
```

Scrape jobs manually:

```powershell
npm run scrape
```

Refresh jobs through the API:

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/admin/refresh-jobs" -Method Post
```

Check health:

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/health"
```

Start database only:

```powershell
npm run db:up
```

Stop database:

```powershell
npm run db:down
```

## Environment Variables

Example:

```text
PORT=4000
DATABASE_URL=postgres://career_align:career_align@localhost:5432/career_align
EMBEDDING_PROVIDER=local
LOCAL_EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
JOB_SOURCES=LinkedIn,Internshala,Indeed,Glassdoor,WeWorkRemotely
JOB_TERM_LIMIT=6
```

## Background Worker And Scheduler

Scraping and embedding now run through `workers/jobRefreshWorker.js`, started by `utils/jobRefreshQueue.js`. This keeps crawler and embedding work out of the request path and out of the main web server process.

`scheduler/scrapeScheduler.js` queues a background refresh every 6 hours:

```text
0 */6 * * *
```

Timezone:

```text
Asia/Kolkata
```

The scheduled job uses the default profile from `config/app.json` to refresh general job inventory.

Run the worker directly:

```powershell
npm run worker:refresh
```

## Current Limitations

- Some job boards expose limited details on search pages, so skill extraction may be incomplete.
- Scraping can break if source websites change their markup or block crawlers.
- Recommendation explanations are deterministic templates, not LLM-generated summaries.
- There are no user accounts, saved-job dashboards, or application tracking yet.
- Feedback is stored, but ranking does not yet learn from it automatically.
- The worker is process-based; a production version should use a durable queue such as BullMQ, RabbitMQ, or a managed job runner.

## Suggested Next Improvements

- Add user accounts and saved/applied jobs.
- Add filters for role, location, seniority, source, and work mode.
- Fetch full job-detail pages where possible.
- Add stale-job expiry.
- Add source reliability and job freshness scoring.
- Use stored feedback to adjust ranking weights per user and globally.
- Use an LLM only for grounded enrichment/explanations, while keeping embeddings and structured fields as the source of truth.
