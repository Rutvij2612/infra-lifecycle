import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../utils/AppError';
import { verifyToken } from '../utils/auth';
import { getUserById } from '../repositories/users.repository';
import type { UserRole } from '../db/types';

/** Authenticated user attached to req.user by requireAuth. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const STAFF_ROLES: readonly UserRole[] = ['ADMIN', 'GOVERNMENT_OFFICER'];

/**
 * Requires "Authorization: Bearer <jwt>". Verifies the token, then loads the user from the
 * database so deactivated users and role changes take effect immediately (the DB is the
 * source of truth, not the token).
 */
export const requireAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) throw AppError.unauthorized('Missing Authorization header');
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw AppError.unauthorized('Authorization header must be: Bearer <token>', 'INVALID_TOKEN');
  }

  const payload = verifyToken(token);
  const user = await getUserById(payload.sub);
  if (!user || !user.is_active) {
    throw AppError.unauthorized('Account not found or deactivated', 'INVALID_TOKEN');
  }

  req.user = { id: user.id, name: user.name, email: user.email, role: user.role, departmentId: user.department_id };
  next();
};

/** Allows only the listed roles. Must run after requireAuth. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const user = currentUser(req);
    if (!roles.includes(user.role)) {
      throw AppError.forbidden(`This action requires one of the roles: ${roles.join(', ')}`);
    }
    next();
  };
}

/** The authenticated user; throws 401 if requireAuth did not run. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
