const express = require('express');
const { findUserByEmail, createUser, createStudentProfile, getStudentProfileByUserId } = require('../../utils/db');
const { generateToken, hashPassword, verifyPassword, authMiddleware } = require('../../utils/auth');

const router = express.Router();

// Register (Student)
router.post('/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ status: 'error', message: 'Email and password required.' });
  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ status: 'error', message: 'User already exists.' });
    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash, role || 'student');
    const token = generateToken({ id: user.id, role: user.role });
    return res.status(201).json({ status: 'ok', token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ status: 'error', message: 'Email and password required.' });
  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
    const token = generateToken({ id: user.id, role: user.role });
    return res.json({ status: 'ok', token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Manage Student Profile
router.post('/profile', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'student') return res.status(403).json({ status: 'error', message: 'Only students may manage profiles.' });
  const { resumePath, skills } = req.body;
  try {
    const profile = await createStudentProfile(id, resumePath || null, skills || []);
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

module.exports = router;
