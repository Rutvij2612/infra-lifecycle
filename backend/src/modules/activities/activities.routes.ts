import { Router } from 'express';
import { AppError } from '../../utils/AppError';
import {
  optionalDateString,
  optionalInt,
  optionalString,
  requireEnum,
  requireString,
  requireUUID,
} from '../../utils/validation';
import { getAssetById } from '../../repositories/assets.repository';
import {
  createActivity,
  getActivityById,
  listActivitiesByAsset,
  listActivitiesForUser,
  updateActivity,
} from '../../repositories/activities.repository';
import { getUserById } from '../../repositories/users.repository';
import { currentUser, requireRole, STAFF_ROLES } from '../../middleware/auth';
import {
  createAssignment,
  deleteAssignment,
  getAssignment,
  listAssignmentsByActivity,
} from '../../repositories/assignments.repository';
import type { ActivityPriority, ActivityStatus, ActivityType } from '../../db/types';

const ACTIVITY_TYPES: ActivityType[] = ['CONSTRUCTION', 'INSPECTION', 'MAINTENANCE', 'REPAIR', 'REHABILITATION', 'OTHER'];
const ACTIVITY_STATUSES: ActivityStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'];
const ACTIVITY_PRIORITIES: ActivityPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// ---------------------------------------------------------------------------
// Mounted with mergeParams at /api/assets/:id/activities
// ---------------------------------------------------------------------------
export const activitiesByAssetRouter = Router({ mergeParams: true });

activitiesByAssetRouter.get('/', async (req, res) => {
  const assetId = requireUUID((req.params as Record<string, string>).id, 'id');
  const asset = await getAssetById(assetId);
  if (!asset) throw AppError.notFound('Asset');

  const status =
    typeof req.query.status === 'string' && req.query.status
      ? requireEnum(req.query.status, 'status', ACTIVITY_STATUSES)
      : undefined;
  const priority =
    typeof req.query.priority === 'string' && req.query.priority
      ? requireEnum(req.query.priority, 'priority', ACTIVITY_PRIORITIES)
      : undefined;

  // Responsible Field Officers can see all activities on the project (access is guarded by requireAssetAccess)
  const activities = await listActivitiesByAsset(assetId, {
    status,
    priority,
  });
  res.json({ data: activities });
});

activitiesByAssetRouter.post('/', requireRole(...STAFF_ROLES), async (req, res) => {
  const assetId = requireUUID((req.params as Record<string, string>).id, 'id');
  const asset = await getAssetById(assetId);
  if (!asset) throw AppError.notFound('Asset');

  const body = req.body ?? {};
  const title = requireString(body.title, 'title', 200);
  const description = optionalString(body.description, 'description');
  const activity_type = requireEnum(body.activity_type, 'activity_type', ACTIVITY_TYPES);
  const status = body.status ? requireEnum(body.status, 'status', ACTIVITY_STATUSES) : 'TODO';
  const priority = body.priority ? requireEnum(body.priority, 'priority', ACTIVITY_PRIORITIES) : 'MEDIUM';
  const start_date = optionalDateString(body.start_date, 'start_date');
  const due_date = optionalDateString(body.due_date, 'due_date');
  const created_by = currentUser(req).id; // always the authenticated user (body value ignored)

  if (start_date && due_date && due_date < start_date) {
    throw AppError.badRequest('due_date cannot be before start_date');
  }

  const activity = await createActivity({
    asset_id: assetId,
    title,
    description,
    activity_type,
    status,
    priority,
    start_date,
    due_date,
    created_by,
  });

  res.status(201).json({ data: activity });
});

// ---------------------------------------------------------------------------
// Mounted at top-level /api/activities
// ---------------------------------------------------------------------------
const router = Router();

// GET /api/activities/mine - activities assigned to the current user, across all assets
router.get('/mine', async (req, res) => {
  res.json({ data: await listActivitiesForUser(currentUser(req).id) });
});

// Fields a field user may change on an activity they are assigned to.
const FIELD_USER_EDITABLE = ['status', 'progress_percentage'];

// PATCH /api/activities/:id
//  - admin / officer: any editable field
//  - field user: only status + progress, and only if assigned to this activity
router.patch('/:id', async (req, res) => {
  const user = currentUser(req);
  const id = requireUUID(req.params.id, 'id');
  const existing = await getActivityById(id);
  if (!existing) throw AppError.notFound('Activity');

  const body = req.body ?? {};
  if (user.role === 'FIELD_USER') {
    if (!(await getAssignment(id, user.id))) {
      throw AppError.forbidden('You are not assigned to this activity');
    }
    const disallowed = Object.keys(body).filter((key) => !FIELD_USER_EDITABLE.includes(key));
    if (disallowed.length > 0) {
      throw AppError.forbidden(`Field users can only update: ${FIELD_USER_EDITABLE.join(', ')}`);
    }
  }
  const fields: Record<string, unknown> = {};

  if (body.title !== undefined) fields.title = requireString(body.title, 'title', 200);
  if (body.description !== undefined) fields.description = optionalString(body.description, 'description');
  if (body.priority !== undefined) fields.priority = requireEnum(body.priority, 'priority', ACTIVITY_PRIORITIES);
  if (body.start_date !== undefined) fields.start_date = optionalDateString(body.start_date, 'start_date');
  if (body.due_date !== undefined) fields.due_date = optionalDateString(body.due_date, 'due_date');
  if (body.progress_percentage !== undefined) {
    fields.progress_percentage = optionalInt(body.progress_percentage, 'progress_percentage', 0, 100);
  }

  if (body.status !== undefined) {
    const status = requireEnum(body.status, 'status', ACTIVITY_STATUSES);
    fields.status = status;
    if (status === 'COMPLETED') {
      fields.progress_percentage = fields.progress_percentage ?? 100;
      fields.completed_at = new Date();
    } else if (existing.status === 'COMPLETED') {
      // Moving off COMPLETED clears the completion timestamp.
      fields.completed_at = null;
    }
  }

  const startDate = (fields.start_date as string | null | undefined) ?? existing.start_date;
  const dueDate = (fields.due_date as string | null | undefined) ?? existing.due_date;
  if (startDate && dueDate && dueDate < startDate) {
    throw AppError.badRequest('due_date cannot be before start_date');
  }

  if (Object.keys(fields).length === 0) {
    throw AppError.badRequest('No editable fields were provided');
  }

  const updated = await updateActivity(id, fields);
  res.json({ data: updated });
});

// GET /api/activities/:id/assignments (field users: only for activities they are assigned to)
router.get('/:id/assignments', async (req, res) => {
  const user = currentUser(req);
  const activityId = requireUUID(req.params.id, 'id');
  const activity = await getActivityById(activityId);
  if (!activity) throw AppError.notFound('Activity');
  if (user.role === 'FIELD_USER' && !(await getAssignment(activityId, user.id))) {
    throw AppError.forbidden('You are not assigned to this activity');
  }

  const assignments = await listAssignmentsByActivity(activityId);
  res.json({ data: assignments });
});

// POST /api/activities/:id/assignments
router.post('/:id/assignments', requireRole(...STAFF_ROLES), async (req, res) => {
  const activityId = requireUUID(req.params.id, 'id');
  const activity = await getActivityById(activityId);
  if (!activity) throw AppError.notFound('Activity');

  const body = req.body ?? {};
  const user_id = requireUUID(body.user_id, 'user_id');
  const assigned_by = currentUser(req).id; // always the authenticated user (body value ignored)

  const user = await getUserById(user_id);
  if (!user) throw AppError.badRequest('user_id does not reference an existing user', 'INVALID_REFERENCE');
  if (!user.is_active) throw AppError.badRequest('Cannot assign an inactive user', 'INACTIVE_USER');

  if (await getAssignment(activityId, user_id)) {
    throw AppError.conflict('This user is already assigned to this activity', 'DUPLICATE_ASSIGNMENT');
  }

  const assignment = await createAssignment(activityId, user_id, assigned_by);
  res.status(201).json({ data: assignment });
});

// DELETE /api/activities/:id/assignments/:userId
router.delete('/:id/assignments/:userId', requireRole(...STAFF_ROLES), async (req, res) => {
  const activityId = requireUUID(req.params.id, 'id');
  const userId = requireUUID(req.params.userId, 'userId');

  const activity = await getActivityById(activityId);
  if (!activity) throw AppError.notFound('Activity');

  const deleted = await deleteAssignment(activityId, userId);
  if (!deleted) throw AppError.notFound('Assignment');

  res.json({ data: { activity_id: activityId, user_id: userId, deleted: true } });
});

export default router;
