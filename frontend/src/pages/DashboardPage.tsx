import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import type { Activity, ApiResponse, InfrastructureAsset } from '../lib/types';
import { LifecycleBadge, ActivityPriorityBadge, ActivityStatusBadge } from '../components/common/StatusBadge';
import { ProgressBar } from '../components/common/ProgressBar';
import { AlertBanner, EmptyState, LoadingSpinner } from '../components/common/Feedback';
import { formatAssetType } from '../lib/formatters';

interface DashboardPageProps {
  onOpenAsset: (assetId: string) => void;
  onNavigateTab: (tab: 'assets' | 'activities' | 'updates') => void;
}

export function DashboardPage({ onOpenAsset, onNavigateTab }: DashboardPageProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<InfrastructureAsset[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFieldUser = user?.role === 'FIELD_USER';

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      setError(null);
      try {
        const [assetsRes, activitiesRes] = await Promise.all([
          apiGet<ApiResponse<InfrastructureAsset[]>>('/assets?limit=100'),
          apiGet<ApiResponse<Activity[]>>('/activities/mine').catch(() => ({ data: [] })),
        ]);
        setAssets(assetsRes.data || []);
        setMyActivities(activitiesRes.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Loading operational dashboard..." />;
  }

  // Calculate real metrics from visible assets
  const totalAssets = assets.length;
  const underConstruction = assets.filter((a) => a.lifecycle_status === 'UNDER_CONSTRUCTION');
  const underMaintenance = assets.filter((a) => a.lifecycle_status === 'UNDER_MAINTENANCE');
  const operational = assets.filter((a) => a.lifecycle_status === 'OPERATIONAL');
  const planned = assets.filter((a) => a.lifecycle_status === 'PLANNED');
  const rehabilitation = assets.filter((a) => a.lifecycle_status === 'REHABILITATION');
  const endOfLife = assets.filter((a) => a.lifecycle_status === 'END_OF_LIFE');

  return (
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Executive Operations Dashboard</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isFieldUser
              ? 'Infrastructure projects & field responsibilities under your supervision'
              : 'Real-time infrastructure asset inventory, lifecycle status, and field operations overview'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('assets')}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
          >
            Browse All Assets →
          </button>
        </div>
      </div>

      <AlertBanner message={error} type="error" onDismiss={() => setError(null)} />

      {/* Field Officer Banner if applicable */}
      {isFieldUser && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-emerald-700 text-lg">🛡️</span>
          <div>
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              Field Officer Project Responsibility Model Active
            </h4>
            <p className="text-xs text-emerald-800 mt-0.5">
              You are assigned direct monitoring and lifecycle management responsibility for{' '}
              <span className="font-bold">{totalAssets}</span> infrastructure project(s). You can record routine
              lifecycle milestones, progress updates, inspections, and view all project tasks.
            </p>
          </div>
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isFieldUser ? 'Responsible Assets' : 'Total Assets'}
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalAssets}</div>
          <div className="text-[10px] text-slate-400 mt-1">In your purview</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
            Under Construction
          </div>
          <div className="text-2xl font-extrabold text-amber-900 mt-1">{underConstruction.length}</div>
          <div className="text-[10px] text-amber-700/80 mt-1">Active civil works</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-orange-700 uppercase tracking-wider">
            Under Maintenance
          </div>
          <div className="text-2xl font-extrabold text-orange-900 mt-1">{underMaintenance.length}</div>
          <div className="text-[10px] text-orange-700/80 mt-1">Repairs / Overhaul</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Operational</div>
          <div className="text-2xl font-extrabold text-emerald-900 mt-1">{operational.length}</div>
          <div className="text-[10px] text-emerald-700/80 mt-1">In public service</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Renewal / EOL</div>
          <div className="text-2xl font-extrabold text-purple-900 mt-1">
            {rehabilitation.length + endOfLife.length}
          </div>
          <div className="text-[10px] text-purple-700/80 mt-1">Rehabilitation / EOL</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">Planned</div>
          <div className="text-2xl font-extrabold text-sky-900 mt-1">{planned.length}</div>
          <div className="text-[10px] text-sky-700/80 mt-1">Sanctioned projects</div>
        </div>
      </div>

      {/* Main Operational Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Infrastructure Projects */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isFieldUser ? 'Your Supervised Infrastructure Projects' : 'Active Infrastructure Projects'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Track current lifecycle stage, location, and progress milestones
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('assets')}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                View Full Table →
              </button>
            </div>

            {assets.length === 0 ? (
              <EmptyState
                title="No visible infrastructure assets"
                description={
                  isFieldUser
                    ? 'No project responsibilities have been assigned to your account yet. Contact your department admin.'
                    : 'No assets found in the system database.'
                }
              />
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                {assets.slice(0, 6).map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => onOpenAsset(asset.id)}
                    className="p-4 hover:bg-slate-50/80 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {asset.asset_code}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 hover:text-blue-700 truncate">
                          {asset.name}
                        </h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
                        <span>{formatAssetType(asset.asset_type)}</span>
                        <span>•</span>
                        <span className="truncate">{asset.location || 'Location unassigned'}</span>
                        {asset.department_code && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-slate-700">{asset.department_code}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <LifecycleBadge status={asset.lifecycle_status} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAsset(asset.id);
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Attention Items & Assigned Tasks */}
        <div className="space-y-4">
          {/* Work / Activities Attention Card */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                My Assigned Work Tasks
              </h3>
              <button
                onClick={() => onNavigateTab('activities')}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
              >
                All Work →
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {myActivities.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded">
                  No individual task assignments pending.
                </div>
              ) : (
                myActivities.slice(0, 4).map((act) => (
                  <div
                    key={act.id}
                    onClick={() => act.asset_id && onOpenAsset(act.asset_id)}
                    className="p-2.5 rounded border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-semibold text-slate-800 line-clamp-1">{act.title}</span>
                      <ActivityPriorityBadge priority={act.priority} />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                      <span>{act.asset_code}</span>
                      <ActivityStatusBadge status={act.status} />
                    </div>
                    {act.status === 'IN_PROGRESS' && (
                      <div className="mt-1.5">
                        <ProgressBar progress={act.progress_percentage} size="sm" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Operational Quick Guide */}
          <div className="bg-slate-900 text-white rounded-lg p-4 space-y-2.5 text-xs">
            <h4 className="font-bold text-amber-400 text-xs uppercase tracking-wider">
              Operational Lifecycle Guide
            </h4>
            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">1.</span>
                <span>
                  <strong>Construction:</strong> Record start & routine progress percentages (0-100%).
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">2.</span>
                <span>
                  <strong>Inspections:</strong> Log routine or structural condition audits (Good/Fair/Poor/Critical).
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">3.</span>
                <span>
                  <strong>Maintenance:</strong> Track preventive & emergency repairs with cost estimates.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
