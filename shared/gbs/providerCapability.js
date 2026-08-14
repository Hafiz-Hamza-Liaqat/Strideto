/**
 * ProviderCapability subject + scope contract (Phase 17D-1).
 *
 * subjectType + subjectId is exact. Agent capability never copies to Agency.
 * Agency capability never copies to an Agent personal credential.
 * Membership does not mint a personal ProviderCapability.
 *
 * Trust: CLAIMED != EVIDENCE_SUBMITTED != EVIDENCE_BACKED != VERIFIED.
 * isVerified: true is not authoritative.
 */
import {
  GBS_SCHEMA_VERSION,
  PROVIDER_SUBJECT_TYPES,
  PROVIDER_TRUST_STATUSES,
  isValidProviderSubjectType,
  isValidProviderTrustStatus,
  LISTING_SCOPE_DIMENSIONS,
  PROVIDER_CAPABILITY_FLAGS,
} from './constants.js';
import { GRANT_STATUSES, isValidGrantStatus } from '../capability/grantStatus.js';

export function emptyProviderScope() {
  return {
    serviceCategoryIds: [],
    countryCodes: [],
    jurisdictionIds: [],
    entityTypeIds: [],
    protectedTitleIds: [],
    flags: {
      [PROVIDER_CAPABILITY_FLAGS.REGISTERED_AGENT]: false,
      [PROVIDER_CAPABILITY_FLAGS.REGISTERED_OFFICE]: false,
    },
  };
}

export function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function normalizeProviderScope(input = {}) {
  const flags = input.flags && typeof input.flags === 'object' ? input.flags : {};
  return {
    serviceCategoryIds: normalizeIdList(input.serviceCategoryIds),
    countryCodes: normalizeIdList(input.countryCodes).map((c) => c.toUpperCase()),
    jurisdictionIds: normalizeIdList(input.jurisdictionIds),
    entityTypeIds: normalizeIdList(input.entityTypeIds),
    protectedTitleIds: normalizeIdList(input.protectedTitleIds),
    flags: {
      [PROVIDER_CAPABILITY_FLAGS.REGISTERED_AGENT]:
        flags[PROVIDER_CAPABILITY_FLAGS.REGISTERED_AGENT] === true,
      [PROVIDER_CAPABILITY_FLAGS.REGISTERED_OFFICE]:
        flags[PROVIDER_CAPABILITY_FLAGS.REGISTERED_OFFICE] === true,
    },
  };
}

/**
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateProviderCapabilityRecord(input = {}) {
  const errors = [];
  if (!isValidProviderSubjectType(input.subjectType)) {
    errors.push('subjectType must be agent or organization');
  }
  const subjectId = input.subjectId != null ? String(input.subjectId).trim() : '';
  if (!subjectId) errors.push('subjectId is required');

  const status = input.status || GRANT_STATUSES.ACTIVE;
  if (!isValidGrantStatus(status)) errors.push('status is invalid');

  const trustStatus = input.trustStatus || PROVIDER_TRUST_STATUSES.CLAIMED;
  if (!isValidProviderTrustStatus(trustStatus)) errors.push('trustStatus is invalid');

  const capabilityId =
    input.capabilityId == null || input.capabilityId === ''
      ? ''
      : String(input.capabilityId).trim();

  if (errors.length) return { ok: false, errors };

  const recordVersion = Number.isInteger(input.recordVersion) ? input.recordVersion : 0;
  return {
    ok: true,
    value: {
      subjectType: input.subjectType,
      subjectId,
      capabilityId,
      status,
      trustStatus,
      scope: normalizeProviderScope(input.scope || input),
      evidenceRefs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs.slice(0, 50) : [],
      review: input.review && typeof input.review === 'object' ? { ...input.review } : {},
      schemaVersion: input.schemaVersion || GBS_SCHEMA_VERSION,
      recordVersion,
    },
  };
}

export function sameProviderSubject(a = {}, b = {}) {
  return (
    a.subjectType === b.subjectType &&
    String(a.subjectId || '') === String(b.subjectId || '') &&
    isValidProviderSubjectType(a.subjectType)
  );
}

export { LISTING_SCOPE_DIMENSIONS, PROVIDER_SUBJECT_TYPES };
