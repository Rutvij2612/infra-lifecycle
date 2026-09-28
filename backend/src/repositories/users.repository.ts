import { query, queryOne } from '../db/query';
import type { User, UserAuthRecord, UserRole } from '../db/types';

/** API-safe user shape: no password hash; department nested. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  department: { id: string; name: string } | null;
  created_at: Date;
  updated_at: Date;
}

interface PublicUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  department_id: string | null;
  department_name: string | null;
  created_at: Date;
  updated_at: Date;
}

const SELECT_PUBLIC = `
  SELECT u.id, u.name, u.email, u.role, u.is_active, u.department_id,
         d.name AS department_name, u.created_at, u.updated_at
  FROM users u
  LEFT JOIN departments d ON d.id = u.department_id`;

function toPublic(row: PublicUserRow): PublicUser {
  const { department_id, department_name, ...rest } = row;
  return { ...rest, department: department_id ? { id: department_id, name: department_name ?? '' } : null };
}

export function getUserById(id: string): Promise<User | null> {
  return queryOne<User>(
    `SELECT id, name, email, role, department_id, is_active, created_at, updated_at
     FROM users WHERE id = $1`,
    [id],
  );
}

/** Includes password_hash - login flow only. Email match is case-insensitive. */
export function getUserAuthByEmail(email: string): Promise<UserAuthRecord | null> {
  return queryOne<UserAuthRecord>('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
}

export async function getPublicUserById(id: string): Promise<PublicUser | null> {
  const row = await queryOne<PublicUserRow>(`${SELECT_PUBLIC} WHERE u.id = $1`, [id]);
  return row ? toPublic(row) : null;
}

export interface UserListFilters {
  role?: UserRole;
  isActive?: boolean;
  departmentId?: string;
  search?: string;
}

export async function listUsers(filters: UserListFilters): Promise<PublicUser[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.role) where.push(`u.role = $${params.push(filters.role)}`);
  if (filters.isActive !== undefined) where.push(`u.is_active = $${params.push(filters.isActive)}`);
  if (filters.departmentId) where.push(`u.department_id = $${params.push(filters.departmentId)}`);
  if (filters.search) {
    const idx = params.push(`%${filters.search}%`);
    where.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const rows = await query<PublicUserRow>(`${SELECT_PUBLIC}${clause} ORDER BY u.name ASC`, params);
  return rows.map(toPublic);
}

export interface NewUser {
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  department_id: string | null;
  is_active: boolean;
}

export async function createUser(input: NewUser): Promise<PublicUser> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, role, department_id, is_active)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [input.name, input.email, input.password_hash, input.role, input.department_id, input.is_active],
  );
  return (await getPublicUserById(row!.id)) as PublicUser;
}

export type UserUpdate = Partial<{
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  department_id: string | null;
  is_active: boolean;
}>;

export async function updateUser(id: string, fields: UserUpdate): Promise<PublicUser | null> {
  const keys = Object.keys(fields) as (keyof UserUpdate)[];
  if (keys.length > 0) {
    const set: string[] = [];
    const params: unknown[] = [];
    for (const key of keys) set.push(`${key} = $${params.push(fields[key])}`);
    params.push(id);
    await query(`UPDATE users SET ${set.join(', ')} WHERE id = $${params.length}`, params);
  }
  return getPublicUserById(id);
}

export async function emailInUse(email: string, exceptUserId?: string): Promise<boolean> {
  const row = await queryOne(
    'SELECT 1 FROM users WHERE lower(email) = lower($1) AND ($2::uuid IS NULL OR id <> $2::uuid)',
    [email, exceptUserId ?? null],
  );
  return row !== null;
}

export async function departmentExists(departmentId: string): Promise<boolean> {
  return (await queryOne('SELECT 1 FROM departments WHERE id = $1', [departmentId])) !== null;
}
