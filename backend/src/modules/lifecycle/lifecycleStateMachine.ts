import type { LifecycleEventType, LifecycleStatus } from '../../db/types';

export interface TransitionValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates whether an event_type is permissible given the asset's current lifecycle_status.
 * Returns { valid: true } if allowed, or { valid: false, reason } explaining the violation.
 */
export function validateLifecycleTransition(
  currentStatus: LifecycleStatus,
  eventType: LifecycleEventType,
): TransitionValidationResult {
  // Terminal state: DECOMMISSIONED assets cannot receive any new lifecycle events
  if (currentStatus === 'DECOMMISSIONED') {
    return {
      valid: false,
      reason: `Cannot record '${eventType}' on a DECOMMISSIONED asset. Decommissioning is a terminal lifecycle state.`,
    };
  }

  switch (eventType) {
    case 'PLANNED':
      if (currentStatus !== 'PLANNED') {
        return {
          valid: false,
          reason: `Cannot record a PLANNED milestone when the asset is already in '${currentStatus}' stage.`,
        };
      }
      break;

    case 'CONSTRUCTION_STARTED':
      if (currentStatus !== 'PLANNED') {
        return {
          valid: false,
          reason: `Cannot start construction on an asset in '${currentStatus}' stage. Construction can only start from PLANNED stage.`,
        };
      }
      break;

    case 'CONSTRUCTION_PROGRESS':
      if (currentStatus !== 'UNDER_CONSTRUCTION') {
        return {
          valid: false,
          reason: `Cannot record construction progress on an asset with status '${currentStatus}'. Asset must be UNDER_CONSTRUCTION.`,
        };
      }
      break;

    case 'CONSTRUCTION_COMPLETED':
      if (currentStatus !== 'UNDER_CONSTRUCTION') {
        return {
          valid: false,
          reason: `Cannot complete construction on an asset in '${currentStatus}' stage. Construction must be in UNDER_CONSTRUCTION stage before completion.`,
        };
      }
      break;

    case 'INSPECTION':
      if (currentStatus === 'PLANNED') {
        return {
          valid: false,
          reason: `Cannot record condition inspections on an asset in PLANNED stage before construction begins.`,
        };
      }
      break;

    case 'MAINTENANCE_STARTED':
      if (currentStatus !== 'OPERATIONAL' && currentStatus !== 'REHABILITATION') {
        return {
          valid: false,
          reason: `Cannot start maintenance on an asset with status '${currentStatus}'. Maintenance is only permitted on OPERATIONAL or REHABILITATION assets.`,
        };
      }
      break;

    case 'MAINTENANCE_COMPLETED':
      if (currentStatus !== 'UNDER_MAINTENANCE') {
        return {
          valid: false,
          reason: `Cannot complete maintenance on an asset with status '${currentStatus}'. Asset must currently be UNDER_MAINTENANCE.`,
        };
      }
      break;

    case 'REHABILITATION':
      if (
        currentStatus !== 'OPERATIONAL' &&
        currentStatus !== 'UNDER_MAINTENANCE' &&
        currentStatus !== 'END_OF_LIFE'
      ) {
        return {
          valid: false,
          reason: `Cannot start rehabilitation on an asset in '${currentStatus}' stage. Rehabilitation requires asset to be OPERATIONAL, UNDER_MAINTENANCE, or END_OF_LIFE.`,
        };
      }
      break;

    case 'END_OF_LIFE_ASSESSMENT':
      if (
        currentStatus !== 'OPERATIONAL' &&
        currentStatus !== 'UNDER_MAINTENANCE' &&
        currentStatus !== 'REHABILITATION'
      ) {
        return {
          valid: false,
          reason: `Cannot perform an end-of-life assessment on an asset in '${currentStatus}' stage.`,
        };
      }
      break;

    case 'DECOMMISSIONED':
      if (
        currentStatus !== 'END_OF_LIFE' &&
        currentStatus !== 'OPERATIONAL' &&
        currentStatus !== 'REHABILITATION'
      ) {
        return {
          valid: false,
          reason: `Cannot decommission an asset directly from '${currentStatus}' stage. Asset must reach END_OF_LIFE, OPERATIONAL, or REHABILITATION before decommissioning.`,
        };
      }
      break;

    case 'OTHER':
      // General milestone permitted on any active non-decommissioned state
      break;
  }

  return { valid: true };
}
