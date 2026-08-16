/**
 * Source-controlled filing-authorization legal-text registry (Phase 17D-9A).
 *
 * Production entry is metadata-only draft / unapproved. No production legal
 * wording is invented here. Tests inject synthetic approved text through
 * dependency injection only. No HTTP, env, DB, or Admin approval path.
 *
 * Server/test only: uses Node crypto. Do not import from client bundles.
 */
import { createHash } from 'node:crypto';
import { catalogFingerprintCanonical } from './catalogFingerprint.js';
import {
  GBS_FILING_AUTHORIZATION_SCHEMA_VERSION,
  LEGAL_TEXT_IDS,
  LEGAL_TEXT_STATUSES,
} from './filingAuthorizationContract.js';

export function hashLegalTextArtifact({ legalTextId, legalTextVersion, paragraphs } = {}) {
  const canonical = catalogFingerprintCanonical({
    legalTextId,
    legalTextVersion,
    paragraphs: Array.isArray(paragraphs) ? paragraphs : [],
  });
  return createHash('sha256').update(canonical).digest('hex');
}

const PRODUCTION_DRAFT_PLACEHOLDER = Object.freeze({
  legalTextId: LEGAL_TEXT_IDS.PRODUCTION_INITIAL_FORMATION,
  legalTextVersion: 1,
  status: LEGAL_TEXT_STATUSES.DRAFT,
  paragraphs: Object.freeze([]),
  applicablePurpose: 'gbs.case_filing_authorization.initial_formation',
  applicableCapabilityId: 'business_formation',
  applicableJurisdictionId: 'j:US-WY',
  applicableEntityTypeId: 'et:US-WY:LLC',
  applicableFrom: '2026-08-16T00:00:00.000Z',
  reviewStatus: 'unapproved',
  reviewedBy: null,
  reviewedAt: null,
  reviewTicket: null,
  schemaVersion: GBS_FILING_AUTHORIZATION_SCHEMA_VERSION,
  testOnly: false,
});

function withHash(entry) {
  return Object.freeze({
    ...entry,
    paragraphs: Object.freeze([...(entry.paragraphs || [])]),
    legalTextHash: hashLegalTextArtifact(entry),
  });
}

export const PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1 = withHash(PRODUCTION_DRAFT_PLACEHOLDER);

export const productionLegalTextRegistry = Object.freeze([
  PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1,
]);

export function registryWithLegalTexts(texts) {
  return Object.freeze([...(texts || [])].map((row) => withHash(row)));
}

/**
 * TEST ONLY. Never selected by the production registry. Callers must inject
 * the returned artifact through service `legalTextRegistry` — never via HTTP.
 */
export function createApprovedSyntheticLegalText({
  version = 1,
  paragraphs,
  legalTextId = LEGAL_TEXT_IDS.TEST_ONLY_INITIAL_FORMATION,
} = {}) {
  return withHash({
    legalTextId,
    legalTextVersion: version,
    status: LEGAL_TEXT_STATUSES.APPROVED,
    paragraphs: paragraphs || [
      'TEST ONLY. This is not production legal authorization wording and is not a power of attorney.',
      'This synthetic text authorizes the named Provider subject to use this Case information for the described initial external formation filing under the attached pack snapshot.',
      'This is not a Wyoming statutory signature, registered-agent signature, Provider organizer legal authority, government filing, or government acceptance.',
    ],
    applicablePurpose: 'gbs.case_filing_authorization.initial_formation',
    applicableCapabilityId: 'business_formation',
    applicableJurisdictionId: 'j:US-WY',
    applicableEntityTypeId: 'et:US-WY:LLC',
    applicableFrom: '2020-01-01T00:00:00.000Z',
    reviewStatus: 'test_only_approved',
    reviewedBy: 'test-only',
    reviewedAt: '2020-01-01T00:00:00.000Z',
    reviewTicket: null,
    schemaVersion: GBS_FILING_AUTHORIZATION_SCHEMA_VERSION,
    testOnly: true,
  });
}

export function isLegalTextApplicable(entry, { capabilityId, jurisdictionId, entityTypeId, purpose, now = new Date() } = {}) {
  if (!entry) return false;
  if (entry.applicablePurpose && entry.applicablePurpose !== purpose) return false;
  if (entry.applicableCapabilityId && entry.applicableCapabilityId !== capabilityId) return false;
  if (entry.applicableJurisdictionId && entry.applicableJurisdictionId !== jurisdictionId) return false;
  if (entry.applicableEntityTypeId && entityTypeId && entry.applicableEntityTypeId !== entityTypeId) return false;
  if (entry.applicableFrom) {
    const from = Date.parse(entry.applicableFrom);
    if (!Number.isNaN(from) && new Date(now).getTime() < from) return false;
  }
  return true;
}

export function resolveEligibleLegalText({
  capabilityId,
  jurisdictionId,
  entityTypeId,
  purpose,
  registry = productionLegalTextRegistry,
  now = new Date(),
} = {}) {
  const approved = (registry || []).filter((entry) => (
    entry.status === LEGAL_TEXT_STATUSES.APPROVED
    && isLegalTextApplicable(entry, { capabilityId, jurisdictionId, entityTypeId, purpose, now })
  ));
  if (!approved.length) return null;
  approved.sort((a, b) => Number(b.legalTextVersion) - Number(a.legalTextVersion));
  return approved[0];
}

if (PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1.status !== LEGAL_TEXT_STATUSES.DRAFT) {
  throw new Error('production filing-authorization legal text must remain draft');
}
if (PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1.paragraphs.length !== 0) {
  throw new Error('production filing-authorization legal text must not invent wording');
}
if (PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1.reviewedBy || PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1.reviewTicket) {
  throw new Error('production filing-authorization legal text must not fake review');
}
