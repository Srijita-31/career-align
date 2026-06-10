require('dotenv').config({ quiet: true });
const cookieParser = require('cookie-parser');

const path = require('path');
const bcrypt = require('bcrypt');
const { generateToken, hashPassword, verifyPassword, authMiddleware } = require('./utils/auth');
const fs = require('fs/promises');
const express = require('express');
const multer = require('multer');
const { parseResume } = require('./utils/resumeParser');
const {
  countStaleJobEmbeddings,
  ensureSchema,
  getJobStats,
  getRecentScraperRuns,
  saveRecommendationFeedback,
  findUserByEmail,
  createUser,
  createJob,
  getStudentProfileByUserId,
  getJobsByCompany,
  updateJob,
  deleteJob,
  createStudentProfile
} = require('./utils/db');
const { matchJobs } = require('./utils/jobAggregator');
const { getJobRefreshStatus, queueJobRefresh } = require('./utils/jobRefreshQueue');
const { startScrapeScheduler } = require('./scheduler/scrapeScheduler');

const upload = multer({ dest: path.join(__dirname, 'tmp') });
const app = express();
app.use(cookieParser());
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Existing resume match endpoint (kept for backward compatibility)
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
      hasStrongMatches: jobs.some(job => job.score >= 75),
    });
  } catch (error) {
    console.error('Error matching jobs:', error);
    return res.status(500).json({ success: false, message: error.message || 'Unable to match jobs right now.' });
  } finally {
    if (resumePath) await fs.unlink(resumePath).catch(() => {});
  }
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ status: 'error', message: 'Email and password required.' });
  }
  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ status: 'error', message: 'User already exists.' });
    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash, role || 'student');
    const token = generateToken({ id: user.id, role: user.role });
      // Set HttpOnly cookie for session token
      res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
      return res.status(201).json({ status: 'ok', token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ status: 'error', message: 'Email and password required.' });
  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
    const token = generateToken({ id: user.id, role: user.role });
      // Set HttpOnly cookie for session token
      res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
      return res.json({ status: 'ok', token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Company job management routes
app.post('/api/company/jobs', authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== 'recruiter') return res.status(403).json({ status: 'error', message: 'Only recruiters may create jobs.' });
  const job = req.body;
  if (!job.title || !job.apply_url) return res.status(400).json({ status: 'error', message: 'Missing required job fields.' });
  try {
    const recruiterProfile = await getRecruiterProfileByUserId(userId);
    if (!recruiterProfile) throw new Error('Recruiter profile not found');
    job.recruiter_id = userId;
    job.company_id = recruiterProfile.company_id;
    const created = await createJob(job, userId);
    return res.status(201).json({ status: 'ok', job: created });
  } catch (err) {
    console.error('Create job error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/company/jobs', authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== 'recruiter') return res.status(403).json({ status: 'error', message: 'Only recruiters may view their jobs.' });
  try {
    const recruiterProfile = await getRecruiterProfileByUserId(userId);
    if (!recruiterProfile) throw new Error('Recruiter profile not found');
    const jobs = await getJobsByCompanyId(recruiterProfile.company_id);
    return res.json({ status: 'ok', jobs });
  } catch (err) {
    console.error('Get recruiter jobs error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

app.put('/api/company/jobs/:id', authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== 'company') return res.status(403).json({ status: 'error', message: 'Only companies may update jobs.' });
  const jobId = parseInt(req.params.id, 10);
  const updates = req.body;
  try {
    const updated = await updateJob(jobId, userId, updates);
    return res.json({ status: 'ok', job: updated });
  } catch (err) {
    console.error('Update job error:', err);
    const code = err.message === 'Unauthorized' ? 403 : 500;
    return res.status(code).json({ status: 'error', message: err.message });
  }
});

app.delete('/api/company/jobs/:id', authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== 'company') return res.status(403).json({ status: 'error', message: 'Only companies may delete jobs.' });
  const jobId = parseInt(req.params.id, 10);
  try {
    await deleteJob(jobId, userId);
    return res.json({ status: 'ok', message: 'Job deleted' });
  } catch (err) {
    console.error('Delete job error:', err);
    const code = err.message === 'Unauthorized' ? 403 : 500;
    return res.status(code).json({ status: 'error', message: err.message });
  }
});

// Student profile and match routes
app.post('/api/student/profile', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'student') return res.status(403).json({ status: 'error', message: 'Only students may manage profiles.' });
  const { resumePath, skills } = req.body;
  try {
    const profile = await createStudentProfile(id, resumePath || null, skills || []);
    return res.status(201).json({ status: 'ok', profile });
  } catch (err) {
    console.error('Student profile error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/student/profile', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'student') return res.status(403).json({ status: 'error', message: 'Only students may view profiles.' });
  try {
    const profile = await getStudentProfileByUserId(id);
    if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found.' });
    return res.json({ status: 'ok', profile });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/student/matches', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'student') return res.status(403).json({ status: 'error', message: 'Only students may view matches.' });
  try {
    const profile = await getStudentProfileByUserId(id);
    if (!profile) return res.status(404).json({ status: 'error', message: 'Student profile not found.' });
    const jobs = await matchJobs(profile);
    return res.json({ status: 'ok', jobs });
  } catch (err) {
    console.error('Student match error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Admin endpoints
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
    app.use('/api/dashboard', require('./services/dashboard'));

    // Re‑embed stale job embeddings
    countStaleJobEmbeddings()
      .then(count => {
        if (count > 0) {
          const queued = queueJobRefresh(undefined, 'startup_reembed', { reembedExisting: true });
          console.log(`[DB] Queued re‑embedding for ${count} stale job embeddings`, queued);
        }
      })
      .catch(error => console.warn('[DB] Unable to check stale job embeddings:', error.message));
  })
  .catch(error => {
    console.error('Unable to start Career Align:', error);
    process.exit(1);
  });
