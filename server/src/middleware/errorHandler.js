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
  } else if (isProd && !SAFE_MESSAGES.has(message) && status >= 400) {
    message = status === 404 ? 'Not found' : 'Request failed';
  }
  res.status(status).json({
    error: message,
    requestId,
    ...(err.applicationId ? { applicationId: err.applicationId } : {}),
    ...(!isProd && process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
