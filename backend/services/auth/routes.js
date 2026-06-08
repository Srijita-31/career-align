const express = require('express');
const { findUserByEmail, createUser, updateUserPassword } = require('../../utils/db');
const { generateToken, hashPassword, verifyPassword, generateResetToken, verifyResetToken } = require('../../utils/auth');
const { sendPasswordResetEmail } = require('../../utils/email');

const router = express.Router();

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

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ status: 'error', message: 'Email is required.' });

  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ status: 'error', message: 'Account not found.' });
    const token = generateResetToken(email);
    const resetUrl = `${req.protocol}://${req.get('host')}/forgot-password?token=${encodeURIComponent(token)}`;
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

module.exports = router;
