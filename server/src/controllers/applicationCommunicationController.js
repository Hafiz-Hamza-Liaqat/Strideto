import { asyncHandler } from '../utils/asyncHandler.js';
import { auditFromRequest } from '../services/auditService.js';
import { hiringOwnerIdFrom } from '../services/employer/employerOrganizationService.js';
import * as CommunicationService from '../services/applicationCommunicationService.js';

function scopeEmployerId(req) {
  return hiringOwnerIdFrom(req);
}

function scopeUserId(req) {
  return req.user?.userId;
}

function auditCtx(req) {
  const base = auditFromRequest(req);
  return { ip: base.ip || '' };
}

export const employerListCommunication = asyncHandler(async (req, res) => {
  const employerId = scopeEmployerId(req);
  await CommunicationService.getOwnedApplicationForEmployer(employerId, req.params.id);
  const data = await CommunicationService.listCommunication(req.params.id, {
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json({ data });
});

export const employerSendMessage = asyncHandler(async (req, res) => {
  CommunicationService.rejectUnexpectedBodyKeys(req.body, ['body', 'message', 'clientMessageId']);
  const employerId = scopeEmployerId(req);
  const result = await CommunicationService.sendEmployerMessage(
    employerId,
    req.params.id,
    req.body,
    auditCtx(req)
  );
  res.status(result.duplicate ? 200 : 201).json({
    data: result.message,
    duplicate: result.duplicate,
    sideEffects: result.sideEffects,
  });
});

export const employerCreateInterviewInvitation = asyncHandler(async (req, res) => {
  CommunicationService.rejectUnexpectedBodyKeys(req.body, [
    'scheduledAt',
    'timeZone',
    'durationMinutes',
    'method',
    'mode',
    'location',
    'meetingUrl',
    'meetingLink',
    'employerNote',
    'notes',
  ]);
  const employerId = scopeEmployerId(req);
  const result = await CommunicationService.createInterviewInvitation(
    employerId,
    req.params.id,
    req.body,
    auditCtx(req)
  );
  res.status(201).json({ data: result });
});

export const employerCancelInterviewInvitation = asyncHandler(async (req, res) => {
  CommunicationService.rejectUnexpectedBodyKeys(req.body, []);
  const employerId = scopeEmployerId(req);
  const result = await CommunicationService.cancelInterviewInvitation(
    employerId,
    req.params.id,
    req.params.invitationId,
    auditCtx(req)
  );
  res.json({ data: result });
});

export const candidateListCommunication = asyncHandler(async (req, res) => {
  const userId = scopeUserId(req);
  const { application } = await CommunicationService.getOwnedApplicationForCandidate(userId, {
    opportunityApplicationId: req.params.id,
  });
  const data = await CommunicationService.listCommunication(application._id, {
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json({ data });
});

export const candidateSendMessage = asyncHandler(async (req, res) => {
  CommunicationService.rejectUnexpectedBodyKeys(req.body, ['body', 'message', 'clientMessageId']);
  const userId = scopeUserId(req);
  const result = await CommunicationService.sendCandidateMessage(
    userId,
    req.params.id,
    req.body,
    auditCtx(req)
  );
  res.status(result.duplicate ? 200 : 201).json({
    data: result.message,
    duplicate: result.duplicate,
    sideEffects: result.sideEffects,
  });
});

export const candidateRespondInterviewInvitation = asyncHandler(async (req, res) => {
  CommunicationService.rejectUnexpectedBodyKeys(req.body, ['response', 'status']);
  const userId = scopeUserId(req);
  const result = await CommunicationService.respondToInterviewInvitation(
    userId,
    req.params.id,
    req.params.invitationId,
    req.body,
    auditCtx(req)
  );
  res.json({ data: result });
});
