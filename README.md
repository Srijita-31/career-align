# Career Align - Current System Status & Architecture Review

# Career Align - Current Working Flow

## Scraping

### When does scraping run?

Scraping runs only when:

1. Backend starts
2. Cron job runs every 6 hours
3. Admin manually triggers refresh
4. Database is empty (fallback)

### Scraping does NOT run when:

* User logs in
* User creates profile
* User edits profile
* User uploads resume
* User requests recommendations

---

## Current Scraper Status

| Source         | Status    |
| -------------- | --------- |
| LinkedIn       | ✅ Working |
| WeWorkRemotely | ✅ Working |
| Internshala    | ❌ Failing |
| Indeed         | ❌ Failing |
| Glassdoor      | ❌ Failing |
| RemoteOK       | ❌ Failing |
| Wellfound      | ❌ Failing |
| Foundit        | ❌ Failing |
| Naukri         | ❌ Failing |

Current inventory in PostgreSQL:

```text
~416 jobs
```

---

## Scraping Flow

```text
LinkedIn + WeWorkRemotely
            ↓
         Scraper
            ↓
      PostgreSQL
```

Jobs are stored and reused until the next scrape cycle.

---

# Recommendation Flow

```text
Student Login
      ↓
Fetch Student Profile
      ↓
Generate Profile Embedding
      ↓
Search Stored Jobs in PostgreSQL
      ↓
Rank Results
      ↓
Return Top Matches
```

No live scraping happens during recommendations.

---

# Recommendation API

## Request

```http
GET /api/recommendations/matches
```

### Input

Authenticated student session.

Profile data is read from:

```text
student_profiles
```

Example profile:

```json
{
  "role": "Frontend Developer",
  "skills": ["React", "TypeScript", "CSS"],
  "location": "Bangalore",
  "workMode": "Remote"
}
```

---

## Response

Content-Type:

```http
application/json
```

Example:

```json
{
  "success": true,
  "count": 25,
  "matches": [
    {
      "jobId": 101,
      "title": "Frontend Developer",
      "company": "ABC Tech",
      "location": "Bangalore",
      "score": 92.4,
      "applyUrl": "https://example.com/job"
    }
  ]
}
```

---

# Database

Database:

```text
PostgreSQL 16 + pgvector
```

Stores:

* Users
* Student Profiles
* Jobs
* Applications
* Notifications

Jobs remain stored after:

* Server restart
* User logout
* Frontend restart

Jobs are updated on subsequent scrape runs.

---

# Summary

```text
Backend Starts
      ↓
Scraper Runs
      ↓
Jobs Stored in PostgreSQL
      ↓
User Logs In
      ↓
Recommendations Requested
      ↓
Search Existing Jobs
      ↓
Return JSON Response
```

Recommendations are generated from jobs already stored in PostgreSQL. Student actions don't trigger scraping.
