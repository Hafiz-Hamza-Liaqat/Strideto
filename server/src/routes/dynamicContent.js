import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireStaff, requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/rbac.js';
import { searchLimiter } from '../middleware/rateLimit.js';
import * as dynamicContent from '../controllers/dynamicContentController.js';

export const dynamicContentRouter = Router();

dynamicContentRouter.get('/dynamic-content/:source', searchLimiter, dynamicContent.getDynamicContent);
dynamicContentRouter.post('/dynamic-content/batch', searchLimiter, dynamicContent.postDynamicContentBatch);
dynamicContentRouter.post(
  '/dynamic-content/invalidate-cache',
  requireAuth,
  requireStaff,
  requirePermission(PERMISSIONS.CONTENT_SITE),
  searchLimiter,
  dynamicContent.invalidateCache
);
