const bcrypt = require('bcrypt');
const { Pool } = require('pg');

async function resetPassword() {
  const hash = await bcrypt.hash('Welcome123!', 12);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email, role',
    [hash, 'srijita.ghorai2003@gmail.com']
  );
  console.log('Updated:', r.rows);
  await pool.end();
}

resetPassword().catch(console.error);
