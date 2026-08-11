import { Router } from 'express';
import { requireAuth, requireUserAuth } from '../middleware/auth.js';
import {
  getPrivacyOverview,
  listMyPrivacyRequests,
  createExportRequest,
  createDeletionRequest,
  cancelPrivacyRequest,
} from '../controllers/accountPrivacyController.js';

export const privacyRouter = Router();

const auth = [requireAuth, requireUserAuth];

privacyRouter.get('/privacy/overview', ...auth, getPrivacyOverview);
privacyRouter.get('/privacy/requests', ...auth, listMyPrivacyRequests);
privacyRouter.post('/privacy/requests/export', ...auth, createExportRequest);
privacyRouter.post('/privacy/requests/deletion', ...auth, createDeletionRequest);
privacyRouter.post('/privacy/requests/:id/cancel', ...auth, cancelPrivacyRequest);
