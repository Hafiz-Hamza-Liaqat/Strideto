import { Router } from 'express';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import {
  listApplications,
  createApplication,
  getApplication,
  updateApplication,
  archiveApplication,
  transitionApplicationStage,
  addApplicationNote,
  attachApplicationDocument,
  removeApplicationDocument,
  addApplicationReminder,
  updateApplicationReminder,
  removeApplicationReminder,
  listStageTemplatesHandler,
  getApplicationMetrics,
  addApplicationContact,
  removeApplicationContact,
  upsertApplicationInterview,
  requireOpportunityApplicationEnabled,
} from '../controllers/career/opportunityApplicationController.js';
import * as applicationCommunication from '../controllers/applicationCommunicationController.js';
import { applicationCommunicationLimiter } from '../middleware/rateLimit.js';

export const opportunityApplicationsRouter = Router();

const appAuth = [...studentProductAuth, requireOpportunityApplicationEnabled];

opportunityApplicationsRouter.get('/applications/stage-templates', ...appAuth, listStageTemplatesHandler);
opportunityApplicationsRouter.get('/applications/metrics', ...appAuth, getApplicationMetrics);
opportunityApplicationsRouter.get('/applications', ...appAuth, listApplications);
opportunityApplicationsRouter.post('/applications', ...appAuth, createApplication);
opportunityApplicationsRouter.get('/applications/:id', ...appAuth, getApplication);
opportunityApplicationsRouter.patch('/applications/:id', ...appAuth, updateApplication);
opportunityApplicationsRouter.delete('/applications/:id', ...appAuth, archiveApplication);
opportunityApplicationsRouter.post('/applications/:id/stage', ...appAuth, transitionApplicationStage);
opportunityApplicationsRouter.post('/applications/:id/notes', ...appAuth, addApplicationNote);
opportunityApplicationsRouter.post('/applications/:id/documents', ...appAuth, attachApplicationDocument);
opportunityApplicationsRouter.delete('/applications/:id/documents/:documentId', ...appAuth, removeApplicationDocument);
opportunityApplicationsRouter.post('/applications/:id/reminders', ...appAuth, addApplicationReminder);
opportunityApplicationsRouter.patch('/applications/:id/reminders/:reminderId', ...appAuth, updateApplicationReminder);
opportunityApplicationsRouter.delete('/applications/:id/reminders/:reminderId', ...appAuth, removeApplicationReminder);
opportunityApplicationsRouter.post('/applications/:id/contacts', ...appAuth, addApplicationContact);
opportunityApplicationsRouter.delete('/applications/:id/contacts/:contactId', ...appAuth, removeApplicationContact);
opportunityApplicationsRouter.put('/applications/:id/interview', ...appAuth, upsertApplicationInterview);
opportunityApplicationsRouter.get(
  '/applications/:id/communication',
  ...appAuth,
  applicationCommunication.candidateListCommunication
);
opportunityApplicationsRouter.post(
  '/applications/:id/communication/messages',
  ...appAuth,
  applicationCommunicationLimiter,
  applicationCommunication.candidateSendMessage
);
opportunityApplicationsRouter.post(
  '/applications/:id/communication/interview-invitations/:invitationId/respond',
  ...appAuth,
  applicationCommunicationLimiter,
  applicationCommunication.candidateRespondInterviewInvitation
);
