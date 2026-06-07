const express = require('express');
const { getStudentProfileByUserId } = require('../../utils/db');
const { matchJobs } = require('../../utils/jobAggregator');
const { authMiddleware } = require('../../utils/auth');

const router = express.Router();

router.get('/matches', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'student') return res.status(403).json({ status: 'error', message: 'Only students may view matches.' });
  try {
    const profile = await getStudentProfileByUserId(id);
    if (!profile) return res.status(404).json({ status: 'error', message: 'Student profile not found.' });
    // This is the recommendation service core logic
    const jobs = await matchJobs(profile);
    return res.json({ status: 'ok', jobs });
  } catch (err) {
    console.error('Student match error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
