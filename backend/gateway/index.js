require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const {
  countStaleJobEmbeddings,
  ensureSchema,
  getJobStats,
  getRecentScraperRuns,
  saveRecommendationFeedback
} = require('../utils/db');
const { getJobRefreshStatus, queueJobRefresh } = require('../utils/jobRefreshQueue');
const { startScrapeScheduler } = require('../scheduler/scrapeScheduler');

const app = express();
const PORT = process.env.PORT || 4001; // Gateway port

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Optional: CORS configuration could be added here if frontend is on a different domain
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Import Services
const authService = require('../services/auth/routes');
const studentService = require('../services/student/routes');
const companyService = require('../services/company/routes');
const matchingService = require('../services/matching/routes');
const recommendationService = require('../services/recommendation/routes');
const applicationService = require('../services/application/routes');
const recruiterService = require('../services/recruiter/routes');
const adminService = require('../services/admin/routes');

// Route to Services
app.use('/api/auth', authService);
app.use('/api/student', studentService); // includes /api/student/profile, /api/student/dashboard
app.use('/api/company', companyService);
app.use('/api/match', matchingService);
app.use('/api/recommendations', recommendationService); // Moved student matches here
app.use('/api/student', recommendationService); // Expose student match route under /api/student/matches for frontend
app.use('/api/applications', applicationService);
app.use('/api/recruiter', recruiterService);
app.use('/api/admin', adminService);

// Backward compatibility for old frontend routes (temporarily)
app.use('/api/student/matches', recommendationService);

// Admin / System endpoints
app.get('/api/admin/refresh-jobs/status', (_, res) => res.json({ status: 'ok', refresh: getJobRefreshStatus() }));
app.get('/api/admin/scraper-runs', async (req, res) => {
  try {
    const runs = await getRecentScraperRuns(req.query.limit);
    res.json({ status: 'ok', runs });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
app.get('/api/admin/job-stats', async (req, res) => {
  try {
    const stats = await getJobStats();
    res.json({ status: 'ok', stats });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const feedback = await saveRecommendationFeedback(req.body || {});
    res.status(201).json({ status: 'ok', feedback });
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

app.get('/api/health', async (_, res) => {
  try {
    await ensureSchema();
    res.json({ status: 'ok', database: 'ok', architecture: 'microservices-gateway' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: error.message });
  }
});

// Start Gateway and Backend Systems
ensureSchema()
  .then(() => {
    startScrapeScheduler();
    app.listen(PORT, () => console.log(`API Gateway running on http://localhost:${PORT}`));
    
    countStaleJobEmbeddings().then(count => {
      if (count > 0) {
        queueJobRefresh(undefined, 'startup_reembed', { reembedExisting: true });
        console.log(`[DB] Queued re‑embedding for ${count} stale job embeddings`);
      }
    }).catch(e => console.warn('[DB] Unable to check stale embeddings:', e.message));
  })
  .catch(error => {
    console.error('Unable to start API Gateway:', error);
    process.exit(1);
  });
