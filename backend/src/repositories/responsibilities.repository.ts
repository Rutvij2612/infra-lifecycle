import { query, queryOne } from '../db/query';
import type { AssetResponsibility, ResponsibilityType } from '../db/types';

export interface ResponsibilityWithUser extends AssetResponsibility {
  user_name: string;
  user_email: string;
  assigned_by_name: string;
}

export function listResponsibilitiesByAsset(assetId: string): Promise<ResponsibilityWithUser[]> {
  return query<ResponsibilityWithUser>(
    `SELECT r.*, u.name AS user_name, u.email AS user_email, ab.name AS assigned_by_name
     FROM asset_responsibilities r
     JOIN users u  ON u.id  = r.user_id
     JOIN users ab ON ab.id = r.assigned_by
     WHERE r.asset_id = $1
     ORDER BY r.assigned_at ASC, r.responsibility_type ASC`,
    [assetId],
  );
}

export function getResponsibility(
  assetId: string,
  userId: string,
  type: ResponsibilityType,
): Promise<AssetResponsibility | null> {
  return queryOne<AssetResponsibility>(
    'SELECT * FROM asset_responsibilities WHERE asset_id = $1 AND user_id = $2 AND responsibility_type = $3',
    [assetId, userId, type],
  );
}

export function createResponsibility(
  assetId: string,
  userId: string,
  type: ResponsibilityType,
  assignedBy: string,
): Promise<AssetResponsibility> {
  return queryOne<AssetResponsibility>(
    `INSERT INTO asset_responsibilities (asset_id, user_id, responsibility_type, assigned_by)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [assetId, userId, type, assignedBy],
  ) as Promise<AssetResponsibility>;
}

/** Removes the user's responsibility on the asset (one capacity, or all if type is omitted). Returns the removed types. */
export async function deleteResponsibilities(
  assetId: string,
  userId: string,
  type?: ResponsibilityType,
): Promise<ResponsibilityType[]> {
  const params: unknown[] = [assetId, userId];
  let sql = 'DELETE FROM asset_responsibilities WHERE asset_id = $1 AND user_id = $2';
  if (type) sql += ` AND responsibility_type = $${params.push(type)}`;
  const rows = await query<{ responsibility_type: ResponsibilityType }>(`${sql} RETURNING responsibility_type`, params);
  return rows.map((r) => r.responsibility_type);
}

/** The capacities (CONSTRUCTION / MAINTENANCE) in which the user is responsible for the asset. */
export async function getResponsibilityTypes(userId: string, assetId: string): Promise<ResponsibilityType[]> {
  const rows = await query<{ responsibility_type: ResponsibilityType }>(
    'SELECT responsibility_type FROM asset_responsibilities WHERE user_id = $1 AND asset_id = $2',
    [userId, assetId],
  );
  return rows.map((r) => r.responsibility_type);
}

/** True if the user is responsible for the asset (in the given capacity, or in any capacity if omitted). */
export async function hasResponsibility(userId: string, assetId: string, type?: ResponsibilityType): Promise<boolean> {
  const row = type
    ? await queryOne(
        'SELECT 1 FROM asset_responsibilities WHERE user_id = $1 AND asset_id = $2 AND responsibility_type = $3 LIMIT 1',
        [userId, assetId, type],
      )
    : await queryOne('SELECT 1 FROM asset_responsibilities WHERE user_id = $1 AND asset_id = $2 LIMIT 1', [userId, assetId]);
  return row !== null;
}
