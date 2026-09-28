// Thrown by route handlers; caught by src/middleware/errorHandler.ts and
// translated into the { error: { code, message } } response shape.
export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }

  static badRequest(message: string, code = 'VALIDATION_ERROR'): AppError {
    return new AppError(400, code, message);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHENTICATED'): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'You do not have permission to perform this action', code = 'FORBIDDEN'): AppError {
    return new AppError(403, code, message);
  }

  static notFound(resource: string): AppError {
    return new AppError(404, 'NOT_FOUND', `${resource} not found`);
  }

  static conflict(message: string, code = 'CONFLICT'): AppError {
    return new AppError(409, code, message);
  }
}
