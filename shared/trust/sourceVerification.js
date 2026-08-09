/**
 * Source Verification + Freshness — shared policy contract (Mission 5).
 *
 * Client- and server-safe: pure JS, no Node/DOM globals.
 *
 * Defines:
 *   - Source authority hierarchy + types
 *   - Source availability statuses
 *   - Verification lifecycle + valid transitions
 *   - Freshness states + deterministic derivation
 *   - Configurable review intervals by data type
 *   - URL normalization for deduplication
 *   - Public-safe last-verified projection
 *   - Publication policy
 *   - Correction report types/statuses
 *   - Empty data-quality metrics shape
 *
 * No live web checks, no scraping, no scheduling. Those are deferred to
 * future missions that will use this contract as their safe boundary.
 */

// ── Source authority hierarchy ────────────────────────────────────────────────

/**
 * Numeric trust tiers — lower = more authoritative.
 * Hierarchy is frozen; do not renumber existing tiers.
 */
export const AUTHORITY_TIERS = Object.freeze({
  GOVERNMENT: 1,
  OFFICIAL_TEST_ORG: 2,
  UNIVERSITY: 3,
  SCHOLARSHIP_PROVIDER: 4,
  OFFICIAL_EMPLOYER: 5,
  VERIFIED_ORG: 6,
  TRUSTED_SECONDARY: 7,
});

/**
 * String tokens stored in DB. Each maps to one AUTHORITY_TIERS value.
 * Hierarchy description:
 *   government          — national/regional regulator, ministry, official body
 *   official_test_org   — ETS, British Council, College Board, etc.
 *   university          — accredited university/college
 *   scholarship_provider — official scholarship body
 *   official_employer   — company/government employer's own site
 *   verified_org        — verified organization/agent official source
 *   trusted_secondary   — recognized education aggregator, press, directory
 */
export const AUTHORITY_TYPES = Object.freeze({
  GOVERNMENT: 'government',
  OFFICIAL_TEST_ORG: 'official_test_org',
  UNIVERSITY: 'university',
  SCHOLARSHIP_PROVIDER: 'scholarship_provider',
  OFFICIAL_EMPLOYER: 'official_employer',
  VERIFIED_ORG: 'verified_org',
  TRUSTED_SECONDARY: 'trusted_secondary',
});

const AUTHORITY_TYPE_TO_TIER = Object.freeze({
  government: AUTHORITY_TIERS.GOVERNMENT,
  official_test_org: AUTHORITY_TIERS.OFFICIAL_TEST_ORG,
  university: AUTHORITY_TIERS.UNIVERSITY,
  scholarship_provider: AUTHORITY_TIERS.SCHOLARSHIP_PROVIDER,
  official_employer: AUTHORITY_TIERS.OFFICIAL_EMPLOYER,
  verified_org: AUTHORITY_TIERS.VERIFIED_ORG,
  trusted_secondary: AUTHORITY_TIERS.TRUSTED_SECONDARY,
});

const AUTHORITY_TYPE_SET = new Set(Object.values(AUTHORITY_TYPES));

export function isValidAuthorityType(value) {
  return typeof value === 'string' && AUTHORITY_TYPE_SET.has(value);
}

/** Returns the numeric tier for an authority type, or null for unknown. */
export function authorityTier(authorityType) {
  return AUTHORITY_TYPE_TO_TIER[authorityType] ?? null;
}

// ── Source availability statuses ─────────────────────────────────────────────

export const SOURCE_STATUS = Object.freeze({
  ACTIVE: 'active',
  REDIRECTED: 'redirected',
  UNAVAILABLE: 'unavailable',
  BROKEN: 'broken',
  RETIRED: 'retired',
});

const SOURCE_STATUS_SET = new Set(Object.values(SOURCE_STATUS));

export function isValidSourceStatus(value) {
  return typeof value === 'string' && SOURCE_STATUS_SET.has(value);
}

// ── Verification lifecycle ────────────────────────────────────────────────────

export const VERIFICATION_STATUSES = Object.freeze({
  UNVERIFIED: 'unverified',
  PENDING_REVIEW: 'pending_review',
  VERIFIED: 'verified',
  NEEDS_REVIEW: 'needs_review',
  DISPUTED: 'disputed',
  SUPERSEDED: 'superseded',
  REJECTED: 'rejected',
});

const VERIFICATION_STATUS_SET = new Set(Object.values(VERIFICATION_STATUSES));

export function isValidVerificationStatus(value) {
  return typeof value === 'string' && VERIFICATION_STATUS_SET.has(value);
}

/**
 * Allowed verification status transitions.
 * superseded is terminal (cannot transition out).
 * rejected can be reopened to pending_review.
 */
const ALLOWED_TRANSITIONS = {
  unverified: new Set(['pending_review', 'verified', 'rejected']),
  pending_review: new Set(['verified', 'needs_review', 'rejected', 'disputed']),
  verified: new Set(['needs_review', 'disputed', 'superseded']),
  needs_review: new Set(['pending_review', 'verified', 'rejected', 'superseded']),
  disputed: new Set(['pending_review', 'verified', 'rejected', 'needs_review']),
  superseded: new Set(),
  rejected: new Set(['pending_review', 'unverified']),
};

export function isValidVerificationTransition(from, to) {
  if (!isValidVerificationStatus(from) || !isValidVerificationStatus(to)) return false;
  const allowed = ALLOWED_TRANSITIONS[from];
  return !!allowed && allowed.has(to);
}

// ── Freshness states ──────────────────────────────────────────────────────────

export const FRESHNESS_STATES = Object.freeze({
  FRESH: 'fresh',
  REVIEW_DUE: 'review_due',
  STALE: 'stale',
  BROKEN: 'broken',
  UNKNOWN: 'unknown',
});

const FRESHNESS_STATE_SET = new Set(Object.values(FRESHNESS_STATES));

export function isValidFreshnessState(value) {
  return typeof value === 'string' && FRESHNESS_STATE_SET.has(value);
}

// ── Configurable review intervals ─────────────────────────────────────────────

/**
 * Default review intervals in days, by data type.
 * Test policy changes need shorter windows; stable institutional identity longer.
 * These are defaults; caller can override with reviewIntervalDays.
 */
export const DEFAULT_REVIEW_INTERVALS = Object.freeze({
  test_policy: 90,
  test_date: 60,
  institution_identity: 365,
  scholarship: 180,
  program: 180,
  country_intelligence: 270,
  alert: 30,
  source_default: 180,
});

export function isValidDataType(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DEFAULT_REVIEW_INTERVALS, value);
}

/**
 * Derive a freshness state deterministically from metadata.
 *
 * @param {object} params
 * @param {Date|string|null} [params.lastVerifiedAt]
 * @param {Date|string|null} [params.nextReviewAt]
 * @param {string} [params.sourceStatus] - one of SOURCE_STATUS values
 * @param {number} [params.reviewIntervalDays] - explicit override
 * @param {string} [params.dataType] - key from DEFAULT_REVIEW_INTERVALS
 * @param {Date|string} [params.now] - injectable clock (for tests)
 * @returns {string} one of FRESHNESS_STATES values
 */
export function deriveFreshness({
  lastVerifiedAt = null,
  nextReviewAt = null,
  sourceStatus = null,
  reviewIntervalDays = null,
  dataType = null,
  now: _now = null,
} = {}) {
  // Broken/unavailable source → broken freshness regardless of verification dates
  if (
    sourceStatus === SOURCE_STATUS.BROKEN ||
    sourceStatus === SOURCE_STATUS.UNAVAILABLE
  ) {
    return FRESHNESS_STATES.BROKEN;
  }

  // Never verified
  if (!lastVerifiedAt) return FRESHNESS_STATES.UNKNOWN;

  const now = _now ? new Date(_now) : new Date();
  const lastVerified = new Date(lastVerifiedAt);
  if (isNaN(lastVerified.getTime())) return FRESHNESS_STATES.UNKNOWN;

  // Explicit nextReviewAt wins over interval calculation
  if (nextReviewAt) {
    const reviewDate = new Date(nextReviewAt);
    if (!isNaN(reviewDate.getTime())) {
      const msUntilReview = reviewDate.getTime() - now.getTime();
      if (msUntilReview >= 0) return FRESHNESS_STATES.FRESH;
      // Past review date — how far past?
      const daysPast = (-msUntilReview) / (1000 * 60 * 60 * 24);
      return daysPast > 90 ? FRESHNESS_STATES.STALE : FRESHNESS_STATES.REVIEW_DUE;
    }
  }

  // Interval-based: resolve interval days
  const intervalDays =
    reviewIntervalDays ??
    (dataType && DEFAULT_REVIEW_INTERVALS[dataType]) ??
    DEFAULT_REVIEW_INTERVALS.source_default;

  const msElapsed = now.getTime() - lastVerified.getTime();
  const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);

  if (daysElapsed < intervalDays * 0.8) return FRESHNESS_STATES.FRESH;
  if (daysElapsed < intervalDays) return FRESHNESS_STATES.REVIEW_DUE;
  if (daysElapsed > intervalDays * 3) return FRESHNESS_STATES.STALE;
  return FRESHNESS_STATES.REVIEW_DUE;
}

// ── URL normalization / deduplication ─────────────────────────────────────────

/**
 * Normalize an http(s) URL for deduplication.
 *   - Lowercase scheme + host
 *   - Remove fragment (#...)
 *   - Strip default ports (80 for http, 443 for https)
 *   - Remove trailing slash from bare origins
 *
 * Returns null for non-http(s) or unparseable input.
 */
export function normalizeSourceUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  // Drop fragment — never affects resource identity
  u.hash = '';

  // Strip default ports
  if (
    (u.protocol === 'http:' && u.port === '80') ||
    (u.protocol === 'https:' && u.port === '443')
  ) {
    u.port = '';
  }

  let result = u.toString().toLowerCase();

  // Remove trailing slash only when path is bare '/'
  if (result.endsWith('/') && u.pathname === '/') {
    result = result.slice(0, -1);
  }

  return result;
}

// ── Public-safe last-verified projection ──────────────────────────────────────

/**
 * Build the public-facing verification badge from a source or fact provenance
 * record. Never exposes adminNotes or internal identifiers.
 *
 * @param {object} record
 * @param {string} [record.label] display label for the source
 * @param {boolean} [record.isOfficial]
 * @param {Date|string|null} [record.lastVerifiedAt]
 * @param {string} [record.freshnessState] one of FRESHNESS_STATES
 * @param {string|null} [record.officialUrl] safe to surface only when official
 * @returns {object} public-safe projection
 */
export function projectLastVerified(record = {}) {
  return {
    label: record.label ?? '',
    isOfficiallySourced: !!record.isOfficial,
    lastVerifiedAt: record.lastVerifiedAt ?? null,
    freshnessState: record.freshnessState ?? FRESHNESS_STATES.UNKNOWN,
    // Only surface URL when officially sourced; never expose internal admin URLs
    officialUrl: record.isOfficial ? (record.officialUrl ?? null) : null,
  };
}

// ── Publication policy ────────────────────────────────────────────────────────

export const PUBLICATION_POLICY_TYPES = Object.freeze({
  ORIGINAL_GUIDANCE: 'original_guidance',
  HIGH_VALUE_FACTUAL: 'high_value_factual',
  DESCRIPTIVE: 'descriptive',
});

const PUBLICATION_POLICY_TYPE_SET = new Set(Object.values(PUBLICATION_POLICY_TYPES));

export function isValidPublicationPolicyType(value) {
  return typeof value === 'string' && PUBLICATION_POLICY_TYPE_SET.has(value);
}

/**
 * Check whether a record satisfies publication policy.
 *
 * original_guidance / descriptive — Strideto-authored or non-factual content;
 *   may publish without external source requirement.
 *
 * high_value_factual — external factual claim; must have at least one source
 *   AND be in VERIFIED status. Unsourced or unverified → draft/review state.
 *
 * @param {object} record
 * @param {string} [record.verificationStatus]
 * @param {Array}  [record.sources]
 * @param {string} policyType one of PUBLICATION_POLICY_TYPES
 * @returns {{ canPublish: boolean, reason: string }}
 */
export function checkPublicationPolicy(record = {}, policyType) {
  if (
    policyType === PUBLICATION_POLICY_TYPES.ORIGINAL_GUIDANCE ||
    policyType === PUBLICATION_POLICY_TYPES.DESCRIPTIVE
  ) {
    return { canPublish: true, reason: 'original_or_descriptive_exempt' };
  }

  if (policyType === PUBLICATION_POLICY_TYPES.HIGH_VALUE_FACTUAL) {
    const hasSources =
      Array.isArray(record.sources) && record.sources.length > 0;
    if (!hasSources) {
      return { canPublish: false, reason: 'high_value_factual_requires_source' };
    }
    if (record.verificationStatus !== VERIFICATION_STATUSES.VERIFIED) {
      return {
        canPublish: false,
        reason: 'high_value_factual_requires_verified_status',
      };
    }
    return { canPublish: true, reason: 'verified_high_value_factual' };
  }

  return { canPublish: false, reason: 'unknown_policy_type' };
}

// ── Correction report types + statuses ───────────────────────────────────────

export const CORRECTION_TYPES = Object.freeze({
  OUTDATED_INFORMATION: 'outdated_information',
  INCORRECT_INFORMATION: 'incorrect_information',
  BROKEN_OFFICIAL_LINK: 'broken_official_link',
  DEADLINE_CHANGED: 'deadline_changed',
  TEST_ACCEPTANCE_CHANGED: 'test_acceptance_changed',
  OTHER_FACTUAL_ISSUE: 'other_factual_issue',
});

const CORRECTION_TYPE_SET = new Set(Object.values(CORRECTION_TYPES));

export function isValidCorrectionType(value) {
  return typeof value === 'string' && CORRECTION_TYPE_SET.has(value);
}

export const CORRECTION_STATUSES = Object.freeze({
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  DUPLICATE: 'duplicate',
  RESOLVED: 'resolved',
});

const CORRECTION_STATUS_SET = new Set(Object.values(CORRECTION_STATUSES));

export function isValidCorrectionStatus(value) {
  return typeof value === 'string' && CORRECTION_STATUS_SET.has(value);
}

// ── Data-quality metrics shape ────────────────────────────────────────────────

/** Zero-value metrics object; shape reference for aggregation results. */
export const EMPTY_DATA_QUALITY_METRICS = Object.freeze({
  totalFactRecords: 0,
  verified: 0,
  unverified: 0,
  fresh: 0,
  reviewDue: 0,
  stale: 0,
  broken: 0,
  correctionsPending: 0,
});

// ── parseSources helper (hardened, replaces Mission 4 silent-drop) ────────────

/**
 * Parse and validate an array of source/evidence entries.
 *
 * In strict mode (for published/high-value records):
 *   - returns { ok: false, errors } when any entry is invalid.
 *
 * In permissive mode (draft workflows):
 *   - drops invalid entries and reports errors in the returned object without
 *     failing the whole operation.
 *
 * @param {any[]} rawSources
 * @param {object} [opts]
 * @param {boolean} [opts.strict=false] fail on any invalid entry
 * @param {Function} validateSource the evidence.validateSource function
 * @returns {{ ok: true, sources: object[], warnings: string[] } |
 *           { ok: false, errors: string[] }}
 */
export function parseSources(rawSources, { strict = false, validateSource } = {}) {
  if (!Array.isArray(rawSources)) {
    return { ok: true, sources: [], warnings: [] };
  }

  const sources = [];
  const warnings = [];
  const errors = [];

  for (let i = 0; i < Math.min(rawSources.length, 20); i++) {
    const entry = rawSources[i];
    // Guard null/non-object entries — coerce to empty object so validateSource
    // produces a clear "sourceType is invalid" error rather than crashing.
    const safeEntry = (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry : {};
    const result = validateSource ? validateSource(safeEntry) : { ok: false, errors: ['validateSource not provided'] };
    if (result.ok) {
      sources.push(result.value);
    } else {
      const msg = `sources[${i}]: ${result.errors.join(', ')}`;
      if (strict) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, sources, warnings };
}
