import { logger } from '../utils/logger.js';

const SAFE_MESSAGES = new Set([
  'Authentication required',
  'Invalid or expired token',
  'Validation failed',
  'Job not found',
  'User not found',
  'Insufficient permissions',
]);

export function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const requestId = req?.id;
  logger.error('unhandled_error', {
    requestId,
    errorClass: err.name || 'Error',
    status,
    message: isProd && status >= 500 ? 'internal_error' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
  let message = err.message || 'Internal Server Error';
  if (isProd && status >= 500) {
    message = 'Internal Server Error';
  } else if (isProd && status === 404 && !SAFE_MESSAGES.has(message)) {
    message = 'Not found';
  } else if (isProd && status >= 400 && status !== 422 && status !== 409 && !SAFE_MESSAGES.has(message) && !err.code) {
    message = 'Request failed';
  }
  res.status(status).json({
    error: message,
    requestId,
    ...(err.code ? { code: err.code } : {}),
    ...(err.applicationId ? { applicationId: err.applicationId } : {}),
    ...(!isProd && process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
