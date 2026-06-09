// backend/services/recruiter/company.js

const express = require('express');
const { requireRole } = require('../auth/roleGuard');
const { createCompany, updateRecruiterProfile } = require('../../utils/db');

const router = express.Router();

// Protected endpoint for recruiter to set up company details
router.post('/setup', requireRole('recruiter'), async (req, res) => {
  const { name, website, industry, size, founded_year } = req.body;
  if (!name) return res.status(400).json({ status: 'error', message: 'Company name required' });
  try {
    // Create company record
    const company = await createCompany(name, website || '', '', industry || '', size || '');
    // Update recruiter profile with company_id
    await updateRecruiterProfile(req.user.id, company.id);
    return res.status(201).json({ status: 'ok', company });
  } catch (err) {
    console.error('Company setup error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
