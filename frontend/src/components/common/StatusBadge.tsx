import type { ActivityPriority, ActivityStatus, ConditionStatus, LifecycleStatus, MaintenanceStatus } from '../../lib/types';
import {
  getActivityPriorityBadge,
  getActivityStatusBadge,
  getConditionStatusBadge,
  getLifecycleStatusBadge,
  getMaintenanceStatusBadge,
} from '../../lib/formatters';

export function LifecycleBadge({ status }: { status?: LifecycleStatus }) {
  const badge = getLifecycleStatusBadge(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
      {badge.label}
    </span>
  );
}

export function ActivityStatusBadge({ status }: { status?: ActivityStatus }) {
  const badge = getActivityStatusBadge(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}

export function ActivityPriorityBadge({ priority }: { priority?: ActivityPriority }) {
  const badge = getActivityPriorityBadge(priority);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}

export function ConditionBadge({ condition }: { condition?: ConditionStatus }) {
  const badge = getConditionStatusBadge(condition);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
      {badge.label}
    </span>
  );
}

export function MaintenanceStatusBadge({ status }: { status?: MaintenanceStatus }) {
  const badge = getMaintenanceStatusBadge(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}
