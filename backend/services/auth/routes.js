const express = require('express');
const { findUserByEmail, createUser, updateUserPassword, createStudentProfile, createCompany, createRecruiterProfile } = require('../../utils/db');
const { generateToken, hashPassword, verifyPassword, generateResetToken, verifyResetToken, authMiddleware } = require('../../utils/auth');
const { sendPasswordResetEmail } = require('../../utils/email');

const router = express.Router();

router.post('/register', async (req, res) => {
  const {
    email,
    password,
    role,
    full_name,
    phone,
    college,
    degree,
    major,
    graduation_year,
    company_name,
    designation,
  } = req.body;
  if (!email || !password) return res.status(400).json({ status: 'error', message: 'Email and password required.' });
  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ status: 'error', message: 'User already exists.' });
    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash, role || 'student');
    // Role‑specific profile creation
    if (user.role === 'student') {
      await createStudentProfile(user.id, null, []);
    } else if (user.role === 'recruiter') {
      const company = await createCompany(company_name || 'Unnamed Company', '', '', '', '');
      await createRecruiterProfile(user.id, company.id, full_name || '', phone || '', designation || '');
    }
    const token = generateToken({ id: user.id, role: user.role });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.status(201).json({ status: 'ok', token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ status: 'error', message: 'Email and password required.' });
  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
    const token = generateToken({ id: user.id, role: user.role });
    res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ status: 'ok', token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ status: 'error', message: 'Email is required.' });

  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ status: 'error', message: 'Account not found.' });
    const token = generateResetToken(email);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/forgot-password?token=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail(email, resetUrl);
    return res.json({ status: 'ok', message: 'Password reset instructions have been sent if the account exists.', resetUrl });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ status: 'error', message: 'Token and new password are required.' });
  try {
    const email = verifyResetToken(token);
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ status: 'error', message: 'Account not found.' });
    const passwordHash = await hashPassword(newPassword);
    await updateUserPassword(email, passwordHash);
    return res.json({ status: 'ok', message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(400).json({ status: 'error', message: err.message || 'Invalid or expired token.' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  // Return the authenticated user's info based on token (from cookie or header)
  const { id, email, role } = req.user;
  return res.json({ status: 'ok', user: { id, email, role } });
});

module.exports = router;
