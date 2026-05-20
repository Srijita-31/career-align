const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const multer = require('multer');
const { parseResume } = require('./utils/resumeParser');
const { aggregateJobs, matchJobs } = require('./utils/jobAggregator');
const { refreshJobs } = require('./utils/scraperService');
const { startScrapeScheduler } = require('./scheduler/scrapeScheduler');

const upload = multer({ dest: path.join(__dirname, 'tmp') });
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/match', upload.single('resume'), async (req, res) => {
  try {
    const form = req.body;
    const resumePath = req.file?.path;
    const parsed = await parseResume(form, resumePath);
    if (resumePath) {
      await fs.unlink(resumePath).catch(() => undefined);
    }

    const jobs = await aggregateJobs(parsed);
    if (!jobs.length) {
      return res.status(502).json({
        success: false,
        error: 'NO_LIVE_JOBS',
        message: 'No live jobs could be scraped from sources.',
        profile: parsed,
        jobs: [],
        recommendations: [],
      });
    }

    const matches = matchJobs(parsed, jobs, 0);
    if (!matches.length) {
      return res.status(502).json({
        success: false,
        error: 'NO_VALID_LIVE_JOBS',
        message: 'Live jobs were scraped, but none had the required title and apply URL.',
        profile: parsed,
        jobs: [],
        recommendations: [],
      });
    }

    const hasStrongMatches = matches.some((job) => job.score >= 0.8);

    return res.json({
      success: true,
      profile: parsed,
      jobs: matches,
      recommendations: matches,
      hasStrongMatches,
    });
  } catch (error) {
    console.error('Error matching jobs:', error);
    res.status(500).json({ success: false, message: 'Unable to match jobs right now.' });
  }
});

app.post('/api/admin/refresh-jobs', async (req, res) => {
  try {
    const report = await refreshJobs();
    res.json({ status: 'ok', report });
  } catch (error) {
    console.error('Error refreshing jobs:', error);
    res.status(500).json({ error: 'Unable to refresh jobs at this time.' });
  }
});

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

startScrapeScheduler();

app.listen(PORT, () => {
  console.log(`Career Align portal running on http://localhost:${PORT}`);
});
