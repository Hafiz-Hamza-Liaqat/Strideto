/**
 * GBS Service Request contracts (Phase 17D-6).
 *
 * Pre-quote lifecycle only. Snapshots never authorize later progression.
 * No Quote, Case, payment, document, or messaging fields.
 */
import {
  GBS_SERVICE_REQUEST_ACTING_FOR,
  GBS_SERVICE_REQUEST_BOUNDS,
  GBS_SERVICE_REQUEST_DECLINE_REASON_CODES,
  GBS_SERVICE_REQUEST_STATUSES,
  isValidServiceRequestActingFor,
  isValidServiceRequestDeclineReason,
  isValidServiceRequestLanguage,
  isValidServiceRequestStatus,
} from './constants.js';

const B = GBS_SERVICE_REQUEST_BOUNDS;
const S = GBS_SERVICE_REQUEST_STATUSES;

export const GBS_SERVICE_REQUEST_PROVIDER_TRANSITIONS = Object.freeze({
  REVIEW: 'review',
  READY_FOR_QUOTE: 'ready_for_quote',
  DECLINE: 'decline',
});

const CREATE_ALLOWLIST = Object.freeze([
  'listingSlug',
  'listingId',
  'creationCommandId',
  'customerSummary',
  'actingFor',
  'existingBusinessName',
  'entityTypeId',
  'preferredLanguage',
]);

const REJECTED_CREATE_KEYS = Object.freeze([
  'providerSubjectType',
  'providerSubjectId',
  'providerId',
  'organizationId',
  'capabilityId',
  'capability',
  'grantStatus',
  'grantedBy',
  'staff',
  'role',
  'userId',
  'requesterUserId',
  'status',
  'recordVersion',
  'publicRequestRef',
  'memberships',
]);

export function boundText(value, max) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

export function parseServiceRequestPage(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function parseServiceRequestLimit(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return B.PAGE_DEFAULT;
  return Math.min(B.PAGE_MAX, n);
}

export function allowlistedCreateInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_body' };
  }
  for (const key of Object.keys(body)) {
    if (REJECTED_CREATE_KEYS.includes(key)) {
      return { ok: false, error: 'untrusted_field' };
    }
    if (!CREATE_ALLOWLIST.includes(key)) {
      return { ok: false, error: 'unknown_field' };
    }
  }
  return { ok: true };
}

export function normalizeCreateIntake(body = {}) {
  const gate = allowlistedCreateInput(body);
  if (!gate.ok) return gate;

  const listingSlug = boundText(body.listingSlug, B.LISTING_REF_MAX).toLowerCase();
  const listingId = boundText(body.listingId, 32);
  if (!listingSlug && !listingId) return { ok: false, error: 'listing_required' };

  const actingFor = boundText(body.actingFor, 40);
  if (!isValidServiceRequestActingFor(actingFor)) {
    return { ok: false, error: 'invalid_acting_for' };
  }

  const customerSummary = boundText(body.customerSummary, B.CUSTOMER_SUMMARY_MAX);
  if (!customerSummary) return { ok: false, error: 'customer_summary_required' };

  let existingBusinessName = '';
  if (actingFor === GBS_SERVICE_REQUEST_ACTING_FOR.EXISTING_BUSINESS) {
    existingBusinessName = boundText(body.existingBusinessName, B.EXISTING_BUSINESS_NAME_MAX);
    if (!existingBusinessName) return { ok: false, error: 'existing_business_name_required' };
  }

  const preferredLanguage = body.preferredLanguage == null || body.preferredLanguage === ''
    ? ''
    : boundText(body.preferredLanguage, 8);
  if (preferredLanguage && !isValidServiceRequestLanguage(preferredLanguage)) {
    return { ok: false, error: 'invalid_preferred_language' };
  }

  const entityTypeId = boundText(body.entityTypeId, 80);
  const creationCommandId = boundText(body.creationCommandId, B.COMMAND_ID_MAX);
  if (!creationCommandId) return { ok: false, error: 'creation_command_id_required' };

  return {
    ok: true,
    value: {
      listingSlug: listingSlug || '',
      listingId: listingId || '',
      creationCommandId,
      customerSummary,
      actingFor,
      existingBusinessName: existingBusinessName || undefined,
      entityTypeId: entityTypeId || undefined,
      preferredLanguage: preferredLanguage || undefined,
    },
  };
}

export function providerCanReview(status) {
  return status === S.SUBMITTED;
}

export function providerCanDecline(status) {
  return status === S.SUBMITTED || status === S.PROVIDER_REVIEWING;
}

export function providerCanReadyForQuote(status) {
  return status === S.SUBMITTED || status === S.PROVIDER_REVIEWING;
}

export function customerCanCancel(status) {
  return status === S.SUBMITTED || status === S.PROVIDER_REVIEWING || status === S.READY_FOR_QUOTE;
}

export function isTerminalServiceRequestStatus(status) {
  return status === S.DECLINED || status === S.CANCELLED;
}

export function normalizeDeclineInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_body' };
  }
  const allowed = new Set([
    'expectedVersion',
    'declineReasonCode',
    'declineNote',
    'reasonCode',
    'subjectType',
    'subjectId',
  ]);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) return { ok: false, error: 'unknown_field' };
  }
  const reason = boundText(body.declineReasonCode || body.reasonCode, B.REASON_CODE_MAX);
  if (!isValidServiceRequestDeclineReason(reason)) {
    return { ok: false, error: 'invalid_decline_reason' };
  }
  return {
    ok: true,
    value: {
      declineReasonCode: reason,
      declineNote: boundText(body.declineNote, B.DECLINE_NOTE_MAX) || undefined,
    },
  };
}

export function normalizeTransitionNote(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_body' };
  }
  const allowed = new Set(['expectedVersion', 'providerTransitionNote', 'subjectType', 'subjectId']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) return { ok: false, error: 'unknown_field' };
  }
  return {
    ok: true,
    value: {
      providerTransitionNote: boundText(body.providerTransitionNote, B.PROVIDER_NOTE_MAX) || undefined,
    },
  };
}

export function parseExpectedVersion(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function customerRequestProjection(record) {
  if (!record) return null;
  return {
    publicRequestRef: record.publicRequestRef,
    listingSlug: record.listingSlugSnapshot,
    intakeChannel: record.intakeChannel || 'public_marketplace',
    title: record.titleSnapshot,
    capabilityPublicName: record.capabilityPublicNameSnapshot,
    jurisdictionName: record.jurisdictionNameSnapshot,
    providerDisplayName: record.providerDisplayNameSnapshot,
    providerKind: record.providerKindSnapshot,
    actingFor: record.actingFor,
    existingBusinessName: record.existingBusinessName || undefined,
    customerSummary: record.customerSummary,
    preferredLanguage: record.preferredLanguage || undefined,
    status: record.status,
    declineReasonCode: record.declineReasonCode || undefined,
    declineNote: record.declineNote || undefined,
    providerTransitionNote: record.providerTransitionNote || undefined,
    recordVersion: record.recordVersion,
    providerReviewingAt: record.providerReviewingAt || undefined,
    providerDecisionAt: record.providerDecisionAt || undefined,
    requesterCancelledAt: record.requesterCancelledAt || undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function providerRequestProjection(record, customerSafe = {}) {
  if (!record) return null;
  return {
    publicRequestRef: record.publicRequestRef,
    intakeChannel: record.intakeChannel || 'public_marketplace',
    customerDisplayName: customerSafe.displayName || 'Customer',
    preferredLanguage: record.preferredLanguage || undefined,
    actingFor: record.actingFor,
    existingBusinessName: record.existingBusinessName || undefined,
    customerSummary: record.customerSummary,
    listingSlug: record.listingSlugSnapshot,
    title: record.titleSnapshot,
    capabilityId: record.capabilityId,
    capabilityPublicName: record.capabilityPublicNameSnapshot,
    jurisdictionName: record.jurisdictionNameSnapshot,
    countryCode: record.countryCode,
    entityTypeId: record.entityTypeId || undefined,
    status: record.status,
    declineReasonCode: record.declineReasonCode || undefined,
    declineNote: record.declineNote || undefined,
    providerTransitionNote: record.providerTransitionNote || undefined,
    recordVersion: record.recordVersion,
    providerReviewingAt: record.providerReviewingAt || undefined,
    providerDecisionAt: record.providerDecisionAt || undefined,
    requesterCancelledAt: record.requesterCancelledAt || undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    actions: {
      review: providerCanReview(record.status),
      readyForQuote: providerCanReadyForQuote(record.status),
      decline: providerCanDecline(record.status),
    },
  };
}

export function overviewCounts(items = []) {
  const counts = {
    submitted: 0,
    provider_reviewing: 0,
    ready_for_quote: 0,
    declined: 0,
    cancelled: 0,
    active: 0,
  };
  for (const row of items) {
    if (isValidServiceRequestStatus(row.status) && counts[row.status] != null) {
      counts[row.status] += 1;
    }
    if (row.status === S.SUBMITTED || row.status === S.PROVIDER_REVIEWING || row.status === S.READY_FOR_QUOTE) {
      counts.active += 1;
    }
  }
  return counts;
}
