require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), quiet: true });

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const {
  countStaleJobEmbeddings,
  ensureSchema,
  getJobStats,
  getRecentScraperRuns,
  saveRecommendationFeedback
} = require('../utils/db');
const { getJobRefreshStatus, queueJobRefresh } = require('../utils/jobRefreshQueue');
const { getScrapeStatus, setCurrentScrape } = require('../utils/scrapeState');
const { startScrapeScheduler } = require('../scheduler/scrapeScheduler');
const { refreshJobs } = require('../utils/scraperService');

const app = express();
const PORT = process.env.PORT || 4001; // Gateway port

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS: allow the frontend origin with credentials (cookies)
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Import Services
const authService = require('../services/auth/routes');
const studentService = require('../services/student/routes');
const companyService = require('../services/company/routes');
const matchingService = require('../services/matching/routes');
const recommendationService = require('../services/recommendation/routes');
const applicationService = require('../services/application/routes');
const recruiterService = require('../services/recruiter/routes');
const adminService = require('../services/admin/routes');
const notificationService = require('../services/notifications/routes');

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
app.use('/api/notifications', notificationService);

// Backward compatibility for old frontend routes (temporarily)
app.use('/api/student/matches', recommendationService);

// Admin / System endpoints
app.get('/api/admin/refresh-jobs/status', (_, res) => res.json({ status: 'ok', refresh: getJobRefreshStatus(), scrape: getScrapeStatus() }));
app.get('/api/scrape-status', async (req, res) => {
  const { getJobCount } = require('../utils/db');
  const count = await getJobCount().catch(() => 0);
  res.json({ status: 'ok', scrape: getScrapeStatus(), jobCount: count });
});
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

// Root endpoint to prevent "Cannot GET /"
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to the Career Align API', 
    healthCheck: '/api/health' 
  });
});

// Start Gateway and Backend Systems
ensureSchema()
  .then(() => {
    startScrapeScheduler();
    app.listen(PORT, () => console.log(`API Gateway running on http://localhost:${PORT}`));
    
    // Trigger live scrape immediately so users see real jobs
    setCurrentScrape(refreshJobs(undefined, { reason: 'startup_live_scrape' })
      .then(result => console.log(`[GATEWAY] Live scrape complete: ${result.scrapedCount} jobs from real sources`))
      .catch(err => console.warn('[GATEWAY] Live scrape failed:', err.message))
    );
    
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
