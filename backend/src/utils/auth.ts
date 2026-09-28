import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './AppError';
import type { UserRole } from '../db/types';

const BCRYPT_ROUNDS = 10;
const ROLES: readonly UserRole[] = ['ADMIN', 'GOVERNMENT_OFFICER', 'FIELD_USER'];

// Compared against when the email is unknown, so "no such user" and "wrong password"
// cost the same time and cannot be told apart by response timing.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_ROUNDS);

export function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH).then((ok) => ok && hash !== null);
}

/** Minimal identity carried in the JWT: no password, hash or profile data. */
export interface TokenPayload {
  sub: string; // user id
  role: UserRole;
  email: string;
}

function secret(): string {
  if (!env.jwtSecret) throw new Error('JWT_SECRET is not configured');
  return env.jwtSecret;
}

export function signToken(user: { id: string; role: UserRole; email: string }): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    subject: user.id,
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign({ role: user.role, email: user.email }, secret(), options);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, secret(), { algorithms: ['HS256'] });
    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.email !== 'string' ||
      !ROLES.includes(decoded.role as UserRole)
    ) {
      throw AppError.unauthorized('Invalid token', 'INVALID_TOKEN');
    }
    return { sub: decoded.sub, role: decoded.role as UserRole, email: decoded.email };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Token has expired, please log in again', 'TOKEN_EXPIRED');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw AppError.unauthorized('Invalid token', 'INVALID_TOKEN');
    }
    throw err; // e.g. missing JWT_SECRET -> 500
  }
}

export const ROLE_VALUES = ROLES;
