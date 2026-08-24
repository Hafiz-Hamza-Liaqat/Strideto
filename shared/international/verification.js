/**
 * Organization Verification contract (Mission 2 — Trust & Verification Foundation).
 *
 * Defines the canonical verification state machine, evidence types, badge
 * semantics, risk levels and credential policy resolution for ALL organization
 * types: employer/company, agent, agency, university, college, institute.
 *
 * Rules:
 *   - Status alone does not imply what was verified (granular badges do).
 *   - No boolean-only `verified: true` architecture.
 *   - Invalid transitions are rejected server-side.
 *   - Expired/revoked evidence does not produce badges.
 *   - No automatic approval (ever).
 *
 * Client- and server-safe: pure JS, no Node/DOM globals.
 */

// ---------------------------------------------------------------------------
// 1. Verification Status State Machine
// ---------------------------------------------------------------------------

/** Canonical verification statuses. Never rename stored values. */
export const VERIFICATION_STATUSES = Object.freeze({
  DRAFT: 'draft',
  EMAIL_VERIFIED: 'email_verified',
  VERIFICATION_PENDING: 'verification_pending',
  UNDER_REVIEW: 'under_review',
  NEEDS_INFORMATION: 'needs_information',
  ENHANCED_REVIEW: 'enhanced_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

const VS = VERIFICATION_STATUSES;

/**
 * Explicit allowed transitions: from → Set<to>.
 * Any transition not listed here is rejected server-side.
 *
 * Notational grouping by actor:
 *   Organization-initiated: draft→email_verified, *→verification_pending
 *   Moderator:              under_review→needs_information, *→enhanced_review
 *   Admin:                  under_review→approved|rejected, needs_info→approved|rejected|under_review, approved→suspended
 *   SuperAdmin:             approved|suspended→revoked, expired→under_review (reverify)
 *   Policy/system:          approved→expired (scheduled — workers are future)
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  [VS.DRAFT]: new Set([VS.EMAIL_VERIFIED]),
  [VS.EMAIL_VERIFIED]: new Set([VS.VERIFICATION_PENDING]),
  [VS.VERIFICATION_PENDING]: new Set([VS.UNDER_REVIEW, VS.NEEDS_INFORMATION]),
  [VS.UNDER_REVIEW]: new Set([VS.APPROVED, VS.REJECTED, VS.NEEDS_INFORMATION, VS.ENHANCED_REVIEW]),
  [VS.NEEDS_INFORMATION]: new Set([VS.VERIFICATION_PENDING, VS.UNDER_REVIEW, VS.APPROVED, VS.REJECTED]),
  [VS.ENHANCED_REVIEW]: new Set([VS.APPROVED, VS.REJECTED, VS.NEEDS_INFORMATION, VS.UNDER_REVIEW]),
  [VS.APPROVED]: new Set([VS.SUSPENDED, VS.REVOKED, VS.EXPIRED]),
  [VS.REJECTED]: new Set([VS.VERIFICATION_PENDING]),
  [VS.SUSPENDED]: new Set([VS.APPROVED, VS.REVOKED]),
  [VS.REVOKED]: new Set([VS.VERIFICATION_PENDING]),
  [VS.EXPIRED]: new Set([VS.VERIFICATION_PENDING, VS.UNDER_REVIEW]),
});

const STATUS_SET = new Set(Object.values(VS));

/** True for a known verification status. */
export function isValidVerificationStatus(value) {
  return typeof value === 'string' && STATUS_SET.has(value);
}

/**
 * True when the transition from → to is explicitly permitted.
 * Both values must be valid statuses; an unknown value returns false.
 */
export function isValidTransition(from, to) {
  if (!isValidVerificationStatus(from) || !isValidVerificationStatus(to)) return false;
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

/** True when the organization holds the APPROVED status. */
export function isApproved(status) {
  return status === VS.APPROVED;
}

/** True when the organization is in a state allowing it to work toward approval. */
export function isActive(status) {
  return (
    status === VS.DRAFT ||
    status === VS.EMAIL_VERIFIED ||
    status === VS.VERIFICATION_PENDING ||
    status === VS.UNDER_REVIEW ||
    status === VS.NEEDS_INFORMATION ||
    status === VS.ENHANCED_REVIEW ||
    status === VS.APPROVED ||
    status === VS.EXPIRED
  );
}

/** True when the organization is blocked from all privileged capabilities. */
export function isBlocked(status) {
  return status === VS.SUSPENDED || status === VS.REVOKED || status === VS.REJECTED;
}

/**
 * True only for the absolute terminal blocked states (suspended or revoked).
 * Unlike isBlocked, this does NOT include REJECTED — which a qa_test super-admin
 * override may selectively bypass for cross-role QA testing without mutating
 * verification truth.
 */
export function isSuspendedOrRevoked(status) {
  return status === VS.SUSPENDED || status === VS.REVOKED;
}

// ---------------------------------------------------------------------------
// 2. Evidence Types & Statuses
// ---------------------------------------------------------------------------

/** Canonical evidence types. */
export const EVIDENCE_TYPES = Object.freeze({
  IDENTITY: 'identity',
  BUSINESS_REGISTRATION: 'business_registration',
  OFFICIAL_DOMAIN: 'official_domain',
  PHYSICAL_LOCATION: 'physical_location',
  GOOGLE_MAPS: 'google_maps',
  PROFESSIONAL_LICENSE: 'professional_license',
  ACCREDITATION: 'accreditation',
  REPRESENTATIVE_AUTHORITY: 'representative_authority',
  ORGANIZATION_DOCUMENT: 'organization_document',
  OTHER: 'other',
});

const EVIDENCE_TYPE_SET = new Set(Object.values(EVIDENCE_TYPES));

export function isValidEvidenceType(value) {
  return typeof value === 'string' && EVIDENCE_TYPE_SET.has(value);
}

/** Evidence record lifecycle statuses. */
export const EVIDENCE_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
});

const EVIDENCE_STATUS_SET = new Set(Object.values(EVIDENCE_STATUSES));

export function isValidEvidenceStatus(value) {
  return typeof value === 'string' && EVIDENCE_STATUS_SET.has(value);
}

/**
 * True when an evidence record is current and valid (may support a badge).
 * Expired or rejected evidence is not current.
 */
export function isEvidenceCurrent(evidenceStatus) {
  return evidenceStatus === EVIDENCE_STATUSES.ACCEPTED;
}

// ---------------------------------------------------------------------------
// 3. Trust Badges
// ---------------------------------------------------------------------------

/**
 * Granular trust badges. Each badge attests ONLY to what it names.
 * A badge may only be derived from accepted, non-expired evidence.
 * "Strideto guarantees this organization" is explicitly NOT implied.
 */
export const BADGE_TYPES = Object.freeze({
  IDENTITY_VERIFIED: 'identity_verified',
  BUSINESS_VERIFIED: 'business_verified',
  OFFICIAL_DOMAIN_VERIFIED: 'official_domain_verified',
  PHYSICAL_LOCATION_VERIFIED: 'physical_location_verified',
  PROFESSIONAL_CREDENTIAL_VERIFIED: 'professional_credential_verified',
  INSTITUTION_REPRESENTATIVE_VERIFIED: 'institution_representative_verified',
  ACCREDITATION_VERIFIED: 'accreditation_verified',
});

/** Maps badge type → the evidence type(s) that can support it. */
const BADGE_EVIDENCE_MAP = {
  [BADGE_TYPES.IDENTITY_VERIFIED]: [EVIDENCE_TYPES.IDENTITY],
  [BADGE_TYPES.BUSINESS_VERIFIED]: [EVIDENCE_TYPES.BUSINESS_REGISTRATION],
  [BADGE_TYPES.OFFICIAL_DOMAIN_VERIFIED]: [EVIDENCE_TYPES.OFFICIAL_DOMAIN],
  [BADGE_TYPES.PHYSICAL_LOCATION_VERIFIED]: [EVIDENCE_TYPES.PHYSICAL_LOCATION],
  // Google Maps / Business is supporting-only and MUST NOT appear here.
  // Maps alone can never produce PHYSICAL_LOCATION_VERIFIED or any VERIFIED badge.
  [BADGE_TYPES.PROFESSIONAL_CREDENTIAL_VERIFIED]: [EVIDENCE_TYPES.PROFESSIONAL_LICENSE],
  [BADGE_TYPES.INSTITUTION_REPRESENTATIVE_VERIFIED]: [EVIDENCE_TYPES.REPRESENTATIVE_AUTHORITY],
  [BADGE_TYPES.ACCREDITATION_VERIFIED]: [EVIDENCE_TYPES.ACCREDITATION],
};

/**
 * Derive the current set of earned badges from a list of evidence records.
 *
 * @param {Array<{ evidenceType: string, status: string }>} evidenceRecords
 * @returns {string[]} badge slugs currently earned (accepted evidence only)
 */
export function deriveBadges(evidenceRecords) {
  if (!Array.isArray(evidenceRecords)) return [];
  const acceptedTypes = new Set(
    evidenceRecords
      .filter((e) => isEvidenceCurrent(e.status))
      .map((e) => e.evidenceType)
  );
  const earned = [];
  for (const [badge, supportingTypes] of Object.entries(BADGE_EVIDENCE_MAP)) {
    if (supportingTypes.some((t) => acceptedTypes.has(t))) {
      earned.push(badge);
    }
  }
  return earned;
}

/** Maps/Business evidence can never alone result in VERIFIED / badge promotion. */
export const MAPS_EVIDENCE_IS_SUPPORTING_ONLY = true;

export function mapsCannotAloneVerify() {
  return MAPS_EVIDENCE_IS_SUPPORTING_ONLY;
}

// ---------------------------------------------------------------------------
// 4. Credential / License Policy
// ---------------------------------------------------------------------------

/**
 * Jurisdiction-aware credential policy values.
 * Used by credentialPolicyService with rolloutConfig to resolve
 * whether a license/credential is required for a given org type + country.
 */
export const CREDENTIAL_POLICY = Object.freeze({
  REQUIRED: 'required',
  OPTIONAL: 'optional',
  NOT_APPLICABLE: 'not_applicable',
});

const CREDENTIAL_POLICY_SET = new Set(Object.values(CREDENTIAL_POLICY));

export function isValidCredentialPolicy(value) {
  return typeof value === 'string' && CREDENTIAL_POLICY_SET.has(value);
}

// ---------------------------------------------------------------------------
// 5. Risk Levels
// ---------------------------------------------------------------------------

export const RISK_LEVELS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

const RISK_LEVEL_SET = new Set(Object.values(RISK_LEVELS));

export function isValidRiskLevel(value) {
  return typeof value === 'string' && RISK_LEVEL_SET.has(value);
}

/** True when risk level should force enhanced/manual review. */
export function requiresEnhancedReview(riskLevel) {
  return riskLevel === RISK_LEVELS.HIGH || riskLevel === RISK_LEVELS.CRITICAL;
}

// ---------------------------------------------------------------------------
// 6. Risk Signal Types
// ---------------------------------------------------------------------------

export const RISK_SIGNALS = Object.freeze({
  DOMAIN_MISMATCH: 'domain_mismatch',
  LOCATION_MISMATCH: 'location_mismatch',
  IDENTITY_MISMATCH: 'identity_mismatch',
  EXPIRED_CREDENTIAL: 'expired_credential',
  DUPLICATE_ORGANIZATION: 'duplicate_organization',
  SUSPICIOUS_CLAIM: 'suspicious_claim',
});

const RISK_SIGNAL_SET = new Set(Object.values(RISK_SIGNALS));

export function isValidRiskSignal(value) {
  return typeof value === 'string' && RISK_SIGNAL_SET.has(value);
}

// ---------------------------------------------------------------------------
// 7. Capability Gate
// ---------------------------------------------------------------------------

/**
 * Returns true when an organization may exercise privileged capabilities
 * (publish marketplace posts, accept paid clients, etc.).
 *
 * Non-approved organizations:
 *   - MAY complete onboarding / manage verification submission / view status
 *   - MAY NOT exercise any privileged capability
 *
 * @param {string} verificationStatus
 * @returns {boolean}
 */
export function canExercisePrivilegedCapability(verificationStatus) {
  return verificationStatus === VS.APPROVED;
}

// ---------------------------------------------------------------------------
// 8. Verification Profile Validation (submission-time)
// ---------------------------------------------------------------------------

const REQUIRED_PROFILE_FIELDS = [
  'legalName',
  'displayName',
  'countryCode',
  'officialEmail',
  'registeredAddress',
  'officialWebsite',
  'authorizedRepresentative',
];

/**
 * Lightweight check: does the profile contain the minimum required fields
 * to make a complete submission? Full validation is at the service layer.
 *
 * @param {object} profile
 * @returns {{ ok: true } | { ok: false, missing: string[] }}
 */
export function validateSubmissionCompleteness(profile = {}) {
  const missing = REQUIRED_PROFILE_FIELDS.filter((f) => {
    const val = profile[f];
    if (val === null || val === undefined) return true;
    if (typeof val === 'string' && !val.trim()) return true;
    if (typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val).length === 0;
    }
    return false;
  });
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 9. SLA Helpers
// ---------------------------------------------------------------------------

/** Target initial-decision window in business hours per policy. */
export const SLA_TARGET_BUSINESS_HOURS = 48;

/**
 * Compute a raw deadline from submission time (not calendar-aware; a
 * full business-calendar engine is deferred). The deadline is a
 * UTC instant ONLY FOR SLA tracking — it is NOT automatic approval.
 *
 * @param {Date|string} submittedAt
 * @returns {string} ISO 8601 UTC instant
 */
export function computeSlaDeadline(submittedAt) {
  const base = new Date(submittedAt);
  if (Number.isNaN(base.getTime())) throw new Error('submittedAt is not a valid date');
  const deadline = new Date(base.getTime() + SLA_TARGET_BUSINESS_HOURS * 60 * 60 * 1000);
  return deadline.toISOString();
}

/**
 * True when the SLA deadline has passed (review window elapsed).
 * Does NOT imply approval — only that the target window has elapsed.
 *
 * @param {string|Date} slaDeadlineAt
 * @returns {boolean}
 */
export function isSlaBreached(slaDeadlineAt) {
  if (!slaDeadlineAt) return false;
  return new Date() > new Date(slaDeadlineAt);
}
