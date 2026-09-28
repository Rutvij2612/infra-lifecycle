import { Router } from 'express';

const router = Router();

// TODO: implement reports endpoints (controller / service / queries live in this folder)
router.get('/', (_req, res) => {
  res.status(501).json({ module: 'reports', message: 'Not implemented yet' });
});

export default router;
