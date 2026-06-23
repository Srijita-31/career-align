# Career Align — API Reference

All API endpoints are served via the API Gateway at `http://localhost:4001`.

- **Base URL:** `http://localhost:4001`
- **Auth:** JWT via httpOnly cookie (`token`) or `Authorization: Bearer <token>` header
- **Content-Type:** `application/json` (except `/api/match` which uses `multipart/form-data`)
- **Response envelope:** Most endpoints return `{ status: "ok", ...data }` or `{ status: "error", message: "..." }`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Student](#2-student)
3. [Company & Jobs](#3-company--jobs)
4. [Recruiter](#4-recruiter)
5. [Matching & Recommendations](#5-matching--recommendations)
6. [Applications](#6-applications)
7. [Notifications](#7-notifications)
8. [Admin](#8-admin)
9. [System](#9-system)

---

## 1. Authentication

### POST /api/auth/register

Register a new user (student or recruiter).

**Request Body (Student):**
```json
{
  "email": "student@example.com",
  "password": "securePass123",
  "role": "student"
}
```

**Request Body (Recruiter):**
```json
{
  "email": "recruiter@acme.com",
  "password": "securePass123",
  "role": "recruiter",
  "company_name": "Acme Corp",
  "full_name": "John Doe",
  "designation": "HR Manager",
  "phone": "+91-9876543210"
}
```

**Response (201):**
```json
{
  "status": "ok",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "role": "student"
  }
}
```

**Errors:**
- `400` — Missing email/password
- `409` — User already exists

---

### POST /api/auth/login

Authenticate a user.

**Request:**
```json
{
  "email": "student@example.com",
  "password": "securePass123"
}
```

**Response:**
```json
{
  "status": "ok",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "role": "student"
  }
}
```

**Errors:**
- `400` — Missing email/password
- `401` — Invalid credentials

---

### POST /api/auth/forgot-password

Send password reset email.

**Request:**
```json
{
  "email": "student@example.com"
}
```

**Response:**
```json
{
  "status": "ok",
  "message": "Password reset instructions have been sent if the account exists.",
  "resetUrl": "http://localhost:3000/forgot-password?token=eyJ..."
}
```

---

### POST /api/auth/reset-password

Reset password using token from email.

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "newPassword": "newSecurePass456"
}
```

**Response:**
```json
{
  "status": "ok",
  "message": "Password updated successfully."
}
```

---

### GET /api/auth/me

Get current authenticated user info.

**Headers:** `Authorization: Bearer <token>` or httpOnly cookie

**Response:**
```json
{
  "status": "ok",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "role": "student"
  }
}
```

---

## 2. Student

### GET /api/student/profile

Get the authenticated student's profile.

**Auth:** Required (student role)

**Response:**
```json
{
  "status": "ok",
  "profile": {
    "id": 1,
    "user_id": 1,
    "full_name": "Jane Student",
    "phone": "+91-9876543210",
    "college": "IIT Bombay",
    "degree": "B.Tech",
    "major": "Computer Science",
    "graduation_year": 2025,
    "resume_text": "...",
    "resume_path": null,
    "skills": ["JavaScript", "Python", "React"],
    "target_roles": ["Frontend Developer", "Full Stack Developer"],
    "extracted_skills": ["JavaScript", "Python", "React", "Node.js"],
    "education": [],
    "experience": [],
    "projects": [],
    "work_preference": "remote",
    "experience_level": "Entry Level",
    "location_preference": "Bangalore",
    "profile_completion_percentage": 60,
    "created_at": "2024-01-15T10:00:00.000Z",
    "updated_at": "2024-01-15T10:00:00.000Z"
  }
}
```

**Errors:**
- `403` — Not a student
- `404` — Profile not found

---

### POST /api/student/profile

Create student profile (initial setup).

**Auth:** Required (student role)

**Request:**
```json
{
  "resumePath": "/path/to/resume.pdf",
  "skills": ["JavaScript", "Python"]
}
```

**Response (201):**
```json
{
  "status": "ok",
  "profile": {
    "id": 1,
    "user_id": 1,
    "resume_path": "/path/to/resume.pdf",
    "extracted_skills": ["JavaScript", "Python"],
    "profile_completion_percentage": 10,
    "created_at": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### POST /api/student/profile/setup

Update profile after registration (merges fields).

**Auth:** Required (student role)

**Request:**
```json
{
  "full_name": "Jane Student",
  "skills": ["JavaScript", "Python", "React"],
  "target_roles": ["Frontend Developer"],
  "work_preference": "remote",
  "experience_level": "Entry Level",
  "location_preference": "Bangalore"
}
```

**Response:**
```json
{
  "status": "ok",
  "profile": { "...updated profile..." }
}
```

---

### GET /api/student/dashboard

Get student dashboard data.

**Auth:** Required (student role)

**Response:**
```json
{
  "status": "ok",
  "dashboardData": {
    "profile": { "...student profile..." },
    "profileCompletionPercentage": 60,
    "applicationSummary": {
      "applied": 5,
      "under_review": 2,
      "shortlisted": 1,
      "interview": 0,
      "selected": 0,
      "rejected": 1,
      "withdrawn": 0
    }
  }
}
```

---

## 3. Company & Jobs

### POST /api/company/jobs

Create a new job posting (recruiter only).

**Auth:** Required (recruiter role)

**Request:**
```json
{
  "title": "Senior Frontend Developer",
  "company": "Acme Corp",
  "location": "Bangalore, India",
  "salary": "₹20-30 LPA",
  "job_type": "Full-time",
  "work_mode": "Hybrid",
  "apply_url": "https://acme.com/careers/frontend-dev",
  "description": "We are looking for a senior frontend developer...",
  "skills": ["React", "TypeScript", "CSS", "GraphQL"],
  "posted_date": "2024-01-15"
}
```

**Response (201):**
```json
{
  "status": "ok",
  "job": {
    "id": 101,
    "url_hash": "a1b2c3d4e5...",
    "title": "Senior Frontend Developer",
    "company": "Acme Corp",
    "company_id": 5,
    "recruiter_id": 3,
    "location": "Bangalore, India",
    "salary": "₹20-30 LPA",
    "job_type": "Full-time",
    "work_mode": "Hybrid",
    "apply_url": "https://acme.com/careers/frontend-dev",
    "description": "We are looking for...",
    "skills": ["React", "TypeScript", "CSS", "GraphQL"],
    "role_family": "Frontend Engineering",
    "seniority": "Senior",
    "remote_type": "Hybrid",
    "minimum_experience_years": 5,
    "required_skills": ["ReactJS", "TypeScript", "CSS", "GraphQL"],
    "nice_to_have_skills": [],
    "is_active": true,
    "created_at": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### GET /api/company/jobs

Get all jobs for the recruiter's company.

**Auth:** Required (recruiter role)

**Response:**
```json
{
  "status": "ok",
  "jobs": [ "...job objects..." ]
}
```

---

### GET /api/company/jobs/all

Get all jobs (public, no auth required).

**Response:**
```json
{
  "status": "ok",
  "jobs": [ "...all job objects..." ]
}
```

---

### PUT /api/company/jobs/:id

Update a job posting (recruiter only).

**Auth:** Required (recruiter role)

**Request:** (partial update — only send fields to change)
```json
{
  "title": "Updated Title",
  "salary": "₹25-35 LPA"
}
```

**Response:**
```json
{
  "status": "ok",
  "job": { "...updated job..." }
}
```

---

### DELETE /api/company/jobs/:id

Delete a job posting (recruiter only).

**Auth:** Required (recruiter role)

**Response:**
```json
{
  "status": "ok",
  "message": "Job deleted"
}
```

---

## 4. Recruiter

### POST /api/recruiter/profile

Create recruiter profile.

**Auth:** Required (recruiter role)

**Request:**
```json
{
  "companyName": "Acme Corp",
  "companyWebsite": "https://acme.com",
  "fullName": "John Doe",
  "phone": "+91-9876543210",
  "designation": "HR Manager"
}
```

**Response:**
```json
{
  "message": "Recruiter profile created",
  "recruiterProfile": {
    "id": 1,
    "user_id": 2,
    "company_id": 5,
    "full_name": "John Doe",
    "phone": "+91-9876543210",
    "designation": "HR Manager",
    "is_verified": false
  }
}
```

---

### GET /api/recruiter/profile

Get recruiter profile with company details.

**Auth:** Required (recruiter role)

**Response:**
```json
{
  "recruiterProfile": {
    "id": 1,
    "user_id": 2,
    "company_id": 5,
    "full_name": "John Doe",
    "phone": "+91-9876543210",
    "designation": "HR Manager",
    "is_verified": true,
    "created_at": "2024-01-15T10:00:00.000Z"
  },
  "company": {
    "id": 5,
    "name": "Acme Corp",
    "website": "https://acme.com",
    "description": "",
    "industry": "",
    "size": ""
  }
}
```

---

### GET /api/recruiter/dashboard

Get recruiter dashboard data.

**Auth:** Required (recruiter role)

**Response:**
```json
{
  "recruiter": {
    "id": 1,
    "user_id": 2,
    "company_id": 5,
    "full_name": "John Doe",
    "is_verified": true
  },
  "activeJobs": 12,
  "totalApplicants": 45,
  "hiringFunnel": {
    "applied": 45,
    "under_review": 20,
    "shortlisted": 8,
    "interview": 3,
    "selected": 1,
    "rejected": 12,
    "withdrawn": 1
  }
}
```

---

### GET /api/recruiter/job/:jobId/applicants

Get applicants for a specific job.

**Auth:** Required (recruiter role)

**Response:**
```json
[
  {
    "id": 10,
    "student_id": 1,
    "job_id": 101,
    "resume_id": null,
    "match_score": 75,
    "matched_skills": ["React", "JavaScript"],
    "missing_skills": ["TypeScript"],
    "current_status": "applied",
    "email": "student@example.com",
    "full_name": "Jane Student",
    "applied_at": "2024-01-15T10:00:00.000Z"
  }
]
```

---

### PUT /api/recruiter/application/:applicationId/status

Update application status.

**Auth:** Required (recruiter role)

**Request:**
```json
{
  "status": "shortlisted",
  "notes": "Strong candidate, scheduling interview"
}
```

**Valid status values:** `applied`, `under_review`, `shortlisted`, `rejected`, `interview`, `selected`

**Response:**
```json
{
  "message": "Application status updated",
  "application": { "...updated application..." }
}
```

---

## 5. Matching & Recommendations

### GET /api/recommendations/matches

Get recommended jobs for the authenticated student.

**Auth:** Required (student role)

**Behavior:**
1. Fetches student profile from DB
2. Builds profile query from: `target_roles`, `skills`, `experience_level`, `location_preference`, `work_preference`, `education`
3. Runs vector similarity search against all jobs
4. Applies multi-factor scoring (skill overlap, semantic similarity, seniority, role family, location, work mode)
5. Returns top 25 ranked results

**Response:**
```json
{
  "status": "ok",
  "jobs": [
    {
      "id": 101,
      "url_hash": "a1b2c3d4...",
      "source": "LinkedIn",
      "source_platform": "LinkedIn",
      "title": "Frontend Developer",
      "company": "Tech Corp",
      "company_id": null,
      "location": "Bangalore, India",
      "salary": "₹12-18 LPA",
      "job_type": "Full-time",
      "work_mode": "Remote",
      "apply_url": "https://linkedin.com/jobs/view/123",
      "description": "We are looking for a frontend developer...",
      "skills": ["React", "JavaScript", "CSS", "HTML"],
      "posted_date": "2024-01-10",
      "role_family": "Frontend Engineering",
      "seniority": "Mid Level",
      "remote_type": "Remote",
      "minimum_experience_years": 2,
      "required_skills": ["ReactJS", "JavaScript", "CSS"],
      "nice_to_have_skills": ["TypeScript"],
      "embedding_text_version": 2,
      "is_active": true,
      "created_at": "2024-01-10T12:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z",
      "score": 87,
      "unpenalizedScore": 92,
      "cappedScore": 87,
      "matchConfidence": "Strong Match",
      "rawSemanticScore": 0.8123,
      "matchBreakdown": {
        "skills": 85,
        "semantic": 82,
        "roleFamily": 100,
        "seniority": 90,
        "location": 70,
        "workMode": 100
      },
      "requiredSkills": ["ReactJS", "JavaScript", "CSS"],
      "niceToHaveSkills": ["TypeScript"],
      "matchedSkills": ["ReactJS", "JavaScript"],
      "missingSkills": ["CSS"],
      "skillEvidence": {
        "matchedRequiredCount": 2,
        "detectedRequiredCount": 3,
        "confidence": "high",
        "rawCoverage": 85
      },
      "skillGap": {
        "matched": ["ReactJS", "JavaScript"],
        "missing": ["CSS"],
        "recommended": ["CSS"]
      },
      "recommendedNextSkills": ["CSS"],
      "scoreCaps": [],
      "filterReasons": [],
      "hardFiltered": false,
      "why": [
        "Matched 2 of 3 detected required skills: ReactJS, JavaScript.",
        "Helped by a Frontend Engineering role classification and Mid Level seniority.",
        "Missing skills include CSS."
      ]
    }
  ]
}
```

---

### GET /api/student/matches

Alias for `/api/recommendations/matches`. Same behavior and response.

---

### POST /api/match

Match a candidate profile (with optional resume upload) against stored jobs.

**Content-Type:** `multipart/form-data`

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resume` | File | No | PDF, DOCX, or TXT resume |
| `desiredRole` | string | No | Target role title |
| `semanticSearch` | string | No | Free-text role description |
| `skills` | string | No | Comma/semicolon-separated skills |
| `workPreference` | string | No | `remote`, `hybrid`, `onsite` |
| `experienceLevel` | string | No | `Student`, `Entry Level`, `Mid Level`, `Senior` |
| `education` | string | No | Education details |
| `locationScope` | string | No | `india` or `outside-india` |
| `summary` | string | No | Additional profile summary |

**Response:**
```json
{
  "success": true,
  "profile": {
    "name": "Jane Student",
    "email": "",
    "desiredRole": "Frontend Developer",
    "semanticSearch": "",
    "location": "India",
    "locationScope": "india",
    "workPreference": "remote",
    "education": "B.Tech Computer Science",
    "experienceLevel": "Entry Level",
    "skills": ["reactjs", "javascript", "css", "html"],
    "summary": "...cleaned resume text...",
    "roleFamily": "Frontend Engineering",
    "seniority": "Entry Level",
    "resumeDiagnostics": {
      "originalName": "resume.pdf",
      "mimeType": "application/pdf",
      "extractedCharacters": 4520,
      "cleanedCharacters": 3800,
      "parsedAsBinaryNoise": false
    }
  },
  "jobs": [ "...ranked job objects (same format as /recommendations/matches)..." ],
  "recommendations": [ "...same as jobs..." ],
  "hasStrongMatches": true
}
```

---

## 6. Applications

### POST /api/applications/apply

Apply to a job.

**Auth:** Required (student role)

**Request:**
```json
{
  "jobId": 101
}
```

**Response:**
```json
{
  "message": "Application submitted",
  "application": {
    "id": 50,
    "student_id": 1,
    "job_id": 101,
    "resume_id": null,
    "match_score": 75,
    "matched_skills": ["ReactJS", "JavaScript"],
    "missing_skills": ["CSS", "TypeScript"],
    "current_status": "applied",
    "recruiter_notes": null,
    "applied_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**
- `400` — Missing `jobId` or student profile not found
- `404` — Job not found
- `409` — Already applied to this job

---

### GET /api/applications/my-applications

Get all applications for the authenticated student.

**Auth:** Required (student role)

**Response:**
```json
[
  {
    "id": 50,
    "student_id": 1,
    "job_id": 101,
    "resume_id": null,
    "match_score": 75,
    "matched_skills": ["ReactJS", "JavaScript"],
    "missing_skills": ["CSS", "TypeScript"],
    "current_status": "under_review",
    "recruiter_notes": null,
    "applied_at": "2024-01-15T10:30:00.000Z",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-16T10:00:00.000Z",
    "title": "Frontend Developer",
    "company": "Tech Corp",
    "location": "Bangalore, India"
  }
]
```

---

### GET /api/applications/:applicationId

Get application details.

**Auth:** Required

**Response:**
```json
{
  "id": 50,
  "student_id": 1,
  "job_id": 101,
  "resume_id": null,
  "match_score": 75,
  "matched_skills": ["ReactJS", "JavaScript"],
  "missing_skills": ["CSS", "TypeScript"],
  "current_status": "under_review",
  "recruiter_notes": null,
  "applied_at": "2024-01-15T10:30:00.000Z",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-16T10:00:00.000Z"
}
```

---

### POST /api/applications/:applicationId/withdraw

Withdraw an application (student only).

**Auth:** Required (student role — must own the application)

**Response:**
```json
{
  "message": "Application withdrawn",
  "application": {
    "...updated application with current_status: 'withdrawn'..."
  }
}
```

---

## 7. Notifications

### GET /api/notifications

Get all notifications for the authenticated user.

**Auth:** Required

**Response:**
```json
{
  "status": "ok",
  "notifications": [
    {
      "id": 1,
      "user_id": 1,
      "type": "application_status",
      "title": "Application Shortlisted",
      "message": "Your application has been shortlisted for Frontend Developer at Tech Corp.",
      "related_entity_type": "application",
      "related_entity_id": 50,
      "is_read": false,
      "action_url": "/student/dashboard",
      "created_at": "2024-01-16T10:00:00.000Z"
    }
  ],
  "unreadCount": 3
}
```

---

### PATCH /api/notifications/:id/read

Mark a notification as read.

**Auth:** Required

**Response:**
```json
{
  "status": "ok",
  "notification": {
    "id": 1,
    "is_read": true,
    "..."
  }
}
```

---

### POST /api/notifications/read-all

Mark all notifications as read.

**Auth:** Required

**Response:**
```json
{
  "status": "ok"
}
```

---

## 8. Admin

All admin endpoints require `authMiddleware` + `requireAdmin` (user must have `role: 'admin'`).

### GET /api/admin/dashboard

Get platform analytics.

**Response:**
```json
{
  "totalStudents": 150,
  "totalRecruiters": 25,
  "totalJobs": 1200,
  "totalApplications": 450,
  "applicationStatusSummary": {
    "applied": 450,
    "under_review": 200,
    "shortlisted": 80,
    "interview": 30,
    "selected": 15,
    "rejected": 100,
    "withdrawn": 25
  }
}
```

---

### GET /api/admin/students

List all students.

**Response:**
```json
[
  {
    "id": 1,
    "email": "student@example.com",
    "role": "student",
    "created_at": "2024-01-15T10:00:00.000Z",
    "full_name": "Jane Student",
    "college": "IIT Bombay",
    "profile_completion_percentage": 60
  }
]
```

---

### GET /api/admin/recruiters

List all recruiters.

**Response:**
```json
[
  {
    "id": 2,
    "email": "recruiter@acme.com",
    "role": "recruiter",
    "created_at": "2024-01-14T10:00:00.000Z",
    "full_name": "John Doe",
    "company_name": "Acme Corp",
    "is_verified": true
  }
]
```

---

### GET /api/admin/jobs

List all jobs (limited to 100).

**Response:**
```json
[
  {
    "id": 101,
    "title": "Frontend Developer",
    "company": "Tech Corp",
    "company_name": null,
    "location": "Bangalore, India",
    "is_active": true,
    "created_at": "2024-01-10T12:00:00.000Z"
  }
]
```

---

### GET /api/admin/applications

List all applications (limited to 100).

**Response:**
```json
[
  {
    "id": 50,
    "student_id": 1,
    "job_id": 101,
    "match_score": 75,
    "current_status": "applied",
    "created_at": "2024-01-15T10:30:00.000Z",
    "email": "student@example.com",
    "title": "Frontend Developer",
    "company": "Tech Corp"
  }
]
```

---

### PUT /api/admin/recruiters/:recruiterId/verify

Verify a recruiter.

**Response:**
```json
{
  "message": "Recruiter verified",
  "recruiter": { "...updated recruiter profile..." }
}
```

---

### PUT /api/admin/users/:userId/suspend

Suspend a user.

**Response:**
```json
{
  "message": "User suspended",
  "user": { "...updated user..." }
}
```

---

### POST /api/admin/refresh-jobs

Queue a background job refresh (triggers scraper + re-embedding).

**Response:**
```json
{
  "queued": true,
  "status": "started",
  "pid": 12345,
  "reason": "manual"
}
```

---

### GET /api/admin/refresh-jobs/status

Check if refresh worker is running.

**Response:**
```json
{
  "status": "ok",
  "refresh": {
    "running": true,
    "pid": 12345,
    "lastQueuedAt": "2024-01-15T12:00:00.000Z"
  },
  "scrape": {
    "running": false,
    "lastScrapeTime": "2024-01-15T11:00:00.000Z",
    "lastScrapeResult": {
      "runId": 5,
      "scrapedCount": 150,
      "totalPersisted": 1200,
      "reembeddedCount": 0,
      "inserted": 45,
      "updated": 105,
      "invalid": 12
    }
  }
}
```

---

### GET /api/admin/scraper-runs?limit=10

Recent scraper run logs.

**Response:**
```json
{
  "status": "ok",
  "runs": [
    {
      "id": 5,
      "status": "completed",
      "reason": "schedule",
      "scraped_count": 150,
      "inserted_count": 45,
      "updated_count": 105,
      "invalid_count": 12,
      "error_message": "",
      "started_at": "2024-01-15T11:00:00.000Z",
      "finished_at": "2024-01-15T11:05:00.000Z",
      "sources": [
        {
          "id": 10,
          "scraper_run_id": 5,
          "source": "LinkedIn",
          "status": "completed",
          "cards_seen": 50,
          "jobs_extracted": 25,
          "error_message": ""
        }
      ]
    }
  ]
}
```

---

### GET /api/admin/job-stats

Job inventory statistics.

**Response:**
```json
{
  "status": "ok",
  "stats": {
    "total_jobs": 1200,
    "location_distribution": {
      "india_jobs": 800,
      "outside_india_jobs": 400
    },
    "work_mode_distribution": {
      "remote_jobs": 450,
      "hybrid_jobs": 300,
      "onsite_jobs": 450
    },
    "description_quality": {
      "full": 600,
      "partial": 400,
      "preview": 200,
      "avg_length": 850
    },
    "skill_extraction": {
      "jobs_with_no_skills": 100,
      "avg_skills_per_job": 3.2
    },
    "jobs_by_source": {
      "LinkedIn": 300,
      "Indeed": 250,
      "Internshala": 200,
      "Naukri": 150,
      "Glassdoor": 100,
      "RemoteOK": 80,
      "WeWorkRemotely": 60,
      "Wellfound": 40,
      "Foundit": 20
    },
    "jobs_by_role_family": {
      "Backend Engineering": 350,
      "Frontend Engineering": 250,
      "Full Stack Engineering": 200,
      "AI and Machine Learning": 150,
      "Data and Analytics": 100,
      "Cloud and DevOps": 80,
      "Mobile Engineering": 40,
      "General Technology": 30
    }
  }
}
```

---

## 9. System

### GET /api/health

Health check.

**Response:**
```json
{
  "status": "ok",
  "database": "ok",
  "architecture": "microservices-gateway"
}
```

---

### GET /api/scrape-status

Current scrape status and job count.

**Response:**
```json
{
  "status": "ok",
  "scrape": {
    "running": false,
    "lastScrapeTime": "2024-01-15T11:00:00.000Z",
    "lastScrapeResult": { "scrapedCount": 150, "totalPersisted": 1200 }
  },
  "jobCount": 1200
}
```

---

### POST /api/feedback

Submit recommendation feedback.

**Request:**
```json
{
  "jobUrlHash": "a1b2c3d4e5...",
  "action": "relevant",
  "reason": "Great match for my skills",
  "profile": { "skills": ["JavaScript", "React"] },
  "job": { "title": "Frontend Developer", "company": "Tech Corp" }
}
```

**Valid actions:** `relevant`, `not_relevant`, `too_senior`, `wrong_location`, `saved`, `applied`

**Response (201):**
```json
{
  "status": "ok",
  "feedback": { "id": 1, "created_at": "2024-01-15T12:00:00.000Z" }
}
```

---

### GET /

Root welcome message.

**Response:**
```json
{
  "message": "Welcome to the Career Align API",
  "healthCheck": "/api/health"
}
```

---

## Common Error Response Format

```json
{
  "status": "error",
  "message": "Description of what went wrong"
}
```

Some legacy endpoints use:
```json
{
  "error": "Error message here"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad request (missing/invalid fields) |
| `401` | Unauthorized (missing/invalid token) |
| `403` | Forbidden (wrong role) |
| `404` | Not found |
| `409` | Conflict (duplicate) |
| `500` | Internal server error |
| `503` | Service unavailable (database down) |
