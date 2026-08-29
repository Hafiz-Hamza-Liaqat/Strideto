/**
 * MKT-P5 — application-scoped job offer workflow.
 * Authorization always traverses Application → Job → Employer / Candidate.
 */
import mongoose from 'mongoose';
import { ApplicationOffer } from '../models/ApplicationOffer.js';
import { ApplicationMessage } from '../models/ApplicationMessage.js';
import { OpportunityApplicationRepository } from '../repositories/career/OpportunityApplicationRepository.js';
import { sanitizeString } from '../utils/sanitize.js';
import {
  OFFER_COMPENSATION_MAX_LENGTH,
  OFFER_EMPLOYMENT_TYPES,
  OFFER_NOTE_MAX_LENGTH,
  OFFER_RESPONDABLE_STATUSES,
  OFFER_WORK_MODES,
} from '../../../shared/employer/applicationOffer.js';
import {
  getOwnedApplicationForEmployer,
  getOwnedApplicationForCandidate,
} from './applicationCommunicationService.js';
import { queueEmail } from './automationService.js';
import { createUserNotificationOnce } from './notificationService.js';
import { logAudit } from './auditService.js';
import { emitCareerEvent } from './career/CareerEventBus.js';
import { deriveEffectiveOfferStatus, serializeOffer } from '../utils/applicationOfferView.js';
import {
  countActiveSentOffers as countActiveSentOffersDb,
  persistExpiredSentOffers,
} from '../utils/applicationOfferLifecycle.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

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

function isDuplicateKeyError(err) {
  return err?.code === 11000;
}

function isClientCommandDuplicateError(err) {
  if (!isDuplicateKeyError(err)) return false;
  const msg = String(err?.message || '');
  return msg.includes('clientCommandId') || msg.includes('application_offer_client_idempotency_unique');
}

function conflictError(message) {
  const err = new Error(message);
  err.status = 409;
  return err;
}

function isActiveSentDuplicateError(err) {
  if (!isDuplicateKeyError(err)) return false;
  const msg = String(err?.message || '');
  return msg.includes('application_offer_active_sent_unique') || msg.includes('applicationId_1');
}

function normalizeClientCommandId(value) {
  const id = sanitizeString(value || '').slice(0, 128);
  return id || null;
}

function parseDateOnly(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (DATE_ONLY.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseExpiresAt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(String(value).trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function validateOfferPayload(body) {
  const startDate = parseDateOnly(body.startDate);
  if (body.startDate !== undefined && body.startDate !== null && body.startDate !== '' && !startDate) {
    throw badRequest('startDate must be a valid date');
  }

  const expiresAt = parseExpiresAt(body.expiresAt);
  if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== '' && !expiresAt) {
    throw badRequest('expiresAt must be a valid datetime');
  }
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw badRequest('expiresAt must be in the future');
  }

  let employmentType = null;
  if (body.employmentType !== undefined && body.employmentType !== null && body.employmentType !== '') {
    employmentType = sanitizeString(body.employmentType);
    if (!OFFER_EMPLOYMENT_TYPES.includes(employmentType)) {
      throw badRequest(`employmentType must be one of: ${OFFER_EMPLOYMENT_TYPES.join(', ')}`);
    }
  }

  let workMode = null;
  if (body.workMode !== undefined && body.workMode !== null && body.workMode !== '') {
    workMode = sanitizeString(body.workMode);
    if (!OFFER_WORK_MODES.includes(workMode)) {
      throw badRequest(`workMode must be one of: ${OFFER_WORK_MODES.join(', ')}`);
    }
  }

  const compensationText = sanitizeString(body.compensationText || body.compensation || '').slice(
    0,
    OFFER_COMPENSATION_MAX_LENGTH
  );
  const offerNote = sanitizeString(body.offerNote || body.note || '').slice(0, OFFER_NOTE_MAX_LENGTH);

  return {
    startDate,
    expiresAt,
    employmentType,
    workMode,
    compensationText,
    offerNote,
  };
}

async function persistOfferSystemMessage(applicationId, body, applicationOfferId) {
  return ApplicationMessage.create({
    applicationId,
    senderRole: 'system',
    senderId: null,
    messageType: 'system',
    body,
    applicationOfferId,
  });
}

async function withdrawActiveSentOffers(applicationId, supersededBy = null) {
  const now = new Date();
  await ApplicationOffer.updateMany(
    {
      applicationId,
      status: 'sent',
      supersededBy: null,
    },
    {
      $set: {
        status: 'withdrawn',
        withdrawnAt: now,
        ...(supersededBy ? { supersededBy } : {}),
      },
    }
  );
}

async function queueOfferNotificationEmail(application, opportunityApplicationId, offerId) {
  const userEmail = application.userId?.email;
  if (!userEmail) return false;

  try {
    const jobTitle = application.jobId?.title || 'your application';
    const signInUrl = opportunityApplicationId
      ? `${process.env.SITE_URL || process.env.FRONTEND_URL || ''}/applications/${opportunityApplicationId}`
      : `${process.env.SITE_URL || process.env.FRONTEND_URL || ''}/dashboard`;
    const emailResult = await queueEmail({
      to: userEmail,
      templateKey: 'applicationOffer',
      vars: {
        name: application.userId?.name || '',
        jobTitle,
        signInUrl,
      },
      dedupKey: `email:app-offer:${application._id}:${String(offerId)}`,
    });
    return Boolean(emailResult?.enqueued);
  } catch {
    return false;
  }
}

export async function findActiveOffer(applicationId) {
  await persistExpiredSentOffers(applicationId);
  const row = await ApplicationOffer.findOne({
    applicationId,
    status: { $in: ['sent', 'accepted', 'declined'] },
    supersededBy: null,
  })
    .sort({ createdAt: -1 })
    .lean();
  return row;
}

export async function countActiveSentOffers(applicationId) {
  return countActiveSentOffersDb(applicationId);
}

export async function listOffersForApplication(applicationId) {
  const rows = await ApplicationOffer.find({ applicationId }).sort({ createdAt: -1 }).lean();
  return rows.map((row) => serializeOffer(row));
}

export async function sendApplicationOffer(employerId, applicationId, body = {}, auditContext = {}) {
  const application = await getOwnedApplicationForEmployer(employerId, applicationId);
  const payload = validateOfferPayload(body);
  const clientCommandId = normalizeClientCommandId(body.clientCommandId);

  if (clientCommandId) {
    const existing = await ApplicationOffer.findOne({ applicationId, clientCommandId }).lean();
    if (existing) {
      return {
        offer: serializeOffer(existing),
        duplicate: true,
        sideEffects: { notificationCreated: false, emailQueued: false },
      };
    }
  }

  await persistExpiredSentOffers(application._id);
  await withdrawActiveSentOffers(application._id);

  let offer;
  try {
    offer = await ApplicationOffer.create({
      applicationId: application._id,
      status: 'sent',
      startDate: payload.startDate,
      employmentType: payload.employmentType,
      workMode: payload.workMode,
      compensationText: payload.compensationText,
      offerNote: payload.offerNote,
      expiresAt: payload.expiresAt,
      createdByEmployerId: employerId,
      clientCommandId,
    });
  } catch (err) {
    if (clientCommandId && isClientCommandDuplicateError(err)) {
      const existing = await ApplicationOffer.findOne({ applicationId, clientCommandId }).lean();
      if (existing) {
        return {
          offer: serializeOffer(existing),
          duplicate: true,
          sideEffects: { notificationCreated: false, emailQueued: false },
        };
      }
    }
    if (isActiveSentDuplicateError(err)) {
      throw conflictError(
        'An active offer already exists for this application. Refresh and try again if you intended to replace it.'
      );
    }
    throw err;
  }

  const message = await persistOfferSystemMessage(application._id, 'Offer sent', offer._id);

  const oa = await OpportunityApplicationRepository.findByLegacyApplicationId(application._id);
  const userId = application.userId?._id || application.userId;

  await createUserNotificationOnce({
    dedupeKey: `application:offer-sent:${offer._id}`,
    recipientType: 'user',
    userId,
    category: 'application',
    type: 'application.offer_sent',
    title: 'You have received an offer',
    body: 'You have received an offer for your STRIDETO application.',
    link: oa?._id ? `/applications/${oa._id}` : '/dashboard',
    metadata: {
      applicationId: String(application._id),
      offerId: String(offer._id),
    },
  }).catch(() => {});

  const emailQueued = await queueOfferNotificationEmail(
    application,
    oa?._id ? String(oa._id) : null,
    offer._id
  );

  emitCareerEvent(
    'OfferSent',
    {
      candidateUserId: String(userId),
      legacyApplicationId: String(application._id),
      opportunityApplicationId: oa?._id ? String(oa._id) : null,
      hasStartDate: Boolean(payload.startDate),
      hasCompensation: Boolean(payload.compensationText),
    },
    { type: 'employer', id: String(employerId) },
    { aggregateId: application._id }
  );

  await logAudit({
    actor: { employerId, role: 'employer' },
    action: 'offer.sent',
    targetType: 'application',
    targetId: application._id,
    ip: auditContext.ip || '',
    metadata: {
      offerId: String(offer._id),
      hasStartDate: Boolean(payload.startDate),
      hasCompensation: Boolean(payload.compensationText),
      messageId: String(message._id),
    },
  });

  return {
    offer: serializeOffer(offer),
    duplicate: false,
    sideEffects: {
      notificationCreated: true,
      emailQueued,
    },
  };
}

export async function withdrawApplicationOffer(employerId, applicationId, offerId, auditContext = {}) {
  await getOwnedApplicationForEmployer(employerId, applicationId);

  if (!offerId || !mongoose.isValidObjectId(String(offerId))) throw notFoundError();

  const offer = await ApplicationOffer.findOne({ _id: offerId, applicationId });
  if (!offer) throw notFoundError();

  if (offer.status !== 'sent') {
    throw badRequest('Only a sent offer can be withdrawn');
  }
  await persistExpiredSentOffers(applicationId);
  if (deriveEffectiveOfferStatus(offer) === 'expired' || offer.status === 'expired') {
    throw badRequest('This offer has expired and cannot be withdrawn');
  }

  if (offer.status === 'withdrawn') {
    return { offer: serializeOffer(offer), changed: false };
  }

  offer.status = 'withdrawn';
  offer.withdrawnAt = new Date();
  await offer.save();

  await persistOfferSystemMessage(applicationId, 'Offer withdrawn', offer._id);

  const application = await getOwnedApplicationForEmployer(employerId, applicationId);
  const oa = await OpportunityApplicationRepository.findByLegacyApplicationId(applicationId);
  const userId = application.userId?._id || application.userId;

  await createUserNotificationOnce({
    dedupeKey: `application:offer-withdrawn:${offer._id}`,
    recipientType: 'user',
    userId,
    category: 'application',
    type: 'application.offer_withdrawn',
    title: 'Offer update',
    body: 'An offer for your STRIDETO application was withdrawn.',
    link: oa?._id ? `/applications/${oa._id}` : '/dashboard',
    metadata: { offerId: String(offer._id) },
  }).catch(() => {});

  await logAudit({
    actor: { employerId, role: 'employer' },
    action: 'offer.withdrawn',
    targetType: 'application',
    targetId: applicationId,
    ip: auditContext.ip || '',
    metadata: { offerId: String(offer._id) },
  });

  return { offer: serializeOffer(offer), changed: true };
}

export async function respondToApplicationOffer(
  userId,
  opportunityApplicationId,
  offerId,
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

  if (!offerId || !mongoose.isValidObjectId(String(offerId))) throw notFoundError();

  const offer = await ApplicationOffer.findOne({
    _id: offerId,
    applicationId: application._id,
  });
  if (!offer) throw notFoundError();

  if (!OFFER_RESPONDABLE_STATUSES.includes(offer.status)) {
    throw badRequest('This offer can no longer be responded to');
  }
  await persistExpiredSentOffers(application._id);
  if (deriveEffectiveOfferStatus(offer) === 'expired' || offer.status === 'expired') {
    throw badRequest('This offer has expired');
  }

  offer.status = response;
  offer.respondedAt = new Date();
  await offer.save();

  const systemBody = response === 'accepted' ? 'Offer accepted' : 'Offer declined';
  await persistOfferSystemMessage(application._id, systemBody, offer._id);

  const employerId = application.jobId?.employerId?._id || application.jobId?.employerId;
  if (employerId) {
    await createUserNotificationOnce({
      dedupeKey: `application:offer-response:${offer._id}:${response}`,
      recipientType: 'employer',
      employerId,
      category: 'application',
      type: `application.offer_${response}`,
      title: `Offer ${response}: ${application.jobId?.title || 'application'}`,
      body:
        response === 'accepted'
          ? 'The candidate accepted the offer in STRIDETO.'
          : 'The candidate declined the offer in STRIDETO.',
      link: `/employer/applications/${application._id}`,
      metadata: {
        offerId: String(offer._id),
        response,
      },
    }).catch(() => {});
  }

  const eventName = response === 'accepted' ? 'OfferAccepted' : 'OfferRejected';
  emitCareerEvent(
    eventName,
    {
      candidateUserId: String(userId),
      legacyApplicationId: String(application._id),
      opportunityApplicationId: opportunityApplication?._id ? String(opportunityApplication._id) : null,
      hasStartDate: Boolean(offer.startDate),
      hasCompensation: Boolean(offer.compensationText),
    },
    { type: 'user', id: String(userId) },
    { aggregateId: application._id }
  );

  await logAudit({
    actor: { userId, role: 'student' },
    action: `offer.${response}`,
    targetType: 'application',
    targetId: application._id,
    ip: auditContext.ip || '',
    metadata: {
      offerId: String(offer._id),
      response,
      opportunityApplicationId: opportunityApplication?._id ? String(opportunityApplication._id) : null,
    },
  });

  return { offer: serializeOffer(offer) };
}

export async function getOfferForEmployer(employerId, applicationId, offerId) {
  await getOwnedApplicationForEmployer(employerId, applicationId);
  if (!offerId || !mongoose.isValidObjectId(String(offerId))) throw notFoundError();
  const offer = await ApplicationOffer.findOne({ _id: offerId, applicationId }).lean();
  if (!offer) throw notFoundError();
  return serializeOffer(offer);
}

export { rejectUnexpectedBodyKeys } from './applicationCommunicationService.js';
export { persistExpiredSentOffers } from '../utils/applicationOfferLifecycle.js';
