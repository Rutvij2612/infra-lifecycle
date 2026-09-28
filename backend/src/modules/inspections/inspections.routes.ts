import { Router } from 'express';
import { AppError } from '../../utils/AppError';
import { optionalString, requireDateString, requireEnum, requireUUID } from '../../utils/validation';
import { getAssetById } from '../../repositories/assets.repository';
import { createInspection, listInspectionsByAsset } from '../../repositories/inspections.repository';
import { getUserById } from '../../repositories/users.repository';
import { currentUser } from '../../middleware/auth';
import type { ConditionStatus, InspectionType } from '../../db/types';

const INSPECTION_TYPES: InspectionType[] = ['ROUTINE', 'STRUCTURAL', 'SAFETY', 'OTHER'];
const CONDITION_STATUSES: ConditionStatus[] = ['GOOD', 'FAIR', 'POOR', 'CRITICAL'];

// Mounted with mergeParams at /api/assets/:id/inspections
export const inspectionsByAssetRouter = Router({ mergeParams: true });

// GET /api/assets/:id/inspections
inspectionsByAssetRouter.get('/', async (req, res) => {
  const assetId = requireUUID((req.params as Record<string, string>).id, 'id');
  const asset = await getAssetById(assetId);
  if (!asset) throw AppError.notFound('Asset');

  const inspections = await listInspectionsByAsset(assetId);
  res.json({ data: inspections });
});

// POST /api/assets/:id/inspections
//  - admin / officer: may record on behalf of any user (conducted_by optional, defaults to self)
//  - field user: only for assets they are responsible for (enforced by requireAssetAccess), only as themselves
inspectionsByAssetRouter.post('/', async (req, res) => {
  const assetId = requireUUID((req.params as Record<string, string>).id, 'id');
  const asset = await getAssetById(assetId);
  if (!asset) throw AppError.notFound('Asset');

  if (asset.lifecycle_status === 'DECOMMISSIONED') {
    throw AppError.badRequest(
      'Cannot record inspections on a DECOMMISSIONED asset.',
      'INVALID_LIFECYCLE_TRANSITION',
    );
  }
  if (asset.lifecycle_status === 'PLANNED') {
    throw AppError.badRequest(
      'Cannot record condition inspections on an asset in PLANNED stage before construction begins.',
      'INVALID_LIFECYCLE_TRANSITION',
    );
  }

  const body = req.body ?? {};
  const inspection_date = requireDateString(body.inspection_date, 'inspection_date');
  const inspection_type = requireEnum(body.inspection_type, 'inspection_type', INSPECTION_TYPES);
  const condition_status = requireEnum(body.condition_status, 'condition_status', CONDITION_STATUSES);
  const findings = optionalString(body.findings, 'findings');
  const recommendations = optionalString(body.recommendations, 'recommendations');
  const user = currentUser(req);

  let conducted_by = user.id;
  if (user.role === 'FIELD_USER') {
    if (body.conducted_by !== undefined && body.conducted_by !== user.id) {
      throw AppError.forbidden('Field users can only submit inspections as themselves');
    }
  } else if (body.conducted_by !== undefined && body.conducted_by !== null && body.conducted_by !== '') {
    conducted_by = requireUUID(body.conducted_by, 'conducted_by');
    const inspector = await getUserById(conducted_by);
    if (!inspector) throw AppError.badRequest('conducted_by does not reference an existing user', 'INVALID_REFERENCE');
  }

  const inspection = await createInspection({
    asset_id: assetId,
    inspection_date,
    inspection_type,
    condition_status,
    findings,
    recommendations,
    conducted_by,
  });

  res.status(201).json({ data: inspection });
});
