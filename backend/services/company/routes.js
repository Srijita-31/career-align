const express = require('express');
const { createJob, getJobsByCompanyId, updateJob, deleteJob, getRecruiterProfileByUserId, getAllJobs } = require('../../utils/db');
const { authMiddleware } = require('../../utils/auth');

const router = express.Router();

// Create job (recruiter posts job for their company)
router.post('/jobs', authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== 'recruiter') return res.status(403).json({ status: 'error', message: 'Only recruiters may create jobs.' });
  
  try {
    const recruiterProfile = await getRecruiterProfileByUserId(userId);
    if (!recruiterProfile) return res.status(400).json({ status: 'error', message: 'Recruiter profile not found' });
    
    const job = req.body;
    if (!job.title || !job.apply_url) return res.status(400).json({ status: 'error', message: 'Missing required job fields.' });
    
    // Add recruiter and company IDs to job
    job.recruiter_id = recruiterProfile.id;
    job.company_id = recruiterProfile.company_id;
    
    const created = await createJob(job, userId);
    return res.status(201).json({ status: 'ok', job: created });
  } catch (err) {
    console.error('Create job error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Get jobs for recruiter's company
router.get('/jobs', authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== 'recruiter') return res.status(403).json({ status: 'error', message: 'Only recruiters may view jobs.' });
  
  try {
    const recruiterProfile = await getRecruiterProfileByUserId(userId);
    if (!recruiterProfile) return res.status(400).json({ status: 'error', message: 'Recruiter profile not found' });
    
    const jobs = await getJobsByCompanyId(recruiterProfile.company_id);
    return res.json({ status: 'ok', jobs });
  } catch (err) {
    console.error('Get company jobs error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Get all jobs (public endpoint)
router.get('/jobs/all', async (req, res) => {
  try {
    const jobs = await getAllJobs();
    return res.json({ status: 'ok', jobs });
  } catch (err) {
    console.error('Get all jobs error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Update job (recruiter only)
router.put('/jobs/:id', authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== 'recruiter') return res.status(403).json({ status: 'error', message: 'Only recruiters may update jobs.' });
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

// Delete job (recruiter only)
router.delete('/jobs/:id', authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role !== 'recruiter') return res.status(403).json({ status: 'error', message: 'Only recruiters may delete jobs.' });
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
