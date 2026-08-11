import { Router } from 'express';
import { requireAuth, requireEmployerAuth } from '../middleware/auth.js';
import { requireEmployerCapability } from '../services/employer/employerOrganizationService.js';
import { EMPLOYER_CAPABILITIES as C } from '../../../shared/employer/team.js';
import {
  requireEmployerIntelligenceEnabled,
  getIntelligenceDashboard,
  listCandidates,
  getCandidateDetail,
  getPipeline,
  transitionPipeline,
  addNote,
  scheduleInterview,
  completeInterview,
  listSavedFilters,
  saveFilter,
  deleteSavedFilter,
  getRankingWeights,
  getTimelineViewer,
  getDocumentViewer,
  getCredentialViewer,
  compareCandidates,
} from '../controllers/career/employerIntelligenceController.js';

export const employerIntelligenceRouter = Router();

const auth = [requireAuth, requireEmployerAuth, requireEmployerIntelligenceEnabled];

employerIntelligenceRouter.get('/employer/intelligence/dashboard', ...auth, getIntelligenceDashboard);
employerIntelligenceRouter.get('/employer/intelligence/candidates', ...auth, listCandidates);
employerIntelligenceRouter.get('/employer/intelligence/candidates/:id', ...auth, getCandidateDetail);
employerIntelligenceRouter.get('/employer/intelligence/pipeline', ...auth, getPipeline);
employerIntelligenceRouter.post('/employer/intelligence/candidates/:id/stage', ...auth, requireEmployerCapability(C.PIPELINE_WRITE), transitionPipeline);
employerIntelligenceRouter.post('/employer/intelligence/candidates/:id/notes', ...auth, requireEmployerCapability(C.PIPELINE_WRITE), addNote);
employerIntelligenceRouter.put('/employer/intelligence/candidates/:id/interview', ...auth, requireEmployerCapability(C.INTERVIEWS_WRITE), scheduleInterview);
employerIntelligenceRouter.post('/employer/intelligence/candidates/:id/interview/complete', ...auth, requireEmployerCapability(C.INTERVIEWS_WRITE), completeInterview);
employerIntelligenceRouter.get('/employer/intelligence/saved-filters', ...auth, listSavedFilters);
employerIntelligenceRouter.post('/employer/intelligence/saved-filters', ...auth, saveFilter);
employerIntelligenceRouter.delete('/employer/intelligence/saved-filters/:id', ...auth, deleteSavedFilter);
employerIntelligenceRouter.get('/employer/intelligence/ranking/weights', ...auth, getRankingWeights);
employerIntelligenceRouter.get('/employer/intelligence/candidates/:id/timeline', ...auth, getTimelineViewer);
employerIntelligenceRouter.get('/employer/intelligence/candidates/:id/documents', ...auth, getDocumentViewer);
employerIntelligenceRouter.get('/employer/intelligence/candidates/:id/credentials', ...auth, getCredentialViewer);
employerIntelligenceRouter.post('/employer/intelligence/candidates/compare', ...auth, compareCandidates);
