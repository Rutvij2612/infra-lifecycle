import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

// Applies db/migrations/*.sql in filename order, once each (tracked in schema_migrations).
async function main() {
  if (!pool) throw new Error('DATABASE_URL is not set (see backend/.env.example)');

  const dir = path.resolve(__dirname, '../../db/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const applied = new Set(
    (await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename),
  );

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip    ${file}`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

main()
  .catch((err) => {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool?.end());
