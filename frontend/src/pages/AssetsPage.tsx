import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import type {
  ApiResponse,
  AssetType,
  Department,
  InfrastructureAsset,
  LifecycleStatus,
  PaginationMeta,
} from '../lib/types';
import { LifecycleBadge } from '../components/common/StatusBadge';
import { Pagination } from '../components/common/Pagination';
import { Modal } from '../components/common/Modal';
import { AlertBanner, EmptyState, LoadingSpinner } from '../components/common/Feedback';
import { formatAssetType } from '../lib/formatters';

interface AssetsPageProps {
  onOpenAsset: (assetId: string) => void;
}

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'HOSPITAL', label: 'Hospital / Health Center' },
  { value: 'HIGHWAY', label: 'Highway / Expressway' },
  { value: 'RAILWAY', label: 'Railway Section' },
  { value: 'PUBLIC_BUILDING', label: 'Public Building' },
  { value: 'BRIDGE', label: 'Bridge / Flyover' },
  { value: 'OTHER', label: 'Other Infrastructure' },
];

const LIFECYCLE_STATUSES: { value: LifecycleStatus; label: string }[] = [
  { value: 'PLANNED', label: 'Planned' },
  { value: 'UNDER_CONSTRUCTION', label: 'Under Construction' },
  { value: 'OPERATIONAL', label: 'Operational' },
  { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
  { value: 'REHABILITATION', label: 'Rehabilitation' },
  { value: 'END_OF_LIFE', label: 'End-of-Life' },
  { value: 'DECOMMISSIONED', label: 'Decommissioned' },
];

export function AssetsPage({ onOpenAsset }: AssetsPageProps) {
  const { user } = useAuth();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICER';
  const isField = user?.role === 'FIELD_USER';

  const [assets, setAssets] = useState<InfrastructureAsset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [assetType, setAssetType] = useState<string>('');
  const [lifecycleStatus, setLifecycleStatus] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [page, setPage] = useState(1);

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAssetForm, setNewAssetForm] = useState({
    asset_code: '',
    name: '',
    asset_type: 'HOSPITAL' as AssetType,
    department_id: '',
    location: '',
    latitude: '',
    longitude: '',
    description: '',
    lifecycle_status: 'PLANNED' as LifecycleStatus,
    construction_start_date: '',
    completion_date: '',
    expected_end_of_life_date: '',
  });

  // Fetch departments list for filter/form dropdown
  useEffect(() => {
    apiGet<ApiResponse<Department[]>>('/departments')
      .then((res: ApiResponse<Department[]>) => {
        setDepartments(res.data || []);
        if (res.data?.length > 0 && !newAssetForm.department_id) {
          setNewAssetForm((f) => ({ ...f, department_id: res.data[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '10');
      if (search.trim()) params.set('search', search.trim());
      if (assetType) params.set('asset_type', assetType);
      if (lifecycleStatus) params.set('lifecycle_status', lifecycleStatus);
      if (departmentId) params.set('department_id', departmentId);

      const res = await apiGet<ApiResponse<InfrastructureAsset[]>>(`/assets?${params.toString()}`);
      setAssets(res.data || []);
      if (res.pagination) setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [page, search, assetType, lifecycleStatus, departmentId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  async function handleCreateAsset(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const payload = {
        asset_code: newAssetForm.asset_code.trim(),
        name: newAssetForm.name.trim(),
        asset_type: newAssetForm.asset_type,
        department_id: newAssetForm.department_id,
        location: newAssetForm.location.trim() || undefined,
        latitude: newAssetForm.latitude ? Number(newAssetForm.latitude) : undefined,
        longitude: newAssetForm.longitude ? Number(newAssetForm.longitude) : undefined,
        description: newAssetForm.description.trim() || undefined,
        lifecycle_status: newAssetForm.lifecycle_status,
        construction_start_date: newAssetForm.construction_start_date || undefined,
        completion_date: newAssetForm.completion_date || undefined,
        expected_end_of_life_date: newAssetForm.expected_end_of_life_date || undefined,
      };

      await apiPost('/assets', payload);
      setSuccessMsg(`Asset ${newAssetForm.asset_code} created successfully.`);
      setCreateModalOpen(false);
      setNewAssetForm({
        asset_code: '',
        name: '',
        asset_type: 'HOSPITAL',
        department_id: departments[0]?.id || '',
        location: '',
        latitude: '',
        longitude: '',
        description: '',
        lifecycle_status: 'PLANNED',
        construction_start_date: '',
        completion_date: '',
        expected_end_of_life_date: '',
      });
      fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create asset');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {isField ? 'My Responsible Infrastructure Projects' : 'Infrastructure Asset Inventory'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isField
              ? 'Projects assigned specifically under your field officer responsibility'
              : 'Search, filter, and track public infrastructure across departments and stages'}
          </p>
        </div>
        {isStaff && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors shadow-xs"
          >
            <span className="text-base leading-none">+</span>
            <span>Register New Asset</span>
          </button>
        )}
      </div>

      <AlertBanner message={error} type="error" onDismiss={() => setError(null)} />
      <AlertBanner message={successMsg} type="success" onDismiss={() => setSuccessMsg(null)} />

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Search Assets
            </label>
            <input
              type="text"
              placeholder="Search code, name, location..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:outline-slate-800"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Lifecycle Status
            </label>
            <select
              value={lifecycleStatus}
              onChange={(e) => {
                setLifecycleStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white focus:outline-slate-800"
            >
              <option value="">All Lifecycle Stages</option>
              {LIFECYCLE_STATUSES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Asset Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Asset Type
            </label>
            <select
              value={assetType}
              onChange={(e) => {
                setAssetType(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white focus:outline-slate-800"
            >
              <option value="">All Asset Types</option>
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter (Staff only) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white focus:outline-slate-800"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(search || lifecycleStatus || assetType || departmentId) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Filters active</span>
            <button
              onClick={() => {
                setSearch('');
                setLifecycleStatus('');
                setAssetType('');
                setDepartmentId('');
                setPage(1);
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Asset Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingSpinner text="Fetching asset records from API..." />
        ) : assets.length === 0 ? (
          <EmptyState
            title="No matching infrastructure assets found"
            description={
              isField
                ? 'You do not have any responsible assets matching the current search criteria.'
                : 'Try adjusting your search terms or filter selections.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Asset Code</th>
                  <th className="py-3 px-4">Asset Name & Location</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Lifecycle Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => onOpenAsset(asset.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {asset.asset_code}
                    </td>
                    <td className="py-3 px-4 max-w-xs sm:max-w-sm">
                      <div className="font-bold text-slate-900 hover:text-blue-700 truncate">
                        {asset.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {asset.location || 'Location unassigned'}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-slate-700">{formatAssetType(asset.asset_type)}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                        {asset.department_code || 'DEPT'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <LifecycleBadge status={asset.lifecycle_status} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAsset(asset.id);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300 shadow-2xs"
                      >
                        Details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onPageChange={(newPage: number) => setPage(newPage)} />
      </div>

      {/* New Asset Modal */}
      {isStaff && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Register Infrastructure Asset"
          description="Create a new government-owned external infrastructure asset record."
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateAsset} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Asset Code <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HOS-DEL-009 or BRG-MUM-012"
                  value={newAssetForm.asset_code}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, asset_code: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Asset Type <span className="text-rose-600">*</span>
                </label>
                <select
                  value={newAssetForm.asset_type}
                  onChange={(e) =>
                    setNewAssetForm({ ...newAssetForm, asset_type: e.target.value as AssetType })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Asset Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Surat District Trauma Care Hospital Block"
                value={newAssetForm.name}
                onChange={(e) => setNewAssetForm({ ...newAssetForm, name: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Department <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={newAssetForm.department_id}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, department_id: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Initial Lifecycle Status
                </label>
                <select
                  value={newAssetForm.lifecycle_status}
                  onChange={(e) =>
                    setNewAssetForm({
                      ...newAssetForm,
                      lifecycle_status: e.target.value as LifecycleStatus,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                >
                  {LIFECYCLE_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Location Address</label>
              <input
                type="text"
                placeholder="e.g. Majura Gate, Surat, Gujarat"
                value={newAssetForm.location}
                onChange={(e) => setNewAssetForm({ ...newAssetForm, location: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 21.1850"
                  value={newAssetForm.latitude}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, latitude: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 72.8190"
                  value={newAssetForm.longitude}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, longitude: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Construction Start Date
                </label>
                <input
                  type="date"
                  value={newAssetForm.construction_start_date}
                  onChange={(e) =>
                    setNewAssetForm({ ...newAssetForm, construction_start_date: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Completion Date</label>
                <input
                  type="date"
                  value={newAssetForm.completion_date}
                  onChange={(e) =>
                    setNewAssetForm({ ...newAssetForm, completion_date: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expected End-of-Life</label>
                <input
                  type="date"
                  value={newAssetForm.expected_end_of_life_date}
                  onChange={(e) =>
                    setNewAssetForm({ ...newAssetForm, expected_end_of_life_date: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description / Project Notes</label>
              <textarea
                rows={2}
                placeholder="Details on scope, capacity, structural specifications..."
                value={newAssetForm.description}
                onChange={(e) => setNewAssetForm({ ...newAssetForm, description: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-1.5 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
              >
                {creating ? 'Registering...' : 'Register Asset'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
