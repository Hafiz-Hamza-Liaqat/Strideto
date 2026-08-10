/**
 * Verified Data Launch — shared contract (Mission 25).
 *
 * Client- and server-safe: pure JS, no Node/DOM globals, no I/O, no network.
 *
 * Defines the vocabulary and pure policy for a *controlled* verified-data
 * launch: manifest schema versioning, launchable entity types, dependency
 * order, provenance origin classification, freshness eligibility, planner
 * states, batch review lifecycle, hard input bounds, safe source URLs, and
 * deterministic canonicalization for fingerprinting.
 *
 * This module deliberately contains NO import/apply logic. Planning and any
 * future mutation live server-side behind explicit gates.
 *
 * Authority hierarchy, freshness states and verification lifecycle are NOT
 * redefined here — Mission 5 (shared/trust/sourceVerification.js) remains the
 * single source of truth and is imported.
 */
import {
  AUTHORITY_TYPES,
  FRESHNESS_STATES,
  SOURCE_STATUS,
  authorityTier,
  isValidAuthorityType,
  isValidFreshnessState,
  isValidSourceStatus,
  normalizeSourceUrl,
} from '../trust/sourceVerification.js';

// ── Manifest schema version ──────────────────────────────────────────────────

/** Current manifest schema version. Bump only on incompatible shape changes. */
export const MANIFEST_SCHEMA_VERSION = 1;

/**
 * Versions this build can interpret. Unknown/future versions fail closed —
 * there is no best-effort interpretation of an incompatible manifest.
 */
export const SUPPORTED_MANIFEST_SCHEMA_VERSIONS = Object.freeze([1]);

export function isSupportedManifestVersion(value) {
  return (
    Number.isInteger(value) && SUPPORTED_MANIFEST_SCHEMA_VERSIONS.includes(value)
  );
}

// ── Launchable entity types ──────────────────────────────────────────────────

/**
 * Only canonical entities already accepted by Missions 4–7 and 18.
 * Mission 25 introduces no new domain model.
 */
export const LAUNCH_ENTITY_TYPES = Object.freeze({
  CANONICAL_SOURCE: 'canonical_source',
  CANONICAL_INSTITUTION: 'canonical_institution',
  TEST_PROVIDER: 'test_provider',
  TEST: 'test',
  PROGRAM: 'program',
  PROGRAM_REQUIREMENT: 'program_requirement',
  TEST_ACCEPTANCE: 'test_acceptance',
  CANONICAL_SCHOLARSHIP: 'canonical_scholarship',
  SCHOLARSHIP_APPLICABILITY: 'scholarship_applicability',
});

const LAUNCH_ENTITY_TYPE_SET = new Set(Object.values(LAUNCH_ENTITY_TYPES));

export function isValidLaunchEntityType(value) {
  return typeof value === 'string' && LAUNCH_ENTITY_TYPE_SET.has(value);
}

/**
 * Deterministic dependency order. A record may only reference records at a
 * strictly lower index (or already-existing canonical state).
 */
export const ENTITY_DEPENDENCY_ORDER = Object.freeze([
  LAUNCH_ENTITY_TYPES.CANONICAL_SOURCE,
  LAUNCH_ENTITY_TYPES.TEST_PROVIDER,
  LAUNCH_ENTITY_TYPES.CANONICAL_INSTITUTION,
  LAUNCH_ENTITY_TYPES.TEST,
  LAUNCH_ENTITY_TYPES.PROGRAM,
  LAUNCH_ENTITY_TYPES.PROGRAM_REQUIREMENT,
  LAUNCH_ENTITY_TYPES.TEST_ACCEPTANCE,
  LAUNCH_ENTITY_TYPES.CANONICAL_SCHOLARSHIP,
  LAUNCH_ENTITY_TYPES.SCHOLARSHIP_APPLICABILITY,
]);

export function entityOrderIndex(entityType) {
  const i = ENTITY_DEPENDENCY_ORDER.indexOf(entityType);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * Which manifest-record reference fields point at which entity type.
 * Used for dependency resolution and ordering checks.
 */
export const ENTITY_DEPENDENCY_FIELDS = Object.freeze({
  canonical_source: Object.freeze({}),
  test_provider: Object.freeze({}),
  canonical_institution: Object.freeze({}),
  test: Object.freeze({ providerKey: LAUNCH_ENTITY_TYPES.TEST_PROVIDER }),
  program: Object.freeze({
    institutionKey: LAUNCH_ENTITY_TYPES.CANONICAL_INSTITUTION,
  }),
  program_requirement: Object.freeze({
    programKey: LAUNCH_ENTITY_TYPES.PROGRAM,
    testKey: LAUNCH_ENTITY_TYPES.TEST,
  }),
  test_acceptance: Object.freeze({
    testKey: LAUNCH_ENTITY_TYPES.TEST,
    institutionKey: LAUNCH_ENTITY_TYPES.CANONICAL_INSTITUTION,
    programKey: LAUNCH_ENTITY_TYPES.PROGRAM,
  }),
  canonical_scholarship: Object.freeze({}),
  scholarship_applicability: Object.freeze({
    scholarshipKey: LAUNCH_ENTITY_TYPES.CANONICAL_SCHOLARSHIP,
    institutionKey: LAUNCH_ENTITY_TYPES.CANONICAL_INSTITUTION,
    programKey: LAUNCH_ENTITY_TYPES.PROGRAM,
  }),
});

/**
 * Which entity types preserve history through supersession rather than being
 * mutated in place. Mission 6 / Mission 5 semantics.
 */
export const SUPERSEDING_ENTITY_TYPES = Object.freeze([
  LAUNCH_ENTITY_TYPES.TEST_ACCEPTANCE,
  LAUNCH_ENTITY_TYPES.PROGRAM_REQUIREMENT,
]);

export function preservesHistory(entityType) {
  return SUPERSEDING_ENTITY_TYPES.includes(entityType);
}

// ── Material facts (fact-level provenance requirement) ───────────────────────

/**
 * Facts that, when present on a record, MUST carry their own fact-level source
 * reference. A single official page does not automatically prove every field.
 *
 * Identity fields (name/slug/country) are covered by the record-level source.
 * Everything listed here is a volatile or high-stakes claim.
 */
export const MATERIAL_FACT_KEYS = Object.freeze({
  canonical_source: Object.freeze([]),
  test_provider: Object.freeze([]),
  canonical_institution: Object.freeze([]),
  test: Object.freeze(['scoreScale', 'validityMonths', 'totalDurationMinutes']),
  program: Object.freeze(['tuition', 'durationMonths', 'intakes']),
  program_requirement: Object.freeze(['minimumScore', 'sectionMinimums']),
  test_acceptance: Object.freeze([
    'acceptanceStatus',
    'minimumOverallScore',
    'sectionMinimums',
  ]),
  canonical_scholarship: Object.freeze(['funding', 'criteria', 'applicationUrl']),
  scholarship_applicability: Object.freeze([]),
});

export function materialFactKeys(entityType) {
  return MATERIAL_FACT_KEYS[entityType] ?? [];
}

// ── Provenance origin classification ─────────────────────────────────────────

/**
 * How a candidate record came to exist. Only genuinely source-backed origins
 * may enter a verified launch manifest. A synthetic/demo record can NEVER be
 * promoted by attaching a URL — origin is declared and validated separately
 * from the source list.
 */
export const PROVENANCE_ORIGINS = Object.freeze({
  REAL_SOURCE_BACKED: 'real_source_backed',
  INSTITUTION_OFFICIAL: 'institution_official',
  INSUFFICIENTLY_SOURCED: 'insufficiently_sourced',
  SYNTHETIC_FIXTURE: 'synthetic_fixture',
  DEMO_PLACEHOLDER: 'demo_placeholder',
  LEGACY_UNKNOWN: 'legacy_unknown',
});

const PROVENANCE_ORIGIN_SET = new Set(Object.values(PROVENANCE_ORIGINS));

export function isValidProvenanceOrigin(value) {
  return typeof value === 'string' && PROVENANCE_ORIGIN_SET.has(value);
}

/** Origins eligible to appear in a verified launch manifest. */
export const LAUNCHABLE_ORIGINS = Object.freeze([
  PROVENANCE_ORIGINS.REAL_SOURCE_BACKED,
  PROVENANCE_ORIGINS.INSTITUTION_OFFICIAL,
]);

export function isLaunchableOrigin(value) {
  return LAUNCHABLE_ORIGINS.includes(value);
}

/**
 * Attribution tokens that must be preserved. Mission 18 institution-submitted
 * data stays attributed as institution_official — it never silently becomes
 * Strideto-independent verification.
 */
export const ATTRIBUTION = Object.freeze({
  STRIDETO_VERIFIED: 'strideto_verified',
  INSTITUTION_OFFICIAL: 'institution_official',
});

export function attributionForOrigin(origin) {
  return origin === PROVENANCE_ORIGINS.INSTITUTION_OFFICIAL
    ? ATTRIBUTION.INSTITUTION_OFFICIAL
    : ATTRIBUTION.STRIDETO_VERIFIED;
}

/**
 * Claim kinds that can never become canonical verified authority, regardless
 * of how they are labelled in a manifest. Rejected explicitly so the error
 * message is unambiguous rather than a generic "unknown authority type".
 */
export const NON_CANONICAL_AUTHORITY_TOKENS = Object.freeze([
  'agent_statement',
  'agent',
  'ai_synthesis',
  'ai_generated',
  'copilot',
  'llm',
  'student_input',
  'user_submitted',
  'self_reported',
]);

export function isNonCanonicalAuthorityToken(value) {
  return (
    typeof value === 'string' &&
    NON_CANONICAL_AUTHORITY_TOKENS.includes(value.trim().toLowerCase())
  );
}

/**
 * True only for an authority type accepted by Mission 5 AND not a
 * non-canonical claim token.
 */
export function isLaunchableAuthorityType(value) {
  if (isNonCanonicalAuthorityToken(value)) return false;
  return isValidAuthorityType(value);
}

/**
 * Which authority types may assert a country-scope test acceptance rule.
 * An institution-owned source can only speak for its own institution/program —
 * "most universities accept X" is never a canonical country rule.
 */
export const COUNTRY_SCOPE_AUTHORITIES = Object.freeze([
  AUTHORITY_TYPES.GOVERNMENT,
  AUTHORITY_TYPES.OFFICIAL_TEST_ORG,
]);

export function canAssertScope(scope, authorityType) {
  if (scope === 'country') return COUNTRY_SCOPE_AUTHORITIES.includes(authorityType);
  if (scope === 'institution' || scope === 'program' || scope === 'program_intake') {
    return isLaunchableAuthorityType(authorityType);
  }
  return false;
}

// ── Freshness eligibility ────────────────────────────────────────────────────

export const LAUNCH_FRESHNESS_DECISIONS = Object.freeze({
  ELIGIBLE: 'eligible',
  REVIEW_REQUIRED: 'review_required',
  NOT_LAUNCHABLE_STALE: 'not_launchable_stale',
  NOT_LAUNCHABLE_BROKEN: 'not_launchable_broken',
  NOT_LAUNCHABLE_UNKNOWN: 'not_launchable_unknown',
});

/**
 * Pure freshness gate. Mission 5 states in, launch decision out.
 *
 *   fresh       → eligible
 *   review_due  → requires an explicit recorded review decision
 *   stale       → not launchable unless an approved exception is recorded
 *   broken      → never launchable
 *   unknown     → never launchable as a verified current fact
 *
 * @param {string} freshnessState one of FRESHNESS_STATES
 * @param {object} [review] record review metadata
 * @param {string} [review.decision] 'approved' | 'rejected' | undefined
 * @param {boolean} [review.staleExceptionApproved]
 * @returns {{ decision: string, reason: string }}
 */
export function evaluateLaunchFreshness(freshnessState, review = {}) {
  if (!isValidFreshnessState(freshnessState)) {
    return {
      decision: LAUNCH_FRESHNESS_DECISIONS.NOT_LAUNCHABLE_UNKNOWN,
      reason: 'freshness_state_invalid',
    };
  }

  switch (freshnessState) {
    case FRESHNESS_STATES.FRESH:
      return { decision: LAUNCH_FRESHNESS_DECISIONS.ELIGIBLE, reason: 'fresh' };

    case FRESHNESS_STATES.REVIEW_DUE:
      return review.decision === 'approved'
        ? {
            decision: LAUNCH_FRESHNESS_DECISIONS.ELIGIBLE,
            reason: 'review_due_explicitly_reviewed',
          }
        : {
            decision: LAUNCH_FRESHNESS_DECISIONS.REVIEW_REQUIRED,
            reason: 'review_due_requires_review_decision',
          };

    case FRESHNESS_STATES.STALE:
      return review.staleExceptionApproved === true
        ? {
            decision: LAUNCH_FRESHNESS_DECISIONS.REVIEW_REQUIRED,
            reason: 'stale_exception_requires_manual_review',
          }
        : {
            decision: LAUNCH_FRESHNESS_DECISIONS.NOT_LAUNCHABLE_STALE,
            reason: 'stale_source_not_launchable_as_current',
          };

    case FRESHNESS_STATES.BROKEN:
      return {
        decision: LAUNCH_FRESHNESS_DECISIONS.NOT_LAUNCHABLE_BROKEN,
        reason: 'broken_source',
      };

    default:
      return {
        decision: LAUNCH_FRESHNESS_DECISIONS.NOT_LAUNCHABLE_UNKNOWN,
        reason: 'unknown_freshness_not_verified_current',
      };
  }
}

// ── Planner states ───────────────────────────────────────────────────────────

export const PLAN_STATES = Object.freeze({
  CREATE: 'create',
  NO_CHANGE: 'no_change',
  UPDATE: 'update',
  SUPERSEDE: 'supersede',
  CONFLICT: 'conflict',
  MANUAL_REVIEW: 'manual_review',
  SKIP_INVALID: 'skip_invalid',
  SKIP_STALE: 'skip_stale',
  SKIP_DUPLICATE: 'skip_duplicate',
  SKIP_DEPENDENCY_FAILED: 'skip_dependency_failed',
});

const PLAN_STATE_SET = new Set(Object.values(PLAN_STATES));

export function isValidPlanState(value) {
  return typeof value === 'string' && PLAN_STATE_SET.has(value);
}

/** Plan states that would mutate canonical state in a future apply run. */
export const MUTATING_PLAN_STATES = Object.freeze([
  PLAN_STATES.CREATE,
  PLAN_STATES.UPDATE,
  PLAN_STATES.SUPERSEDE,
]);

export function isMutatingPlanState(value) {
  return MUTATING_PLAN_STATES.includes(value);
}

// ── Batch review lifecycle ───────────────────────────────────────────────────

/**
 * Batch lifecycle. Deliberately has NO `production_launched` state —
 * Mission 25 does not own production application.
 */
export const BATCH_REVIEW_STATES = Object.freeze({
  DRAFT: 'draft',
  VALIDATED: 'validated',
  REVIEW_REQUIRED: 'review_required',
  APPROVED_FOR_NONPRODUCTION: 'approved_for_nonproduction',
  APPLIED_NONPRODUCTION_FUTURE: 'applied_nonproduction_future',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
});

const BATCH_REVIEW_STATE_SET = new Set(Object.values(BATCH_REVIEW_STATES));

export function isValidBatchReviewState(value) {
  return typeof value === 'string' && BATCH_REVIEW_STATE_SET.has(value);
}

const BATCH_TRANSITIONS = {
  draft: new Set(['validated', 'review_required', 'rejected', 'archived']),
  validated: new Set(['review_required', 'approved_for_nonproduction', 'rejected', 'archived']),
  review_required: new Set(['validated', 'approved_for_nonproduction', 'rejected', 'archived']),
  approved_for_nonproduction: new Set(['applied_nonproduction_future', 'rejected', 'archived']),
  applied_nonproduction_future: new Set(['archived']),
  rejected: new Set(['draft', 'archived']),
  archived: new Set(),
};

export function isValidBatchTransition(from, to) {
  if (!isValidBatchReviewState(from) || !isValidBatchReviewState(to)) return false;
  return BATCH_TRANSITIONS[from].has(to);
}

/** Roles/realms permitted to approve a platform-wide launch batch. */
export const BATCH_APPROVAL_ROLES = Object.freeze(['admin', 'superadmin']);

/**
 * Approval authority check. Institution/agent/employer/student identities can
 * never approve a global verified launch batch, whatever they claim.
 *
 * @param {object} actor server-derived actor ({ role })
 */
export function canApproveLaunchBatch(actor = {}) {
  const role = typeof actor.role === 'string' ? actor.role.toLowerCase() : '';
  return BATCH_APPROVAL_ROLES.includes(role);
}

// ── Environment intent ───────────────────────────────────────────────────────

export const ENVIRONMENT_INTENTS = Object.freeze({
  LOCAL: 'local',
  TEST: 'test',
  NONPRODUCTION: 'nonproduction',
});

const ENVIRONMENT_INTENT_SET = new Set(Object.values(ENVIRONMENT_INTENTS));

export function isValidEnvironmentIntent(value) {
  return typeof value === 'string' && ENVIRONMENT_INTENT_SET.has(value);
}

/**
 * Environment names that can never be an application target in this mission.
 * Note this is a manifest-declared intent, not an inference from NODE_ENV.
 */
export const FORBIDDEN_ENVIRONMENT_INTENTS = Object.freeze([
  'production',
  'prod',
  'staging',
  'stage',
  'preprod',
  'pre-production',
]);

// ── Hard input bounds ────────────────────────────────────────────────────────

/**
 * Conservative bounds. A launch batch is an operator-reviewed unit of work,
 * not a bulk ingestion channel.
 */
export const LAUNCH_LIMITS = Object.freeze({
  MAX_MANIFEST_BYTES: 2 * 1024 * 1024, // 2 MiB
  MAX_RECORDS_PER_BATCH: 500,
  MAX_SOURCES_PER_BATCH: 500,
  MAX_SOURCES_PER_RECORD: 20,
  MAX_FACT_ENTRIES_PER_RECORD: 40,
  MAX_ARRAY_LENGTH: 100,
  MAX_STRING_LENGTH: 4000,
  MAX_KEY_LENGTH: 160,
  MAX_OBJECT_DEPTH: 8,
  MAX_OBJECT_KEYS: 60,
});

/** Stable external/canonical keys: conservative, URL- and filename-safe. */
const RECORD_KEY_RE = /^[a-z0-9][a-z0-9._:-]{2,159}$/;

export function isValidRecordKey(value) {
  return typeof value === 'string' && RECORD_KEY_RE.test(value);
}

const BATCH_ID_RE = /^[a-z0-9][a-z0-9._-]{7,79}$/;

export function isValidBatchId(value) {
  return typeof value === 'string' && BATCH_ID_RE.test(value);
}

// ── Source URL safety ────────────────────────────────────────────────────────

const FORBIDDEN_URL_SCHEMES = Object.freeze([
  'javascript:',
  'data:',
  'file:',
  'blob:',
  'vbscript:',
  'ftp:',
]);

const INTERNAL_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'ip6-localhost',
  'metadata.google.internal',
  'instance-data',
]);

/**
 * True when a hostname resolves to a private/loopback/link-local range by
 * literal inspection. No DNS is performed — Mission 25 makes no network calls.
 */
function isInternalHostname(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (INTERNAL_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return true;
  }
  // Bare hostname with no dot cannot be a public evidence host.
  if (!host.includes('.') && !host.includes(':')) return true;
  // IPv4 private / loopback / link-local ranges
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return true; // a bare public IP is never accepted as canonical evidence
  }
  // IPv6 unique-local / loopback
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
  return false;
}

/**
 * Validate a source URL for use as canonical public evidence.
 * Returns the Mission 5 normalized URL, or an error reason.
 *
 * @returns {{ ok: true, normalizedUrl: string } | { ok: false, reason: string }}
 */
export function validateLaunchSourceUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, reason: 'source_url_missing' };
  }
  if (raw.length > LAUNCH_LIMITS.MAX_STRING_LENGTH) {
    return { ok: false, reason: 'source_url_too_long' };
  }
  const lowered = raw.trim().toLowerCase();
  for (const scheme of FORBIDDEN_URL_SCHEMES) {
    if (lowered.startsWith(scheme)) {
      return { ok: false, reason: `source_url_forbidden_scheme:${scheme.replace(':', '')}` };
    }
  }
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'source_url_unparseable' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'source_url_non_http_scheme' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'source_url_contains_credentials' };
  }
  if (isInternalHostname(parsed.hostname)) {
    return { ok: false, reason: 'source_url_internal_or_non_public_host' };
  }
  const normalized = normalizeSourceUrl(raw);
  if (!normalized) return { ok: false, reason: 'source_url_not_normalizable' };
  return { ok: true, normalizedUrl: normalized };
}

// ── Deterministic canonicalization ───────────────────────────────────────────

/**
 * Recursively canonicalize a JSON-ish value for fingerprinting:
 *   - object keys sorted lexicographically
 *   - `undefined` members dropped
 *   - Date instances rendered as ISO strings
 *   - arrays keep their (already normalized) order
 *
 * The result is stable regardless of insertion order.
 */
export function canonicalizeValue(value, depth = 0) {
  if (depth > LAUNCH_LIMITS.MAX_OBJECT_DEPTH) {
    throw new Error('canonicalize: max object depth exceeded');
  }
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeValue(entry, depth + 1));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const canonical = canonicalizeValue(value[key], depth + 1);
      if (canonical !== undefined) out[key] = canonical;
    }
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('canonicalize: non-finite number');
  }
  return value;
}

/**
 * Deterministic ordering comparator for manifest records:
 * dependency order first, then canonical key.
 */
export function compareRecords(a, b) {
  const ai = entityOrderIndex(a?.entityType);
  const bi = entityOrderIndex(b?.entityType);
  if (ai !== bi) return ai - bi;
  const ak = String(a?.recordKey ?? '');
  const bk = String(b?.recordKey ?? '');
  if (ak < bk) return -1;
  if (ak > bk) return 1;
  return 0;
}

/**
 * Build the normalized, fingerprintable view of a manifest.
 *
 * Excluded deliberately:
 *   - batchId          (batch identity, not content)
 *   - createdAt        (volatile)
 *   - createdByProcess (volatile)
 *   - reviewState      (lifecycle, mutates without content change)
 *
 * Same normalized content ⇒ same fingerprint, whatever the key/array
 * insertion order in the source file.
 */
export function normalizeManifestForFingerprint(manifest = {}) {
  const records = Array.isArray(manifest.records) ? [...manifest.records] : [];
  const sources = Array.isArray(manifest.sourceSnapshot)
    ? [...manifest.sourceSnapshot]
    : [];

  records.sort(compareRecords);
  sources.sort((a, b) =>
    String(a?.sourceKey ?? '') < String(b?.sourceKey ?? '') ? -1 : 1
  );

  return canonicalizeValue({
    manifestVersion: manifest.manifestVersion ?? null,
    environmentIntent: manifest.environmentIntent ?? null,
    scope: manifest.scope ?? null,
    sourceSnapshot: sources,
    records,
  });
}

// ── Report shape ─────────────────────────────────────────────────────────────

/** Zero-value launch quality report; shape reference for aggregation. */
export const EMPTY_LAUNCH_REPORT = Object.freeze({
  totalRecords: 0,
  byEntityType: Object.freeze({}),
  byPlanState: Object.freeze({}),
  bySourceAuthority: Object.freeze({}),
  byFreshness: Object.freeze({}),
  byCountry: Object.freeze({}),
  conflicts: 0,
  duplicates: 0,
  stale: 0,
  invalid: 0,
  unknownSource: 0,
  dependencyFailures: 0,
  publishable: 0,
  reviewRequired: 0,
});

// Re-export the Mission 5 primitives callers need so launch code never has to
// invent its own hierarchy.
export {
  AUTHORITY_TYPES,
  FRESHNESS_STATES,
  SOURCE_STATUS,
  authorityTier,
  isValidAuthorityType,
  isValidFreshnessState,
  isValidSourceStatus,
};
