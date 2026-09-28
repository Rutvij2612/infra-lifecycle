import { Router } from 'express';
import { AppError } from '../../utils/AppError';
import { requireDateString, requireEnum, requireUUID, optionalInt, optionalString, requireString } from '../../utils/validation';
import { getAssetById } from '../../repositories/assets.repository';
import { listEventsByAsset, recordLifecycleEvent } from '../../repositories/lifecycle.repository';
import { getResponsibilityTypes } from '../../repositories/responsibilities.repository';
import { currentUser } from '../../middleware/auth';
import type { LifecycleEventType, LifecycleStatus, ResponsibilityType } from '../../db/types';
import { validateLifecycleTransition } from './lifecycleStateMachine';

const EVENT_TYPES: LifecycleEventType[] = [
  'PLANNED',
  'CONSTRUCTION_STARTED',
  'CONSTRUCTION_PROGRESS',
  'CONSTRUCTION_COMPLETED',
  'INSPECTION',
  'MAINTENANCE_STARTED',
  'MAINTENANCE_COMPLETED',
  'REHABILITATION',
  'END_OF_LIFE_ASSESSMENT',
  'DECOMMISSIONED',
  'OTHER',
];

// Event types that also move the asset into a new lifecycle_status. Anything not
// listed here (e.g. PLANNED, CONSTRUCTION_PROGRESS, INSPECTION, OTHER) only adds a
// timeline entry and leaves the asset's current status untouched.
const STATUS_BY_EVENT: Partial<Record<LifecycleEventType, LifecycleStatus>> = {
  CONSTRUCTION_STARTED: 'UNDER_CONSTRUCTION',
  CONSTRUCTION_COMPLETED: 'OPERATIONAL',
  MAINTENANCE_STARTED: 'UNDER_MAINTENANCE',
  MAINTENANCE_COMPLETED: 'OPERATIONAL',
  REHABILITATION: 'REHABILITATION',
  END_OF_LIFE_ASSESSMENT: 'END_OF_LIFE',
  DECOMMISSIONED: 'DECOMMISSIONED',
};

// Routine field-level events a Field Officer may record, by the capacity they are responsible in.
// Recording these needs no separate approval. Governance-level events (PLANNED, REHABILITATION,
// END_OF_LIFE_ASSESSMENT, DECOMMISSIONED) stay with ADMIN / GOVERNMENT_OFFICER.
const FIELD_EVENT_TYPES: Record<ResponsibilityType, LifecycleEventType[]> = {
  CONSTRUCTION: ['CONSTRUCTION_STARTED', 'CONSTRUCTION_PROGRESS', 'CONSTRUCTION_COMPLETED', 'INSPECTION', 'OTHER'],
  MAINTENANCE: ['MAINTENANCE_STARTED', 'MAINTENANCE_COMPLETED', 'INSPECTION', 'OTHER'],
};

// Mounted with mergeParams at /api/assets/:id/lifecycle
export const lifecycleByAssetRouter = Router({ mergeParams: true });

// GET /api/assets/:id/lifecycle - full chronological timeline
lifecycleByAssetRouter.get('/', async (req, res) => {
  const assetId = requireUUID((req.params as Record<string, string>).id, 'id');
  const asset = await getAssetById(assetId);
  if (!asset) throw AppError.notFound('Asset');

  const events = await listEventsByAsset(assetId);
  res.json({ data: events });
});

// POST /api/assets/:id/lifecycle - add an event, optionally moving the asset's status
//  - admin / officer: any event type
//  - field user: only routine events matching their responsibility for the asset (asset access is
//    already enforced by requireAssetAccess; no activity assignment is needed)
lifecycleByAssetRouter.post('/', async (req, res) => {
  const assetId = requireUUID((req.params as Record<string, string>).id, 'id');
  const asset = await getAssetById(assetId);
  if (!asset) throw AppError.notFound('Asset');

  const body = req.body ?? {};
  const event_type = requireEnum(body.event_type, 'event_type', EVENT_TYPES);
  const event_date = requireDateString(body.event_date, 'event_date');
  const title = requireString(body.title, 'title', 200);
  const description = optionalString(body.description, 'description');
  let progress_percentage = optionalInt(body.progress_percentage, 'progress_percentage', 0, 100);
  const user = currentUser(req);
  const recorded_by = user.id; // always the authenticated user (body value ignored)

  // 1. Role / responsibility validation for Field Officers
  if (user.role === 'FIELD_USER') {
    const types = await getResponsibilityTypes(user.id, assetId);
    if (!types.some((t) => FIELD_EVENT_TYPES[t].includes(event_type))) {
      throw AppError.forbidden(
        `Your responsibility for this asset (${types.join(', ') || 'none'}) does not allow recording a ${event_type} event`,
      );
    }
  }

  // 2. Lifecycle state machine validation
  const transitionCheck = validateLifecycleTransition(asset.lifecycle_status, event_type);
  if (!transitionCheck.valid) {
    throw AppError.badRequest(
      transitionCheck.reason || 'Invalid lifecycle transition',
      'INVALID_LIFECYCLE_TRANSITION',
    );
  }

  // Auto-progress handling for milestones
  if (event_type === 'CONSTRUCTION_COMPLETED' && progress_percentage === undefined) {
    progress_percentage = 100;
  } else if (event_type === 'CONSTRUCTION_STARTED' && progress_percentage === undefined) {
    progress_percentage = 0;
  }

  const newStatus = STATUS_BY_EVENT[event_type] ?? null;

  const { event, asset: updatedAsset } = await recordLifecycleEvent(
    { asset_id: assetId, event_type, event_date, title, description, progress_percentage, recorded_by },
    newStatus,
  );

  res.status(201).json({ data: { event, asset: updatedAsset ?? asset } });
});
