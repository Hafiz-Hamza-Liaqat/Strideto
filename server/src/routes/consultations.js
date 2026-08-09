import { Router } from 'express';
import { requireAgentAuth, requireAuth, requireUserAuth } from '../middleware/auth.js';
import * as consultation from '../controllers/consultationController.js';

export const consultationRouter = Router();
const studentAuth = [requireAuth, requireUserAuth];
const agentAuth = [requireAuth, requireAgentAuth];

consultationRouter.get('/consultations/availability/:serviceId', ...studentAuth, consultation.studentAvailability);
consultationRouter.get('/consultations', ...studentAuth, consultation.studentList);
consultationRouter.post('/consultations', ...studentAuth, consultation.createConsultation);
consultationRouter.get('/consultations/:consultationId', ...studentAuth, consultation.studentDetail);
consultationRouter.post('/consultations/:consultationId/transition', ...studentAuth, consultation.studentTransition);
consultationRouter.get('/consultations/threads/:threadId/messages', ...studentAuth, consultation.studentMessages);
consultationRouter.post('/consultations/threads/:threadId/messages', ...studentAuth, consultation.studentSendMessage);
consultationRouter.post('/consultations/threads/:threadId/read', ...studentAuth, consultation.studentMarkRead);

consultationRouter.get('/agent/availability', ...agentAuth, consultation.agentAvailability);
consultationRouter.put('/agent/availability', ...agentAuth, consultation.agentSaveAvailability);
consultationRouter.get('/agent/consultations', ...agentAuth, consultation.agentList);
consultationRouter.get('/agent/consultations/:consultationId', ...agentAuth, consultation.agentDetail);
consultationRouter.post('/agent/consultations/:consultationId/transition', ...agentAuth, consultation.agentTransition);
consultationRouter.get('/agent/consultations/threads/:threadId/messages', ...agentAuth, consultation.agentMessages);
consultationRouter.post('/agent/consultations/threads/:threadId/messages', ...agentAuth, consultation.agentSendMessage);
consultationRouter.post('/agent/consultations/threads/:threadId/read', ...agentAuth, consultation.agentMarkRead);
consultationRouter.get('/agent/consultations/threads/:threadId/document-references/:messageId', ...agentAuth, consultation.agentResolveDocumentReference);
