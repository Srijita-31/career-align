const express = require('express');
const { getStudentProfileByUserId } = require('../../utils/db');
const { matchJobs } = require('../../utils/jobAggregator');
const { authMiddleware } = require('../../utils/auth');

const router = express.Router();

router.get('/matches', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'student') return res.status(403).json({ status: 'error', message: 'Only students may view matches.' });
  try {
    const dbProfile = await getStudentProfileByUserId(id);
    if (!dbProfile) return res.status(404).json({ status: 'error', message: 'Student profile not found.' });
    const profile = {
      ...dbProfile,
      desiredRole: Array.isArray(dbProfile.target_roles) ? dbProfile.target_roles[0] : '',
      roleFamily: '',
      semanticSearch: Array.isArray(dbProfile.target_roles) ? dbProfile.target_roles.join(', ') : '',
      seniority: dbProfile.experience_level || '',
      experienceLevel: dbProfile.experience_level || '',
      location: dbProfile.location_preference || '',
      workPreference: dbProfile.work_preference || '',
      skills: Array.isArray(dbProfile.skills) ? dbProfile.skills : [],
      education: dbProfile.education ? (Array.isArray(dbProfile.education) ? dbProfile.education.join(', ') : dbProfile.education) : '',
    };
    const jobs = await matchJobs(profile);
    return res.json({ status: 'ok', jobs });
  } catch (err) {
    console.error('Student match error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
