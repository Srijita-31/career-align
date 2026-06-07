const express = require('express');
const { createJob, getJobsByCompany, updateJob, deleteJob } = require('../../utils/db');
const { authMiddleware } = require('../../utils/auth');

const router = express.Router();

router.post('/jobs', authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== 'company') return res.status(403).json({ status: 'error', message: 'Only companies may create jobs.' });
  const job = req.body;
  if (!job.title || !job.apply_url) return res.status(400).json({ status: 'error', message: 'Missing required job fields.' });
  try {
    const created = await createJob(job, userId);
    return res.status(201).json({ status: 'ok', job: created });
  } catch (err) {
    console.error('Create job error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/jobs', authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== 'company') return res.status(403).json({ status: 'error', message: 'Only companies may view their jobs.' });
  try {
    const jobs = await getJobsByCompany(userId);
    return res.json({ status: 'ok', jobs });
  } catch (err) {
    console.error('Get company jobs error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

router.put('/jobs/:id', authMiddleware, async (req, res) => {
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

router.delete('/jobs/:id', authMiddleware, async (req, res) => {
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

module.exports = router;
