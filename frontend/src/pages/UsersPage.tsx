import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import type { ApiResponse, Department, User, UserRole } from '../lib/types';
import { Modal } from '../components/common/Modal';
import { AlertBanner, EmptyState, LoadingSpinner } from '../components/common/Feedback';
import { formatRole } from '../lib/formatters';

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create Form
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'FIELD_USER' as UserRole,
    department_id: '',
  });

  // Edit Form
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'FIELD_USER' as UserRole,
    department_id: '',
    is_active: true,
    password: '',
  });

  useEffect(() => {
    apiGet<ApiResponse<Department[]>>('/departments')
      .then((res: ApiResponse<Department[]>) => {
        setDepartments(res.data || []);
        if (res.data?.length > 0) {
          setCreateForm((f) => ({ ...f, department_id: res.data[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter) params.set('role', roleFilter);
      if (activeFilter) params.set('is_active', activeFilter);

      const res = await apiGet<ApiResponse<User[]>>(`/users?${params.toString()}`);
      setUsers(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, activeFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/users', {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
        department_id: createForm.department_id || undefined,
      });
      setSuccessMsg(`User ${createForm.email} created.`);
      setCreateModalOpen(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        role: 'FIELD_USER',
        department_id: departments[0]?.id || '',
      });
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditUser(e: FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        role: editForm.role,
        department_id: editForm.department_id || null,
        is_active: editForm.is_active,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      await apiPatch(`/users/${selectedUser.id}`, payload);
      setSuccessMsg(`User "${selectedUser.name}" updated.`);
      setEditModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">User & Staff Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin directory of government officers, field users, and system permissions
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors shadow-xs"
        >
          + Add New User
        </button>
      </div>

      <AlertBanner message={error} type="error" onDismiss={() => setError(null)} />
      <AlertBanner message={successMsg} type="success" onDismiss={() => setSuccessMsg(null)} />

      {/* Filters */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div>
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-2.5 py-1 text-xs rounded border border-slate-300 w-52"
          />
        </div>
        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="GOVERNMENT_OFFICER">Government Officer</option>
            <option value="FIELD_USER">Field User</option>
          </select>
        </div>
        <div>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
          >
            <option value="">All Account Statuses</option>
            <option value="true">Active Accounts</option>
            <option value="false">Inactive / Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingSpinner text="Fetching user directory..." />
        ) : users.length === 0 ? (
          <EmptyState title="No users found" description="Adjust search or filter options." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Name & Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : u.role === 'GOVERNMENT_OFFICER'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {formatRole(u.role)}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {u.department_name || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          u.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setEditForm({
                            name: u.name,
                            role: u.role,
                            department_id: u.department_id || '',
                            is_active: u.is_active,
                            password: '',
                          });
                          setEditModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add New User Account"
        description="Create an internal government or field officer account."
      >
        <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Full Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Email Address <span className="text-rose-600">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="e.g. ramesh.kumar@infra.example.gov.in"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Password (min 8 chars) <span className="text-rose-600">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Role</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-semibold"
              >
                <option value="FIELD_USER">Field User / Site Engineer</option>
                <option value="GOVERNMENT_OFFICER">Government Officer</option>
                <option value="ADMIN">System Administrator</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={createForm.department_id}
                onChange={(e) => setCreateForm({ ...createForm, department_id: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
              >
                <option value="">None (Central / Admin)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </div>
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
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit User Profile & Permissions"
        description={`Modify account for ${selectedUser?.email}`}
      >
        <form onSubmit={handleEditUser} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Role</label>
              <select
                value={editForm.role}
                disabled={selectedUser?.id === currentUser?.id}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-semibold disabled:opacity-50"
              >
                <option value="FIELD_USER">Field User / Site Engineer</option>
                <option value="GOVERNMENT_OFFICER">Government Officer</option>
                <option value="ADMIN">System Administrator</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={editForm.department_id}
                onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
              >
                <option value="">None (Central / Admin)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Reset Password (leave empty to keep unchanged)
            </label>
            <input
              type="password"
              minLength={8}
              placeholder="New password (min 8 chars)"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active_toggle"
              checked={editForm.is_active}
              disabled={selectedUser?.id === currentUser?.id}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
              className="rounded border-slate-300 text-slate-900"
            />
            <label htmlFor="is_active_toggle" className="text-xs font-semibold text-slate-800">
              Account Active / Enabled
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
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
    </div>
  );
}
