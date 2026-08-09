import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getBookableAvailability, getOwnAvailability, getStudentConsultation, getAgentConsultation,
  listStudentConsultations, listAgentConsultations, listMessages, markThreadRead,
  requestConsultation, sendMessage, transitionConsultation, upsertAvailability,
  resolveDocumentReference,
} from '../services/consultationService.js';

export const studentAvailability = asyncHandler(async (req, res) => res.json(await getBookableAvailability(req.user.userId, req.params.serviceId)));
export const createConsultation = asyncHandler(async (req, res) => res.status(201).json({ consultation: await requestConsultation(req.user.userId, req.body) }));
export const studentList = asyncHandler(async (req, res) => res.json(await listStudentConsultations(req.user.userId, req.query)));
export const studentDetail = asyncHandler(async (req, res) => res.json(await getStudentConsultation(req.user.userId, req.params.consultationId)));
export const studentTransition = asyncHandler(async (req, res) => res.json({ consultation: await transitionConsultation('student', req.user.userId, req.params.consultationId, req.body) }));
export const studentMessages = asyncHandler(async (req, res) => res.json(await listMessages('student', req.user.userId, req.params.threadId, req.query)));
export const studentSendMessage = asyncHandler(async (req, res) => res.status(201).json({ message: await sendMessage('student', req.user.userId, req.params.threadId, req.body) }));
export const studentMarkRead = asyncHandler(async (req, res) => res.json(await markThreadRead('student', req.user.userId, req.params.threadId)));

export const agentAvailability = asyncHandler(async (req, res) => res.json({ availability: await getOwnAvailability(req.agent.agentAccountId) }));
export const agentSaveAvailability = asyncHandler(async (req, res) => res.json({ availability: await upsertAvailability(req.agent.agentAccountId, req.body) }));
export const agentList = asyncHandler(async (req, res) => res.json(await listAgentConsultations(req.agent.agentAccountId, req.query)));
export const agentDetail = asyncHandler(async (req, res) => res.json(await getAgentConsultation(req.agent.agentAccountId, req.params.consultationId)));
export const agentTransition = asyncHandler(async (req, res) => res.json({ consultation: await transitionConsultation('agent', req.agent.agentAccountId, req.params.consultationId, req.body) }));
export const agentMessages = asyncHandler(async (req, res) => res.json(await listMessages('agent', req.agent.agentAccountId, req.params.threadId, req.query)));
export const agentSendMessage = asyncHandler(async (req, res) => res.status(201).json({ message: await sendMessage('agent', req.agent.agentAccountId, req.params.threadId, req.body) }));
export const agentMarkRead = asyncHandler(async (req, res) => res.json(await markThreadRead('agent', req.agent.agentAccountId, req.params.threadId)));
export const agentResolveDocumentReference = asyncHandler(async (req, res) => res.json(await resolveDocumentReference(req.agent.agentAccountId, req.params.threadId, req.params.messageId)));
