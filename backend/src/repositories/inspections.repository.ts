import { query, queryOne } from '../db/query';
import type { ConditionStatus, Inspection, InspectionType } from '../db/types';

export function listInspectionsByAsset(assetId: string): Promise<Inspection[]> {
  return query<Inspection>(
    'SELECT * FROM inspections WHERE asset_id = $1 ORDER BY inspection_date DESC, created_at DESC',
    [assetId],
  );
}

export interface NewInspection {
  asset_id: string;
  inspection_date: string;
  inspection_type: InspectionType;
  condition_status: ConditionStatus;
  findings: string | null;
  recommendations: string | null;
  conducted_by: string;
}

export function createInspection(input: NewInspection): Promise<Inspection> {
  return queryOne<Inspection>(
    `INSERT INTO inspections
       (asset_id, inspection_date, inspection_type, condition_status, findings, recommendations, conducted_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      input.asset_id,
      input.inspection_date,
      input.inspection_type,
      input.condition_status,
      input.findings,
      input.recommendations,
      input.conducted_by,
    ],
  ) as Promise<Inspection>;
}
