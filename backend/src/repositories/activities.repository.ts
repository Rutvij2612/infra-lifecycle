import { query, queryOne } from '../db/query';
import type { Activity, ActivityPriority, ActivityStatus, ActivityType } from '../db/types';

export interface ActivityFilters {
  status?: ActivityStatus;
  priority?: ActivityPriority;
  /** Only activities this user is assigned to (used for field users). */
  assignedToUserId?: string;
}

export function listActivitiesByAsset(assetId: string, filters: ActivityFilters = {}): Promise<Activity[]> {
  const where = ['asset_id = $1'];
  const params: unknown[] = [assetId];
  if (filters.status) where.push(`status = $${params.push(filters.status)}`);
  if (filters.priority) where.push(`priority = $${params.push(filters.priority)}`);
  if (filters.assignedToUserId) {
    where.push(
      `id IN (SELECT activity_id FROM activity_assignments WHERE user_id = $${params.push(filters.assignedToUserId)})`,
    );
  }

  return query<Activity>(
    `SELECT * FROM activities WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
    params,
  );
}

export function getActivityById(id: string): Promise<Activity | null> {
  return queryOne<Activity>('SELECT * FROM activities WHERE id = $1', [id]);
}

export interface NewActivity {
  asset_id: string;
  title: string;
  description: string | null;
  activity_type: ActivityType;
  status: ActivityStatus;
  priority: ActivityPriority;
  start_date: string | null;
  due_date: string | null;
  created_by: string;
}

export function createActivity(input: NewActivity): Promise<Activity> {
  return queryOne<Activity>(
    `INSERT INTO activities
       (asset_id, title, description, activity_type, status, priority, start_date, due_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.asset_id,
      input.title,
      input.description,
      input.activity_type,
      input.status,
      input.priority,
      input.start_date,
      input.due_date,
      input.created_by,
    ],
  ) as Promise<Activity>;
}

export type ActivityUpdate = Partial<
  Pick<
    Activity,
    'title' | 'description' | 'status' | 'priority' | 'start_date' | 'due_date' | 'progress_percentage'
  >
> & { completed_at?: Date | null };

export async function updateActivity(id: string, fields: ActivityUpdate): Promise<Activity | null> {
  const keys = Object.keys(fields) as (keyof ActivityUpdate)[];
  if (keys.length === 0) return getActivityById(id);

  const set: string[] = [];
  const params: unknown[] = [];
  for (const key of keys) {
    set.push(`${key} = $${params.push(fields[key])}`);
  }
  params.push(id);

  return queryOne<Activity>(
    `UPDATE activities SET ${set.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
}

export interface MyActivity extends Activity {
  asset_code: string;
  asset_name: string;
}

/** Activities assigned to a user, across all assets ("my work"). */
export function listActivitiesForUser(userId: string): Promise<MyActivity[]> {
  return query<MyActivity>(
    `SELECT ac.*, a.asset_code, a.name AS asset_name
     FROM activities ac
     JOIN activity_assignments aa ON aa.activity_id = ac.id
     JOIN infrastructure_assets a ON a.id = ac.asset_id
     WHERE aa.user_id = $1
     ORDER BY ac.due_date ASC NULLS LAST, ac.created_at DESC`,
    [userId],
  );
}
