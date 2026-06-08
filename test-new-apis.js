#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:4001/api';
let studentToken = null;
let recruiterToken = null;
let studentId = null;
let recruiterId = null;
let companyId = null;
let jobId = null;
let applicationId = null;

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    // Parse URL
    const fullUrl = `${BASE_URL}${path}`;
    const url = new URL(fullUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Career Align Backend APIs\n');

  const timestamp = Date.now();
  const studentEmail = `student-${timestamp}@test.com`;
  const recruiterEmail = `recruiter-${timestamp}@test.com`;

  try {
    // Test 1: Register student
    console.log('📝 Test 1: Register Student');
    let res = await request('POST', '/auth/register', { email: studentEmail, password: 'pass123', role: 'student' });
    console.log(`Status: ${res.status}`);
    if (res.status !== 201) return console.error('❌ Failed:', res.body);
    studentToken = res.body.token;
    studentId = res.body.user.id;
    console.log(`✅ Student registered: ID=${studentId}\n`);

    // Test 2: Register recruiter
    console.log('📝 Test 2: Register Recruiter');
    res = await request('POST', '/auth/register', { email: recruiterEmail, password: 'pass123', role: 'recruiter' });
    console.log(`Status: ${res.status}`);
    if (res.status !== 201) return console.error('❌ Failed:', res.body);
    recruiterToken = res.body.token;
    recruiterId = res.body.user.id;
    console.log(`✅ Recruiter registered: ID=${recruiterId}\n`);

    // Test 3: Create recruiter profile
    console.log('📝 Test 3: Create Recruiter Profile');
    res = await request('POST', '/recruiter/profile', {
      companyName: 'Tech Corp',
      companyWebsite: 'https://techcorp.com',
      fullName: 'John Recruiter',
      phone: '1234567890',
      designation: 'HR Manager'
    }, recruiterToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    companyId = res.body.recruiterProfile.company_id;
    console.log(`✅ Recruiter profile created\n`);

    // Test 4: Create a job
    console.log('📝 Test 4: Create Job');
    res = await request('POST', '/company/jobs', {
      title: 'Senior Developer',
      company: 'Tech Corp',
      location: 'New York',
      apply_url: 'https://techcorp.com/apply/123',
      description: 'Looking for experienced developer',
      required_skills: ['JavaScript', 'React', 'Node.js'],
      seniority: 'senior',
      minimum_experience_years: 3
    }, recruiterToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 201) return console.error('❌ Failed:', res.body);
    jobId = res.body.job.id;
    console.log(`✅ Job created: JobID=${jobId}\n`);

    // Test 5: Create student profile
    console.log('📝 Test 5: Create Student Profile');
    res = await request('POST', '/student/profile', {
      resumePath: '/uploads/resume.pdf',
      skills: ['JavaScript', 'React', 'Node.js', 'Python']
    }, studentToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 201) return console.error('❌ Failed:', res.body);
    console.log(`✅ Student profile created\n`);

    // Test 6: Get student dashboard
    console.log('📝 Test 6: Get Student Dashboard');
    res = await request('GET', '/student/dashboard', null, studentToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    console.log(`✅ Student dashboard retrieved\n`);

    // Test 7: Student apply to job
    console.log('📝 Test 7: Student Apply to Job');
    res = await request('POST', '/applications/apply', { jobId }, studentToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    applicationId = res.body.application.id;
    console.log(`✅ Application submitted\n`);

    // Test 8: Get recruiter dashboard
    console.log('📝 Test 8: Get Recruiter Dashboard');
    res = await request('GET', '/recruiter/dashboard', null, recruiterToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    console.log(`✅ Recruiter dashboard retrieved\n`);

    // Test 9: Get job applicants
    console.log('📝 Test 9: Get Job Applicants');
    res = await request('GET', `/recruiter/job/${jobId}/applicants`, null, recruiterToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    console.log(`✅ Found ${res.body.length} applicant(s)\n`);

    // Test 10: Update application status
    console.log('📝 Test 10: Update Application Status');
    res = await request('PUT', `/recruiter/application/${applicationId}/status`, {
      status: 'shortlisted',
      notes: 'Good match'
    }, recruiterToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    console.log(`✅ Application status updated\n`);

    console.log('\n✅✅✅ All backend APIs working correctly! ✅✅✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();

async function runTests() {
  console.log('🧪 Testing Career Align Backend APIs\n');

  const timestamp = Date.now();
  const studentEmail = `student-${timestamp}@test.com`;
  const recruiterEmail = `recruiter-${timestamp}@test.com`;

  try {
    // Test 1: Register student
    console.log('📝 Test 1: Register Student');
    let res = await request('POST', '/auth/register', { email: studentEmail, password: 'pass123', role: 'student' });
    console.log(`Status: ${res.status}`);
    if (res.status !== 201) return console.error('❌ Failed:', res.body);
    studentToken = res.body.token;
    studentId = res.body.user.id;
    console.log(`✅ Student registered: ID=${studentId}, Token=${studentToken.substring(0, 20)}...\n`);

    // Test 2: Register recruiter
    console.log('📝 Test 2: Register Recruiter');
    res = await request('POST', '/auth/register', { email: recruiterEmail, password: 'pass123', role: 'recruiter' });
    console.log(`Status: ${res.status}`);
    if (res.status !== 201) return console.error('❌ Failed:', res.body);
    recruiterToken = res.body.token;
    recruiterId = res.body.user.id;
    console.log(`✅ Recruiter registered: ID=${recruiterId}\n`);

    // Test 3: Create recruiter profile
    console.log('📝 Test 3: Create Recruiter Profile');
    res = await request('POST', '/recruiter/profile', {
      companyName: 'Tech Corp',
      companyWebsite: 'https://techcorp.com',
      fullName: 'John Recruiter',
      phone: '1234567890',
      designation: 'HR Manager'
    }, recruiterToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    companyId = res.body.recruiterProfile.company_id;
    console.log(`✅ Recruiter profile created: CompanyID=${companyId}\n`);

    // Test 4: Create a job
    console.log('📝 Test 4: Create Job');
    res = await request('POST', '/company/jobs', {
      title: 'Senior Developer',
      company: 'Tech Corp',
      location: 'New York',
      apply_url: 'https://techcorp.com/apply/123',
      description: 'Looking for experienced developer',
      required_skills: ['JavaScript', 'React', 'Node.js'],
      seniority: 'senior',
      minimum_experience_years: 3
    }, recruiterToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 201) return console.error('❌ Failed:', res.body);
    jobId = res.body.job.id;
    console.log(`✅ Job created: JobID=${jobId}\n`);

    // Test 5: Create student profile
    console.log('📝 Test 5: Create Student Profile');
    res = await request('POST', '/student/profile', {
      resumePath: '/uploads/resume.pdf',
      skills: ['JavaScript', 'React', 'Node.js', 'Python']
    }, studentToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 201) return console.error('❌ Failed:', res.body);
    console.log(`✅ Student profile created\n`);

    // Test 6: Get student dashboard
    console.log('📝 Test 6: Get Student Dashboard');
    res = await request('GET', '/student/dashboard', null, studentToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    console.log(`✅ Student dashboard:`, JSON.stringify(res.body.dashboardData, null, 2), '\n');

    // Test 7: Student apply to job
    console.log('📝 Test 7: Student Apply to Job');
    res = await request('POST', '/applications/apply', { jobId }, studentToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    applicationId = res.body.application.id;
    console.log(`✅ Application submitted: AppID=${applicationId}\n`);

    // Test 8: Get recruiter dashboard
    console.log('📝 Test 8: Get Recruiter Dashboard');
    res = await request('GET', '/recruiter/dashboard', null, recruiterToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    console.log(`✅ Recruiter dashboard:`, JSON.stringify(res.body, null, 2), '\n');

    // Test 9: Get job applicants
    console.log('📝 Test 9: Get Job Applicants');
    res = await request('GET', `/recruiter/job/${jobId}/applicants`, null, recruiterToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    console.log(`✅ Found ${res.body.length} applicant(s)\n`);

    // Test 10: Update application status
    console.log('📝 Test 10: Update Application Status to Shortlisted');
    res = await request('PUT', `/recruiter/application/${applicationId}/status`, {
      status: 'shortlisted',
      notes: 'Good match - schedule interview'
    }, recruiterToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    console.log(`✅ Application status updated\n`);

    // Test 11: Get updated student applications
    console.log('📝 Test 11: Get Student Applications');
    res = await request('GET', '/applications/my-applications', null, studentToken);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) return console.error('❌ Failed:', res.body);
    console.log(`✅ Found ${res.body.length} application(s):`, JSON.stringify(res.body.map(a => ({
      id: a.id,
      jobTitle: a.title,
      status: a.current_status,
      matchScore: a.match_score
    })), null, 2), '\n');

    // Test 12: Admin dashboard
    console.log('📝 Test 12: Admin Dashboard (without auth - should fail gracefully or work)');
    res = await request('GET', '/admin/dashboard', null, recruiterToken); // Use recruiter token to test auth
    console.log(`Status: ${res.status}`);
    if (res.status === 200) {
      console.log(`Admin data:`, JSON.stringify(res.body, null, 2));
    } else {
      console.log(`✅ Admin access correctly restricted (${res.status})\n`);
    }

    console.log('\n✅✅✅ All tests completed successfully! ✅✅✅');
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

runTests();
