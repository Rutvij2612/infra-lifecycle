import type { PoolClient } from 'pg';
import { query, withTransaction } from '../db/query';
import type { InfrastructureAsset, LifecycleEvent, LifecycleEventType, LifecycleStatus } from '../db/types';

export interface LifecycleEventWithUser extends LifecycleEvent {
  recorded_by_name: string;
}

/** Full timeline of an asset, chronological (oldest first). Uses idx_lifecycle_events_asset_date. */
export function listEventsByAsset(assetId: string): Promise<LifecycleEventWithUser[]> {
  return query<LifecycleEventWithUser>(
    `SELECT e.*, u.name AS recorded_by_name
     FROM lifecycle_events e
     JOIN users u ON u.id = e.recorded_by
     WHERE e.asset_id = $1
     ORDER BY e.event_date ASC, e.created_at ASC`,
    [assetId],
  );
}

export interface NewLifecycleEvent {
  asset_id: string;
  event_type: LifecycleEventType;
  event_date: string;
  title: string;
  description: string | null;
  progress_percentage: number | null;
  recorded_by: string;
}

async function insertEvent(client: PoolClient, input: NewLifecycleEvent): Promise<LifecycleEvent> {
  const result = await client.query<LifecycleEvent>(
    `INSERT INTO lifecycle_events
       (asset_id, event_type, event_date, title, description, progress_percentage, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      input.asset_id,
      input.event_type,
      input.event_date,
      input.title,
      input.description,
      input.progress_percentage,
      input.recorded_by,
    ],
  );
  return result.rows[0];
}

async function updateAssetStatus(
  client: PoolClient,
  assetId: string,
  status: LifecycleStatus,
): Promise<InfrastructureAsset> {
  const result = await client.query<InfrastructureAsset>(
    `UPDATE infrastructure_assets SET lifecycle_status = $1 WHERE id = $2 RETURNING *`,
    [status, assetId],
  );
  return result.rows[0];
}

/**
 * Inserts the lifecycle event and, if the event type maps to a lifecycle status,
 * updates the asset's current status - both in one transaction so they never drift apart.
 */
export function recordLifecycleEvent(
  input: NewLifecycleEvent,
  newStatus: LifecycleStatus | null,
): Promise<{ event: LifecycleEvent; asset: InfrastructureAsset | null }> {
  return withTransaction(async (client) => {
    const event = await insertEvent(client, input);
    const asset = newStatus ? await updateAssetStatus(client, input.asset_id, newStatus) : null;
    return { event, asset };
  });
}
