import { types } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from '../config/db';

// DATE (1082) -> plain 'YYYY-MM-DD' string (avoids timezone shifts); NUMERIC (1700) -> number.
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1700, (value) => parseFloat(value));

function requirePool() {
  if (!pool) throw new Error('DATABASE_URL is not set - database is not configured');
  return pool;
}

/** Run a parameterised query and return the rows. */
export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await requirePool().query<T>(text, params);
  return result.rows;
}

/** Run a query and return the first row, or null. */
export async function queryOne<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run several statements atomically (e.g. update asset status + insert lifecycle event). */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await requirePool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
