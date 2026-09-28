import { query, queryOne } from '../db/query';
import type { ActivityAssignment } from '../db/types';

export interface AssignmentWithUser extends ActivityAssignment {
  user_name: string;
  user_email: string;
  user_role: string;
}

export function listAssignmentsByActivity(activityId: string): Promise<AssignmentWithUser[]> {
  return query<AssignmentWithUser>(
    `SELECT aa.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
     FROM activity_assignments aa
     JOIN users u ON u.id = aa.user_id
     WHERE aa.activity_id = $1
     ORDER BY aa.assigned_at ASC`,
    [activityId],
  );
}

export function getAssignment(activityId: string, userId: string): Promise<ActivityAssignment | null> {
  return queryOne<ActivityAssignment>(
    'SELECT * FROM activity_assignments WHERE activity_id = $1 AND user_id = $2',
    [activityId, userId],
  );
}

export function createAssignment(
  activityId: string,
  userId: string,
  assignedBy: string,
): Promise<ActivityAssignment> {
  return queryOne<ActivityAssignment>(
    `INSERT INTO activity_assignments (activity_id, user_id, assigned_by)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [activityId, userId, assignedBy],
  ) as Promise<ActivityAssignment>;
}

/** Returns true if a row was deleted. */
export async function deleteAssignment(activityId: string, userId: string): Promise<boolean> {
  const rows = await query(
    'DELETE FROM activity_assignments WHERE activity_id = $1 AND user_id = $2 RETURNING id',
    [activityId, userId],
  );
  return rows.length > 0;
}
