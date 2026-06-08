const express = require('express');
const router = express.Router();
const db = require('../../utils/db');
const { authMiddleware } = require('../../utils/auth');

// Apply to a job
router.post('/apply', authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.body;
    const studentId = req.user.id;

    if (!jobId) return res.status(400).json({ error: 'jobId required' });

    // Check if student already applied
    const existingApp = await db.checkApplicationExists(studentId, jobId);
    if (existingApp) return res.status(409).json({ error: 'Already applied to this job' });

    // Get job details for matching
    const job = await db.pool.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    if (job.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

    // Get student profile with resume data
    const studentProfile = await db.getStudentProfileByUserId(studentId);
    if (!studentProfile) return res.status(400).json({ error: 'Student profile not found - complete profile first' });

    // Simple matching: extract skills from both
    const jobSkills = (job.rows[0].required_skills || []);
    const studentSkills = studentProfile.extracted_skills || [];
    const matchedSkills = studentSkills.filter(s => jobSkills.some(js => js.toLowerCase() === s.toLowerCase()));
    const missingSkills = jobSkills.filter(js => !studentSkills.some(s => s.toLowerCase() === js.toLowerCase()));

    // Calculate basic match score: skills overlap + seniority fit
    const skillsOverlapScore = jobSkills.length > 0 ? (matchedSkills.length / jobSkills.length) * 60 : 30;
    const matchScore = Math.min(100, Math.round(skillsOverlapScore + 20)); // 20 points base + skills

    // Create application
    const application = await db.createApplication(studentId, jobId, null, matchScore, matchedSkills, missingSkills);

    res.json({ message: 'Application submitted', application });
  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student's applications
router.get('/my-applications', authMiddleware, async (req, res) => {
  try {
    const studentId = req.user.id;
    const applications = await db.getApplicationsByStudentId(studentId);
    res.json(applications);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get application details
router.get('/:applicationId', authMiddleware, async (req, res) => {
  try {
    const application = await db.getApplicationById(req.params.applicationId);
    if (!application) return res.status(404).json({ error: 'Application not found' });
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Withdraw application (student)
router.post('/:applicationId/withdraw', authMiddleware, async (req, res) => {
  try {
    const app = await db.getApplicationById(req.params.applicationId);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.student_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const updated = await db.updateApplicationStatus(req.params.applicationId, 'withdrawn', 'Student withdrew application');
    res.json({ message: 'Application withdrawn', application: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
