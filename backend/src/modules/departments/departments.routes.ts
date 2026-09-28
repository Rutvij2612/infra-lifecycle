import { Router } from 'express';
import { query } from '../../db/query';
import type { Department } from '../../db/types';

const router = Router();

// GET /api/departments - any authenticated user (lookup list for forms/filters)
router.get('/', async (_req, res) => {
  const rows = await query<Department>('SELECT id, name, code, description FROM departments ORDER BY name');
  res.json({ data: rows });
});

export default router;
