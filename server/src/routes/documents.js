import { Router } from 'express';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  archiveDocument,
  deleteDocument,
  listDocumentVersions,
  createDocumentVersion,
  requireDocumentsPlatformEnabled,
} from '../controllers/career/documentController.js';

export const documentsRouter = Router();

const docAuth = [...studentProductAuth, requireDocumentsPlatformEnabled];

documentsRouter.get('/documents', ...docAuth, listDocuments);
documentsRouter.post('/documents', ...docAuth, createDocument);
documentsRouter.get('/documents/:id', ...docAuth, getDocument);
documentsRouter.patch('/documents/:id', ...docAuth, updateDocument);
documentsRouter.delete('/documents/:id', ...docAuth, deleteDocument);
documentsRouter.post('/documents/:id/archive', ...docAuth, archiveDocument);
documentsRouter.get('/documents/:id/versions', ...docAuth, listDocumentVersions);
documentsRouter.post('/documents/:id/versions', ...docAuth, createDocumentVersion);
