import { AppError } from './AppError';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function requireUUID(value: unknown, field: string): string {
  if (!isUUID(value)) throw AppError.badRequest(`${field} must be a valid UUID`);
  return value;
}

/** Non-empty trimmed string. */
export function requireString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw AppError.badRequest(`${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
}

/** Optional string field: undefined/null/'' -> null, otherwise trimmed string. */
export function optionalString(value: unknown, field: string, maxLength = 2000): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw AppError.badRequest(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
}

export function requireEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw AppError.badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | null {
  if (value === undefined || value === null || value === '') return null;
  return requireEnum(value, field, allowed);
}

export function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

export function requireDateString(value: unknown, field: string): string {
  if (!isValidDateString(value)) {
    throw AppError.badRequest(`${field} must be a valid date in YYYY-MM-DD format`);
  }
  return value;
}

/** Optional date field: undefined/null/'' -> null, otherwise validated 'YYYY-MM-DD'. */
export function optionalDateString(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireDateString(value, field);
}

export function optionalNumber(value: unknown, field: string, min?: number, max?: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) throw AppError.badRequest(`${field} must be a number`);
  if (min !== undefined && num < min) throw AppError.badRequest(`${field} must be >= ${min}`);
  if (max !== undefined && num > max) throw AppError.badRequest(`${field} must be <= ${max}`);
  return num;
}

export function optionalInt(value: unknown, field: string, min?: number, max?: number): number | null {
  const num = optionalNumber(value, field, min, max);
  if (num === null) return null;
  if (!Number.isInteger(num)) throw AppError.badRequest(`${field} must be an integer`);
  return num;
}

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export function parsePagination(query: Record<string, unknown>): Pagination {
  let page = Number(query.page);
  let limit = Number(query.limit);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_PAGE_SIZE;
  if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
  page = Math.floor(page);
  limit = Math.floor(limit);
  return { page, limit, offset: (page - 1) * limit };
}

export function buildPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
