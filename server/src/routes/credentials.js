import { Router } from 'express';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import {
  listCredentials,
  getCredential,
  issueCredential,
  updateCredential,
  verifyCredential,
  revokeCredential,
  requireDocumentsPlatformEnabled,
} from '../controllers/career/credentialController.js';

export const credentialsRouter = Router();

const credAuth = [...studentProductAuth, requireDocumentsPlatformEnabled];

credentialsRouter.get('/credentials', ...credAuth, listCredentials);
credentialsRouter.post('/credentials', ...credAuth, issueCredential);
credentialsRouter.get('/credentials/:id', ...credAuth, getCredential);
credentialsRouter.patch('/credentials/:id', ...credAuth, updateCredential);
credentialsRouter.post('/credentials/:id/verify', ...credAuth, verifyCredential);
credentialsRouter.post('/credentials/:id/revoke', ...credAuth, revokeCredential);
