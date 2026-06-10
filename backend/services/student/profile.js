// backend/services/student/profile.js
const express = require('express');
const router = express.Router();
const { requireRole } = require('../auth/roleGuard');
const { createStudentProfile, getStudentProfileByUserId, updateUserPassword } = require('../../utils/db');

// POST /student/profile/setup
router.post('/setup', requireRole('student'), async (req, res) => {
  const { full_name, phone, college, degree, major, graduation_year, resume_text, skills, education, experience, projects, target_roles } = req.body;
  try {
    // Assume profile already exists, otherwise create
    const existing = await getStudentProfileByUserId(req.user.id);
    if (existing) {
      // Update existing profile
      const updated = await createStudentProfile(req.user.id, null, []); // placeholder, actual update logic needed
      return res.json({ status: 'ok', profile: updated });
    }
    // Create new profile
    const profile = await createStudentProfile(req.user.id, null, []);
    // Update fields (simplified, real implementation would have separate update function)
    // For brevity, we just return the created profile
    return res.status(201).json({ status: 'ok', profile });
  } catch (err) {
    console.error('Student profile setup error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
