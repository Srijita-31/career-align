const express = require('express');
const { createStudentProfile, getStudentProfileByUserId, getStudentDashboardData, calculateProfileCompletion, updateStudentProfile } = require('../../utils/db');
const { authMiddleware } = require('../../utils/auth');

const router = express.Router();

// Manage Student Profile
router.post('/profile', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'student') return res.status(403).json({ status: 'error', message: 'Only students may manage profiles.' });
  const { resumePath, skills } = req.body;
  try {
    const profile = await createStudentProfile(id, resumePath || null, skills || []);
    await calculateProfileCompletion(id);
    return res.status(201).json({ status: 'ok', profile });
  } catch (err) {
    console.error('Student profile error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/profile', authMiddleware, async (req, res) => {
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

// Student Profile Setup (after registration)
router.post('/profile/setup', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'student') return res.status(403).json({ status: 'error', message: 'Only students may setup profiles.' });
  try {
    const existing = await getStudentProfileByUserId(id);
    if (!existing) {
      await createStudentProfile(id, null, []);
    }
    const profile = await updateStudentProfile(id, req.body);
    await calculateProfileCompletion(id);
    return res.json({ status: 'ok', profile });
  } catch (err) {
    console.error('Student profile setup error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Student Dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'student') return res.status(403).json({ status: 'error', message: 'Only students may view dashboard.' });
  try {
    const dashboardData = await getStudentDashboardData(id);
    return res.json({ status: 'ok', dashboardData });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
