import { logger } from '../utils/logger.js';
import { recordRequest } from '../config/metrics.js';

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const isError = res.statusCode >= 500;
    recordRequest(ms, isError);
    logger.info('request', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms,
    });
  });
  next();
}
