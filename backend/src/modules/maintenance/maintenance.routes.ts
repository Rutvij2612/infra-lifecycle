import { Router } from 'express';
import { AppError } from '../../utils/AppError';
import {
  optionalDateString,
  optionalNumber,
  optionalString,
  requireEnum,
  requireString,
  requireUUID,
} from '../../utils/validation';
import { getAssetById } from '../../repositories/assets.repository';
import {
  createMaintenanceRecord,
  getMaintenanceById,
  listMaintenanceByAsset,
  updateMaintenanceRecord,
} from '../../repositories/maintenance.repository';
import { getUserById } from '../../repositories/users.repository';
import { hasResponsibility } from '../../repositories/responsibilities.repository';
import { currentUser } from '../../middleware/auth';
import type { MaintenanceStatus, MaintenanceType } from '../../db/types';

const MAINTENANCE_TYPES: MaintenanceType[] = ['PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'OTHER'];
const MAINTENANCE_STATUSES: MaintenanceStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];

// ---------------------------------------------------------------------------
// Mounted with mergeParams at /api/assets/:id/maintenance
// ---------------------------------------------------------------------------
export const maintenanceByAssetRouter = Router({ mergeParams: true });

maintenanceByAssetRouter.get('/', async (req, res) => {
  const assetId = requireUUID((req.params as Record<string, string>).id, 'id');
  const asset = await getAssetById(assetId);
  if (!asset) throw AppError.notFound('Asset');

  const records = await listMaintenanceByAsset(assetId);
  res.json({ data: records });
});

// POST /api/assets/:id/maintenance
//  - admin / officer: may set performed_by to any user
//  - field user: only for assets they hold MAINTENANCE responsibility for, and only as themselves
maintenanceByAssetRouter.post('/', async (req, res) => {
  const user = currentUser(req);
  const assetId = requireUUID((req.params as Record<string, string>).id, 'id');
  const asset = await getAssetById(assetId);
  if (!asset) throw AppError.notFound('Asset');

  const body = req.body ?? {};
  const maintenance_type = requireEnum(body.maintenance_type, 'maintenance_type', MAINTENANCE_TYPES);
  const title = requireString(body.title, 'title', 200);
  const description = optionalString(body.description, 'description');
  const start_date = optionalDateString(body.start_date, 'start_date');
  const completion_date = optionalDateString(body.completion_date, 'completion_date');
  const cost = optionalNumber(body.cost, 'cost', 0);
  const status = body.status ? requireEnum(body.status, 'status', MAINTENANCE_STATUSES) : 'PLANNED';
  let performed_by = body.performed_by ? requireUUID(body.performed_by, 'performed_by') : null;

  if (user.role === 'FIELD_USER') {
    if (!(await hasResponsibility(user.id, assetId, 'MAINTENANCE'))) {
      throw AppError.forbidden('You can only submit maintenance for assets you hold MAINTENANCE responsibility for');
    }
    if (performed_by !== null && performed_by !== user.id) {
      throw AppError.forbidden('Field users can only submit maintenance as themselves');
    }
    performed_by = user.id;
  }

  if (asset.lifecycle_status === 'DECOMMISSIONED') {
    throw AppError.badRequest(
      'Cannot record maintenance on a DECOMMISSIONED asset.',
      'INVALID_LIFECYCLE_TRANSITION',
    );
  }
  if (asset.lifecycle_status === 'PLANNED' || asset.lifecycle_status === 'UNDER_CONSTRUCTION') {
    throw AppError.badRequest(
      `Cannot perform maintenance on an asset with status '${asset.lifecycle_status}'. Maintenance is only permitted on OPERATIONAL, UNDER_MAINTENANCE, REHABILITATION, or END_OF_LIFE assets.`,
      'INVALID_LIFECYCLE_TRANSITION',
    );
  }

  if (start_date && completion_date && completion_date < start_date) {
    throw AppError.badRequest('completion_date cannot be before start_date');
  }
  if (performed_by) {
    const performer = await getUserById(performed_by);
    if (!performer) throw AppError.badRequest('performed_by does not reference an existing user', 'INVALID_REFERENCE');
  }

  const record = await createMaintenanceRecord({
    asset_id: assetId,
    maintenance_type,
    title,
    description,
    start_date,
    completion_date,
    cost,
    status,
    performed_by,
  });

  res.status(201).json({ data: record });
});

// ---------------------------------------------------------------------------
// Mounted at top-level /api/maintenance
// ---------------------------------------------------------------------------
const router = Router();

// PATCH /api/maintenance/:id
//  - admin / officer: any editable field
//  - field user: only records they performed (performed_by = self) on assets they still hold
//    MAINTENANCE responsibility for, and cannot reassign them
router.patch('/:id', async (req, res) => {
  const user = currentUser(req);
  const id = requireUUID(req.params.id, 'id');
  const existing = await getMaintenanceById(id);
  if (!existing) throw AppError.notFound('Maintenance record');

  const body = req.body ?? {};
  if (user.role === 'FIELD_USER') {
    if (existing.performed_by !== user.id) {
      throw AppError.forbidden('You can only update maintenance records you performed');
    }
    if (!(await hasResponsibility(user.id, existing.asset_id, 'MAINTENANCE'))) {
      throw AppError.forbidden('You no longer hold MAINTENANCE responsibility for this asset');
    }
    if ('performed_by' in body) {
      throw AppError.forbidden('Field users cannot reassign a maintenance record');
    }
  }
  const fields: Record<string, unknown> = {};

  if (body.maintenance_type !== undefined) {
    fields.maintenance_type = requireEnum(body.maintenance_type, 'maintenance_type', MAINTENANCE_TYPES);
  }
  if (body.title !== undefined) fields.title = requireString(body.title, 'title', 200);
  if (body.description !== undefined) fields.description = optionalString(body.description, 'description');
  if (body.start_date !== undefined) fields.start_date = optionalDateString(body.start_date, 'start_date');
  if (body.completion_date !== undefined) fields.completion_date = optionalDateString(body.completion_date, 'completion_date');
  if (body.cost !== undefined) fields.cost = optionalNumber(body.cost, 'cost', 0);
  if (body.status !== undefined) fields.status = requireEnum(body.status, 'status', MAINTENANCE_STATUSES);
  if (body.performed_by !== undefined) {
    if (body.performed_by === null || body.performed_by === '') {
      fields.performed_by = null;
    } else {
      const performedBy = requireUUID(body.performed_by, 'performed_by');
      const performer = await getUserById(performedBy);
      if (!performer) throw AppError.badRequest('performed_by does not reference an existing user', 'INVALID_REFERENCE');
      fields.performed_by = performedBy;
    }
  }

  const startDate = (fields.start_date as string | null | undefined) ?? existing.start_date;
  const completionDate = (fields.completion_date as string | null | undefined) ?? existing.completion_date;
  if (startDate && completionDate && completionDate < startDate) {
    throw AppError.badRequest('completion_date cannot be before start_date');
  }

  if (Object.keys(fields).length === 0) {
    throw AppError.badRequest('No editable fields were provided');
  }

  const updated = await updateMaintenanceRecord(id, fields);
  res.json({ data: updated });
});

export default router;
