import { Router } from 'express';
import { requireAuth, requireUserAuth } from '../middleware/auth.js';
import { vaultFileMiddleware } from '../middleware/vaultUpload.js';
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  archiveDocument,
  deleteDocument,
  listVersions,
  uploadVersion,
  accessDocument,
  listGrants,
  createGrant,
  revokeGrant,
} from '../controllers/vault/vaultController.js';

export const vaultRouter = Router();

const auth = [requireAuth, requireUserAuth];

// Document CRUD
vaultRouter.get('/vault/documents', ...auth, listDocuments);
vaultRouter.post('/vault/documents', ...auth, vaultFileMiddleware, createDocument);
vaultRouter.get('/vault/documents/:id', ...auth, getDocument);
vaultRouter.patch('/vault/documents/:id', ...auth, updateDocument);
vaultRouter.post('/vault/documents/:id/archive', ...auth, archiveDocument);
vaultRouter.delete('/vault/documents/:id', ...auth, deleteDocument);

// Versions
vaultRouter.get('/vault/documents/:id/versions', ...auth, listVersions);
vaultRouter.post('/vault/documents/:id/versions', ...auth, vaultFileMiddleware, uploadVersion);

// Private access / download (ownership verified server-side)
vaultRouter.get('/vault/documents/:id/access', ...auth, accessDocument);

// Sharing grants
vaultRouter.get('/vault/documents/:id/grants', ...auth, listGrants);
vaultRouter.post('/vault/documents/:id/grants', ...auth, createGrant);
vaultRouter.delete('/vault/documents/:id/grants/:grantId', ...auth, revokeGrant);
