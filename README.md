# Career Align

Career Align is a student job matching portal. It accepts profile details and an optional resume, scrapes live jobs from configured job sites, stores valid jobs locally, scores them against the candidate profile, and renders real job cards with working apply links.

The application does not use mock jobs, fallback jobs, emergency seed data, or fake apply URLs.

## Working Sources

These sources are currently active by default and have been verified to scrape real jobs successfully:

- LinkedIn
- Internshala
- Indeed
- Glassdoor
- WeWorkRemotely

The active default source list is configured in `utils/sourceCrawlers.js`:

```js
LinkedIn, Internshala, Indeed, Glassdoor, WeWorkRemotely
```

## Disabled / Unreliable Sources

These scrapers are implemented or partially implemented, but are not enabled by default because they did not reliably return live jobs in this runtime:

- Naukri: returns HTTP `403 Access Denied` from the site/CDN when accessed by the scraper.
- RemoteOK: returned empty placeholder rows or connection errors during verification.
- Wellfound and Foundit: crawler definitions exist, but they are not part of the verified default pipeline.

You can manually test a source by setting `JOB_SOURCES`:

```powershell
$env:JOB_SOURCES="LinkedIn"
npm run scrape
```

For faster one-term scraper checks:

```powershell
$env:JOB_TERM_LIMIT="1"
npm run scrape
```

## Architecture

```text
Browser UI
  -> Express API /api/match
  -> Resume/profile parser
  -> Job aggregator
  -> Local JSON job store
  -> Matcher/scorer
  -> JSON response
  -> Rendered job cards
```

### Main Files

- `server.js`: Express server. Serves the frontend, handles `/api/match`, exposes `/api/admin/refresh-jobs`, and starts the scheduler.
- `public/index.html`: Main frontend page and candidate form.
- `public/app.js`: Submits the form, handles API responses, renders job cards and apply links.
- `public/styles.css`: Frontend styling.
- `utils/resumeParser.js`: Parses form fields and uploaded PDF/DOCX/TXT resumes.
- `utils/sourceCrawlers.js`: Crawlee scraper definitions for job sources.
- `utils/scraperService.js`: Runs live scraping and verifies stored jobs are readable.
- `utils/jobAggregator.js`: Reads stored jobs or triggers scraping when empty, then scores jobs against the profile.
- `utils/db.js`: Local JSON persistence for scraped jobs.
- `scheduler/scrapeScheduler.js`: Periodic background refresh.
- `storage/jobs.json`: Runtime job database generated from live scraped jobs.

## How It Works

1. The user fills out the frontend profile form and optionally uploads a resume.
2. The frontend sends a `POST` request to `/api/match`.
3. The server parses the profile and resume.
4. The job aggregator reads `storage/jobs.json`.
5. If no live jobs are stored, the app scrapes active sources.
6. Scraped jobs are stored only when they have a real title and valid `http(s)` apply URL.
7. Jobs are scored against skills, desired role, location, work preference, and experience level.
8. The API returns real jobs as JSON.
9. The frontend renders cards with title, company, source, match score, and apply link.

If no live jobs can be found, the API returns an explicit error JSON response instead of silently falling back to fake data.

## Run Locally

Install dependencies:

```powershell
npm install
```

Refresh live jobs manually:

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

Run the development server with auto-restart:

```powershell
npm run dev
```

Refresh jobs through the API while the server is running:

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/admin/refresh-jobs" -Method Post
```

Check server health:

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/health"
```

## Notes

- `storage/jobs.json` is runtime data and is ignored by Git.
- `tmp/` is used for uploaded resume files during parsing and is ignored by Git.
- Root-level `tmp-*.js` scratch scripts are ignored by Git.
- `data/sampleJobs.json` and the old seed fallback dataset were removed because the app now uses only live scraped jobs.
