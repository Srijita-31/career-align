# Career Align

Career Align is an MVP job matcher. It scrapes live jobs, creates OpenAI embeddings for each scraped job, stores them in Postgres with pgvector, and compares a user profile/resume against those embeddings from the frontend.

## Architecture

```text
Browser form
  -> Express /api/match
  -> Resume/profile parser
  -> OpenAI profile embedding
  -> pgvector similarity search
  -> Ranked job cards

Scraper refresh
  -> utils/sourceCrawlers.js
  -> OpenAI job embeddings
  -> Postgres jobs table
```

`utils/sourceCrawlers.js` is the existing scraper implementation and is intentionally left as-is.

## Setup

Set `OPENAI_API_KEY` in `.env`. A starter `.env` is included locally, and `.env.example` documents the expected variables.

Start the full stack:

```powershell
docker compose up --build
```

Install dependencies:

```powershell
npm install
```

Scrape jobs and store embeddings:

```powershell
npm run scrape
```

Start the app:

```powershell
npm start
```

Open:

```text
http://localhost:4000
```

## Useful Commands

```powershell
npm run dev
docker compose up --build
docker compose down
Invoke-RestMethod -Uri "http://localhost:4000/api/admin/refresh-jobs" -Method Post
Invoke-RestMethod -Uri "http://localhost:4000/api/health"
```

## Environment

```text
DATABASE_URL=postgres://career_align:career_align@localhost:5432/career_align
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
JOB_SOURCES=LinkedIn,Internshala,Indeed,Glassdoor,WeWorkRemotely
```

The embedding column is `vector(1536)`, matching `text-embedding-3-small`.
