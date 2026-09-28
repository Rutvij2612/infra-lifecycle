export type UserRole = 'ADMIN' | 'GOVERNMENT_OFFICER' | 'FIELD_USER';

export type AssetType = 'HOSPITAL' | 'HIGHWAY' | 'RAILWAY' | 'PUBLIC_BUILDING' | 'BRIDGE' | 'OTHER';

export type LifecycleStatus =
  | 'PLANNED'
  | 'UNDER_CONSTRUCTION'
  | 'OPERATIONAL'
  | 'UNDER_MAINTENANCE'
  | 'REHABILITATION'
  | 'END_OF_LIFE'
  | 'DECOMMISSIONED';

export type LifecycleEventType =
  | 'PLANNED'
  | 'CONSTRUCTION_STARTED'
  | 'CONSTRUCTION_PROGRESS'
  | 'CONSTRUCTION_COMPLETED'
  | 'INSPECTION'
  | 'MAINTENANCE_STARTED'
  | 'MAINTENANCE_COMPLETED'
  | 'REHABILITATION'
  | 'END_OF_LIFE_ASSESSMENT'
  | 'DECOMMISSIONED'
  | 'OTHER';

export type ActivityType = 'CONSTRUCTION' | 'INSPECTION' | 'MAINTENANCE' | 'REPAIR' | 'REHABILITATION' | 'OTHER';
export type ActivityStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';
export type ActivityPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type InspectionType = 'ROUTINE' | 'STRUCTURAL' | 'SAFETY' | 'OTHER';
export type ConditionStatus = 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';

export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY' | 'OTHER';
export type MaintenanceStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

export type ResponsibilityType = 'CONSTRUCTION' | 'MAINTENANCE';

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department_id: string | null;
  department_name?: string | null;
  department_code?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  department: { id: string; name: string } | null;
}

export interface InfrastructureAsset {
  id: string;
  asset_code: string;
  name: string;
  asset_type: AssetType;
  description: string | null;
  department_id: string;
  department_name?: string;
  department_code?: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  lifecycle_status: LifecycleStatus;
  construction_start_date: string | null;
  completion_date: string | null;
  expected_end_of_life_date: string | null;
  created_at?: string;
  updated_at?: string;
  counts?: RelatedCounts;
}

export interface RelatedCounts {
  activityCount: number;
  openActivityCount: number;
  inspectionCount: number;
  maintenanceCount: number;
  lifecycleEventCount: number;
}

export interface LifecycleEvent {
  id: string;
  asset_id: string;
  event_type: LifecycleEventType;
  event_date: string;
  title: string;
  description: string | null;
  progress_percentage: number | null;
  recorded_by: string;
  recorded_by_name?: string;
  created_at: string;
}

export interface Activity {
  id: string;
  asset_id: string;
  title: string;
  description: string | null;
  activity_type: ActivityType;
  status: ActivityStatus;
  priority: ActivityPriority;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  progress_percentage: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  asset_code?: string;
  asset_name?: string;
}

export interface ActivityAssignment {
  id: string;
  activity_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  assigned_at: string;
  assigned_by: string;
}

export interface AssetResponsibility {
  id: string;
  asset_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  responsibility_type: ResponsibilityType;
  assigned_by: string;
  assigned_at: string;
}

export interface Inspection {
  id: string;
  asset_id: string;
  inspection_date: string;
  inspection_type: InspectionType;
  condition_status: ConditionStatus;
  findings: string | null;
  recommendations: string | null;
  conducted_by: string;
  conducted_by_name?: string;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  asset_id: string;
  maintenance_type: MaintenanceType;
  title: string;
  description: string | null;
  start_date: string | null;
  completion_date: string | null;
  cost: number | null;
  status: MaintenanceStatus;
  performed_by: string | null;
  performed_by_name?: string;
  created_at: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationMeta;
}
