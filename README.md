# Career Align

A student job matching portal prototype that ingests resume text and profile fields, aggregates jobs from job data sources, and recommends opportunities that align with the candidate's skills.

## Features

- Resume upload and profile form capture
- Resume text extraction for PDF, DOCX, and TXT
- Crawlee-powered job scraping from LinkedIn, Naukri, Internshala, Foundit, Glassdoor, and Indeed
- Work preference selection: remote, onsite, or hybrid
- Skill-based matching with an 80% alignment threshold
- Frontend results display with match score and job details

## Run locally

1. Install dependencies:

```bash
cd "e:\career align"
npm install
```

2. Start the server:

```bash
npm start
```

3. Open `http://localhost:4000`

## Notes

This prototype provides a working workflow for resume parsing and job matching. For production use, add secure authentication, a real job portal scraper/API integration layer, persistent storage, and stronger resume parsing.
