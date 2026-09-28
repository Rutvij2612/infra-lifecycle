import { query, queryOne } from '../db/query';
import type { MaintenanceRecord, MaintenanceStatus, MaintenanceType } from '../db/types';

export function listMaintenanceByAsset(assetId: string): Promise<MaintenanceRecord[]> {
  return query<MaintenanceRecord>(
    'SELECT * FROM maintenance_records WHERE asset_id = $1 ORDER BY created_at DESC',
    [assetId],
  );
}

export function getMaintenanceById(id: string): Promise<MaintenanceRecord | null> {
  return queryOne<MaintenanceRecord>('SELECT * FROM maintenance_records WHERE id = $1', [id]);
}

export interface NewMaintenanceRecord {
  asset_id: string;
  maintenance_type: MaintenanceType;
  title: string;
  description: string | null;
  start_date: string | null;
  completion_date: string | null;
  cost: number | null;
  status: MaintenanceStatus;
  performed_by: string | null;
}

export function createMaintenanceRecord(input: NewMaintenanceRecord): Promise<MaintenanceRecord> {
  return queryOne<MaintenanceRecord>(
    `INSERT INTO maintenance_records
       (asset_id, maintenance_type, title, description, start_date, completion_date, cost, status, performed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.asset_id,
      input.maintenance_type,
      input.title,
      input.description,
      input.start_date,
      input.completion_date,
      input.cost,
      input.status,
      input.performed_by,
    ],
  ) as Promise<MaintenanceRecord>;
}

export type MaintenanceUpdate = Partial<
  Pick<
    MaintenanceRecord,
    | 'maintenance_type'
    | 'title'
    | 'description'
    | 'start_date'
    | 'completion_date'
    | 'cost'
    | 'status'
    | 'performed_by'
  >
>;

export async function updateMaintenanceRecord(
  id: string,
  fields: MaintenanceUpdate,
): Promise<MaintenanceRecord | null> {
  const keys = Object.keys(fields) as (keyof MaintenanceUpdate)[];
  if (keys.length === 0) return getMaintenanceById(id);

  const set: string[] = [];
  const params: unknown[] = [];
  for (const key of keys) {
    set.push(`${key} = $${params.push(fields[key])}`);
  }
  params.push(id);

  return queryOne<MaintenanceRecord>(
    `UPDATE maintenance_records SET ${set.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
}
