import { Pool } from 'pg';
import { env } from './env';

// The pool is created only when DATABASE_URL is set, so the API can still
// boot (and /api/health work) before the database is configured.
export const pool: Pool | null = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
      ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

pool?.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});
