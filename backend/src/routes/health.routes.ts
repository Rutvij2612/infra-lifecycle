import { Router } from 'express';
import { env } from '../config/env';
import { pool } from '../config/db';

const router = Router();

// GET /api/health
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'infra-lifecycle-api',
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// GET /api/health/db  (verifies the Supabase/PostgreSQL connection)
router.get('/db', async (_req, res) => {
  if (!pool) {
    res.status(503).json({ status: 'unconfigured', message: 'DATABASE_URL is not set' });
    return;
  }
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('DB health check failed:', err instanceof Error ? err.message : err);
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});

export default router;
