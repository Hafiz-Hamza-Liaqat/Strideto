import { Router } from 'express';
import { searchLimiter } from '../middleware/rateLimit.js';
import * as analytics from '../controllers/analyticsController.js';
import { optionalAuth } from '../middleware/auth.js';

/**
 * Additive public analytics ingest (C.7.0.5).
 * Existing POST /api/v1/analytics/event remains unchanged.
 */
export const analyticsRouter = Router();

analyticsRouter.post('/analytics/event', searchLimiter, optionalAuth, analytics.recordEvent);
