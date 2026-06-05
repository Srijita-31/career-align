const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { closePool } = require('../utils/db');
const { matchJobs } = require('../utils/jobAggregator');
const { detectFileType, parseResume } = require('../utils/resumeParser');

const runParserSmoke = async () => {
  assert.strictEqual(
    await detectFileType({ originalname: 'resume.pdf', mimetype: 'application/pdf' }, Buffer.from('%PDF-1.7')),
    'pdf'
  );
  assert.strictEqual(
    await detectFileType({ originalname: 'resume.docx', mimetype: '' }, Buffer.from('PK\u0003\u0004')),
    'docx'
  );

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-align-upload-'));
  const uploadPath = path.join(dir, 'multer-random-name');
  await fs.writeFile(uploadPath, [
    'Pausali Sengupta',
    'Entry level data scientist',
    'Skills: Python, SQL, MySQL, Machine Learning, AWS, Git',
    'Projects: ETL pipeline and predictive analytics dashboard',
  ].join('\n'));

  const profile = await parseResume({
    name: 'Pausali Sengupta',
    experienceLevel: 'Fresher',
    workPreference: 'onsite',
    locationScope: 'india',
  }, {
    path: uploadPath,
    originalname: 'resume.txt',
    mimetype: 'text/plain',
  });

  assert(profile.summary.includes('entry level data scientist'));
  assert(!profile.summary.includes('obj type catalog'));
  assert(profile.skills.includes('python'));
  assert(profile.skills.includes('sql'));
  assert(profile.resumeDiagnostics.cleanedCharacters > 0);
  await fs.rm(dir, { recursive: true, force: true });

  return profile;
};

const runRecommendationSmoke = async (profile) => {
  const jobs = await matchJobs(profile, 10);
  assert(jobs.length > 0, 'Expected at least one recommendation from the local job inventory.');

  const weaklyGroundedHighScores = jobs.filter((job) => {
    const score = Number(job.score || 0);
    const semantic = Number(job.matchBreakdown?.semantic || 0);
    const evidenceCount = Number(job.skillEvidence?.detectedRequiredCount || 0);
    return score >= 60 && semantic < 15 && evidenceCount < 3;
  });

  assert.strictEqual(
    weaklyGroundedHighScores.length,
    0,
    `Found high-scoring weakly grounded jobs: ${weaklyGroundedHighScores.map((job) => job.title).join(', ')}`
  );

  return jobs;
};

const main = async () => {
  const profile = await runParserSmoke();
  const jobs = await runRecommendationSmoke(profile);

  console.log('Parsed profile:', {
    roleFamily: profile.roleFamily,
    seniority: profile.seniority,
    skills: profile.skills,
    resumeDiagnostics: profile.resumeDiagnostics,
  });
  console.table(jobs.slice(0, 5).map((job) => ({
    score: job.score,
    semantic: job.matchBreakdown?.semantic,
    skills: job.matchBreakdown?.skills,
    role: job.matchBreakdown?.roleFamily,
    seniority: job.matchBreakdown?.seniority,
    title: job.title,
    company: job.company,
  })));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => undefined);
  });
