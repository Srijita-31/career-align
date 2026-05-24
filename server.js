require('dotenv').config({ quiet: true });

const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const multer = require('multer');
const { parseResume } = require('./utils/resumeParser');
const { ensureSchema } = require('./utils/db');
const { matchJobs } = require('./utils/jobAggregator');
const { refreshJobs } = require('./utils/scraperService');
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
    const profile = await parseResume(req.body, resumePath);
    const jobs = await matchJobs(profile);

    return res.json({
      success: true,
      profile,
      jobs,
      recommendations: jobs,
      hasStrongMatches: jobs.some((job) => job.score >= 0.75),
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
    const report = await refreshJobs(req.body || undefined);
    res.json({ status: 'ok', report });
  } catch (error) {
    console.error('Error refreshing jobs:', error);
    res.status(500).json({ error: error.message || 'Unable to refresh jobs at this time.' });
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
  })
  .catch((error) => {
    console.error('Unable to start Career Align:', error);
    process.exit(1);
  });
