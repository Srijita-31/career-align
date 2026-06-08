const express = require('express');
const router = express.Router();
const db = require('../../utils/db');
const { authMiddleware } = require('../../utils/auth');

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get all students
router.get('/students', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const r = await db.pool.query(`
      SELECT u.id, u.email, u.role, u.created_at, sp.full_name, sp.college, sp.profile_completion_percentage
      FROM users u
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE u.role = 'student'
      ORDER BY u.created_at DESC
    `);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all recruiters
router.get('/recruiters', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const r = await db.pool.query(`
      SELECT u.id, u.email, u.role, u.created_at, rp.full_name, c.name as company_name, rp.is_verified
      FROM users u
      LEFT JOIN recruiter_profiles rp ON u.id = rp.user_id
      LEFT JOIN companies c ON rp.company_id = c.id
      WHERE u.role = 'recruiter'
      ORDER BY u.created_at DESC
    `);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all jobs
router.get('/jobs', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const r = await db.pool.query(`
      SELECT j.id, j.title, j.company, c.name as company_name, j.location, j.is_active, j.created_at
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      ORDER BY j.created_at DESC
      LIMIT 100
    `);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all applications
router.get('/applications', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const r = await db.pool.query(`
      SELECT a.id, a.student_id, a.job_id, a.match_score, a.current_status, a.created_at,
             u.email, j.title, j.company
      FROM applications a
      JOIN users u ON a.student_id = u.id
      JOIN jobs j ON a.job_id = j.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get platform analytics
router.get('/dashboard', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const dashboardData = await db.getAdminDashboardData();
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify recruiter
router.put('/recruiters/:recruiterId/verify', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const r = await db.pool.query(
      `UPDATE recruiter_profiles SET is_verified = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.recruiterId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Recruiter not found' });
    res.json({ message: 'Recruiter verified', recruiter: r.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suspend user
router.put('/users/:userId/suspend', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const r = await db.pool.query(
      `UPDATE users SET is_active = false WHERE id = $1 RETURNING *`,
      [req.params.userId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User suspended', user: r.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
