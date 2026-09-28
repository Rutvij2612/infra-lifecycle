import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { pool } from '../config/db';

// DEV ONLY: truncates all app tables and loads db/seeds/*.sql in one transaction,
// then gives every seeded user the shared development password (bcrypt-hashed).
const DEV_PASSWORD = 'Demo@12345';

async function main() {
  if (!pool) throw new Error('DATABASE_URL is not set (see backend/.env.example)');
  if (env.isProduction) throw new Error('Refusing to seed when NODE_ENV=production');

  const dir = path.resolve(__dirname, '../../db/seeds');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const file of files) {
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      console.log(`seeded  ${file}`);
    }
    const hash = await bcrypt.hash(DEV_PASSWORD, 10);
    const res = await client.query('UPDATE users SET password_hash = $1', [hash]);
    console.log(`set dev password on ${res.rowCount} users`);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool?.end());
