// backend/services/dashboard.js

const express = require('express');
const router = express.Router();
const { requireRole } = require('./auth/roleGuard');

// Placeholder data for dashboards
const studentData = {
  welcome: 'Welcome to your student dashboard',
  stats: { applications: 0, interviews: 0 },
};

const recruiterData = {
  welcome: 'Welcome to your recruiter dashboard',
  stats: { postings: 0, candidates: 0 },
};

const adminData = {
  welcome: 'Welcome to the admin dashboard',
  stats: { users: 0, reports: 0 },
};

router.get('/student', requireRole('student'), (req, res) => {
  res.json({ status: 'ok', data: studentData });
});

router.get('/recruiter', requireRole('recruiter', 'company'), (req, res) => {
  res.json({ status: 'ok', data: recruiterData });
});

router.get('/admin', requireRole('admin'), (req, res) => {
  res.json({ status: 'ok', data: adminData });
});

module.exports = router;
