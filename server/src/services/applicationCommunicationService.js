/**
 * MKT-P4 — application-scoped employer/candidate communication.
 * Authorization always traverses Application → Job → Employer / Candidate.
 */
import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { ApplicationMessage } from '../models/ApplicationMessage.js';
import { ApplicationInterviewInvitation } from '../models/ApplicationInterviewInvitation.js';
import { ApplicationOffer } from '../models/ApplicationOffer.js';
import { OpportunityApplicationRepository } from '../repositories/career/OpportunityApplicationRepository.js';
import { resolveJobApplyType } from './employerApplicationCounts.js';
import { syncOpportunityApplicationFromLegacyStatus } from './employerOpportunityApplicationSync.js';
import { sanitizeString } from '../utils/sanitize.js';
import { formatAppointmentTime, normalizeTimeZone } from '../utils/appointmentTime.js';
import { validateInterviewMeetingUrl } from '../utils/interviewMeetingUrl.js';
import {
  APPLICATION_COMMUNICATION_MAX_PAGE_SIZE,
  APPLICATION_COMMUNICATION_PAGE_SIZE,
  APPLICATION_MESSAGE_MAX_LENGTH,
  APPLICATION_MESSAGE_MIN_LENGTH,
  INTERVIEW_EMPLOYER_NOTE_MAX_LENGTH,
  INTERVIEW_INVITATION_MAX_DURATION_MINUTES,
  INTERVIEW_INVITATION_METHODS,
  INTERVIEW_INVITATION_MIN_DURATION_MINUTES,
} from '../../../shared/employer/applicationCommunication.js';
import { queueNotification, queueEmail, interviewInvitationDedupKey } from './automationService.js';
import { createUserNotificationOnce } from './notificationService.js';
import { logAudit } from './auditService.js';
import { emitCareerEvent } from './career/CareerEventBus.js';
import { canTransition } from '../../../shared/career/applicationStageMachine.js';
import { serializeOffer } from '../utils/applicationOfferView.js';
import { persistExpiredSentOffers } from '../utils/applicationOfferLifecycle.js';

const ZONE_LESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

function notFoundError() {
  const err = new Error('Application not found');
  err.status = 404;
  return err;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function parseScheduledAt(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const normalized = ZONE_LESS_DATE_TIME.test(raw) ? `${raw}Z` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimeZone(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return normalizeTimeZone(raw);
}

function normalizeMessageBody(body) {
  const text = sanitizeString(body || '').slice(0, APPLICATION_MESSAGE_MAX_LENGTH);
  if (text.length < APPLICATION_MESSAGE_MIN_LENGTH) {
    throw badRequest('Message cannot be empty');
  }
  return text;
}

function normalizeClientMessageId(value) {
  const id = sanitizeString(value || '').slice(0, 128);
  return id || null;
}

function isDuplicateKeyError(err) {
  return err?.code === 11000;
}

async function loadApplicationWithJob(applicationId) {
  if (!applicationId || !mongoose.isValidObjectId(String(applicationId))) return null;
  return Application.findById(applicationId).populate('jobId').populate('userId', 'name email').lean();
}

function assertInternalJobApplication(application) {
  if (!application?.jobId) throw notFoundError();
  if (resolveJobApplyType(application.jobId) === 'external') {
    throw notFoundError();
  }
}

export async function getOwnedApplicationForEmployer(employerId, applicationId) {
  const application = await loadApplicationWithJob(applicationId);
  if (!application || application.jobId?.employerId?.toString() !== String(employerId)) {
    throw notFoundError();
  }
  assertInternalJobApplication(application);
  return application;
}

export async function getOwnedApplicationForCandidate(userId, { legacyApplicationId, opportunityApplicationId }) {
  if (legacyApplicationId) {
    const application = await loadApplicationWithJob(legacyApplicationId);
    if (!application) throw notFoundError();
    const candidateId = application.userId?._id || application.userId;
    if (String(candidateId) !== String(userId)) throw notFoundError();
    assertInternalJobApplication(application);
    return { application, opportunityApplication: null };
  }

  if (!opportunityApplicationId || !mongoose.isValidObjectId(String(opportunityApplicationId))) {
    throw notFoundError();
  }
  const oa = await OpportunityApplicationRepository.findByIdForUser(opportunityApplicationId, userId);
  if (!oa?.legacyApplicationId) throw notFoundError();
  const application = await loadApplicationWithJob(oa.legacyApplicationId);
  if (!application) throw notFoundError();
  assertInternalJobApplication(application);
  return { application, opportunityApplication: oa };
}

function serializeMessage(doc) {
  return {
    _id: doc._id,
    senderRole: doc.senderRole,
    messageType: doc.messageType,
    body: doc.body,
    interviewInvitationId: doc.interviewInvitationId || null,
    applicationOfferId: doc.applicationOfferId || null,
    createdAt: doc.createdAt,
  };
}

function serializeInvitation(doc) {
  if (!doc) return null;
  return {
    _id: doc._id,
    scheduledAt: doc.scheduledAt,
    timeZone: doc.timeZone,
    durationMinutes: doc.durationMinutes ?? null,
    method: doc.method,
    location: doc.location || '',
    meetingUrl: doc.meetingUrl || '',
    employerNote: doc.employerNote || '',
    status: doc.status,
    respondedAt: doc.respondedAt || null,
    cancelledAt: doc.cancelledAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listCommunication(applicationId, { page = 1, limit = APPLICATION_COMMUNICATION_PAGE_SIZE } = {}) {
  const safeLimit = Math.min(
    Math.max(1, Number(limit) || APPLICATION_COMMUNICATION_PAGE_SIZE),
    APPLICATION_COMMUNICATION_MAX_PAGE_SIZE
  );
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;

  await persistExpiredSentOffers(applicationId);

  const [messages, total, activeInvitation, activeOffer] = await Promise.all([
    ApplicationMessage.find({ applicationId })
      .sort({ createdAt: 1, _id: 1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    ApplicationMessage.countDocuments({ applicationId }),
    ApplicationInterviewInvitation.findOne({
      applicationId,
      status: { $in: ['pending', 'accepted'] },
      supersededBy: null,
    })
      .sort({ createdAt: -1 })
      .lean(),
    ApplicationOffer.findOne({
      applicationId,
      status: { $in: ['sent', 'accepted', 'declined'] },
      supersededBy: null,
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const invitationIds = messages
    .map((m) => m.interviewInvitationId)
    .filter(Boolean);
  const offerIds = messages.map((m) => m.applicationOfferId).filter(Boolean);
  const invitationsById = new Map();
  const offersById = new Map();
  if (invitationIds.length) {
    const rows = await ApplicationInterviewInvitation.find({ _id: { $in: invitationIds } }).lean();
    for (const row of rows) invitationsById.set(String(row._id), serializeInvitation(row));
  }
  if (offerIds.length) {
    const rows = await ApplicationOffer.find({ _id: { $in: offerIds } }).lean();
    for (const row of rows) offersById.set(String(row._id), serializeOffer(row));
  }

  return {
    messages: messages.map((m) => ({
      ...serializeMessage(m),
      interviewInvitation: m.interviewInvitationId
        ? invitationsById.get(String(m.interviewInvitationId)) || null
        : null,
      applicationOffer: m.applicationOfferId
        ? offersById.get(String(m.applicationOfferId)) || null
        : null,
    })),
    activeInterviewInvitation: serializeInvitation(activeInvitation),
    activeOffer: serializeOffer(activeOffer),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: skip + messages.length < total,
    },
    communicationSupported: true,
  };
}

async function queueInterviewInvitationEmail(application, payload) {
  const userEmail = application.userId?.email;
  if (!userEmail) return false;

  try {
    const appointment = {
      when: payload.scheduledAt,
      mode: payload.method,
      link: payload.meetingUrl,
      location: payload.location,
      timeZone: payload.timeZone,
    };
    const whenLabel = formatAppointmentTime(payload.scheduledAt, payload.timeZone);
    const emailResult = await queueEmail({
      to: userEmail,
      templateKey: 'interviewInvitation',
      vars: {
        name: application.userId?.name || '',
        jobTitle: application.jobId?.title || 'Job',
        when: payload.scheduledAt,
        whenLabel: whenLabel?.text || '',
        timeZone: whenLabel?.zone || '',
        link: payload.meetingUrl,
        mode: payload.method,
        location: payload.location,
      },
      dedupKey: interviewInvitationDedupKey(String(application._id), appointment),
    });
    return Boolean(emailResult?.enqueued);
  } catch {
    return false;
  }
}

async function notifyCandidateMessage({ application, opportunityApplicationId, messageId }) {
  const userId = application.userId?._id || application.userId;
  const jobTitle = application.jobId?.title || 'your application';
  const link = opportunityApplicationId
    ? `/applications/${opportunityApplicationId}`
    : '/dashboard';

  const notificationResult = await queueNotification({
    dedupeKey: `application:message:${application._id}:${messageId}`,
    recipientType: 'user',
    userId,
    category: 'message',
    type: 'application.message',
    title: `New message about ${jobTitle}`,
    body: 'You have a new message from the employer about your application on STRIDETO.',
    link,
    metadata: { applicationId: String(application._id), messageId: String(messageId) },
  });

  const userEmail = application.userId?.email;
  let emailQueued = false;
  if (userEmail) {
    const emailResult = await queueEmail({
      to: userEmail,
      templateKey: 'applicationCommunication',
      vars: {
        name: application.userId?.name || '',
        jobTitle,
        signInUrl: `${process.env.SITE_URL || process.env.FRONTEND_URL || ''}/applications/${opportunityApplicationId || ''}`,
      },
      dedupKey: `email:app-msg:${application._id}:${messageId}`,
    });
    emailQueued = Boolean(emailResult?.enqueued);
  }

  return {
    notificationCreated: Boolean(notificationResult?.created),
    emailQueued,
  };
}

async function notifyEmployerMessageReply({ application, employerId, messageId }) {
  const jobTitle = application.jobId?.title || 'a job';
  const result = await queueNotification({
    dedupeKey: `application:employer-reply:${application._id}:${messageId}`,
    recipientType: 'employer',
    employerId,
    category: 'message',
    type: 'application.candidate_reply',
    title: `Candidate replied: ${jobTitle}`,
    body: 'A candidate sent a message about their application on STRIDETO.',
    link: `/employer/applications/${application._id}`,
    metadata: { applicationId: String(application._id), messageId: String(messageId) },
  });
  return { notificationCreated: Boolean(result?.created) };
}

async function persistMessage({
  applicationId,
  senderRole,
  senderId,
  messageType,
  body,
  clientMessageId,
  interviewInvitationId,
}) {
  try {
    const doc = await ApplicationMessage.create({
      applicationId,
      senderRole,
      senderId,
      messageType,
      body,
      clientMessageId,
      interviewInvitationId: interviewInvitationId || null,
    });
    return { message: doc, duplicate: false };
  } catch (err) {
    if (!clientMessageId || !isDuplicateKeyError(err)) throw err;
    const existing = await ApplicationMessage.findOne({ applicationId, clientMessageId }).lean();
    if (!existing) throw err;
    return { message: existing, duplicate: true };
  }
}

export async function sendEmployerMessage(employerId, applicationId, body = {}, auditContext = {}) {
  const application = await getOwnedApplicationForEmployer(employerId, applicationId);
  const text = normalizeMessageBody(body.body ?? body.message);
  const clientMessageId = normalizeClientMessageId(body.clientMessageId);

  const { message, duplicate } = await persistMessage({
    applicationId: application._id,
    senderRole: 'employer',
    senderId: employerId,
    messageType: 'message',
    body: text,
    clientMessageId,
  });

  if (duplicate) {
    return {
      message: serializeMessage(message),
      duplicate: true,
      sideEffects: { notificationCreated: false, emailQueued: false },
    };
  }

  const oa = await OpportunityApplicationRepository.findByLegacyApplicationId(application._id);
  const sideEffects = await notifyCandidateMessage({
    application,
    opportunityApplicationId: oa?._id ? String(oa._id) : null,
    messageId: message._id,
  }).catch(() => ({ notificationCreated: false, emailQueued: false }));

  await logAudit({
    actor: { employerId, role: 'employer' },
    action: 'application.message.sent',
    targetType: 'application',
    targetId: application._id,
    ip: auditContext.ip || '',
    metadata: {
      senderRole: 'employer',
      messageType: 'message',
      messageId: String(message._id),
    },
  });

  return {
    message: serializeMessage(message),
    duplicate: false,
    sideEffects,
  };
}

export async function sendCandidateMessage(userId, opportunityApplicationId, body = {}, auditContext = {}) {
  const { application, opportunityApplication } = await getOwnedApplicationForCandidate(userId, {
    opportunityApplicationId,
  });
  const text = normalizeMessageBody(body.body ?? body.message);
  const clientMessageId = normalizeClientMessageId(body.clientMessageId);

  const { message, duplicate } = await persistMessage({
    applicationId: application._id,
    senderRole: 'candidate',
    senderId: userId,
    messageType: 'message',
    body: text,
    clientMessageId,
  });

  if (duplicate) {
    return {
      message: serializeMessage(message),
      duplicate: true,
      sideEffects: { notificationCreated: false },
    };
  }

  const employerId = application.jobId?.employerId?._id || application.jobId?.employerId;
  const sideEffects = employerId
    ? await notifyEmployerMessageReply({
        application,
        employerId,
        messageId: message._id,
      }).catch(() => ({ notificationCreated: false }))
    : { notificationCreated: false };

  await logAudit({
    actor: { userId, role: 'student' },
    action: 'application.message.sent',
    targetType: 'application',
    targetId: application._id,
    ip: auditContext.ip || '',
    metadata: {
      senderRole: 'candidate',
      messageType: 'message',
      messageId: String(message._id),
      opportunityApplicationId: opportunityApplication?._id ? String(opportunityApplication._id) : null,
    },
  });

  return {
    message: serializeMessage(message),
    duplicate: false,
    sideEffects,
  };
}

async function syncInterviewToPipeline(application, employerId, interviewPatch) {
  const oa = await OpportunityApplicationRepository.findByLegacyApplicationId(application._id);
  if (oa) {
    await OpportunityApplicationRepository.patchInterview(oa._id, interviewPatch);
    if (oa.pipelineStage !== 'interview' && canTransition(oa.stageTemplateId || 'job_default', oa.pipelineStage, 'interview')) {
      await OpportunityApplicationRepository.pushStageHistory(oa._id, {
        fromStage: oa.pipelineStage,
        toStage: 'interview',
        at: new Date(),
        byActorType: 'employer',
        byActorId: String(employerId),
        reason: 'interview_invitation',
        metadata: { source: 'mkt_p4' },
      });
    }
  }

  const previousStatus = application.status;
  if (previousStatus !== 'interview' && previousStatus !== 'hired') {
    await Application.updateOne({ _id: application._id }, { $set: { status: 'interview' } });
    await syncOpportunityApplicationFromLegacyStatus(
      { _id: application._id },
      {
        employerId,
        previousStatus,
        newStatus: 'interview',
        reason: 'interview_invitation',
      }
    );
  }
}

function validateInterviewPayload(body) {
  const scheduledAt = parseScheduledAt(body.scheduledAt);
  if (!scheduledAt) throw badRequest('scheduledAt is required and must be a valid datetime');
  const minLeadMs = 5 * 60 * 1000;
  if (scheduledAt.getTime() < Date.now() + minLeadMs) {
    throw badRequest('Interview must be scheduled at least 5 minutes in the future');
  }

  const timeZone = parseTimeZone(body.timeZone);
  if (!timeZone) throw badRequest('timeZone must be a valid IANA timezone identifier');

  const method = sanitizeString(body.method || body.mode || 'video') || 'video';
  if (!INTERVIEW_INVITATION_METHODS.includes(method)) {
    throw badRequest(`method must be one of: ${INTERVIEW_INVITATION_METHODS.join(', ')}`);
  }

  let durationMinutes = null;
  if (body.durationMinutes !== undefined && body.durationMinutes !== null && body.durationMinutes !== '') {
    durationMinutes = Number(body.durationMinutes);
    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes < INTERVIEW_INVITATION_MIN_DURATION_MINUTES ||
      durationMinutes > INTERVIEW_INVITATION_MAX_DURATION_MINUTES
    ) {
      throw badRequest(
        `durationMinutes must be between ${INTERVIEW_INVITATION_MIN_DURATION_MINUTES} and ${INTERVIEW_INVITATION_MAX_DURATION_MINUTES}`
      );
    }
  }

  const location = sanitizeString(body.location || '').slice(0, 500);
  const employerNote = sanitizeString(body.employerNote || body.notes || '').slice(0, INTERVIEW_EMPLOYER_NOTE_MAX_LENGTH);

  let meetingUrl = '';
  if (method === 'video') {
    const urlResult = validateInterviewMeetingUrl(body.meetingUrl || body.meetingLink || '');
    if (!urlResult.ok) throw badRequest(urlResult.error);
    meetingUrl = urlResult.url;
    if (!meetingUrl) throw badRequest('meetingUrl is required for video interviews');
  } else if (body.meetingUrl !== undefined || body.meetingLink !== undefined) {
    const urlResult = validateInterviewMeetingUrl(body.meetingUrl || body.meetingLink || '');
    if (!urlResult.ok) throw badRequest(urlResult.error);
    meetingUrl = urlResult.url;
  }

  if (method === 'in_person' && !location.trim()) {
    throw badRequest('location is required for in-person interviews');
  }

  return {
    scheduledAt,
    timeZone,
    durationMinutes,
    method,
    location,
    meetingUrl,
    employerNote,
  };
}

async function cancelActiveInvitations(applicationId, supersededBy = null) {
  await ApplicationInterviewInvitation.updateMany(
    {
      applicationId,
      status: { $in: ['pending', 'accepted'] },
      supersededBy: null,
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        ...(supersededBy ? { supersededBy } : {}),
      },
    }
  );
}

export async function createInterviewInvitation(employerId, applicationId, body = {}, auditContext = {}) {
  const application = await getOwnedApplicationForEmployer(employerId, applicationId);
  const payload = validateInterviewPayload(body);

  await cancelActiveInvitations(application._id);

  const invitation = await ApplicationInterviewInvitation.create({
    applicationId: application._id,
    scheduledAt: payload.scheduledAt,
    timeZone: payload.timeZone,
    durationMinutes: payload.durationMinutes,
    method: payload.method,
    location: payload.location,
    meetingUrl: payload.meetingUrl,
    employerNote: payload.employerNote,
    status: 'pending',
    createdByEmployerId: employerId,
  });

  const systemBody = 'Interview invitation sent';
  const { message } = await persistMessage({
    applicationId: application._id,
    senderRole: 'system',
    senderId: null,
    messageType: 'interview_invitation',
    body: systemBody,
    interviewInvitationId: invitation._id,
  });

  await syncInterviewToPipeline(application, employerId, {
    scheduledAt: payload.scheduledAt,
    timeZone: payload.timeZone,
    mode: payload.method,
    location: payload.location,
    meetingUrl: payload.meetingUrl,
    notes: payload.employerNote,
  });

  const oa = await OpportunityApplicationRepository.findByLegacyApplicationId(application._id);
  const userId = application.userId?._id || application.userId;

  const emailQueued = await queueInterviewInvitationEmail(application, payload);

  await createUserNotificationOnce({
    dedupeKey: `application:interview-invite:${invitation._id}`,
    recipientType: 'user',
    userId,
    category: 'interview',
    type: 'application.interview_invitation',
    title: `Interview invitation: ${application.jobId?.title || 'Job'}`,
    body: 'You have an interview invitation regarding your application on STRIDETO.',
    link: oa?._id ? `/applications/${oa._id}` : '/dashboard',
    metadata: {
      applicationId: String(application._id),
      invitationId: String(invitation._id),
    },
  }).catch(() => {});

  emitCareerEvent(
    'InterviewScheduled',
    {
      candidateUserId: String(userId),
      legacyApplicationId: String(application._id),
      opportunityApplicationId: oa?._id ? String(oa._id) : null,
      scheduledAt: payload.scheduledAt,
      timeZone: payload.timeZone,
      mode: payload.method,
      location: payload.location,
    },
    { type: 'employer', id: String(employerId) },
    { aggregateId: application._id }
  );

  await logAudit({
    actor: { employerId, role: 'employer' },
    action: 'application.interview_invitation.created',
    targetType: 'application',
    targetId: application._id,
    ip: auditContext.ip || '',
    metadata: {
      invitationId: String(invitation._id),
      method: payload.method,
    },
  });

  return {
    invitation: serializeInvitation(invitation),
    message: serializeMessage(message),
    emailQueued,
  };
}

export async function cancelInterviewInvitation(employerId, applicationId, invitationId, auditContext = {}) {
  await getOwnedApplicationForEmployer(employerId, applicationId);
  const invitation = await ApplicationInterviewInvitation.findOne({
    _id: invitationId,
    applicationId,
  });
  if (!invitation) throw notFoundError();
  if (invitation.status === 'cancelled') {
    return { invitation: serializeInvitation(invitation), changed: false };
  }

  invitation.status = 'cancelled';
  invitation.cancelledAt = new Date();
  await invitation.save();

  await persistMessage({
    applicationId,
    senderRole: 'system',
    senderId: null,
    messageType: 'system',
    body: 'Interview invitation cancelled',
    interviewInvitationId: invitation._id,
  });

  const oa = await OpportunityApplicationRepository.findByLegacyApplicationId(applicationId);
  const userId = (await loadApplicationWithJob(applicationId))?.userId?._id;
  if (userId) {
    await createUserNotificationOnce({
      dedupeKey: `application:interview-cancel:${invitation._id}`,
      recipientType: 'user',
      userId,
      category: 'interview',
      type: 'application.interview_cancelled',
      title: 'Interview invitation updated',
      body: 'An interview invitation for your application was cancelled.',
      link: oa?._id ? `/applications/${oa._id}` : '/dashboard',
      metadata: { invitationId: String(invitation._id) },
    }).catch(() => {});
  }

  await logAudit({
    actor: { employerId, role: 'employer' },
    action: 'application.interview_invitation.cancelled',
    targetType: 'application',
    targetId: applicationId,
    ip: auditContext.ip || '',
    metadata: { invitationId: String(invitation._id) },
  });

  return { invitation: serializeInvitation(invitation), changed: true };
}

export async function respondToInterviewInvitation(
  userId,
  opportunityApplicationId,
  invitationId,
  body = {},
  auditContext = {}
) {
  const { application, opportunityApplication } = await getOwnedApplicationForCandidate(userId, {
    opportunityApplicationId,
  });

  const ALLOWED = new Set(['accepted', 'declined']);
  const response = sanitizeString(body.response || body.status || '');
  if (!ALLOWED.has(response)) {
    throw badRequest('response must be accepted or declined');
  }

  const invitation = await ApplicationInterviewInvitation.findOne({
    _id: invitationId,
    applicationId: application._id,
  });
  if (!invitation) throw notFoundError();
  if (invitation.status !== 'pending') {
    throw badRequest('This interview invitation can no longer be responded to');
  }

  invitation.status = response;
  invitation.respondedAt = new Date();
  await invitation.save();

  const systemBody = response === 'accepted' ? 'Interview accepted' : 'Interview declined';
  await persistMessage({
    applicationId: application._id,
    senderRole: 'system',
    senderId: null,
    messageType: 'system',
    body: systemBody,
    interviewInvitationId: invitation._id,
  });

  const employerId = application.jobId?.employerId?._id || application.jobId?.employerId;
  if (employerId) {
    await createUserNotificationOnce({
      dedupeKey: `application:interview-response:${invitation._id}:${response}`,
      recipientType: 'employer',
      employerId,
      category: 'interview',
      type: `application.interview_${response}`,
      title: `Interview ${response}: ${application.jobId?.title || 'application'}`,
      body: `The candidate ${response === 'accepted' ? 'accepted' : 'declined'} the interview invitation.`,
      link: `/employer/applications/${application._id}`,
      metadata: {
        invitationId: String(invitation._id),
        response,
      },
    }).catch(() => {});
  }

  await logAudit({
    actor: { userId, role: 'student' },
    action: 'application.interview_invitation.responded',
    targetType: 'application',
    targetId: application._id,
    ip: auditContext.ip || '',
    metadata: {
      invitationId: String(invitation._id),
      response,
      opportunityApplicationId: opportunityApplication?._id ? String(opportunityApplication._id) : null,
    },
  });

  return { invitation: serializeInvitation(invitation) };
}

export function rejectUnexpectedBodyKeys(body, allowedKeys) {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(body || {}).filter(
    (key) => body[key] !== undefined && !allowed.has(key)
  );
  if (unexpected.length) {
    throw badRequest(`Unexpected fields: ${unexpected.join(', ')}`);
  }
}
