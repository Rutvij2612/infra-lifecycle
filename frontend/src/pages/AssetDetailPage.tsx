import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import type {
  Activity,
  ActivityPriority,
  ActivityStatus,
  ActivityType,
  ApiResponse,
  AssetResponsibility,
  AssetType,
  ConditionStatus,
  Department,
  InfrastructureAsset,
  Inspection,
  InspectionType,
  LifecycleEvent,
  LifecycleEventType,
  MaintenanceRecord,
  MaintenanceStatus,
  MaintenanceType,
  ResponsibilityType,
  User,
} from '../lib/types';
import {
  ActivityPriorityBadge,
  ActivityStatusBadge,
  ConditionBadge,
  LifecycleBadge,
  MaintenanceStatusBadge,
} from '../components/common/StatusBadge';
import { ProgressBar } from '../components/common/ProgressBar';
import { Modal } from '../components/common/Modal';
import { AlertBanner, EmptyState, LoadingSpinner } from '../components/common/Feedback';
import {
  formatAssetType,
  formatDate,
  formatEventType,
  formatINR,
} from '../lib/formatters';

interface AssetDetailPageProps {
  assetId: string;
  onBack: () => void;
}

type TabKey = 'timeline' | 'activities' | 'inspections' | 'maintenance' | 'responsibilities' | 'metadata';

const ALL_EVENT_TYPES: { value: LifecycleEventType; label: string; fieldAllowed?: boolean }[] = [
  { value: 'CONSTRUCTION_STARTED', label: 'Construction Started', fieldAllowed: true },
  { value: 'CONSTRUCTION_PROGRESS', label: 'Construction Progress Milestone', fieldAllowed: true },
  { value: 'CONSTRUCTION_COMPLETED', label: 'Construction Completed (Move to Operational)', fieldAllowed: true },
  { value: 'INSPECTION', label: 'Inspection Recorded', fieldAllowed: true },
  { value: 'MAINTENANCE_STARTED', label: 'Maintenance Started (Move to Under Maintenance)', fieldAllowed: true },
  { value: 'MAINTENANCE_COMPLETED', label: 'Maintenance Completed', fieldAllowed: true },
  { value: 'PLANNED', label: 'Project Sanctioned (Governance)', fieldAllowed: false },
  { value: 'REHABILITATION', label: 'Rehabilitation Started (Governance)', fieldAllowed: false },
  { value: 'END_OF_LIFE_ASSESSMENT', label: 'End-of-Life Assessment (Governance)', fieldAllowed: false },
  { value: 'DECOMMISSIONED', label: 'Asset Decommissioned (Governance)', fieldAllowed: false },
  { value: 'OTHER', label: 'Other Lifecycle Event', fieldAllowed: true },
];

export function AssetDetailPage({ assetId, onBack }: AssetDetailPageProps) {
  const { user } = useAuth();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICER';
  const isField = user?.role === 'FIELD_USER';

  const [asset, setAsset] = useState<InfrastructureAsset | null>(null);
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [responsibilities, setResponsibilities] = useState<AssetResponsibility[]>([]);
  const [fieldUsers, setFieldUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [activeTab, setActiveTab] = useState<TabKey>('timeline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [lifecycleModalOpen, setLifecycleModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [updateActivityModalOpen, setUpdateActivityModalOpen] = useState(false);
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [updateMaintenanceModalOpen, setUpdateMaintenanceModalOpen] = useState(false);
  const [responsibilityModalOpen, setResponsibilityModalOpen] = useState(false);
  const [editAssetModalOpen, setEditAssetModalOpen] = useState(false);

  // Selected records for editing
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState<MaintenanceRecord | null>(null);

  // Submitting flags
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [lifecycleForm, setLifecycleForm] = useState({
    event_type: 'CONSTRUCTION_PROGRESS' as LifecycleEventType,
    event_date: new Date().toISOString().slice(0, 10),
    title: '',
    description: '',
    progress_percentage: '',
  });

  const [activityForm, setActivityForm] = useState({
    title: '',
    description: '',
    activity_type: 'CONSTRUCTION' as ActivityType,
    status: 'TODO' as ActivityStatus,
    priority: 'MEDIUM' as ActivityPriority,
    start_date: '',
    due_date: '',
  });

  const [activityUpdateForm, setActivityUpdateForm] = useState({
    status: 'IN_PROGRESS' as ActivityStatus,
    progress_percentage: 0,
    title: '',
    priority: 'MEDIUM' as ActivityPriority,
    start_date: '',
    due_date: '',
  });

  const [inspectionForm, setInspectionForm] = useState({
    inspection_date: new Date().toISOString().slice(0, 10),
    inspection_type: 'ROUTINE' as InspectionType,
    condition_status: 'GOOD' as ConditionStatus,
    findings: '',
    recommendations: '',
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenance_type: 'PREVENTIVE' as MaintenanceType,
    title: '',
    description: '',
    start_date: new Date().toISOString().slice(0, 10),
    completion_date: '',
    cost: '',
    status: 'PLANNED' as MaintenanceStatus,
    performed_by: '',
  });

  const [maintenanceUpdateForm, setMaintenanceUpdateForm] = useState({
    status: 'IN_PROGRESS' as MaintenanceStatus,
    completion_date: '',
    cost: '',
    description: '',
  });

  const [responsibilityForm, setResponsibilityForm] = useState({
    user_id: '',
    responsibility_type: 'CONSTRUCTION' as ResponsibilityType,
  });

  const [editAssetForm, setEditAssetForm] = useState({
    name: '',
    asset_type: 'HOSPITAL' as AssetType,
    department_id: '',
    location: '',
    latitude: '',
    longitude: '',
    description: '',
    construction_start_date: '',
    completion_date: '',
    expected_end_of_life_date: '',
  });

  // Load Asset and all sub-resources
  const loadAssetData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetRes, eventsRes, actsRes, inspRes, maintRes, respRes] = await Promise.all([
        apiGet<ApiResponse<InfrastructureAsset>>(`/assets/${assetId}`),
        apiGet<ApiResponse<LifecycleEvent[]>>(`/assets/${assetId}/lifecycle`).catch(() => ({ data: [] })),
        apiGet<ApiResponse<Activity[]>>(`/assets/${assetId}/activities`).catch(() => ({ data: [] })),
        apiGet<ApiResponse<Inspection[]>>(`/assets/${assetId}/inspections`).catch(() => ({ data: [] })),
        apiGet<ApiResponse<MaintenanceRecord[]>>(`/assets/${assetId}/maintenance`).catch(() => ({ data: [] })),
        apiGet<ApiResponse<AssetResponsibility[]>>(`/assets/${assetId}/responsibilities`).catch(() => ({ data: [] })),
      ]);

      setAsset(assetRes.data);
      setEvents(eventsRes.data || []);
      setActivities(actsRes.data || []);
      setInspections(inspRes.data || []);
      setMaintenance(maintRes.data || []);
      setResponsibilities(respRes.data || []);

      if (assetRes.data) {
        setEditAssetForm({
          name: assetRes.data.name || '',
          asset_type: assetRes.data.asset_type || 'HOSPITAL',
          department_id: assetRes.data.department_id || '',
          location: assetRes.data.location || '',
          latitude: assetRes.data.latitude !== null ? String(assetRes.data.latitude) : '',
          longitude: assetRes.data.longitude !== null ? String(assetRes.data.longitude) : '',
          description: assetRes.data.description || '',
          construction_start_date: assetRes.data.construction_start_date || '',
          completion_date: assetRes.data.completion_date || '',
          expected_end_of_life_date: assetRes.data.expected_end_of_life_date || '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load asset details');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    loadAssetData();
  }, [loadAssetData]);

  // Load field users and departments for dropdowns if staff
  useEffect(() => {
    if (isStaff) {
      apiGet<ApiResponse<User[]>>('/users?role=FIELD_USER&is_active=true')
        .then((res: ApiResponse<User[]>) => {
          setFieldUsers(res.data || []);
          if (res.data?.length > 0) {
            setResponsibilityForm((f) => ({ ...f, user_id: res.data[0].id }));
          }
        })
        .catch(() => {});

      apiGet<ApiResponse<Department[]>>('/departments')
        .then((res: ApiResponse<Department[]>) => setDepartments(res.data || []))
        .catch(() => {});
    }
  }, [isStaff]);

  // Handle Record Lifecycle Event
  async function handleRecordLifecycle(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        event_type: lifecycleForm.event_type,
        event_date: lifecycleForm.event_date,
        title: lifecycleForm.title.trim(),
        description: lifecycleForm.description.trim() || undefined,
        progress_percentage:
          lifecycleForm.progress_percentage !== '' ? Number(lifecycleForm.progress_percentage) : undefined,
      };
      await apiPost(`/assets/${assetId}/lifecycle`, payload);
      setSuccessMsg('Lifecycle milestone recorded successfully.');
      setLifecycleModalOpen(false);
      setLifecycleForm({
        event_type: 'CONSTRUCTION_PROGRESS',
        event_date: new Date().toISOString().slice(0, 10),
        title: '',
        description: '',
        progress_percentage: '',
      });
      loadAssetData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record lifecycle event');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Create Activity
  async function handleCreateActivity(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: activityForm.title.trim(),
        description: activityForm.description.trim() || undefined,
        activity_type: activityForm.activity_type,
        status: activityForm.status,
        priority: activityForm.priority,
        start_date: activityForm.start_date || undefined,
        due_date: activityForm.due_date || undefined,
      };
      await apiPost(`/assets/${assetId}/activities`, payload);
      setSuccessMsg('Activity created successfully.');
      setActivityModalOpen(false);
      setActivityForm({
        title: '',
        description: '',
        activity_type: 'CONSTRUCTION',
        status: 'TODO',
        priority: 'MEDIUM',
        start_date: '',
        due_date: '',
      });
      loadAssetData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create activity');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Update Activity
  async function handleUpdateActivity(e: FormEvent) {
    e.preventDefault();
    if (!selectedActivity) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        status: activityUpdateForm.status,
        progress_percentage: Number(activityUpdateForm.progress_percentage),
      };
      if (isStaff) {
        if (activityUpdateForm.title) payload.title = activityUpdateForm.title.trim();
        if (activityUpdateForm.priority) payload.priority = activityUpdateForm.priority;
        if (activityUpdateForm.start_date) payload.start_date = activityUpdateForm.start_date;
        if (activityUpdateForm.due_date) payload.due_date = activityUpdateForm.due_date;
      }
      await apiPatch(`/activities/${selectedActivity.id}`, payload);
      setSuccessMsg(`Activity "${selectedActivity.title}" updated.`);
      setUpdateActivityModalOpen(false);
      setSelectedActivity(null);
      loadAssetData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update activity');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Record Inspection
  async function handleRecordInspection(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        inspection_date: inspectionForm.inspection_date,
        inspection_type: inspectionForm.inspection_type,
        condition_status: inspectionForm.condition_status,
        findings: inspectionForm.findings.trim() || undefined,
        recommendations: inspectionForm.recommendations.trim() || undefined,
      };
      await apiPost(`/assets/${assetId}/inspections`, payload);
      setSuccessMsg('Inspection recorded successfully.');
      setInspectionModalOpen(false);
      setInspectionForm({
        inspection_date: new Date().toISOString().slice(0, 10),
        inspection_type: 'ROUTINE',
        condition_status: 'GOOD',
        findings: '',
        recommendations: '',
      });
      loadAssetData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record inspection');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Log Maintenance
  async function handleLogMaintenance(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        maintenance_type: maintenanceForm.maintenance_type,
        title: maintenanceForm.title.trim(),
        description: maintenanceForm.description.trim() || undefined,
        start_date: maintenanceForm.start_date || undefined,
        completion_date: maintenanceForm.completion_date || undefined,
        cost: maintenanceForm.cost !== '' ? Number(maintenanceForm.cost) : undefined,
        status: maintenanceForm.status,
        performed_by: maintenanceForm.performed_by || undefined,
      };
      await apiPost(`/assets/${assetId}/maintenance`, payload);
      setSuccessMsg('Maintenance record logged successfully.');
      setMaintenanceModalOpen(false);
      setMaintenanceForm({
        maintenance_type: 'PREVENTIVE',
        title: '',
        description: '',
        start_date: new Date().toISOString().slice(0, 10),
        completion_date: '',
        cost: '',
        status: 'PLANNED',
        performed_by: '',
      });
      loadAssetData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log maintenance');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Update Maintenance
  async function handleUpdateMaintenance(e: FormEvent) {
    e.preventDefault();
    if (!selectedMaintenance) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        status: maintenanceUpdateForm.status,
      };
      if (maintenanceUpdateForm.completion_date) payload.completion_date = maintenanceUpdateForm.completion_date;
      if (maintenanceUpdateForm.cost !== '') payload.cost = Number(maintenanceUpdateForm.cost);
      if (maintenanceUpdateForm.description) payload.description = maintenanceUpdateForm.description.trim();

      await apiPatch(`/maintenance/${selectedMaintenance.id}`, payload);
      setSuccessMsg('Maintenance record updated.');
      setUpdateMaintenanceModalOpen(false);
      setSelectedMaintenance(null);
      loadAssetData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update maintenance');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Assign Responsibility
  async function handleAssignResponsibility(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/assets/${assetId}/responsibilities`, {
        user_id: responsibilityForm.user_id,
        responsibility_type: responsibilityForm.responsibility_type,
      });
      setSuccessMsg('Field officer responsibility assigned successfully.');
      setResponsibilityModalOpen(false);
      loadAssetData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign responsibility');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Remove Responsibility
  async function handleRemoveResponsibility(userId: string, type?: ResponsibilityType) {
    if (!confirm('Are you sure you want to revoke this field officer responsibility assignment?')) return;
    setError(null);
    try {
      const queryStr = type ? `?responsibility_type=${type}` : '';
      await apiDelete(`/assets/${assetId}/responsibilities/${userId}${queryStr}`);
      setSuccessMsg('Responsibility assignment removed.');
      loadAssetData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove responsibility');
    }
  }

  // Handle Edit Asset Info
  async function handleEditAsset(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: editAssetForm.name.trim(),
        asset_type: editAssetForm.asset_type,
        department_id: editAssetForm.department_id,
        location: editAssetForm.location.trim() || undefined,
        latitude: editAssetForm.latitude ? Number(editAssetForm.latitude) : undefined,
        longitude: editAssetForm.longitude ? Number(editAssetForm.longitude) : undefined,
        description: editAssetForm.description.trim() || undefined,
        construction_start_date: editAssetForm.construction_start_date || undefined,
        completion_date: editAssetForm.completion_date || undefined,
        expected_end_of_life_date: editAssetForm.expected_end_of_life_date || undefined,
      };
      await apiPatch(`/assets/${assetId}`, payload);
      setSuccessMsg('Asset details updated.');
      setEditAssetModalOpen(false);
      loadAssetData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update asset');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !asset) {
    return <LoadingSpinner text="Loading infrastructure asset profile..." />;
  }

  if (!asset) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-semibold">
          ← Back to Inventory
        </button>
        <EmptyState
          title="Asset not accessible or not found"
          description="You might not have field-level responsibility for this project, or the asset ID is invalid."
          actionText="Back to Assets"
          onAction={onBack}
        />
      </div>
    );
  }

  // Latest progress event
  const progressEvents = events.filter((e) => e.progress_percentage !== null);
  const latestProgress = progressEvents.length > 0 ? progressEvents[0].progress_percentage : null;

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs"
          >
            ← Back
          </button>
          <span className="text-xs text-slate-400">/</span>
          <span className="text-xs font-mono font-bold text-slate-700">{asset.asset_code}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Record Milestone (Any Staff, or Responsible Field Officer) */}
          <button
            onClick={() => setLifecycleModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors shadow-xs"
          >
            + Record Lifecycle Event
          </button>

          {/* Quick Inspection Record */}
          <button
            onClick={() => setInspectionModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-800 rounded hover:bg-slate-50 border border-slate-300 shadow-2xs"
          >
            + Log Inspection
          </button>

          {/* Create Activity (Staff only) */}
          {isStaff && (
            <button
              onClick={() => setActivityModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-800 rounded hover:bg-slate-50 border border-slate-300 shadow-2xs"
            >
              + Add Task
            </button>
          )}

          {/* Edit Asset (Staff only) */}
          {isStaff && (
            <button
              onClick={() => setEditAssetModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-700 rounded hover:bg-slate-50 border border-slate-300 shadow-2xs"
            >
              Edit Asset
            </button>
          )}
        </div>
      </div>

      <AlertBanner message={error} type="error" onDismiss={() => setError(null)} />
      <AlertBanner message={successMsg} type="success" onDismiss={() => setSuccessMsg(null)} />

      {/* Main Asset Header Card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-300">
                {asset.asset_code}
              </span>
              <LifecycleBadge status={asset.lifecycle_status} />
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {formatAssetType(asset.asset_type)}
              </span>
              {asset.department_name && (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                  {asset.department_name}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{asset.name}</h1>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span>📍 {asset.location || 'Location not specified'}</span>
              {asset.latitude && asset.longitude && (
                <span className="font-mono text-[11px] text-slate-400">
                  ({asset.latitude.toFixed(4)}, {asset.longitude.toFixed(4)})
                </span>
              )}
            </p>
          </div>

          {/* Construction / Lifecycle Progress Tracker */}
          {asset.lifecycle_status === 'UNDER_CONSTRUCTION' && (
            <div className="w-full lg:w-72 bg-slate-50 p-3 rounded-lg border border-slate-200 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                <span>Civil Construction Progress</span>
                <span className="font-mono text-amber-800">{latestProgress ?? 0}%</span>
              </div>
              <ProgressBar progress={latestProgress ?? 0} size="md" statusColor="amber" />
              <p className="text-[10px] text-slate-500 mt-1.5">
                Start: {formatDate(asset.construction_start_date)} • Target:{' '}
                {formatDate(asset.completion_date)}
              </p>
            </div>
          )}
        </div>

        {/* Related Counts Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-100 text-xs">
          <div className="p-2 bg-slate-50 rounded border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Milestones</span>
            <div className="text-base font-bold text-slate-900">{events.length}</div>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Project Tasks</span>
            <div className="text-base font-bold text-slate-900">{activities.length}</div>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Inspections</span>
            <div className="text-base font-bold text-slate-900">{inspections.length}</div>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Maintenance Logs</span>
            <div className="text-base font-bold text-slate-900">{maintenance.length}</div>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Field Officers</span>
            <div className="text-base font-bold text-slate-900">{responsibilities.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto text-xs font-semibold">
          {[
            { key: 'timeline', label: `Lifecycle Timeline (${events.length})` },
            { key: 'activities', label: `Activities & Tasks (${activities.length})` },
            { key: 'inspections', label: `Inspections (${inspections.length})` },
            { key: 'maintenance', label: `Maintenance (${maintenance.length})` },
            { key: 'responsibilities', label: `Responsible Officers (${responsibilities.length})` },
            { key: 'metadata', label: 'Project Metadata' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`py-2.5 px-3 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 1: Lifecycle Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Chronological Lifecycle History</h3>
              <p className="text-[11px] text-slate-500">
                Official audit trail of all sanctioned stages, construction progress, inspections, and transitions.
              </p>
            </div>
            <button
              onClick={() => setLifecycleModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
            >
              + Record Milestone
            </button>
          </div>

          {events.length === 0 ? (
            <EmptyState
              title="No lifecycle events recorded yet"
              description="Record the first lifecycle milestone for this asset (e.g. Construction Started, Progress, etc.)."
              actionText="+ Record Milestone"
              onAction={() => setLifecycleModalOpen(true)}
            />
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6 py-2">
              {events.map((ev) => (
                <div key={ev.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-white shadow-xs" />

                  <div className="bg-slate-50/80 rounded-lg p-3.5 border border-slate-200/80 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{ev.title}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                          {formatEventType(ev.event_type)}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-500">{formatDate(ev.event_date)}</span>
                    </div>

                    {ev.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">{ev.description}</p>
                    )}

                    {ev.progress_percentage !== null && (
                      <div className="pt-1 max-w-xs">
                        <ProgressBar progress={ev.progress_percentage} size="sm" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Activities & Tasks */}
      {activeTab === 'activities' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Project Work Tasks & Activities</h3>
              <p className="text-[11px] text-slate-500">
                {isField
                  ? 'Complete activity list for this project under your field-officer responsibility'
                  : 'Track work packages, priority tasks, and field assignments'}
              </p>
            </div>
            {isStaff && (
              <button
                onClick={() => setActivityModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
              >
                + Add New Task
              </button>
            )}
          </div>

          {activities.length === 0 ? (
            <EmptyState
              title="No activities recorded for this asset"
              description="Create the first work package or task for this infrastructure project."
              actionText={isStaff ? '+ Add Task' : undefined}
              onAction={isStaff ? () => setActivityModalOpen(true) : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Task Title & Details</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Progress</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activities.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 max-w-xs">
                        <div className="font-bold text-slate-900">{act.title}</div>
                        {act.description && (
                          <div className="text-[11px] text-slate-500 truncate">{act.description}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">{act.activity_type}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <ActivityPriorityBadge priority={act.priority} />
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <ActivityStatusBadge status={act.status} />
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap min-w-[120px]">
                        <ProgressBar progress={act.progress_percentage} size="sm" />
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                        {formatDate(act.due_date)}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedActivity(act);
                            setActivityUpdateForm({
                              status: act.status,
                              progress_percentage: act.progress_percentage || 0,
                              title: act.title,
                              priority: act.priority,
                              start_date: act.start_date || '',
                              due_date: act.due_date || '',
                            });
                            setUpdateActivityModalOpen(true);
                          }}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300"
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Inspections */}
      {activeTab === 'inspections' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Condition & Safety Inspections</h3>
              <p className="text-[11px] text-slate-500">
                Audits, routine structural assessments, and safety reviews.
              </p>
            </div>
            <button
              onClick={() => setInspectionModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
            >
              + Record Inspection
            </button>
          </div>

          {inspections.length === 0 ? (
            <EmptyState
              title="No inspections recorded for this asset"
              description="Log the first structural, routine, or safety inspection."
              actionText="+ Record Inspection"
              onAction={() => setInspectionModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {inspections.map((insp) => (
                <div
                  key={insp.id}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-900">{insp.inspection_type} Inspection</span>
                    <ConditionBadge condition={insp.condition_status} />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Date: <span className="font-medium text-slate-700">{formatDate(insp.inspection_date)}</span>
                  </div>
                  {insp.findings && (
                    <div>
                      <span className="font-bold text-slate-700 text-[11px]">Findings: </span>
                      <span className="text-slate-600">{insp.findings}</span>
                    </div>
                  )}
                  {insp.recommendations && (
                    <div>
                      <span className="font-bold text-slate-700 text-[11px]">Recommendations: </span>
                      <span className="text-slate-600">{insp.recommendations}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Maintenance */}
      {activeTab === 'maintenance' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Maintenance & Repair History</h3>
              <p className="text-[11px] text-slate-500">
                Preventive servicing, corrective work, emergency repairs, and costs.
              </p>
            </div>
            <button
              onClick={() => setMaintenanceModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
            >
              + Log Maintenance
            </button>
          </div>

          {maintenance.length === 0 ? (
            <EmptyState
              title="No maintenance records found"
              description="Log preventive, corrective, or emergency maintenance records."
              actionText="+ Log Maintenance"
              onAction={() => setMaintenanceModalOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Title & Type</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Estimated Cost</th>
                    <th className="py-2.5 px-3">Start Date</th>
                    <th className="py-2.5 px-3">Completion Date</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {maintenance.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 max-w-xs">
                        <div className="font-bold text-slate-900">{m.title}</div>
                        <div className="text-[11px] text-slate-500">{m.maintenance_type}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <MaintenanceStatusBadge status={m.status} />
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800">
                        {formatINR(m.cost)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">{formatDate(m.start_date)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                        {formatDate(m.completion_date)}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedMaintenance(m);
                            setMaintenanceUpdateForm({
                              status: m.status,
                              completion_date: m.completion_date || '',
                              cost: m.cost !== null ? String(m.cost) : '',
                              description: m.description || '',
                            });
                            setUpdateMaintenanceModalOpen(true);
                          }}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300"
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Responsibilities */}
      {activeTab === 'responsibilities' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Responsible Field Officers</h3>
              <p className="text-[11px] text-slate-500">
                Field officers assigned primary project-level monitoring & maintenance responsibility for this asset.
              </p>
            </div>
            {isStaff && (
              <button
                onClick={() => setResponsibilityModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
              >
                + Assign Field Officer
              </button>
            )}
          </div>

          {responsibilities.length === 0 ? (
            <EmptyState
              title="No field officers assigned to this project"
              description="Assign a field officer with CONSTRUCTION or MAINTENANCE responsibility."
              actionText={isStaff ? '+ Assign Officer' : undefined}
              onAction={isStaff ? () => setResponsibilityModalOpen(true) : undefined}
            />
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {responsibilities.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-4 bg-slate-50/50">
                  <div>
                    <div className="font-bold text-xs text-slate-900">
                      {r.user_name || r.user_email || r.user_id}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Capacity:{' '}
                      <span className="font-semibold text-slate-700 bg-slate-200 px-1.5 py-0.2 rounded">
                        {r.responsibility_type}
                      </span>{' '}
                      • Assigned on {formatDate(r.assigned_at)}
                    </div>
                  </div>

                  {isStaff && (
                    <button
                      onClick={() => handleRemoveResponsibility(r.user_id, r.responsibility_type)}
                      className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Metadata */}
      {activeTab === 'metadata' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Project Overview & Asset Specifications</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">Asset Code</span>
                <p className="font-mono font-bold text-slate-900">{asset.asset_code}</p>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">Department</span>
                <p className="font-semibold text-slate-800">{asset.department_name || '—'}</p>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">Location Address</span>
                <p className="text-slate-700">{asset.location || '—'}</p>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">Geographic Coordinates</span>
                <p className="font-mono text-slate-700">
                  {asset.latitude && asset.longitude
                    ? `${asset.latitude.toFixed(5)}, ${asset.longitude.toFixed(5)}`
                    : 'Not mapped'}
                </p>
              </div>
            </div>

            <div className="space-y-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">Construction Start Date</span>
                <p className="font-semibold text-slate-800">{formatDate(asset.construction_start_date)}</p>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">Target / Completion Date</span>
                <p className="font-semibold text-slate-800">{formatDate(asset.completion_date)}</p>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">Expected End of Life Date</span>
                <p className="font-semibold text-slate-800">{formatDate(asset.expected_end_of_life_date)}</p>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">Project Description</span>
                <p className="text-slate-700">{asset.description || 'No detailed project notes.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Lifecycle Modal */}
      <Modal
        isOpen={lifecycleModalOpen}
        onClose={() => setLifecycleModalOpen(false)}
        title="Record Lifecycle Milestone"
        description="Update project lifecycle stage or record construction/maintenance progress."
      >
        <form onSubmit={handleRecordLifecycle} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Event Type <span className="text-rose-600">*</span>
            </label>
            <select
              value={lifecycleForm.event_type}
              onChange={(e) =>
                setLifecycleForm({ ...lifecycleForm, event_type: e.target.value as LifecycleEventType })
              }
              className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
            >
              {ALL_EVENT_TYPES.filter((t) => isStaff || t.fieldAllowed).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Event Date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={lifecycleForm.event_date}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, event_date: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Progress Percentage (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 45"
                value={lifecycleForm.progress_percentage}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, progress_percentage: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Milestone Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Foundation slab casting completed"
              value={lifecycleForm.title}
              onChange={(e) => setLifecycleForm({ ...lifecycleForm, title: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description / Field Notes</label>
            <textarea
              rows={3}
              placeholder="Provide technical progress details or inspection observations..."
              value={lifecycleForm.description}
              onChange={(e) => setLifecycleForm({ ...lifecycleForm, description: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setLifecycleModalOpen(false)}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Recording...' : 'Record Event'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Activity Modal */}
      {isStaff && (
        <Modal
          isOpen={activityModalOpen}
          onClose={() => setActivityModalOpen(false)}
          title="Add Project Activity / Task"
          description="Create a work task for this infrastructure project."
        >
          <form onSubmit={handleCreateActivity} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Task Title <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Electrical and MEP rough-in"
                value={activityForm.title}
                onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Type</label>
                <select
                  value={activityForm.activity_type}
                  onChange={(e) =>
                    setActivityForm({ ...activityForm, activity_type: e.target.value as ActivityType })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                >
                  <option value="CONSTRUCTION">Construction</option>
                  <option value="INSPECTION">Inspection</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="REPAIR">Repair</option>
                  <option value="REHABILITATION">Rehabilitation</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={activityForm.priority}
                  onChange={(e) =>
                    setActivityForm({ ...activityForm, priority: e.target.value as ActivityPriority })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Status</label>
                <select
                  value={activityForm.status}
                  onChange={(e) =>
                    setActivityForm({ ...activityForm, status: e.target.value as ActivityStatus })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={activityForm.start_date}
                  onChange={(e) => setActivityForm({ ...activityForm, start_date: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={activityForm.due_date}
                  onChange={(e) => setActivityForm({ ...activityForm, due_date: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Task Scope & Description</label>
              <textarea
                rows={2}
                placeholder="Scope details, technical specs, contractor instructions..."
                value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActivityModalOpen(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Update Activity Modal */}
      <Modal
        isOpen={updateActivityModalOpen}
        onClose={() => setUpdateActivityModalOpen(false)}
        title="Update Activity Status & Progress"
        description={`Update task "${selectedActivity?.title}"`}
      >
        <form onSubmit={handleUpdateActivity} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Activity Status <span className="text-rose-600">*</span>
              </label>
              <select
                value={activityUpdateForm.status}
                onChange={(e) =>
                  setActivityUpdateForm({
                    ...activityUpdateForm,
                    status: e.target.value as ActivityStatus,
                    progress_percentage: e.target.value === 'COMPLETED' ? 100 : activityUpdateForm.progress_percentage,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-semibold"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="BLOCKED">Blocked</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Progress Percentage (0-100%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={activityUpdateForm.progress_percentage}
                onChange={(e) =>
                  setActivityUpdateForm({
                    ...activityUpdateForm,
                    progress_percentage: Number(e.target.value),
                  })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-semibold"
              />
            </div>
          </div>

          {isStaff && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={activityUpdateForm.priority}
                  onChange={(e) =>
                    setActivityUpdateForm({
                      ...activityUpdateForm,
                      priority: e.target.value as ActivityPriority,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={activityUpdateForm.due_date}
                  onChange={(e) =>
                    setActivityUpdateForm({ ...activityUpdateForm, due_date: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setUpdateActivityModalOpen(false)}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Save Updates'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Inspection Modal */}
      <Modal
        isOpen={inspectionModalOpen}
        onClose={() => setInspectionModalOpen(false)}
        title="Record Condition Inspection"
        description="Log an official inspection and condition audit report."
      >
        <form onSubmit={handleRecordInspection} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Inspection Date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={inspectionForm.inspection_date}
                onChange={(e) =>
                  setInspectionForm({ ...inspectionForm, inspection_date: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Inspection Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={inspectionForm.inspection_type}
                onChange={(e) =>
                  setInspectionForm({
                    ...inspectionForm,
                    inspection_type: e.target.value as InspectionType,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
              >
                <option value="ROUTINE">Routine Inspection</option>
                <option value="STRUCTURAL">Structural Audit</option>
                <option value="SAFETY">Safety Audit</option>
                <option value="OTHER">Other Inspection</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Observed Condition Status <span className="text-rose-600">*</span>
            </label>
            <select
              value={inspectionForm.condition_status}
              onChange={(e) =>
                setInspectionForm({
                  ...inspectionForm,
                  condition_status: e.target.value as ConditionStatus,
                })
              }
              className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-bold"
            >
              <option value="GOOD">GOOD - No significant defects</option>
              <option value="FAIR">FAIR - Minor surface wear or minor repair required</option>
              <option value="POOR">POOR - Structural distress / deterioration present</option>
              <option value="CRITICAL">CRITICAL - Severe spalling / immediate hazard</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Inspection Findings</label>
            <textarea
              rows={2}
              placeholder="Specific defects, crack measurements, wear observations..."
              value={inspectionForm.findings}
              onChange={(e) => setInspectionForm({ ...inspectionForm, findings: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Recommendations & Remedial Action</label>
            <textarea
              rows={2}
              placeholder="Recommended repair measures, retrofitting, or monitoring timeline..."
              value={inspectionForm.recommendations}
              onChange={(e) =>
                setInspectionForm({ ...inspectionForm, recommendations: e.target.value })
              }
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setInspectionModalOpen(false)}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Recording...' : 'Record Inspection'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Maintenance Modal */}
      <Modal
        isOpen={maintenanceModalOpen}
        onClose={() => setMaintenanceModalOpen(false)}
        title="Log Maintenance / Repair Record"
        description="Record preventive maintenance, corrective overhaul, or emergency repair."
      >
        <form onSubmit={handleLogMaintenance} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Maintenance Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={maintenanceForm.maintenance_type}
                onChange={(e) =>
                  setMaintenanceForm({
                    ...maintenanceForm,
                    maintenance_type: e.target.value as MaintenanceType,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
              >
                <option value="PREVENTIVE">Preventive Maintenance</option>
                <option value="CORRECTIVE">Corrective Maintenance</option>
                <option value="EMERGENCY">Emergency Repair</option>
                <option value="OTHER">Other Maintenance</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={maintenanceForm.status}
                onChange={(e) =>
                  setMaintenanceForm({
                    ...maintenanceForm,
                    status: e.target.value as MaintenanceStatus,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
              >
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Maintenance Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Resurfacing of damaged corridor stretch"
              value={maintenanceForm.title}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={maintenanceForm.start_date}
                onChange={(e) =>
                  setMaintenanceForm({ ...maintenanceForm, start_date: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Completion Date</label>
              <input
                type="date"
                value={maintenanceForm.completion_date}
                onChange={(e) =>
                  setMaintenanceForm({ ...maintenanceForm, completion_date: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Estimated Cost (INR)</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 500000"
                value={maintenanceForm.cost}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Scope / Description</label>
            <textarea
              rows={2}
              placeholder="Scope of repairs, contractor details, materials used..."
              value={maintenanceForm.description}
              onChange={(e) =>
                setMaintenanceForm({ ...maintenanceForm, description: e.target.value })
              }
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setMaintenanceModalOpen(false)}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Save Maintenance Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Maintenance Modal */}
      <Modal
        isOpen={updateMaintenanceModalOpen}
        onClose={() => setUpdateMaintenanceModalOpen(false)}
        title="Update Maintenance Status"
        description={`Update record: "${selectedMaintenance?.title}"`}
      >
        <form onSubmit={handleUpdateMaintenance} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={maintenanceUpdateForm.status}
                onChange={(e) =>
                  setMaintenanceUpdateForm({
                    ...maintenanceUpdateForm,
                    status: e.target.value as MaintenanceStatus,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-semibold"
              >
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Completion Date</label>
              <input
                type="date"
                value={maintenanceUpdateForm.completion_date}
                onChange={(e) =>
                  setMaintenanceUpdateForm({
                    ...maintenanceUpdateForm,
                    completion_date: e.target.value,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Final / Updated Cost (INR)</label>
            <input
              type="number"
              min={0}
              value={maintenanceUpdateForm.cost}
              onChange={(e) =>
                setMaintenanceUpdateForm({ ...maintenanceUpdateForm, cost: e.target.value })
              }
              className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Completion Notes</label>
            <textarea
              rows={2}
              value={maintenanceUpdateForm.description}
              onChange={(e) =>
                setMaintenanceUpdateForm({
                  ...maintenanceUpdateForm,
                  description: e.target.value,
                })
              }
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setUpdateMaintenanceModalOpen(false)}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Updating...' : 'Update Maintenance'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Field Officer Responsibility Modal (Staff only) */}
      {isStaff && (
        <Modal
          isOpen={responsibilityModalOpen}
          onClose={() => setResponsibilityModalOpen(false)}
          title="Assign Field Officer Responsibility"
          description="Grant explicit project-level monitoring or maintenance responsibility to a Field Officer."
        >
          <form onSubmit={handleAssignResponsibility} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Select Field Officer <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={responsibilityForm.user_id}
                onChange={(e) =>
                  setResponsibilityForm({ ...responsibilityForm, user_id: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-medium"
              >
                {fieldUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Responsibility Type / Capacity <span className="text-rose-600">*</span>
              </label>
              <select
                value={responsibilityForm.responsibility_type}
                onChange={(e) =>
                  setResponsibilityForm({
                    ...responsibilityForm,
                    responsibility_type: e.target.value as ResponsibilityType,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-semibold"
              >
                <option value="CONSTRUCTION">
                  CONSTRUCTION (Lifecycle progress, routine milestones, inspections)
                </option>
                <option value="MAINTENANCE">
                  MAINTENANCE (Maintenance logging, repair updates, inspections)
                </option>
              </select>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
              <strong>Notice:</strong> Once assigned, the Field Officer gains full routine lifecycle and task
              supervision access for this infrastructure asset without requiring separate task assignments.
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResponsibilityModalOpen(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Asset Metadata Modal (Staff only) */}
      {isStaff && (
        <Modal
          isOpen={editAssetModalOpen}
          onClose={() => setEditAssetModalOpen(false)}
          title="Edit Asset Details"
          description="Update metadata, department, location coordinates, or target dates."
          maxWidth="xl"
        >
          <form onSubmit={handleEditAsset} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Asset Name</label>
              <input
                type="text"
                required
                value={editAssetForm.name}
                onChange={(e) => setEditAssetForm({ ...editAssetForm, name: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Asset Type</label>
                <select
                  value={editAssetForm.asset_type}
                  onChange={(e) =>
                    setEditAssetForm({ ...editAssetForm, asset_type: e.target.value as AssetType })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                >
                  <option value="HOSPITAL">Hospital / Health Center</option>
                  <option value="HIGHWAY">Highway / Expressway</option>
                  <option value="RAILWAY">Railway Section</option>
                  <option value="PUBLIC_BUILDING">Public Building</option>
                  <option value="BRIDGE">Bridge / Flyover</option>
                  <option value="OTHER">Other Infrastructure</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={editAssetForm.department_id}
                  onChange={(e) =>
                    setEditAssetForm({ ...editAssetForm, department_id: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Location Address</label>
              <input
                type="text"
                value={editAssetForm.location}
                onChange={(e) => setEditAssetForm({ ...editAssetForm, location: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={editAssetForm.latitude}
                  onChange={(e) => setEditAssetForm({ ...editAssetForm, latitude: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={editAssetForm.longitude}
                  onChange={(e) => setEditAssetForm({ ...editAssetForm, longitude: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={editAssetForm.construction_start_date}
                  onChange={(e) =>
                    setEditAssetForm({ ...editAssetForm, construction_start_date: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Completion Date</label>
                <input
                  type="date"
                  value={editAssetForm.completion_date}
                  onChange={(e) =>
                    setEditAssetForm({ ...editAssetForm, completion_date: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expected End-of-Life</label>
                <input
                  type="date"
                  value={editAssetForm.expected_end_of_life_date}
                  onChange={(e) =>
                    setEditAssetForm({ ...editAssetForm, expected_end_of_life_date: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Project Description</label>
              <textarea
                rows={2}
                value={editAssetForm.description}
                onChange={(e) => setEditAssetForm({ ...editAssetForm, description: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditAssetModalOpen(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
