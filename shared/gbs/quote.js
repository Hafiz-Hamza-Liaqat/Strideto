/**
 * Quote intake, list query, and DTO projections (Phase 17D-7).
 */
import {
  GBS_QUOTE_BOUNDS,
  QUOTE_DECLINE_REASON_CODES,
  QUOTE_STATUSES,
  effectiveQuoteStatus,
  isEmittedQuoteStatus,
  isOpaqueQuoteRef,
  isValidQuoteDeclineReason,
  normalizeValidForDays,
  parseProfessionalFeeLines,
} from './quoteContract.js';

function boundText(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function boundStringList(raw, maxItems, maxLen = 200) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLen));
}

const CREATE_ALLOWED = new Set(['creationCommandId', 'commandId', 'subjectType', 'subjectId']);
const DRAFT_ALLOWED = new Set([
  'expectedVersion',
  'professionalFeeLines',
  'officialFeeIds',
  'providerTerms',
  'validForDays',
  'includedItems',
  'excludedItems',
  'providerTurnaroundEstimate',
  'subjectType',
  'subjectId',
]);
const ACTION_ALLOWED = new Set([
  'expectedVersion',
  'commandId',
  'creationCommandId',
  'subjectType',
  'subjectId',
  'validForDays',
]);
const DECLINE_ALLOWED = new Set([
  'expectedVersion',
  'commandId',
  'creationCommandId',
  'declineReasonCode',
  'declineNote',
  'reasonCode',
]);

function rejectUnknown(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_body' };
  }
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) return { ok: false, error: 'unknown_field' };
  }
  return { ok: true };
}

export function allowlistedCreateInput(body = {}) {
  const gate = rejectUnknown(body, CREATE_ALLOWED);
  if (!gate.ok) return gate;
  const creationCommandId = boundText(body.creationCommandId || body.commandId, GBS_QUOTE_BOUNDS.COMMAND_ID_MAX);
  if (!creationCommandId) return { ok: false, error: 'creation_command_id_required' };
  return { ok: true, value: { creationCommandId } };
}

export function allowlistedDraftUpdate(body = {}) {
  const gate = rejectUnknown(body, DRAFT_ALLOWED);
  if (!gate.ok) return gate;
  const professional = body.professionalFeeLines !== undefined
    ? parseProfessionalFeeLines(body.professionalFeeLines, undefined)
    : null;
  if (professional && !professional.ok) return { ok: false, error: 'invalid_professional_fees', errors: professional.errors };
  const validForDays = body.validForDays !== undefined ? normalizeValidForDays(body.validForDays) : undefined;
  if (body.validForDays !== undefined && validForDays == null) return { ok: false, error: 'invalid_valid_for_days' };
  const officialFeeIds = Array.isArray(body.officialFeeIds)
    ? [...new Set(body.officialFeeIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
    : undefined;
  if (officialFeeIds && officialFeeIds.length > GBS_QUOTE_BOUNDS.FEE_LINES_MAX) {
    return { ok: false, error: 'too_many_official_fees' };
  }
  return {
    ok: true,
    value: {
      professionalFeeLines: professional ? professional.value : undefined,
      currency: professional ? professional.currency : undefined,
      officialFeeIds,
      providerTerms: body.providerTerms !== undefined
        ? boundText(body.providerTerms, GBS_QUOTE_BOUNDS.TERMS_MAX)
        : undefined,
      validForDays,
      includedItems: body.includedItems !== undefined
        ? boundStringList(body.includedItems, GBS_QUOTE_BOUNDS.INCLUDED_ITEMS_MAX)
        : undefined,
      excludedItems: body.excludedItems !== undefined
        ? boundStringList(body.excludedItems, GBS_QUOTE_BOUNDS.EXCLUDED_ITEMS_MAX)
        : undefined,
      providerTurnaroundEstimate: body.providerTurnaroundEstimate === null || body.providerTurnaroundEstimate === ''
        ? null
        : body.providerTurnaroundEstimate !== undefined
          ? Number(body.providerTurnaroundEstimate)
          : undefined,
    },
  };
}

export function allowlistedSendInput(body = {}) {
  const gate = rejectUnknown(body, ACTION_ALLOWED);
  if (!gate.ok) return gate;
  const validForDays = body.validForDays !== undefined ? normalizeValidForDays(body.validForDays) : undefined;
  if (body.validForDays !== undefined && validForDays == null) return { ok: false, error: 'invalid_valid_for_days' };
  return {
    ok: true,
    value: {
      validForDays,
      commandId: boundText(body.commandId || body.creationCommandId, GBS_QUOTE_BOUNDS.COMMAND_ID_MAX) || undefined,
    },
  };
}

export function allowlistedDeclineInput(body = {}) {
  const gate = rejectUnknown(body, DECLINE_ALLOWED);
  if (!gate.ok) return gate;
  const reason = body.declineReasonCode || body.reasonCode || QUOTE_DECLINE_REASON_CODES.OTHER;
  if (!isValidQuoteDeclineReason(reason)) return { ok: false, error: 'invalid_decline_reason' };
  return {
    ok: true,
    value: {
      declineReasonCode: reason,
      declineNote: boundText(body.declineNote, GBS_QUOTE_BOUNDS.DECLINE_NOTE_MAX) || undefined,
      commandId: boundText(body.commandId || body.creationCommandId, GBS_QUOTE_BOUNDS.COMMAND_ID_MAX) || undefined,
    },
  };
}

export function allowlistedActionInput(body = {}) {
  const gate = rejectUnknown(body, ACTION_ALLOWED);
  if (!gate.ok) return gate;
  return {
    ok: true,
    value: {
      commandId: boundText(body.commandId || body.creationCommandId, GBS_QUOTE_BOUNDS.COMMAND_ID_MAX) || undefined,
    },
  };
}

export function parseExpectedVersion(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function parseQuotePage(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

export function parseQuoteLimit(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return GBS_QUOTE_BOUNDS.PAGE_DEFAULT;
  return Math.min(n, GBS_QUOTE_BOUNDS.PAGE_MAX);
}

export function parseQuoteListQuery(query = {}) {
  const page = parseQuotePage(query.page);
  const limit = parseQuoteLimit(query.limit);
  const status = typeof query.status === 'string' && isEmittedQuoteStatus(query.status) ? query.status : undefined;
  const capabilityId = typeof query.capabilityId === 'string' && query.capabilityId.trim()
    ? query.capabilityId.trim()
    : undefined;
  const currency = typeof query.currency === 'string' && /^[A-Z]{3}$/.test(query.currency.trim().toUpperCase())
    ? query.currency.trim().toUpperCase()
    : undefined;
  return { page, limit, status, capabilityId, currency };
}

function moneyProjection(record) {
  return {
    currency: record.currency,
    professionalFeeLines: record.professionalFeeLines || [],
    officialFeeLines: record.officialFeeLines || [],
    thirdPartyFeeLines: [],
    subtotalProfessionalMinor: record.subtotalProfessionalMinor,
    officialFeeGroups: record.officialFeeGroups || [],
    totalCustomerAmountMinor: record.totalCustomerAmountMinor ?? null,
  };
}

function sharedQuoteProjection(record, now = new Date()) {
  const status = record.status;
  const effectiveStatus = effectiveQuoteStatus(record, now);
  return {
    publicQuoteRef: record.publicQuoteRef,
    requestPublicRef: record.requestPublicRefSnapshot,
    quoteRevision: record.quoteRevision,
    status,
    effectiveStatus,
    capabilityId: record.capabilityId,
    capabilityPublicName: record.capabilityPublicNameSnapshot,
    title: record.titleSnapshot,
    jurisdictionName: record.jurisdictionNameSnapshot,
    countryCode: record.countryCode,
    listingPricingMode: record.listingPricingModeSnapshot,
    listingProfessionalFee: record.listingProfessionalFeeSnapshot || null,
    includedItems: record.includedItemsSnapshot || [],
    excludedItems: record.excludedItemsSnapshot || [],
    providerTerms: record.providerTerms || '',
    providerTurnaroundEstimate: record.providerTurnaroundEstimateSnapshot ?? null,
    turnaroundIsProviderEstimate: record.turnaroundIsProviderEstimate !== false,
    recurringService: record.recurringServiceSnapshot === true,
    ...moneyProjection(record),
    validForDays: record.validForDays,
    expiresAt: record.expiresAt || null,
    sentAt: record.sentAt || null,
    acceptedAt: record.acceptedAt || null,
    declinedAt: record.declinedAt || null,
    withdrawnAt: record.withdrawnAt || null,
    expiredAt: record.expiredAt || null,
    declineReasonCode: record.declineReasonCode || undefined,
    declineNote: record.declineNote || undefined,
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function customerQuoteProjection(record, extras = {}, now = new Date()) {
  if (!record) return null;
  return {
    ...sharedQuoteProjection(record, now),
    providerDisplayName: extras.providerDisplayName || record.providerDisplayNameSnapshot || 'Provider',
    providerKind: extras.providerKind || record.providerKindSnapshot || 'independent',
    verificationBadge: extras.verificationBadge || null,
  };
}

export function providerQuoteProjection(record, customerSafe = {}, now = new Date()) {
  if (!record) return null;
  return {
    ...sharedQuoteProjection(record, now),
    customerDisplayName: customerSafe.displayName || 'Customer',
    actingFor: record.actingForSnapshot,
    existingBusinessName: record.existingBusinessNameSnapshot || undefined,
    preferredLanguage: record.preferredLanguageSnapshot || undefined,
    customerSummary: record.customerSummarySnapshot,
    officialFeeIds: (record.officialFeeLines || []).map((line) => line.feeId).filter(Boolean),
  };
}

export function customerQuoteListItem(record, extras = {}, now = new Date()) {
  const full = customerQuoteProjection(record, extras, now);
  if (!full) return null;
  return {
    publicQuoteRef: full.publicQuoteRef,
    title: full.title,
    providerDisplayName: full.providerDisplayName,
    providerKind: full.providerKind,
    capabilityPublicName: full.capabilityPublicName,
    jurisdictionName: full.jurisdictionName,
    currency: full.currency,
    subtotalProfessionalMinor: full.subtotalProfessionalMinor,
    officialFeeGroups: full.officialFeeGroups,
    totalCustomerAmountMinor: full.totalCustomerAmountMinor,
    status: full.status,
    effectiveStatus: full.effectiveStatus,
    sentAt: full.sentAt,
    expiresAt: full.expiresAt,
    quoteRevision: full.quoteRevision,
    createdAt: full.createdAt,
  };
}

export function providerQuoteListItem(record, customerSafe = {}, now = new Date()) {
  const full = providerQuoteProjection(record, customerSafe, now);
  if (!full) return null;
  return {
    publicQuoteRef: full.publicQuoteRef,
    requestPublicRef: full.requestPublicRef,
    customerDisplayName: full.customerDisplayName,
    title: full.title,
    capabilityPublicName: full.capabilityPublicName,
    jurisdictionName: full.jurisdictionName,
    currency: full.currency,
    subtotalProfessionalMinor: full.subtotalProfessionalMinor,
    status: full.status,
    effectiveStatus: full.effectiveStatus,
    sentAt: full.sentAt,
    expiresAt: full.expiresAt,
    quoteRevision: full.quoteRevision,
    createdAt: full.createdAt,
  };
}

export function isOpaqueQuoteRefExport(value) {
  return isOpaqueQuoteRef(value);
}

export { QUOTE_STATUSES, QUOTE_DECLINE_REASON_CODES };
