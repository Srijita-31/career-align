// backend/services/dashboard/index.js

const express = require('express');
const { authMiddleware } = require('../../utils/auth');
const { requireRole } = require('../auth/roleGuard');
const { getStudentDashboardData, getRecruiterDashboardData } = require('../../utils/db');

const router = express.Router();

// Student dashboard endpoint
router.get('/student', authMiddleware, requireRole('student'), async (req, res) => {
  try {
    const data = await getStudentDashboardData(req.user.id);
    return res.json({ status: 'ok', data });
  } catch (err) {
    console.error('Student dashboard error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Recruiter (company) dashboard endpoint
router.get('/recruiter', authMiddleware, requireRole('recruiter'), async (req, res) => {
  try {
    const data = await getRecruiterDashboardData(req.user.id);
    return res.json({ status: 'ok', data });
  } catch (err) {
    console.error('Recruiter dashboard error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
