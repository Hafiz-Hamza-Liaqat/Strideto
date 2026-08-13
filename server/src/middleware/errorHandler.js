import { logger } from '../utils/logger.js';

const SAFE_MESSAGES = new Set([
  'Authentication required',
  'Invalid or expired token',
  'Validation failed',
  'Job not found',
  'User not found',
  'Insufficient permissions',
]);

const SAFE_CODES = new Set([
  'email_verification_required',
  'ACTIVE_LIMIT_REACHED_AT_APPROVAL',
  'EMPLOYER_NOT_ELIGIBLE',
  'QUOTA_EXCEEDED',
  'smtp_not_configured',
  'STEP_UP_REQUIRED',
  'FORBIDDEN',
  'CONFLICT',
]);

function looksInternal(message = '') {
  return /mongo|econnrefused|stack trace|\/src\/|JWT_SECRET|REFRESH_SECRET|at Object\.|ValidationError/i.test(String(message));
}

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
  const safeCode = typeof err.code === 'string' && SAFE_CODES.has(err.code) ? err.code : undefined;
  if (status >= 500 || looksInternal(message)) {
    message = status >= 500 ? 'Internal Server Error' : 'Request failed';
  } else if (status === 404 && !SAFE_MESSAGES.has(message)) {
    message = 'Not found';
  } else if (status >= 400 && status !== 422 && status !== 409 && !SAFE_MESSAGES.has(message) && !safeCode) {
    message = 'Request failed';
  }
  res.status(status).json({
    error: message,
    requestId,
    ...(safeCode ? { code: safeCode } : {}),
    ...(err.applicationId ? { applicationId: err.applicationId } : {}),
  });
}
