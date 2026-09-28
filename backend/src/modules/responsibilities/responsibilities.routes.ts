import { Router } from 'express';
import { AppError } from '../../utils/AppError';
import { requireEnum, requireUUID } from '../../utils/validation';
import { getUserById } from '../../repositories/users.repository';
import {
  createResponsibility,
  deleteResponsibilities,
  getResponsibility,
  listResponsibilitiesByAsset,
} from '../../repositories/responsibilities.repository';
import { currentUser, requireRole, STAFF_ROLES } from '../../middleware/auth';
import type { ResponsibilityType } from '../../db/types';

const RESPONSIBILITY_TYPES: ResponsibilityType[] = ['CONSTRUCTION', 'MAINTENANCE'];

// Mounted with mergeParams at /api/assets/:id/responsibilities.
// requireAssetAccess (mounted on /api/assets/:id) has already run: a field user only reaches
// these routes for an asset they are responsible for. Managing responsibilities is staff-only.
export const responsibilitiesByAssetRouter = Router({ mergeParams: true });

// GET /api/assets/:id/responsibilities - who is responsible for this asset, and in which capacity
responsibilitiesByAssetRouter.get('/', async (req, res) => {
  const assetId = requireUUID((req.params as Record<string, string>).id, 'id');
  res.json({ data: await listResponsibilitiesByAsset(assetId) });
});

// POST /api/assets/:id/responsibilities - { user_id, responsibility_type } (admin / officer only)
responsibilitiesByAssetRouter.post('/', requireRole(...STAFF_ROLES), async (req, res) => {
  const assetId = requireUUID((req.params as Record<string, string>).id, 'id');
  const body = req.body ?? {};
  const user_id = requireUUID(body.user_id, 'user_id');
  const responsibility_type = requireEnum(body.responsibility_type, 'responsibility_type', RESPONSIBILITY_TYPES);
  const assigned_by = currentUser(req).id; // always the authenticated user (body value ignored)

  const assignee = await getUserById(user_id);
  if (!assignee) throw AppError.badRequest('user_id does not reference an existing user', 'INVALID_REFERENCE');
  if (assignee.role !== 'FIELD_USER') {
    throw AppError.badRequest('Only Field Officers (FIELD_USER) can be assigned asset responsibility', 'INVALID_ASSIGNEE');
  }
  if (!assignee.is_active) throw AppError.badRequest('Cannot assign an inactive user', 'INACTIVE_USER');

  if (await getResponsibility(assetId, user_id, responsibility_type)) {
    throw AppError.conflict(
      `This user already has ${responsibility_type} responsibility for this asset`,
      'DUPLICATE_RESPONSIBILITY',
    );
  }

  const responsibility = await createResponsibility(assetId, user_id, responsibility_type, assigned_by);
  res.status(201).json({ data: responsibility });
});

// DELETE /api/assets/:id/responsibilities/:userId[?responsibility_type=CONSTRUCTION|MAINTENANCE]
// Without the query parameter, all of that user's responsibilities for the asset are removed.
responsibilitiesByAssetRouter.delete('/:userId', requireRole(...STAFF_ROLES), async (req, res) => {
  const params = req.params as Record<string, string>;
  const assetId = requireUUID(params.id, 'id');
  const userId = requireUUID(params.userId, 'userId');
  const type =
    typeof req.query.responsibility_type === 'string' && req.query.responsibility_type
      ? requireEnum(req.query.responsibility_type, 'responsibility_type', RESPONSIBILITY_TYPES)
      : undefined;

  const removed = await deleteResponsibilities(assetId, userId, type);
  if (removed.length === 0) throw AppError.notFound('Responsibility');

  res.json({ data: { asset_id: assetId, user_id: userId, removed, deleted: true } });
});
