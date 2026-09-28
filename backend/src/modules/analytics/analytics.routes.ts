import { Router } from 'express';

const router = Router();

// TODO: implement analytics endpoints (controller / service / queries live in this folder)
router.get('/', (_req, res) => {
  res.status(501).json({ module: 'analytics', message: 'Not implemented yet' });
});

export default router;
