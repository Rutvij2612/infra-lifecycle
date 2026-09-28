import type {
  ActivityPriority,
  ActivityStatus,
  AssetType,
  ConditionStatus,
  LifecycleEventType,
  LifecycleStatus,
  MaintenanceStatus,
  UserRole,
} from './types';

export function formatRole(role?: UserRole): string {
  if (!role) return '';
  switch (role) {
    case 'ADMIN':
      return 'System Administrator';
    case 'GOVERNMENT_OFFICER':
      return 'Government Officer / Asset Manager';
    case 'FIELD_USER':
      return 'Field Officer / Site Engineer';
    default:
      return role;
  }
}

export function formatAssetType(type?: AssetType): string {
  if (!type) return '';
  switch (type) {
    case 'HOSPITAL':
      return 'Hospital / Health Center';
    case 'HIGHWAY':
      return 'Highway / Expressway';
    case 'RAILWAY':
      return 'Railway / Rail Infrastructure';
    case 'PUBLIC_BUILDING':
      return 'Public / Civic Building';
    case 'BRIDGE':
      return 'Bridge / Flyover';
    case 'OTHER':
      return 'Other Public Infrastructure';
    default:
      return type;
  }
}

export function formatLifecycleStatus(status?: LifecycleStatus): string {
  if (!status) return '';
  switch (status) {
    case 'PLANNED':
      return 'Planned / Sanctioned';
    case 'UNDER_CONSTRUCTION':
      return 'Under Construction';
    case 'OPERATIONAL':
      return 'Operational / In-Service';
    case 'UNDER_MAINTENANCE':
      return 'Under Maintenance';
    case 'REHABILITATION':
      return 'Rehabilitation / Renewal';
    case 'END_OF_LIFE':
      return 'End-of-Life Assessment';
    case 'DECOMMISSIONED':
      return 'Decommissioned / Retired';
    default:
      return status;
  }
}

export function getLifecycleStatusBadge(status?: LifecycleStatus): { bg: string; text: string; dot: string; label: string } {
  switch (status) {
    case 'PLANNED':
      return { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-800', dot: 'bg-sky-500', label: 'Planned' };
    case 'UNDER_CONSTRUCTION':
      return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Under Construction' };
    case 'OPERATIONAL':
      return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-600', label: 'Operational' };
    case 'UNDER_MAINTENANCE':
      return { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800', dot: 'bg-orange-500', label: 'Under Maintenance' };
    case 'REHABILITATION':
      return { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800', dot: 'bg-purple-500', label: 'Rehabilitation' };
    case 'END_OF_LIFE':
      return { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800', dot: 'bg-rose-500', label: 'End-of-Life' };
    case 'DECOMMISSIONED':
      return { bg: 'bg-slate-100 border-slate-300', text: 'text-slate-700', dot: 'bg-slate-400', label: 'Decommissioned' };
    default:
      return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400', label: status || 'Unknown' };
  }
}

export function formatEventType(type?: LifecycleEventType): string {
  if (!type) return '';
  switch (type) {
    case 'PLANNED':
      return 'Project Sanctioned';
    case 'CONSTRUCTION_STARTED':
      return 'Construction Started';
    case 'CONSTRUCTION_PROGRESS':
      return 'Construction Progress Milestone';
    case 'CONSTRUCTION_COMPLETED':
      return 'Construction Completed';
    case 'INSPECTION':
      return 'Structural / Safety Inspection';
    case 'MAINTENANCE_STARTED':
      return 'Maintenance Work Started';
    case 'MAINTENANCE_COMPLETED':
      return 'Maintenance Work Completed';
    case 'REHABILITATION':
      return 'Rehabilitation / Renewal Work';
    case 'END_OF_LIFE_ASSESSMENT':
      return 'End-of-Life Assessment';
    case 'DECOMMISSIONED':
      return 'Asset Decommissioned';
    case 'OTHER':
      return 'Other Lifecycle Event';
    default:
      return type;
  }
}

export function getActivityStatusBadge(status?: ActivityStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case 'TODO':
      return { bg: 'bg-slate-100 border-slate-300', text: 'text-slate-700', label: 'To Do' };
    case 'IN_PROGRESS':
      return { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', label: 'In Progress' };
    case 'BLOCKED':
      return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Blocked' };
    case 'COMPLETED':
      return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: 'Completed' };
    default:
      return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', label: status || 'Unknown' };
  }
}

export function getActivityPriorityBadge(priority?: ActivityPriority): { bg: string; text: string; label: string } {
  switch (priority) {
    case 'LOW':
      return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', label: 'Low' };
    case 'MEDIUM':
      return { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700', label: 'Medium' };
    case 'HIGH':
      return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'High' };
    case 'CRITICAL':
      return { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'Critical' };
    default:
      return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', label: priority || 'Unknown' };
  }
}

export function getConditionStatusBadge(condition?: ConditionStatus): { bg: string; text: string; dot: string; label: string } {
  switch (condition) {
    case 'GOOD':
      return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Good' };
    case 'FAIR':
      return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Fair' };
    case 'POOR':
      return { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800', dot: 'bg-orange-500', label: 'Poor' };
    case 'CRITICAL':
      return { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800', dot: 'bg-rose-600', label: 'Critical' };
    default:
      return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400', label: condition || 'Unknown' };
  }
}

export function getMaintenanceStatusBadge(status?: MaintenanceStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case 'PLANNED':
      return { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-800', label: 'Planned' };
    case 'IN_PROGRESS':
      return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'In Progress' };
    case 'COMPLETED':
      return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: 'Completed' };
    default:
      return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', label: status || 'Unknown' };
  }
}

export function formatINR(amount?: number | null): string {
  if (amount === undefined || amount === null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

export function formatDateTime(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}
