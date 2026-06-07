const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { parseResume } = require('../../utils/resumeParser');
const { matchJobs } = require('../../utils/jobAggregator');
const { authMiddleware } = require('../../utils/auth');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../../tmp') });

router.post('/', upload.single('resume'), async (req, res) => {
  let resumePath;
  try {
    resumePath = req.file?.path;
    const profile = await parseResume(req.body, req.file);
    // Ideally, matching engine only extracts embeddings and returns profile.
    // The recommendation service takes the profile and returns jobs.
    // For this migration step, we'll keep the monolithic matchJobs call here.
    const jobs = await matchJobs(profile);
    return res.json({
      success: true,
      profile,
      jobs,
      recommendations: jobs,
      hasStrongMatches: jobs.some(job => job.score >= 75),
    });
  } catch (error) {
    console.error('Error matching jobs:', error);
    return res.status(500).json({ success: false, message: error.message || 'Unable to match jobs right now.' });
  } finally {
    if (resumePath) await fs.unlink(resumePath).catch(() => {});
  }
});

module.exports = router;
