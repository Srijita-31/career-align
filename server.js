require('dotenv').config({ quiet: true });

const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const multer = require('multer');
const { parseResume } = require('./utils/resumeParser');
const { countStaleJobEmbeddings, ensureSchema, getJobStats, getRecentScraperRuns, saveRecommendationFeedback } = require('./utils/db');
const { matchJobs } = require('./utils/jobAggregator');
const { getJobRefreshStatus, queueJobRefresh } = require('./utils/jobRefreshQueue');
const { startScrapeScheduler } = require('./scheduler/scrapeScheduler');

const upload = multer({ dest: path.join(__dirname, 'tmp') });
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/match', upload.single('resume'), async (req, res) => {
  let resumePath;
  try {
    resumePath = req.file?.path;
    const profile = await parseResume(req.body, req.file);
    const jobs = await matchJobs(profile);

    return res.json({
      success: true,
      profile,
      jobs,
      recommendations: jobs,
      hasStrongMatches: jobs.some((job) => job.score >= 75),
    });
  } catch (error) {
    console.error('Error matching jobs:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to match jobs right now.',
    });
  } finally {
    if (resumePath) {
      await fs.unlink(resumePath).catch(() => undefined);
    }
  }
});

app.post('/api/admin/refresh-jobs', async (req, res) => {
  try {
    const report = queueJobRefresh(req.body?.profile || req.body || undefined, 'api', {
      reembedExisting: req.body?.reembedExisting !== false,
    });
    res.status(report.queued ? 202 : 200).json({ status: 'ok', report });
  } catch (error) {
    console.error('Error queueing job refresh:', error);
    res.status(500).json({ error: error.message || 'Unable to queue job refresh at this time.' });
  }
});

app.get('/api/admin/refresh-jobs/status', (_, res) => {
  res.json({ status: 'ok', refresh: getJobRefreshStatus() });
});

app.get('/api/admin/scraper-runs', async (req, res) => {
  try {
    const runs = await getRecentScraperRuns(req.query.limit);
    res.json({ status: 'ok', runs });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message || 'Unable to load scraper runs.' });
  }
});

// Issue 2: Admin endpoint to check job inventory by location
app.get('/api/admin/job-stats', async (req, res) => {
  try {
    const stats = await getJobStats();
    res.json({ status: 'ok', stats });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message || 'Unable to load job statistics.' });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const feedback = await saveRecommendationFeedback(req.body || {});
    res.status(201).json({ status: 'ok', feedback });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(400).json({ status: 'error', message: error.message || 'Unable to save feedback.' });
  }
});

app.get('/api/health', async (_, res) => {
  try {
    await ensureSchema();
    res.json({ status: 'ok', database: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: error.message });
  }
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureSchema()
  .then(() => {
    startScrapeScheduler();
    app.listen(PORT, () => {
      console.log(`Career Align portal running on http://localhost:${PORT}`);
    });
    countStaleJobEmbeddings()
      .then((count) => {
        if (count > 0) {
          const queued = queueJobRefresh(undefined, 'startup_reembed', { reembedExisting: true });
          console.log(`[DB] Queued re-embedding for ${count} stale job embeddings`, queued);
        }
      })
      .catch((error) => {
        console.warn('[DB] Unable to check stale job embeddings:', error.message);
      });
  })
  .catch((error) => {
    console.error('Unable to start Career Align:', error);
    process.exit(1);
  });
