import mongoose from 'mongoose';
import { AgentAvailability } from '../models/consultation/AgentAvailability.js';
import { Consultation } from '../models/consultation/Consultation.js';
import { ConsultationEvent } from '../models/consultation/ConsultationEvent.js';
import { ConsultationThread } from '../models/consultation/ConsultationThread.js';
import { ConsultationMessage } from '../models/consultation/ConsultationMessage.js';
import { ConsultationNotificationEvent } from '../models/consultation/ConsultationNotificationEvent.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentService } from '../models/agent/AgentService.js';
import { AgentLead } from '../models/agent/AgentLead.js';
import { AgentMarketplacePost } from '../models/agent/AgentMarketplacePost.js';
import { VaultDocument } from '../models/vault/VaultDocument.js';
import { DocumentAccessGrant } from '../models/vault/DocumentAccessGrant.js';
import { canAccessDocument } from './vault/vaultAccessPolicy.js';
import { assertApprovedVerification, getVerificationStatus } from './agentProfileService.js';
import { logAudit } from './auditService.js';
import { AGENT_LEAD_STATUSES, AGENT_MEMBER_ROLES, AGENT_SERVICE_PRICING_MODES, AGENT_SERVICE_STATUSES } from '../../../shared/agent/constants.js';
import { MARKETPLACE_MODERATION_STATUSES, MARKETPLACE_PUBLICATION_STATUSES } from '../../../shared/agent/marketplace.js';
import { normalizeTimeZone } from '../../../shared/international/timezone.js';
import {
  CONSULTATION_PAYMENT_STATES, CONSULTATION_STATUSES, MEETING_MODES, MESSAGE_TYPES, THREAD_STATUSES,
  canTransitionConsultation, isSlotInsideAvailability, messagingAllowed,
  sanitizeMessageText, validateAvailabilityWindows,
} from '../../../shared/services/consultations.js';

const ACTIVE_BOOKING_STATUSES = ['requested', 'pending_confirmation', 'confirmed', 'reschedule_requested'];
const CLOSED_STATUSES = ['cancelled', 'completed', 'declined', 'no_show'];
const MAX_PAGE_SIZE = 50;
const POST_CONSULTATION_MESSAGE_HOURS = 72;

function fail(message, status = 400, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  throw error;
}
function clean(value, max) { return sanitizeMessageText(value, max); }
function id(value, label = 'id') { if (!mongoose.isValidObjectId(value)) fail(`Invalid ${label}`); return value; }

function pageOptions(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

async function agentScope(agentAccountId) {
  const profile = await AgentProfile.findOne({ agentAccountId }).lean();
  if (!profile) fail('Agent profile not found', 404);
  const membership = await AgentMembership.findOne({ agentAccountId, organizationId: profile.organizationId, active: true }).lean();
  if (!membership) fail('Active organization membership required', 403);
  return { profile, membership, organizationId: profile.organizationId };
}

function paymentStateFor(service) {
  if (service.pricingMode === AGENT_SERVICE_PRICING_MODES.FREE) return CONSULTATION_PAYMENT_STATES.FREE;
  if (service.pricingMode === AGENT_SERVICE_PRICING_MODES.PAID_FUTURE) return CONSULTATION_PAYMENT_STATES.PAYMENT_REQUIRED_FUTURE;
  return CONSULTATION_PAYMENT_STATES.PAYMENT_NOT_CONFIGURED;
}

function snapshotService(service) {
  return {
    title: service.title,
    category: service.category,
    description: service.description || '',
    pricingMode: service.pricingMode,
    price: {
      amountMinor: Number.isSafeInteger(service.price?.amountMinor) ? service.price.amountMinor : null,
      currency: service.price?.currency || null,
    },
    deliveryMode: service.deliveryMode,
    journeyType: service.journeyType,
    countriesServed: [...(service.countriesServed || [])],
    destinationCountries: [...(service.destinationCountries || [])],
    durationEstimate: service.durationEstimate || '',
    eligibilityNotes: service.eligibilityNotes || '',
  };
}

function studentProjection(record, verificationStatus) {
  const data = record.toObject ? record.toObject() : record;
  const restricted = verificationStatus !== 'approved';
  return {
    id: String(data._id), organizationId: String(data.organizationId), assignedMembershipId: String(data.assignedMembershipId),
    agentServiceId: String(data.agentServiceId), marketplacePostId: data.marketplacePostId ? String(data.marketplacePostId) : null,
    consultationType: data.consultationType, status: data.status, requestedWindow: data.requestedWindow,
    confirmedStart: data.confirmedStart, durationMinutes: data.durationMinutes, timezone: data.timezone,
    meetingMode: data.meetingMode, meetingMetadata: restricted ? { restricted: true } : data.meetingMetadata,
    purpose: data.purpose, studentNote: data.studentNote, paymentState: data.paymentState,
    service: data.serviceSnapshot || null,
    verificationState: verificationStatus, restricted, cancellation: data.cancellation?.cancelledAt ? { actorType: data.cancellation.actorType, cancelledAt: data.cancellation.cancelledAt } : null,
    completion: data.completion?.completedAt ? { completedAt: data.completion.completedAt } : null,
    createdAt: data.createdAt, updatedAt: data.updatedAt,
  };
}

function agentProjection(record, verificationStatus) {
  const data = record.toObject ? record.toObject() : record;
  return { ...studentProjection(data, verificationStatus), studentUserId: String(data.studentUserId), leadId: data.leadId ? String(data.leadId) : null, agentNote: data.agentNote };
}

function historyProjection(events, actorType) {
  return events.map((event) => ({
    id: String(event._id), actorType: event.actorType, fromStatus: event.fromStatus,
    toStatus: event.toStatus, createdAt: event.createdAt,
    ...(actorType === 'agent' || event.actorType === 'student' ? { reason: event.reason } : {}),
  }));
}

async function verificationFor(record) { return getVerificationStatus(record.organizationId); }

async function appendEvent(record, actorType, actorId, fromStatus, toStatus, reason = '', metadata = {}) {
  return ConsultationEvent.create({ consultationId: record._id, organizationId: record.organizationId, actorType, actorId: String(actorId), fromStatus, toStatus, reason: clean(reason, 500), metadata });
}

async function prepareNotification(record, recipientActorType, recipientId, eventType, category = 'appointments', scheduledAt = null) {
  const event = await ConsultationNotificationEvent.create({ consultationId: record._id, recipientActorType, recipientId: String(recipientId), eventType, category, scheduledAt, timezone: record.timezone, status: 'pending', deliveryAttempted: false });
  if (recipientActorType === 'agent') {
    const { notifyAgentMembership } = await import('./agentInboxNotificationBridge.js');
    await notifyAgentMembership({
      membershipId: recipientId,
      category: eventType === 'new_contextual_message' ? 'message' : 'consultation',
      type: eventType,
      title: eventType === 'new_contextual_message' ? 'New consultation message' : 'Consultation update',
      body: 'A consultation event requires your attention. Open the consultation for details.',
      link: `/agent/education/consultations/${record._id}`,
      dedupeKey: `agent:consultation:${record._id}:${eventType}:${event._id}`,
    }).catch(() => {});
  }
  if (recipientActorType === 'student') {
    const { createUserNotificationOnce } = await import('./notificationService.js');
    const messageEvent = eventType === 'new_contextual_message';
    await createUserNotificationOnce({
      recipientType: 'user',
      userId: recipientId,
      category: messageEvent ? 'message' : 'consultation',
      type: eventType,
      title: messageEvent ? 'New consultation message' : 'Consultation update',
      body: 'A consultation event requires your attention. Open the consultation for details.',
      link: `/consultations/${record._id}`,
      dedupeKey: messageEvent
        ? `user:consultation:${record._id}:${eventType}:${event._id}`
        : `user:consultation:${record._id}:${eventType}`,
    }).catch(() => {});
  }
  return event;
}

async function assertSlotAvailable({ availability, start, durationMinutes, excludeConsultationId }) {
  const instant = new Date(start);
  if (Number.isNaN(instant.getTime())) fail('A valid future requestedStart is required', 422, 'INVALID_START');
  const now = new Date();
  if (instant.getTime() < now.getTime() + availability.minNoticeMinutes * 60000) fail('Slot does not satisfy minimum notice', 422, 'MIN_NOTICE');
  if (instant.getTime() > now.getTime() + availability.bookingHorizonDays * 86400000) fail('Slot exceeds the booking horizon', 422, 'HORIZON');
  if (!isSlotInsideAvailability({ start: instant, durationMinutes, timeZone: availability.timezone, windows: availability.windows, blockedDates: availability.blockedDates })) fail('Requested slot is unavailable', 409, 'SLOT_UNAVAILABLE');
  const bufferMs = availability.bufferMinutes * 60000;
  const end = new Date(instant.getTime() + durationMinutes * 60000);
  const conflict = await Consultation.exists({
    ...(excludeConsultationId ? { _id: { $ne: excludeConsultationId } } : {}),
    assignedMembershipId: availability.membershipId, status: { $in: ACTIVE_BOOKING_STATUSES },
    'requestedWindow.start': { $lt: new Date(end.getTime() + bufferMs) },
    'requestedWindow.end': { $gt: new Date(instant.getTime() - bufferMs) },
  });
  if (conflict) fail('Requested slot conflicts with another consultation', 409, 'SLOT_CONFLICT');
  return { start: instant, end };
}

export async function upsertAvailability(agentAccountId, input = {}) {
  const scope = await agentScope(agentAccountId);
  const zone = normalizeTimeZone(input.timezone);
  if (!zone) fail('A valid IANA timezone is required', 422, 'INVALID_TIMEZONE');
  const validation = validateAvailabilityWindows(input.windows);
  if (!validation.ok) fail(validation.error, 422);
  const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : null;
  const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
  if ((effectiveFrom && Number.isNaN(effectiveFrom.getTime())) || (effectiveTo && Number.isNaN(effectiveTo.getTime())) || (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo)) fail('Availability effective dates are invalid', 422);
  const blockedDates = [...new Set((input.blockedDates || []).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))].slice(0, 180);
  const availability = await AgentAvailability.findOneAndUpdate(
    { membershipId: scope.membership._id, organizationId: scope.organizationId },
    { $set: { timezone: zone, windows: validation.value, blockedDates, active: input.active !== false,
      effectiveFrom, effectiveTo,
      minNoticeMinutes: Math.min(10080, Math.max(0, Number(input.minNoticeMinutes) || 60)),
      bookingHorizonDays: Math.min(365, Math.max(1, Number(input.bookingHorizonDays) || 90)),
      bufferMinutes: Math.min(240, Math.max(0, Number(input.bufferMinutes) || 15)) } },
    { upsert: true, new: true, runValidators: true }
  ).lean();
  await logAudit({ actor: { userId: agentAccountId, role: 'agent' }, action: 'consultation.availability_updated', targetType: 'AgentAvailability', targetId: availability._id, metadata: { organizationId: String(scope.organizationId), timezone: zone, windowCount: validation.value.length } });
  return availability;
}

export async function getOwnAvailability(agentAccountId) {
  const scope = await agentScope(agentAccountId);
  return AgentAvailability.findOne({ membershipId: scope.membership._id, organizationId: scope.organizationId }).lean();
}

export async function getBookableAvailability(userId, serviceId) {
  id(serviceId, 'service id');
  if (!userId) fail('Authentication required', 401);
  const service = await AgentService.findOne({ _id: serviceId, status: AGENT_SERVICE_STATUSES.ACTIVE }).lean();
  if (!service) fail('Active service not found', 404);
  await assertApprovedVerification(service.organizationId);
  const activeMemberIds = await AgentMembership.find({ organizationId: service.organizationId, active: true }).distinct('_id');
  const now = new Date();
  const availability = await AgentAvailability.find({ organizationId: service.organizationId, membershipId: { $in: activeMemberIds }, active: true,
    $and: [{ $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: now } }] }, { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: now } }] }],
  }).select('membershipId timezone windows blockedDates effectiveFrom effectiveTo minNoticeMinutes bookingHorizonDays bufferMinutes').lean();
  return { serviceId: String(service._id), paymentState: paymentStateFor(service), availability };
}

export async function requestConsultation(userId, input = {}) {
  if (!userId) fail('Authentication required', 401);
  id(input.agentServiceId, 'service id');
  const service = await AgentService.findOne({ _id: input.agentServiceId, status: AGENT_SERVICE_STATUSES.ACTIVE }).lean();
  if (!service) fail('Active Agent service not found', 404);
  await assertApprovedVerification(service.organizationId);
  if (!clean(input.purpose, 300)) fail('Purpose is required', 422, 'PURPOSE_REQUIRED');

  const isInquiry = !input.membershipId;
  let assignedMembershipId, zone, requestedWindow, durationMinutes, meetingMode;

  if (isInquiry) {
    // Inquiry mode: route to the service owner's membership for deterministic assignment.
    // Rule: service.agentProfileId identifies the canonical owner; find that profile's active
    // membership in the organization. Fallback: org owner → admin → earliest active member.
    const serviceProfile = await AgentProfile.findOne({ _id: service.agentProfileId }).lean();
    let chosenMembership = null;
    if (serviceProfile) {
      chosenMembership = await AgentMembership.findOne({ agentAccountId: serviceProfile.agentAccountId, organizationId: service.organizationId, active: true }).lean();
    }
    if (!chosenMembership) {
      chosenMembership = await AgentMembership.findOne({ organizationId: service.organizationId, active: true, role: AGENT_MEMBER_ROLES.OWNER }).sort({ createdAt: 1 }).lean()
        || await AgentMembership.findOne({ organizationId: service.organizationId, active: true, role: AGENT_MEMBER_ROLES.ADMIN }).sort({ createdAt: 1 }).lean();
    }
    if (!chosenMembership) fail('No authorized consultation recipient found for this service', 503, 'PROVIDER_UNAVAILABLE');
    assignedMembershipId = chosenMembership._id;
    zone = '';
    requestedWindow = { start: null, end: null };
    durationMinutes = null;
    meetingMode = MEETING_MODES.VIDEO;
  } else {
    // Booking mode: slot validation required.
    id(input.membershipId, 'membership id');
    const availability = await AgentAvailability.findOne({ organizationId: service.organizationId, membershipId: input.membershipId, active: true }).lean();
    if (!availability) fail('Active availability not found', 404);
    const memberActive = await AgentMembership.exists({ _id: availability.membershipId, organizationId: service.organizationId, active: true });
    if (!memberActive) fail('Selected Agent member is not active', 403);
    const current = new Date();
    if ((availability.effectiveFrom && availability.effectiveFrom > current) || (availability.effectiveTo && availability.effectiveTo < current)) fail('Selected availability is not currently effective', 409);
    zone = normalizeTimeZone(input.timezone);
    if (!zone || zone !== availability.timezone) fail('Booking timezone must match the selected availability timezone', 422, 'TIMEZONE_MISMATCH');
    durationMinutes = Math.min(480, Math.max(15, Number(input.durationMinutes) || 30));
    if (!Object.values(MEETING_MODES).includes(input.meetingMode)) fail('A valid meetingMode is required', 422, 'INVALID_MEETING_MODE');
    meetingMode = input.meetingMode;
    assignedMembershipId = availability.membershipId;
    requestedWindow = await assertSlotAvailable({ availability, start: input.requestedStart, durationMinutes });
  }

  let marketplacePostId = null;
  if (input.marketplacePostId) {
    id(input.marketplacePostId, 'marketplace post id');
    const post = await AgentMarketplacePost.findOne({ _id: input.marketplacePostId, organizationId: service.organizationId, relatedServiceId: service._id, publicationStatus: MARKETPLACE_PUBLICATION_STATUSES.PUBLISHED, moderationStatus: MARKETPLACE_MODERATION_STATUSES.APPROVED }).lean();
    if (!post) fail('Marketplace origin is not a valid public post', 422);
    marketplacePostId = post._id;
  }
  const lead = await AgentLead.findOneAndUpdate(
    { organizationId: service.organizationId, userId },
    { $setOnInsert: { source: marketplacePostId ? 'marketplace_consultation' : 'consultation_request', context: `Consultation request for service ${service._id}`, status: AGENT_LEAD_STATUSES.NEW } },
    { upsert: true, new: true }
  ).lean();
  const record = await Consultation.create({
    studentUserId: userId, organizationId: service.organizationId, assignedMembershipId,
    agentServiceId: service._id, marketplacePostId, leadId: lead._id, consultationType: input.consultationType,
    serviceSnapshot: snapshotService(service),
    requestedWindow, durationMinutes, timezone: zone, meetingMode,
    purpose: clean(input.purpose, 300), studentNote: clean(input.studentNote, 2000), paymentState: paymentStateFor(service), verificationState: 'approved',
  });
  if (!record.purpose) fail('Purpose is required', 422);
  const thread = await ConsultationThread.create({ consultationId: record._id, organizationId: record.organizationId, studentUserId: userId, authorizedMembershipIds: [assignedMembershipId] });
  await appendEvent(record, 'student', userId, '', record.status, '', { threadId: String(thread._id), marketplaceOrigin: Boolean(marketplacePostId) });
  await prepareNotification(record, 'agent', assignedMembershipId, 'consultation_requested');
  await prepareNotification(record, 'student', userId, 'consultation_requested');
  const { recordHandoffConsent, CONSENT_PURPOSES } = await import('./consentGrantService.js');
  await recordHandoffConsent({
    subjectId: userId,
    counterpartyId: service.organizationId,
    counterpartyType: 'agent',
    purpose: CONSENT_PURPOSES.AGENT_CONSULTATION,
    resourceScope: `consultation:${record._id}`,
    grantedAt: new Date(),
    provenance: 'student_consultation_request',
    auditIdentity: `consultation:${record._id}`,
  });
  await logAudit({ actor: { userId, role: 'User' }, action: 'consultation.requested', targetType: 'Consultation', targetId: record._id, metadata: { organizationId: String(record.organizationId), serviceId: String(service._id), paymentState: record.paymentState } });
  await logAudit({ actor: { userId, role: 'User' }, action: 'consultation.participant_assigned', targetType: 'Consultation', targetId: record._id, metadata: { organizationId: String(record.organizationId), membershipId: String(assignedMembershipId) } });
  await logAudit({ actor: { userId, role: 'User' }, action: 'consultation.thread_created', targetType: 'ConsultationThread', targetId: thread._id, metadata: { consultationId: String(record._id), organizationId: String(record.organizationId) } });
  return studentProjection(record, 'approved');
}

export async function listStudentConsultations(userId, query = {}) {
  const { page, limit, skip } = pageOptions(query); const filter = { studentUserId: userId };
  if (query.status && Object.values(CONSULTATION_STATUSES).includes(query.status)) filter.status = query.status;
  const [rows, total] = await Promise.all([Consultation.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(), Consultation.countDocuments(filter)]);
  const items = await Promise.all(rows.map(async (row) => studentProjection(row, await verificationFor(row))));
  return { consultations: items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getStudentConsultation(userId, consultationId) {
  const record = await Consultation.findOne({ _id: id(consultationId, 'consultation id'), studentUserId: userId }).lean();
  if (!record) fail('Consultation not found', 404);
  const [history, thread, verificationStatus] = await Promise.all([ConsultationEvent.find({ consultationId: record._id }).sort({ createdAt: 1 }).lean(), ConsultationThread.findOne({ consultationId: record._id }).lean(), verificationFor(record)]);
  return { consultation: studentProjection(record, verificationStatus), history: historyProjection(history, 'student'), threadId: thread ? String(thread._id) : null };
}

export async function listAgentConsultations(agentAccountId, query = {}) {
  const scope = await agentScope(agentAccountId); const { page, limit, skip } = pageOptions(query);
  const filter = { organizationId: scope.organizationId, assignedMembershipId: scope.membership._id };
  if (query.status && Object.values(CONSULTATION_STATUSES).includes(query.status)) filter.status = query.status;
  const term = String(query.q || '').trim().slice(0, 80);
  if (term) filter.purpose = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [rows, total, verificationStatus] = await Promise.all([Consultation.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(), Consultation.countDocuments(filter), getVerificationStatus(scope.organizationId)]);
  return { consultations: rows.map((row) => agentProjection(row, verificationStatus)), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getAgentConsultation(agentAccountId, consultationId) {
  const scope = await agentScope(agentAccountId);
  const record = await Consultation.findOne({ _id: id(consultationId, 'consultation id'), organizationId: scope.organizationId }).lean();
  if (!record) fail('Consultation not found', 404);
  if (String(record.assignedMembershipId) !== String(scope.membership._id)) fail('Only the assigned Agent member can access this consultation', 403);
  const [history, thread, verificationStatus] = await Promise.all([ConsultationEvent.find({ consultationId: record._id }).sort({ createdAt: 1 }).lean(), ConsultationThread.findOne({ consultationId: record._id }).lean(), getVerificationStatus(scope.organizationId)]);
  return { consultation: agentProjection(record, verificationStatus), history: historyProjection(history, 'agent'), threadId: thread ? String(thread._id) : null };
}

export async function transitionConsultation(actorType, actorId, consultationId, input = {}) {
  const target = input.status; let record; let membership;
  if (actorType === 'student') record = await Consultation.findOne({ _id: id(consultationId, 'consultation id'), studentUserId: actorId });
  else {
    const scope = await agentScope(actorId); membership = scope.membership;
    record = await Consultation.findOne({ _id: id(consultationId, 'consultation id'), organizationId: scope.organizationId, assignedMembershipId: membership._id });
    if (record && !['cancelled'].includes(target)) await assertApprovedVerification(scope.organizationId);
  }
  if (!record) fail('Consultation not found', 404);
  if (!canTransitionConsultation(record.status, target, actorType)) fail(`Invalid consultation transition: ${record.status} -> ${target}`, 409);
  if (target === CONSULTATION_STATUSES.CONFIRMED) await assertApprovedVerification(record.organizationId);
  if ([CONSULTATION_STATUSES.COMPLETED, CONSULTATION_STATUSES.NO_SHOW].includes(target)) {
    if (!record.confirmedStart || record.confirmedStart > new Date()) fail('Consultation cannot be closed before its confirmed start', 409);
  }
  if (target === CONSULTATION_STATUSES.RESCHEDULE_REQUESTED) {
    const availability = await AgentAvailability.findOne({ membershipId: record.assignedMembershipId, active: true }).lean();
    if (!availability) fail('Assigned member has no active availability', 409);
    const durationMinutes = Math.min(480, Math.max(15, Number(input.durationMinutes) || record.durationMinutes));
    record.requestedWindow = await assertSlotAvailable({ availability, start: input.requestedStart, durationMinutes, excludeConsultationId: record._id });
    record.durationMinutes = durationMinutes; record.timezone = availability.timezone; record.confirmedStart = null;
  }
  if (target === CONSULTATION_STATUSES.CONFIRMED) {
    const availability = await AgentAvailability.findOne({ membershipId: record.assignedMembershipId, active: true }).lean();
    if (!availability) fail('Assigned member has no active availability', 409);
    await assertSlotAvailable({ availability, start: record.requestedWindow.start, durationMinutes: record.durationMinutes, excludeConsultationId: record._id });
    record.confirmedStart = record.requestedWindow.start;
    if (actorType === 'agent') {
      if (input.meetingMode) record.meetingMode = input.meetingMode;
      record.meetingMetadata = { link: String(input.meetingMetadata?.link || '').slice(0, 1000), location: clean(input.meetingMetadata?.location, 500), dialIn: clean(input.meetingMetadata?.dialIn, 300) };
      record.agentNote = clean(input.agentNote, 2000);
    }
  }
  if (target === CONSULTATION_STATUSES.CANCELLED) record.cancellation = { actorType, reason: clean(input.reason, 500), cancelledAt: new Date() };
  if (target === CONSULTATION_STATUSES.COMPLETED) record.completion = { completedAt: new Date(), outcomeNote: clean(input.outcomeNote, 1000) };
  const fromStatus = record.status; record.status = target; await record.save();
  await appendEvent(record, actorType, actorType === 'agent' ? membership._id : actorId, fromStatus, target, input.reason, target === 'reschedule_requested' ? { requestedWindow: record.requestedWindow } : {});
  if (CLOSED_STATUSES.includes(target)) {
    await ConsultationThread.updateOne({ consultationId: record._id }, { $set: { status: THREAD_STATUSES.READ_ONLY, closesAt: new Date(Date.now() + POST_CONSULTATION_MESSAGE_HOURS * 3600000) } });
    await logAudit({ actor: { userId: actorId, role: actorType }, action: 'consultation.thread_read_only', targetType: 'Consultation', targetId: record._id, metadata: { organizationId: String(record.organizationId), postConsultationHours: POST_CONSULTATION_MESSAGE_HOURS } });
  }
  const recipientType = actorType === 'agent' ? 'student' : 'agent';
  const recipientId = actorType === 'agent' ? record.studentUserId : record.assignedMembershipId;
  await prepareNotification(record, recipientType, recipientId, `consultation_${target}`);
  if (target === CONSULTATION_STATUSES.CONFIRMED) {
    await prepareNotification(record, 'student', record.studentUserId, 'consultation_upcoming_reminder', 'appointments', new Date(record.confirmedStart.getTime() - 24 * 3600000));
    await prepareNotification(record, 'agent', record.assignedMembershipId, 'consultation_upcoming_reminder', 'appointments', new Date(record.confirmedStart.getTime() - 24 * 3600000));
  }
  await logAudit({ actor: { userId: actorId, role: actorType }, action: `consultation.${target}`, targetType: 'Consultation', targetId: record._id, reason: clean(input.reason, 500), metadata: { organizationId: String(record.organizationId), fromStatus, toStatus: target } });
  const verificationStatus = await verificationFor(record);
  return actorType === 'student' ? studentProjection(record, verificationStatus) : agentProjection(record, verificationStatus);
}

async function authorizeThread(actorType, actorId, threadId) {
  const thread = await ConsultationThread.findById(id(threadId, 'thread id')).lean();
  if (!thread) fail('Conversation not found', 404);
  let actorKey;
  if (actorType === 'student') {
    if (String(thread.studentUserId) !== String(actorId)) fail('Conversation not found', 404);
    actorKey = `student:${actorId}`;
  } else {
    const scope = await agentScope(actorId);
    if (String(thread.organizationId) !== String(scope.organizationId) || !thread.authorizedMembershipIds.some((value) => String(value) === String(scope.membership._id))) fail('Conversation not found', 404);
    actorKey = `agent:${scope.membership._id}`;
  }
  const consultation = await Consultation.findOne({ _id: thread.consultationId, organizationId: thread.organizationId }).lean();
  if (!consultation) fail('Consultation context not found', 404);
  return { thread, consultation, actorKey };
}

export async function listMessages(actorType, actorId, threadId, query = {}) {
  await authorizeThread(actorType, actorId, threadId); const { page, limit, skip } = pageOptions(query);
  const filter = { threadId, moderationStatus: 'active' };
  const [messages, total] = await Promise.all([ConsultationMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), ConsultationMessage.countDocuments(filter)]);
  return { messages: messages.reverse(), page, limit, total };
}

export async function sendMessage(actorType, actorId, threadId, input = {}) {
  const { thread, consultation, actorKey } = await authorizeThread(actorType, actorId, threadId);
  if (!messagingAllowed(consultation.status, consultation.updatedAt, new Date(), POST_CONSULTATION_MESSAGE_HOURS)) fail('This consultation conversation is closed', 409);
  const messageType = input.messageType || MESSAGE_TYPES.TEXT;
  if (![MESSAGE_TYPES.TEXT, MESSAGE_TYPES.DOCUMENT_REFERENCE].includes(messageType)) fail('Unsupported message type', 422);
  const text = clean(input.text, 4000); let documentReference = undefined;
  if (messageType === MESSAGE_TYPES.TEXT && !text) fail('Message text is required', 422);
  if (messageType === MESSAGE_TYPES.DOCUMENT_REFERENCE) {
    if (actorType !== 'student') fail('Only the Student document owner may share a Vault reference', 403);
    const documentId = id(input.documentId, 'document id'); const grantId = id(input.grantId, 'grant id');
    const [document, grant] = await Promise.all([VaultDocument.findOne({ _id: documentId, ownerUserId: actorId }).lean(), DocumentAccessGrant.findById(grantId).lean()]);
    if (!document || !grant) fail('Document or grant not found', 404);
    if (String(grant.consultationRef) !== String(consultation._id)) fail('Grant is not scoped to this consultation', 403);
    const access = await canAccessDocument({ actor: { type: 'agent', id: String(consultation.organizationId) }, document, requiredPermission: 'view', grantId });
    if (!access.allowed) fail(`Document grant denied: ${access.reason}`, 403);
    documentReference = { documentId, grantId, displayName: document.displayName };
  }
  const message = await ConsultationMessage.create({ threadId: thread._id, senderActorType: actorType, senderId: actorKey.split(':')[1], messageType, text, documentReference, readBy: [{ actorKey, readAt: new Date() }] });
  const recipientType = actorType === 'agent' ? 'student' : 'agent'; const recipientId = actorType === 'agent' ? consultation.studentUserId : consultation.assignedMembershipId;
  await prepareNotification(consultation, recipientType, recipientId, 'new_contextual_message', 'consultant_messages');
  if (messageType === MESSAGE_TYPES.DOCUMENT_REFERENCE) await logAudit({ actor: { userId: actorId, role: actorType }, action: 'consultation.document_reference_shared', targetType: 'Consultation', targetId: consultation._id, metadata: { threadId: String(thread._id), documentId: String(documentReference.documentId), grantId: String(documentReference.grantId) } });
  else await logAudit({ actor: { userId: actorId, role: actorType }, action: 'consultation.message_created', targetType: 'ConsultationThread', targetId: thread._id, metadata: { consultationId: String(consultation._id), messageType } });
  return message.toObject();
}

export async function markThreadRead(actorType, actorId, threadId) {
  const { actorKey } = await authorizeThread(actorType, actorId, threadId);
  await ConsultationMessage.updateMany({ threadId, 'readBy.actorKey': { $ne: actorKey } }, { $push: { readBy: { actorKey, readAt: new Date() } } });
  return { read: true };
}

export async function resolveDocumentReference(agentAccountId, threadId, messageId) {
  const { thread, consultation } = await authorizeThread('agent', agentAccountId, threadId);
  const message = await ConsultationMessage.findOne({ _id: id(messageId, 'message id'), threadId: thread._id, messageType: MESSAGE_TYPES.DOCUMENT_REFERENCE, moderationStatus: 'active' }).lean();
  if (!message?.documentReference?.documentId || !message.documentReference.grantId) fail('Document reference not found', 404);
  const document = await VaultDocument.findById(message.documentReference.documentId).lean();
  if (!document) fail('Document not found', 404);
  const access = await canAccessDocument({ actor: { type: 'agent', id: String(consultation.organizationId) }, document, requiredPermission: 'view', grantId: message.documentReference.grantId });
  if (!access.allowed) fail(`Document grant denied: ${access.reason}`, 403);
  return { accessAllowed: true, documentId: String(document._id), displayName: document.displayName, grantId: String(message.documentReference.grantId), consultationId: String(consultation._id) };
}

export const consultationInternals = Object.freeze({ ACTIVE_BOOKING_STATUSES, CLOSED_STATUSES, MAX_PAGE_SIZE, POST_CONSULTATION_MESSAGE_HOURS, paymentStateFor, snapshotService, studentProjection, agentProjection, pageOptions });
