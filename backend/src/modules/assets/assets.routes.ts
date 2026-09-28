import { Router } from 'express';
import { AppError } from '../../utils/AppError';
import {
  buildPaginationMeta,
  optionalDateString,
  optionalNumber,
  optionalString,
  parsePagination,
  requireEnum,
  requireString,
  requireUUID,
} from '../../utils/validation';
import {
  createAsset,
  getAssetByCode,
  getAssetById,
  getRelatedCounts,
  listAssets,
  updateAsset,
} from '../../repositories/assets.repository';
import type { AssetType, LifecycleStatus } from '../../db/types';
import { pool } from '../../config/db';
import { currentUser, requireRole, STAFF_ROLES } from '../../middleware/auth';
import { requireAssetAccess } from '../../middleware/assetAccess';
import { lifecycleByAssetRouter } from '../lifecycle/lifecycle.routes';
import { activitiesByAssetRouter } from '../activities/activities.routes';
import { inspectionsByAssetRouter } from '../inspections/inspections.routes';
import { maintenanceByAssetRouter } from '../maintenance/maintenance.routes';
import { responsibilitiesByAssetRouter } from '../responsibilities/responsibilities.routes';

const ASSET_TYPES: AssetType[] = ['HOSPITAL', 'HIGHWAY', 'RAILWAY', 'PUBLIC_BUILDING', 'BRIDGE', 'OTHER'];
const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  'PLANNED',
  'UNDER_CONSTRUCTION',
  'OPERATIONAL',
  'UNDER_MAINTENANCE',
  'REHABILITATION',
  'END_OF_LIFE',
  'DECOMMISSIONED',
];

const router = Router();

async function departmentExists(departmentId: string): Promise<boolean> {
  if (!pool) throw new Error('DATABASE_URL is not set');
  const result = await pool.query('SELECT 1 FROM departments WHERE id = $1', [departmentId]);
  return (result.rowCount ?? 0) > 0;
}

// GET /api/assets - paginated, searchable, filterable list (field users see only assets they are responsible for)
router.get('/', async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : undefined;
  const asset_type =
    typeof req.query.asset_type === 'string' && req.query.asset_type
      ? requireEnum(req.query.asset_type, 'asset_type', ASSET_TYPES)
      : undefined;
  const lifecycle_status =
    typeof req.query.lifecycle_status === 'string' && req.query.lifecycle_status
      ? requireEnum(req.query.lifecycle_status, 'lifecycle_status', LIFECYCLE_STATUSES)
      : undefined;
  const department_id =
    typeof req.query.department_id === 'string' && req.query.department_id
      ? requireUUID(req.query.department_id, 'department_id')
      : undefined;

  const user = currentUser(req);
  const { rows, total } = await listAssets({
    search,
    assetType: asset_type,
    lifecycleStatus: lifecycle_status,
    departmentId: department_id,
    visibleTo: user.role === 'FIELD_USER' ? { userId: user.id } : undefined,
    limit,
    offset,
  });

  res.json({ data: rows, pagination: buildPaginationMeta(page, limit, total) });
});

// POST /api/assets (admin / officer)
router.post('/', requireRole(...STAFF_ROLES), async (req, res) => {
  const body = req.body ?? {};

  const asset_code = requireString(body.asset_code, 'asset_code', 50);
  const name = requireString(body.name, 'name', 200);
  const asset_type = requireEnum(body.asset_type, 'asset_type', ASSET_TYPES);
  const description = optionalString(body.description, 'description');
  const department_id = requireUUID(body.department_id, 'department_id');
  const location = optionalString(body.location, 'location', 500);
  const latitude = optionalNumber(body.latitude, 'latitude', -90, 90);
  const longitude = optionalNumber(body.longitude, 'longitude', -180, 180);
  const lifecycle_status = body.lifecycle_status
    ? requireEnum(body.lifecycle_status, 'lifecycle_status', LIFECYCLE_STATUSES)
    : 'PLANNED';
  const construction_start_date = optionalDateString(body.construction_start_date, 'construction_start_date');
  const completion_date = optionalDateString(body.completion_date, 'completion_date');
  const expected_end_of_life_date = optionalDateString(body.expected_end_of_life_date, 'expected_end_of_life_date');

  if (construction_start_date && completion_date && completion_date < construction_start_date) {
    throw AppError.badRequest('completion_date cannot be before construction_start_date');
  }
  if (completion_date && expected_end_of_life_date && expected_end_of_life_date < completion_date) {
    throw AppError.badRequest('expected_end_of_life_date cannot be before completion_date');
  }

  if (!(await departmentExists(department_id))) {
    throw AppError.badRequest('department_id does not reference an existing department', 'INVALID_REFERENCE');
  }
  if (await getAssetByCode(asset_code)) {
    throw AppError.conflict(`asset_code '${asset_code}' is already in use`);
  }

  const asset = await createAsset({
    asset_code,
    name,
    asset_type,
    description,
    department_id,
    location,
    latitude,
    longitude,
    lifecycle_status,
    construction_start_date,
    completion_date,
    expected_end_of_life_date,
  });

  res.status(201).json({ data: asset });
});

// Every /api/assets/:id/... route (including nested resources) passes this visibility check.
router.use('/:id', requireAssetAccess);

// GET /api/assets/:id - asset + department info + basic related counts (no deep nesting)
router.get('/:id', async (req, res) => {
  const id = requireUUID(req.params.id, 'id');
  const asset = await getAssetById(id);
  if (!asset) throw AppError.notFound('Asset');

  const counts = await getRelatedCounts(id);
  res.json({ data: { ...asset, counts } });
});

// PATCH /api/assets/:id - editable fields only; lifecycle_status changes via /lifecycle events
router.patch('/:id', requireRole(...STAFF_ROLES), async (req, res) => {
  const id = requireUUID(req.params.id, 'id');
  const existing = await getAssetById(id);
  if (!existing) throw AppError.notFound('Asset');

  const body = req.body ?? {};
  if ('lifecycle_status' in body) {
    throw AppError.badRequest('lifecycle_status cannot be changed directly - add a lifecycle event instead');
  }
  if ('asset_code' in body) {
    throw AppError.badRequest('asset_code cannot be changed');
  }

  const fields: Record<string, unknown> = {};
  if (body.name !== undefined) fields.name = requireString(body.name, 'name', 200);
  if (body.asset_type !== undefined) fields.asset_type = requireEnum(body.asset_type, 'asset_type', ASSET_TYPES);
  if (body.description !== undefined) fields.description = optionalString(body.description, 'description');
  if (body.location !== undefined) fields.location = optionalString(body.location, 'location', 500);
  if (body.latitude !== undefined) fields.latitude = optionalNumber(body.latitude, 'latitude', -90, 90);
  if (body.longitude !== undefined) fields.longitude = optionalNumber(body.longitude, 'longitude', -180, 180);
  if (body.construction_start_date !== undefined) {
    fields.construction_start_date = optionalDateString(body.construction_start_date, 'construction_start_date');
  }
  if (body.completion_date !== undefined) {
    fields.completion_date = optionalDateString(body.completion_date, 'completion_date');
  }
  if (body.expected_end_of_life_date !== undefined) {
    fields.expected_end_of_life_date = optionalDateString(body.expected_end_of_life_date, 'expected_end_of_life_date');
  }
  if (body.department_id !== undefined) {
    const departmentId = requireUUID(body.department_id, 'department_id');
    if (!(await departmentExists(departmentId))) {
      throw AppError.badRequest('department_id does not reference an existing department', 'INVALID_REFERENCE');
    }
    fields.department_id = departmentId;
  }

  if (Object.keys(fields).length === 0) {
    throw AppError.badRequest('No editable fields were provided');
  }

  const startDate = (fields.construction_start_date as string | null | undefined) ?? existing.construction_start_date;
  const completionDate = (fields.completion_date as string | null | undefined) ?? existing.completion_date;
  const eolDate = (fields.expected_end_of_life_date as string | null | undefined) ?? existing.expected_end_of_life_date;
  if (startDate && completionDate && completionDate < startDate) {
    throw AppError.badRequest('completion_date cannot be before construction_start_date');
  }
  if (completionDate && eolDate && eolDate < completionDate) {
    throw AppError.badRequest('expected_end_of_life_date cannot be before completion_date');
  }

  const updated = await updateAsset(id, fields);
  res.json({ data: updated });
});

// Nested sub-resources
router.use('/:id/lifecycle', lifecycleByAssetRouter);
router.use('/:id/activities', activitiesByAssetRouter);
router.use('/:id/inspections', inspectionsByAssetRouter);
router.use('/:id/maintenance', maintenanceByAssetRouter);
router.use('/:id/responsibilities', responsibilitiesByAssetRouter);

export default router;
