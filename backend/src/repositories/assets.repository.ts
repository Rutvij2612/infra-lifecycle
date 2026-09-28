import { query, queryOne } from '../db/query';
import type { AssetType, InfrastructureAsset, LifecycleStatus } from '../db/types';

export interface AssetWithDepartment extends InfrastructureAsset {
  department_name: string;
  department_code: string;
}

export interface AssetListFilters {
  search?: string;
  assetType?: AssetType;
  lifecycleStatus?: LifecycleStatus;
  departmentId?: string;
  /** Field-user scope: only assets the user has an explicit responsibility assignment for. */
  visibleTo?: { userId: string };
  limit: number;
  offset: number;
}

const SELECT_ASSET = `
  SELECT a.*, d.name AS department_name, d.code AS department_code
  FROM infrastructure_assets a
  JOIN departments d ON d.id = a.department_id`;

/** Paginated + filtered + searched list. Filtering/search/pagination all happen in SQL. */
export async function listAssets(
  filters: AssetListFilters,
): Promise<{ rows: AssetWithDepartment[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    const idx = params.push(`%${filters.search}%`);
    where.push(`(a.name ILIKE $${idx} OR a.asset_code ILIKE $${idx} OR a.location ILIKE $${idx})`);
  }
  if (filters.assetType) where.push(`a.asset_type = $${params.push(filters.assetType)}`);
  if (filters.lifecycleStatus) where.push(`a.lifecycle_status = $${params.push(filters.lifecycleStatus)}`);
  if (filters.departmentId) where.push(`a.department_id = $${params.push(filters.departmentId)}`);

  if (filters.visibleTo) {
    const userIdx = params.push(filters.visibleTo.userId);
    where.push(
      `EXISTS (SELECT 1 FROM asset_responsibilities r WHERE r.asset_id = a.id AND r.user_id = $${userIdx}::uuid)`,
    );
  }

  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const limitIdx = params.push(filters.limit);
  const offsetIdx = params.push(filters.offset);

  const rows = await query<AssetWithDepartment & { total_count: string }>(
    `${SELECT_ASSET}${clause}
     ORDER BY a.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params,
  );

  // Total count for the same filter set (needed for pagination.total even on an empty page).
  const countParams = params.slice(0, params.length - 2);
  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM infrastructure_assets a${clause}`,
    countParams,
  );

  return { rows, total: countRow ? Number(countRow.count) : 0 };
}

export function getAssetById(id: string): Promise<AssetWithDepartment | null> {
  return queryOne<AssetWithDepartment>(`${SELECT_ASSET} WHERE a.id = $1`, [id]);
}

export function getAssetByCode(assetCode: string): Promise<InfrastructureAsset | null> {
  return queryOne<InfrastructureAsset>('SELECT * FROM infrastructure_assets WHERE asset_code = $1', [assetCode]);
}

export interface RelatedCounts {
  activityCount: number;
  openActivityCount: number;
  inspectionCount: number;
  maintenanceCount: number;
  lifecycleEventCount: number;
}

export async function getRelatedCounts(assetId: string): Promise<RelatedCounts> {
  const row = await queryOne<{
    activity_count: string;
    open_activity_count: string;
    inspection_count: string;
    maintenance_count: string;
    lifecycle_event_count: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM activities WHERE asset_id = $1) AS activity_count,
       (SELECT COUNT(*) FROM activities WHERE asset_id = $1 AND status <> 'COMPLETED') AS open_activity_count,
       (SELECT COUNT(*) FROM inspections WHERE asset_id = $1) AS inspection_count,
       (SELECT COUNT(*) FROM maintenance_records WHERE asset_id = $1) AS maintenance_count,
       (SELECT COUNT(*) FROM lifecycle_events WHERE asset_id = $1) AS lifecycle_event_count`,
    [assetId],
  );
  return {
    activityCount: Number(row?.activity_count ?? 0),
    openActivityCount: Number(row?.open_activity_count ?? 0),
    inspectionCount: Number(row?.inspection_count ?? 0),
    maintenanceCount: Number(row?.maintenance_count ?? 0),
    lifecycleEventCount: Number(row?.lifecycle_event_count ?? 0),
  };
}

export interface NewAsset {
  asset_code: string;
  name: string;
  asset_type: AssetType;
  description: string | null;
  department_id: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  lifecycle_status: LifecycleStatus;
  construction_start_date: string | null;
  completion_date: string | null;
  expected_end_of_life_date: string | null;
}

export function createAsset(input: NewAsset): Promise<InfrastructureAsset> {
  return queryOne<InfrastructureAsset>(
    `INSERT INTO infrastructure_assets
       (asset_code, name, asset_type, description, department_id, location, latitude, longitude,
        lifecycle_status, construction_start_date, completion_date, expected_end_of_life_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      input.asset_code,
      input.name,
      input.asset_type,
      input.description,
      input.department_id,
      input.location,
      input.latitude,
      input.longitude,
      input.lifecycle_status,
      input.construction_start_date,
      input.completion_date,
      input.expected_end_of_life_date,
    ],
  ) as Promise<InfrastructureAsset>;
}

export type AssetUpdate = Partial<
  Pick<
    InfrastructureAsset,
    | 'name'
    | 'asset_type'
    | 'description'
    | 'department_id'
    | 'location'
    | 'latitude'
    | 'longitude'
    | 'construction_start_date'
    | 'completion_date'
    | 'expected_end_of_life_date'
  >
>;

export async function updateAsset(id: string, fields: AssetUpdate): Promise<InfrastructureAsset | null> {
  const keys = Object.keys(fields) as (keyof AssetUpdate)[];
  if (keys.length === 0) return getAssetById(id).then((a) => a as InfrastructureAsset | null);

  const set: string[] = [];
  const params: unknown[] = [];
  for (const key of keys) {
    set.push(`${key} = $${params.push(fields[key])}`);
  }
  params.push(id);

  return queryOne<InfrastructureAsset>(
    `UPDATE infrastructure_assets SET ${set.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
}
