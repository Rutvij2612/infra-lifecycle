import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

interface PgError {
  code: string;
  message: string;
  detail?: string;
  constraint?: string;
}

function isPgError(err: unknown): err is PgError {
  return typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: unknown }).code === 'string';
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (isPgError(err)) {
    switch (err.code) {
      case '23505': // unique_violation
        res.status(409).json({
          error: { code: 'CONFLICT', message: 'A record with the same unique value already exists' },
        });
        return;
      case '23503': // foreign_key_violation
        res.status(400).json({
          error: { code: 'INVALID_REFERENCE', message: 'One or more referenced records do not exist' },
        });
        return;
      case '23514': // check_violation
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'The provided data violates a database constraint' },
        });
        return;
      case '22P02': // invalid_text_representation (bad enum / uuid / number literal)
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'One or more fields contain an invalid value' },
        });
        return;
      default:
        break;
    }
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
