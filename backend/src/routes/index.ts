import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from '../modules/auth/auth.routes';
import usersRoutes from '../modules/users/users.routes';
import departmentsRoutes from '../modules/departments/departments.routes';
import { requireAuth } from '../middleware/auth';
import assetsRoutes from '../modules/assets/assets.routes';
import activitiesRoutes from '../modules/activities/activities.routes';
import maintenanceRoutes from '../modules/maintenance/maintenance.routes';
import reportsRoutes from '../modules/reports/reports.routes';
import analyticsRoutes from '../modules/analytics/analytics.routes';

const router = Router();

// Public: health checks and POST /auth/login (auth.routes protects /auth/me itself).
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// Everything below requires a valid token (default-deny); modules add role checks on top.
router.use(requireAuth);
router.use('/users', usersRoutes);
router.use('/departments', departmentsRoutes);
router.use('/assets', assetsRoutes);
router.use('/activities', activitiesRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/reports', reportsRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
