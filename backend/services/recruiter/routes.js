const express = require('express');
const router = express.Router();
const db = require('../../utils/db');
const { authMiddleware } = require('../../utils/auth');

// Create recruiter profile (during registration)
router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const { companyName, companyWebsite, fullName, phone, designation } = req.body;
    const userId = req.user.id;

    // Check if already has recruiter profile
    const existing = await db.getRecruiterProfileByUserId(userId);
    if (existing) return res.status(400).json({ error: 'Recruiter profile already exists' });

    // Create company
    const company = await db.createCompany(companyName, companyWebsite, '', '', '');

    // Create recruiter profile
    const recruiterProfile = await db.createRecruiterProfile(userId, company.id, fullName, phone, designation);

    res.json({ message: 'Recruiter profile created', recruiterProfile });
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recruiter profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const recruiterProfile = await db.getRecruiterProfileByUserId(req.user.id);
    if (!recruiterProfile) return res.status(404).json({ error: 'Recruiter profile not found' });
    
    const company = await db.getCompanyById(recruiterProfile.company_id);
    res.json({ recruiterProfile, company });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get applicants for a job
router.get('/job/:jobId/applicants', authMiddleware, async (req, res) => {
  try {
    const applicants = await db.getApplicationsByJobId(req.params.jobId);
    res.json(applicants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update application status (recruiter action)
router.put('/application/:applicationId/status', authMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });
    if (!['applied', 'under_review', 'shortlisted', 'rejected', 'interview', 'selected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updated = await db.updateApplicationStatus(req.params.applicationId, status, notes, req.user.id);
    res.json({ message: 'Application status updated', application: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recruiter dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const recruiter = await db.getRecruiterProfileByUserId(req.user.id);
    if (!recruiter) return res.status(404).json({ error: 'Recruiter profile not found' });

    const dashboardData = await db.getRecruiterDashboardData(recruiter.id);
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
