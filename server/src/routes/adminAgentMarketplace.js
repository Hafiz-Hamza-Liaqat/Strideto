import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '../config/rbac.js';
import * as controller from '../controllers/admin/adminAgentMarketplaceController.js';
export const adminAgentMarketplaceRouter = Router();
adminAgentMarketplaceRouter.get('/agent-marketplace',requirePermission(PERMISSIONS.WORKFLOW_REVIEW),controller.list);
adminAgentMarketplaceRouter.get('/agent-marketplace/:postId',requirePermission(PERMISSIONS.WORKFLOW_REVIEW),controller.detail);
adminAgentMarketplaceRouter.patch('/agent-marketplace/:postId/moderate',requirePermission(PERMISSIONS.WORKFLOW_APPROVE,PERMISSIONS.WORKFLOW_PUBLISH),controller.moderate);
