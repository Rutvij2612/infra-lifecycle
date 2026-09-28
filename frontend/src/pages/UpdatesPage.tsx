import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import type { ApiResponse, InfrastructureAsset, LifecycleEvent, Inspection, MaintenanceRecord } from '../lib/types';
import { AlertBanner, EmptyState, LoadingSpinner } from '../components/common/Feedback';
import { formatDate, formatEventType } from '../lib/formatters';

interface UpdatesPageProps {
  onOpenAsset: (assetId: string) => void;
}

interface UpdateItem {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  type: 'LIFECYCLE' | 'INSPECTION' | 'MAINTENANCE';
  title: string;
  description?: string | null;
  date: string;
  badgeText: string;
  badgeClass: string;
}

export function UpdatesPage({ onOpenAsset }: UpdatesPageProps) {
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    async function fetchUpdates() {
      setLoading(true);
      setError(null);
      try {
        const assetsRes = await apiGet<ApiResponse<InfrastructureAsset[]>>('/assets?limit=25');
        const assets = assetsRes.data || [];

        const feed: UpdateItem[] = [];

        // Fetch lifecycle, inspections, and maintenance for the first few assets
        await Promise.all(
          assets.slice(0, 10).map(async (asset: InfrastructureAsset) => {
            try {
              const [eventsRes, inspRes, maintRes] = await Promise.all([
                apiGet<ApiResponse<LifecycleEvent[]>>(`/assets/${asset.id}/lifecycle`).catch(() => ({ data: [] })),
                apiGet<ApiResponse<Inspection[]>>(`/assets/${asset.id}/inspections`).catch(() => ({ data: [] })),
                apiGet<ApiResponse<MaintenanceRecord[]>>(`/assets/${asset.id}/maintenance`).catch(() => ({ data: [] })),
              ]);

              (eventsRes.data || []).forEach((ev: LifecycleEvent) => {
                feed.push({
                  id: `ev-${ev.id}`,
                  assetId: asset.id,
                  assetCode: asset.asset_code,
                  assetName: asset.name,
                  type: 'LIFECYCLE',
                  title: ev.title,
                  description: ev.description,
                  date: ev.event_date,
                  badgeText: formatEventType(ev.event_type),
                  badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
                });
              });

              (inspRes.data || []).forEach((insp: Inspection) => {
                feed.push({
                  id: `insp-${insp.id}`,
                  assetId: asset.id,
                  assetCode: asset.asset_code,
                  assetName: asset.name,
                  type: 'INSPECTION',
                  title: `${insp.inspection_type} Inspection — Condition: ${insp.condition_status}`,
                  description: insp.findings || insp.recommendations,
                  date: insp.inspection_date,
                  badgeText: `Inspection: ${insp.condition_status}`,
                  badgeClass:
                    insp.condition_status === 'CRITICAL' || insp.condition_status === 'POOR'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200',
                });
              });

              (maintRes.data || []).forEach((m: MaintenanceRecord) => {
                feed.push({
                  id: `maint-${m.id}`,
                  assetId: asset.id,
                  assetCode: asset.asset_code,
                  assetName: asset.name,
                  type: 'MAINTENANCE',
                  title: `${m.title} (${m.status})`,
                  description: m.description,
                  date: m.start_date || m.completion_date || '',
                  badgeText: `Maintenance: ${m.status}`,
                  badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
                });
              });
            } catch {
              // Individual asset access fallback
            }
          }),
        );

        // Sort by date descending
        feed.sort((a, b) => (b.date > a.date ? 1 : -1));
        setUpdates(feed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load updates feed');
      } finally {
        setLoading(false);
      }
    }
    fetchUpdates();
  }, []);

  const filteredUpdates = updates.filter((item) => {
    if (categoryFilter === 'ALL') return true;
    return item.type === categoryFilter;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Operational Updates & Milestone Feed</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Lightweight in-app reporting stream of recent lifecycle milestones, inspections, and maintenance events
          </p>
        </div>
      </div>

      <AlertBanner message={error} type="error" onDismiss={() => setError(null)} />

      {/* Category Filter */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center gap-2 text-xs">
        <span className="font-bold text-slate-600 uppercase text-[10px] mr-2">Category Filter:</span>
        {['ALL', 'LIFECYCLE', 'INSPECTION', 'MAINTENANCE'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              categoryFilter === cat
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {cat === 'ALL' ? 'All Updates' : cat.charAt(0) + cat.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Updates Stream */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
        {loading ? (
          <LoadingSpinner text="Compiling operational update stream..." />
        ) : filteredUpdates.length === 0 ? (
          <EmptyState
            title="No recent updates found"
            description="Operational events will populate here as lifecycle milestones and inspections are recorded."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredUpdates.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenAsset(item.assetId)}
                className="py-3.5 px-2 hover:bg-slate-50/80 rounded-md cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {item.assetCode}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${item.badgeClass}`}>
                      {item.badgeText}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">{formatDate(item.date)}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 hover:text-blue-700">{item.title}</h4>
                  {item.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">Project: {item.assetName}</p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAsset(item.assetId);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300 self-start shrink-0"
                >
                  View Project →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
