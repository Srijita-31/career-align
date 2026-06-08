const http = require('http');

async function test() {
  const options = {
    hostname: 'localhost',
    port: 4001,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error('Error:', e);
  });

  const body = JSON.stringify({ email: 'test@test.com', password: 'pass123', role: 'student' });
  console.log('Sending body:', body);
  req.write(body);
  req.end();
}

test();
