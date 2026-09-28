import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { apiGet, apiPatch } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import type { Activity, ActivityStatus, ApiResponse } from '../lib/types';
import { ActivityPriorityBadge, ActivityStatusBadge } from '../components/common/StatusBadge';
import { ProgressBar } from '../components/common/ProgressBar';
import { Modal } from '../components/common/Modal';
import { AlertBanner, EmptyState, LoadingSpinner } from '../components/common/Feedback';
import { formatDate } from '../lib/formatters';

interface ActivitiesPageProps {
  onOpenAsset: (assetId: string) => void;
}

export function ActivitiesPage({ onOpenAsset }: ActivitiesPageProps) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  // Update modal state
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    status: 'IN_PROGRESS' as ActivityStatus,
    progress_percentage: 0,
  });

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<ApiResponse<Activity[]>>('/activities/mine');
      setActivities(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assigned work');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  async function handleSaveProgress(e: FormEvent) {
    e.preventDefault();
    if (!selectedActivity) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPatch(`/activities/${selectedActivity.id}`, {
        status: updateForm.status,
        progress_percentage: Number(updateForm.progress_percentage),
      });
      setSuccessMsg(`Activity "${selectedActivity.title}" updated.`);
      setUpdateModalOpen(false);
      setSelectedActivity(null);
      fetchActivities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update activity');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredActivities = activities.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (priorityFilter && a.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Assigned Activities & Work Packages</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Work tasks and milestones specifically assigned to {user?.name} across infrastructure assets
          </p>
        </div>
      </div>

      <AlertBanner message={error} type="error" onDismiss={() => setError(null)} />
      <AlertBanner message={successMsg} type="success" onDismiss={() => setSuccessMsg(null)} />

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Status Filter
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Priority Filter
          </label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {(statusFilter || priorityFilter) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setPriorityFilter('');
            }}
            className="mt-4 text-xs font-semibold text-rose-600 hover:text-rose-800"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingSpinner text="Fetching assigned activities..." />
        ) : filteredActivities.length === 0 ? (
          <EmptyState
            title="No assigned activities found"
            description="You do not currently have any individual tasks assigned in this filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Activity Title</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivities.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        onClick={() => act.asset_id && onOpenAsset(act.asset_id)}
                        className="font-mono font-bold text-slate-900 hover:text-blue-700 underline underline-offset-2"
                      >
                        {act.asset_code || 'ASSET'}
                      </button>
                      {act.asset_name && (
                        <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                          {act.asset_name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-bold text-slate-900">{act.title}</div>
                      {act.description && (
                        <div className="text-[11px] text-slate-500 truncate">{act.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <ActivityPriorityBadge priority={act.priority} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <ActivityStatusBadge status={act.status} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap min-w-[120px]">
                      <ProgressBar progress={act.progress_percentage} size="sm" />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {formatDate(act.due_date)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedActivity(act);
                          setUpdateForm({
                            status: act.status,
                            progress_percentage: act.progress_percentage || 0,
                          });
                          setUpdateModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300"
                      >
                        Update Progress
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Update Progress Modal */}
      <Modal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        title="Update Activity Progress"
        description={`Update task: "${selectedActivity?.title}"`}
      >
        <form onSubmit={handleSaveProgress} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Task Status <span className="text-rose-600">*</span>
            </label>
            <select
              value={updateForm.status}
              onChange={(e) =>
                setUpdateForm({
                  ...updateForm,
                  status: e.target.value as ActivityStatus,
                  progress_percentage: e.target.value === 'COMPLETED' ? 100 : updateForm.progress_percentage,
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
              value={updateForm.progress_percentage}
              onChange={(e) =>
                setUpdateForm({ ...updateForm, progress_percentage: Number(e.target.value) })
              }
              className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-semibold"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setUpdateModalOpen(false)}
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
    </div>
  );
}
