/**
 * GBS filing-requirement pack contract (Phase 17D-8B2B).
 *
 * Source-controlled, versioned, server-owned. Production Wyoming v1 remains
 * draft/draft. Selection requires activationStatus=active AND reviewStatus=reviewed.
 * Not legal counsel. No government submission. No HSI. No document uploads.
 */
import { CATALOG_REVIEW_STATUSES } from './catalogConstants.js';
import { canonicalizeCatalogValue } from './catalogFingerprint.js';
import { normalizePhone } from '../international/phone.js';

export const GBS_REQUIREMENT_PACK_SCHEMA_VERSION = '17d-8b2b.0';

export const REQUIREMENT_PACK_IDS = Object.freeze({
  US_WY_LLC: 'gbs.requirement_pack.US-WY.LLC',
});

export const REQUIREMENT_PACK_ACTIVATION = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  SUPERSEDED: 'superseded',
});

export const REQUIREMENT_FACT_CLASSES = Object.freeze({
  FACT: 'FACT',
  OPTIONAL_FACT: 'OPTIONAL_FACT',
});

export const REQUIREMENT_WHO_SUPPLIES = Object.freeze({
  CUSTOMER: 'customer',
  PROVIDER: 'provider',
  EITHER: 'either',
});

export const REQUIREMENT_VALUE_TYPES = Object.freeze({
  STRING: 'string',
  BOOLEAN: 'boolean',
  ENUM: 'enum',
  ADDRESS: 'address',
  EMAIL: 'email',
  PHONE: 'phone',
  DATE: 'date',
});

export const REQUIREMENT_CHECK_MODES = Object.freeze({
  MANUAL: 'manual',
  DERIVED: 'derived',
});

export const RA_SOURCE_VALUES = Object.freeze([
  'customer_individual',
  'customer_third_party',
  'provider_as_ra',
]);

export const RA_KIND_VALUES = Object.freeze(['individual', 'entity']);

export const FILING_METHOD_VALUES = Object.freeze(['wyobiz_online', 'paper_mail']);

export const WY_LLC_NAME_SUFFIXES = Object.freeze([
  'Limited Liability Company',
  'LLC',
  'L.L.C.',
  'Limited Company',
  'LC',
  'L.C.',
  'Ltd. Liability Company',
  'Ltd. Liability Co.',
  'Limited Liability Co.',
]);

export const REQUIRED_WY_LLC_FACT_KEYS = Object.freeze([
  'proposed_entity_name',
  'close_llc_election',
  'ra_source',
  'ra_kind',
  'ra_name',
  'ra_registered_office_street',
  'ra_registered_office_city',
  'ra_registered_office_state',
  'ra_registered_office_postal_code',
  'mailing_address',
  'principal_office_address',
  'entity_email',
  'organizer_print_name',
  'filing_contact_name',
  'filing_contact_phone',
  'ra_email',
  'ra_phone',
]);

export const OPTIONAL_WY_LLC_FACT_KEYS = Object.freeze([
  'ra_po_box_in_addition',
  'ra_mailing_address_if_different',
  'delayed_effective_date',
]);

export const WY_LLC_PROVIDER_CHECK_KEYS = Object.freeze([
  'name_distinguishability_search_performed',
  'name_suffix_compliant',
  'restricted_name_words_reviewed',
  'ra_eligibility_confirmed',
  'ra_written_consent_obtained_and_retained',
  'organizer_identified_for_external_execution',
  'articles_facts_complete_for_external_filing',
  'filing_method_selected',
  'provider_not_claimed_as_wy_ra_without_capability',
  'close_llc_not_elected',
]);

export const DERIVED_CHECK_KEYS = Object.freeze([
  'name_suffix_compliant',
  'close_llc_not_elected',
  'articles_facts_complete_for_external_filing',
  'organizer_identified_for_external_execution',
  'provider_not_claimed_as_wy_ra_without_capability',
  'ra_written_consent_obtained_and_retained',
]);

export const MANUAL_CHECK_KEYS = Object.freeze([
  'name_distinguishability_search_performed',
  'restricted_name_words_reviewed',
  'ra_eligibility_confirmed',
  'filing_method_selected',
]);

export const RA_CONSENT_KEY = 'ra_written_consent';

export const FORBIDDEN_IDENTITY_KEYS = Object.freeze([
  'passport',
  'cnic',
  'national_id',
  'nationalId',
  'driver_license',
  'ssn_card',
  'kyc',
  'signature_image',
  'proof_of_address',
  'kyc_proof_of_address',
]);

export const FORBIDDEN_GOVERNMENT_STATUSES = Object.freeze([
  'submitted',
  'processing',
  'approved',
  'registered',
  'government_rejected',
  'authority_reference',
  'certificate_issued',
  'submitted_to_authority',
]);

export const REQUIREMENT_PACK_BOUNDS = Object.freeze({
  STRING_MAX: 160,
  ADDRESS_LINE_MAX: 160,
  EMAIL_MAX: 254,
  POSTAL_MAX: 16,
  DATE_MAX: 32,
});

export const DELAYED_EFFECTIVE_DATE_MAX_DAYS = 90;

export const PACK_APPLICABLE_FROM_US_WY_LLC_V1 = '2026-08-16T00:00:00.000Z';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PO_BOX_ONLY_RE = /^\s*(p\.?\s*o\.?\s*box|post\s*office\s*box)\b/i;
const DROP_BOX_RE = /^\s*drop\s*box\b/i;

export function sourceSnapshotFingerprintPayload(pack = {}) {
  const {
    activationStatus: _activationStatus,
    reviewStatus: _reviewStatus,
    reviewedByRole: _reviewedByRole,
    reviewedByProcess: _reviewedByProcess,
    reviewedAt: _reviewedAt,
    approvalRef: _approvalRef,
    sourceSnapshotHash: _sourceSnapshotHash,
    ...rest
  } = pack;
  return canonicalizeCatalogValue(rest);
}

export function packSelectionKey({ capabilityId, jurisdictionId, entityTypeId } = {}) {
  return `${capabilityId || ''}::${jurisdictionId || ''}::${entityTypeId || ''}`;
}

function isSelectable(pack) {
  return pack
    && pack.activationStatus === REQUIREMENT_PACK_ACTIVATION.ACTIVE
    && pack.reviewStatus === CATALOG_REVIEW_STATUSES.REVIEWED;
}

export function packIsApplicable(pack, now = new Date()) {
  if (!pack?.packApplicableFrom) return false;
  const from = Date.parse(pack.packApplicableFrom);
  if (Number.isNaN(from)) return false;
  return new Date(now).getTime() >= from;
}

/**
 * Server-authoritative selection. Client packId/packVersion is ignored.
 * Production Wyoming v1 is draft/draft and therefore returns null.
 * No env, query, Admin, or HTTP registry injection.
 */
export function resolveRequirementPack({
  capabilityId,
  jurisdictionId,
  entityTypeId,
  registry,
  now = new Date(),
} = {}) {
  const packs = Array.isArray(registry?.packs) ? registry.packs : [];
  const match = packs.find((pack) => (
    pack.capabilityId === capabilityId
    && pack.jurisdictionId === jurisdictionId
    && pack.entityTypeId === entityTypeId
    && isSelectable(pack)
    && packIsApplicable(pack, now)
  ));
  return match || null;
}

export function llcNameHasLockedSuffix(name) {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return WY_LLC_NAME_SUFFIXES.some((suffix) => {
    const s = suffix.toLowerCase();
    if (!lower.endsWith(s.toLowerCase())) return false;
    const before = trimmed.slice(0, trimmed.length - suffix.length);
    return before.length === 0 || /[\s,.-]$/.test(before);
  });
}

export function isPoBoxOnlyStreet(street) {
  if (typeof street !== 'string') return false;
  const trimmed = street.trim();
  if (!trimmed) return false;
  return PO_BOX_ONLY_RE.test(trimmed) && !/\d+\s+\S+/.test(trimmed.replace(PO_BOX_ONLY_RE, ''));
}

export function isDropBoxStreet(street) {
  return typeof street === 'string' && DROP_BOX_RE.test(street.trim());
}

export function normalizeWyState(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toUpperCase();
  if (trimmed === 'WY' || trimmed === 'WYOMING') return 'WY';
  return trimmed;
}

export function isValidPackEmail(value) {
  return typeof value === 'string' && value.trim().length > 0
    && value.trim().length <= REQUIREMENT_PACK_BOUNDS.EMAIL_MAX
    && EMAIL_RE.test(value.trim());
}

export function factMap(facts = []) {
  const out = {};
  for (const row of facts) {
    if (row?.factKey) out[row.factKey] = row;
  }
  return out;
}

export function checkMap(checks = []) {
  const out = {};
  for (const row of checks) {
    if (row?.checkKey) out[row.checkKey] = row;
  }
  return out;
}

function addressPresent(value) {
  if (!value || typeof value !== 'object') return false;
  return Boolean(
    String(value.line1 || '').trim()
    && String(value.city || '').trim()
    && String(value.state || '').trim()
    && String(value.postalCode || '').trim()
  );
}

function factValuePresent(def, value) {
  if (def.valueType === REQUIREMENT_VALUE_TYPES.BOOLEAN) return value === true || value === false;
  if (def.valueType === REQUIREMENT_VALUE_TYPES.ADDRESS) return addressPresent(value);
  if (typeof value === 'string') return value.trim().length > 0;
  return value != null && value !== '';
}

export function validateFactValue(def, raw) {
  if (!def) return { ok: false, error: 'unknown_fact_key' };
  if (raw == null || raw === '') {
    if (def.class === REQUIREMENT_FACT_CLASSES.OPTIONAL_FACT) return { ok: true, value: null };
    return { ok: false, error: 'fact_required' };
  }
  const max = REQUIREMENT_PACK_BOUNDS.STRING_MAX;
  if (def.valueType === REQUIREMENT_VALUE_TYPES.BOOLEAN) {
    if (raw !== true && raw !== false && raw !== 'true' && raw !== 'false') {
      return { ok: false, error: 'invalid_fact_value' };
    }
    return { ok: true, value: raw === true || raw === 'true' };
  }
  if (def.valueType === REQUIREMENT_VALUE_TYPES.ENUM) {
    const value = String(raw).trim();
    if (!def.enumValues?.includes(value)) return { ok: false, error: 'invalid_fact_value' };
    if (def.factKey === 'ra_source' && value === 'provider_as_ra') {
      return { ok: false, error: 'provider_registered_agent_capability_required' };
    }
    return { ok: true, value };
  }
  if (def.valueType === REQUIREMENT_VALUE_TYPES.EMAIL) {
    const value = String(raw).trim();
    if (!isValidPackEmail(value)) return { ok: false, error: 'invalid_email' };
    return { ok: true, value };
  }
  if (def.valueType === REQUIREMENT_VALUE_TYPES.PHONE) {
    const candidate = normalizePhone(String(raw).trim());
    if (!candidate) return { ok: false, error: 'invalid_phone' };
    return { ok: true, value: candidate };
  }
  if (def.valueType === REQUIREMENT_VALUE_TYPES.DATE) {
    const value = String(raw).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: 'invalid_date' };
    return { ok: true, value };
  }
  if (def.valueType === REQUIREMENT_VALUE_TYPES.ADDRESS) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid_address' };
    const line1 = String(raw.line1 || '').trim().slice(0, REQUIREMENT_PACK_BOUNDS.ADDRESS_LINE_MAX);
    const line2 = String(raw.line2 || '').trim().slice(0, REQUIREMENT_PACK_BOUNDS.ADDRESS_LINE_MAX);
    const city = String(raw.city || '').trim().slice(0, max);
    const state = String(raw.state || '').trim().slice(0, 32);
    const postalCode = String(raw.postalCode || '').trim().slice(0, REQUIREMENT_PACK_BOUNDS.POSTAL_MAX);
    if (!line1 || !city || !state || !postalCode) return { ok: false, error: 'invalid_address' };
    return { ok: true, value: { line1, line2: line2 || undefined, city, state, postalCode } };
  }
  const value = String(raw).trim().slice(0, max);
  if (!value) return { ok: false, error: 'fact_required' };
  if (def.factKey === 'ra_registered_office_state') {
    const state = normalizeWyState(value);
    if (state !== 'WY') return { ok: false, error: 'ra_state_must_be_wy' };
    return { ok: true, value: 'WY' };
  }
  if (def.factKey === 'ra_registered_office_street') {
    if (isPoBoxOnlyStreet(value)) return { ok: false, error: 'ra_po_box_insufficient' };
    if (isDropBoxStreet(value)) return { ok: false, error: 'ra_drop_box_invalid' };
  }
  return { ok: true, value };
}

export function whoMaySupply(def, lane) {
  if (!def) return false;
  if (def.whoSupplies === REQUIREMENT_WHO_SUPPLIES.EITHER) return true;
  return def.whoSupplies === lane;
}

function identityKeyHit(value) {
  const text = String(value || '').toLowerCase();
  return FORBIDDEN_IDENTITY_KEYS.some((key) => text.includes(key.replace(/_/g, '')) || text.includes(key));
}

export function validateRequirementPackDefinition(pack, { requireReviewed = false } = {}) {
  const errors = [];
  if (!pack || typeof pack !== 'object') return ['pack_missing'];
  if (!pack.packId) errors.push('packId_required');
  if (pack.packVersion !== 1 && pack.packVersion !== '1') errors.push('packVersion_required');
  if (pack.schemaVersion !== GBS_REQUIREMENT_PACK_SCHEMA_VERSION) errors.push('schemaVersion_mismatch');
  if (!pack.sourceSetId) errors.push('sourceSetId_required');
  if (!pack.capabilityId || !pack.jurisdictionId || !pack.entityTypeId || !pack.authorityId) {
    errors.push('selection_key_incomplete');
  }
  if (!pack.packApplicableFrom) errors.push('packApplicableFrom_required');
  if (!Array.isArray(pack.sourceRefs) || pack.sourceRefs.length === 0) errors.push('sourceRefs_required');
  for (const ref of pack.sourceRefs || []) {
    if (!ref.sourceId || !ref.title || !ref.authority || !ref.url || !ref.sourceType || !ref.retrievedAt) {
      errors.push('sourceRef_incomplete');
      break;
    }
  }
  if (!Array.isArray(pack.documentRequirements) || pack.documentRequirements.length !== 0) {
    errors.push('document_requirements_must_be_empty');
  }
  if (pack.hsiRequirementCount !== 0) errors.push('hsi_requirement_count_must_be_zero');
  const factKeys = new Set();
  for (const fact of pack.facts || []) {
    if (!fact.factKey || factKeys.has(fact.factKey)) errors.push('duplicate_or_missing_fact_key');
    factKeys.add(fact.factKey);
    if (!fact.sourceIds?.length) errors.push(`fact_missing_source:${fact.factKey}`);
    if (identityKeyHit(fact.factKey)) errors.push(`identity_field_forbidden:${fact.factKey}`);
  }
  for (const check of pack.providerChecks || []) {
    if (!check.checkKey) errors.push('check_missing_key');
    if (!check.sourceIds?.length) errors.push(`check_missing_source:${check.checkKey}`);
  }
  const consent = (pack.consents || []).find((row) => row.consentKey === RA_CONSENT_KEY);
  if (!consent) errors.push('ra_written_consent_required');
  if (consent?.waivable === true) errors.push('ra_consent_must_be_non_waivable');
  if (consent?.satisfactionMode !== 'provider_attestation') errors.push('ra_consent_mode');
  if (pack.activationStatus === REQUIREMENT_PACK_ACTIVATION.ACTIVE
    && pack.reviewStatus !== CATALOG_REVIEW_STATUSES.REVIEWED) {
    errors.push('active_requires_reviewed');
  }
  const reviewed = pack.reviewStatus === CATALOG_REVIEW_STATUSES.REVIEWED || requireReviewed;
  if (reviewed) {
    if (!pack.reviewedByRole || !pack.reviewedByProcess || !pack.reviewedAt || !pack.sourceSnapshotHash) {
      errors.push('reviewed_metadata_required');
    }
  }
  if (pack.reviewStatus === CATALOG_REVIEW_STATUSES.DRAFT) {
    if (pack.reviewedByRole || pack.reviewedAt || pack.approvalRef) {
      errors.push('draft_must_not_fabricate_reviewer');
    }
  }
  return [...new Set(errors)];
}

export function buildCasePackSnapshot(pack) {
  if (!pack) return null;
  return Object.freeze({
    packId: pack.packId,
    packVersion: pack.packVersion,
    schemaVersion: pack.schemaVersion,
    sourceSetId: pack.sourceSetId,
    sourceSnapshotHash: pack.sourceSnapshotHash || null,
    capabilityId: pack.capabilityId,
    jurisdictionId: pack.jurisdictionId,
    entityTypeId: pack.entityTypeId,
    authorityId: pack.authorityId,
    packApplicableFrom: pack.packApplicableFrom,
    activationStatus: pack.activationStatus,
    reviewStatus: pack.reviewStatus,
    feeRef: pack.feeRef || null,
    feeAmountUsd: pack.feeAmountUsd ?? null,
    delayedEffectiveDateMaxDays: pack.delayedEffectiveDateMaxDays || DELAYED_EFFECTIVE_DATE_MAX_DAYS,
    llcNameSuffixes: pack.llcNameSuffixes || WY_LLC_NAME_SUFFIXES,
    documentRequirements: Object.freeze([...(pack.documentRequirements || [])]),
    hsiRequirementCount: pack.hsiRequirementCount || 0,
    facts: Object.freeze((pack.facts || []).map((row) => Object.freeze({ ...row }))),
    providerChecks: Object.freeze((pack.providerChecks || []).map((row) => Object.freeze({ ...row }))),
    consents: Object.freeze((pack.consents || []).map((row) => Object.freeze({ ...row }))),
    filingMethods: Object.freeze([...(pack.filingMethods || FILING_METHOD_VALUES)]),
    sourceRefs: Object.freeze((pack.sourceRefs || []).map((row) => Object.freeze({ ...row }))),
  });
}

export function evaluateRequirementPackReadiness({
  snapshot,
  facts = [],
  checks = [],
  raConsent,
  professionalAuthorityAllowed = true,
} = {}) {
  const reasons = [];
  if (!snapshot) {
    return { ready: true, reasons: [], attached: false };
  }
  if (professionalAuthorityAllowed === false) reasons.push('professional_authority_invalid');
  const defs = snapshot.facts || [];
  const values = factMap(facts);
  const checkState = checkMap(checks);
  for (const def of defs) {
    if (def.class === REQUIREMENT_FACT_CLASSES.OPTIONAL_FACT) continue;
    const row = values[def.factKey];
    if (!factValuePresent(def, row?.value)) reasons.push(`fact_missing:${def.factKey}`);
  }
  const close = values.close_llc_election?.value;
  if (close === true) reasons.push('wy_close_llc_out_of_scope');
  const name = values.proposed_entity_name?.value;
  if (name && !llcNameHasLockedSuffix(name)) reasons.push('name_suffix_invalid');
  const raState = normalizeWyState(values.ra_registered_office_state?.value || '');
  if (values.ra_registered_office_state && raState !== 'WY') reasons.push('ra_state_must_be_wy');
  const street = values.ra_registered_office_street?.value;
  if (street && (isPoBoxOnlyStreet(street) || isDropBoxStreet(street))) {
    reasons.push('ra_physical_street_required');
  }
  if (values.ra_source?.value === 'provider_as_ra') {
    reasons.push('provider_registered_agent_capability_required');
  }
  if (!String(values.organizer_print_name?.value || '').trim()) {
    reasons.push('organizer_print_name_missing');
  }
  if (raConsent?.status !== 'attested') reasons.push('ra_written_consent_missing');
  for (const key of MANUAL_CHECK_KEYS) {
    const row = checkState[key];
    if (key === 'filing_method_selected') {
      if (!FILING_METHOD_VALUES.includes(row?.selectedMethod)) reasons.push('filing_method_missing');
      continue;
    }
    if (row?.status !== 'attested') reasons.push(`check_missing:${key}`);
  }
  const unique = [...new Set(reasons)];
  return {
    ready: unique.length === 0,
    reasons: unique,
    attached: true,
    b2bRequirementsReady: unique.length === 0,
    authorizedForExternalFiling: false,
  };
}

export function derivedCheckStatus(checkKey, { snapshot, facts = [], raConsent } = {}) {
  const values = factMap(facts);
  if (checkKey === 'name_suffix_compliant') {
    return llcNameHasLockedSuffix(values.proposed_entity_name?.value) ? 'derived_pass' : 'derived_fail';
  }
  if (checkKey === 'close_llc_not_elected') {
    return values.close_llc_election?.value === false ? 'derived_pass' : 'derived_fail';
  }
  if (checkKey === 'organizer_identified_for_external_execution') {
    return String(values.organizer_print_name?.value || '').trim() ? 'derived_pass' : 'derived_fail';
  }
  if (checkKey === 'provider_not_claimed_as_wy_ra_without_capability') {
    return values.ra_source?.value === 'provider_as_ra' ? 'derived_fail' : 'derived_pass';
  }
  if (checkKey === 'ra_written_consent_obtained_and_retained') {
    return raConsent?.status === 'attested' ? 'derived_pass' : 'derived_fail';
  }
  if (checkKey === 'articles_facts_complete_for_external_filing') {
    const defs = snapshot?.facts || [];
    const missing = defs.some((def) => {
      if (def.class === REQUIREMENT_FACT_CLASSES.OPTIONAL_FACT) return false;
      return !factValuePresent(def, values[def.factKey]?.value);
    });
    return missing ? 'derived_fail' : 'derived_pass';
  }
  return 'missing';
}

export function createReviewedActiveClone(pack, {
  reviewedByRole = 'catalog_steward',
  reviewedByProcess = 'official_source_mechanical_mapping',
  reviewedAt = '2026-08-16T00:00:00.000Z',
  sourceSnapshotHash,
} = {}) {
  if (!pack) throw new Error('pack_required');
  return Object.freeze({
    ...pack,
    activationStatus: REQUIREMENT_PACK_ACTIVATION.ACTIVE,
    reviewStatus: CATALOG_REVIEW_STATUSES.REVIEWED,
    reviewedByRole,
    reviewedByProcess,
    reviewedAt,
    sourceSnapshotHash: sourceSnapshotHash || pack.sourceSnapshotHash,
    approvalRef: undefined,
  });
}
