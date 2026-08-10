/**
 * Applicant Skill Claim + Evidence + Verification contract.
 *
 * The single trust rule this module exists to enforce:
 *
 *     CLAIMED != VERIFIED       EVIDENCE SUBMITTED != VERIFIED
 *
 * A GitHub / Figma / portfolio / social link proves only that a link was
 * supplied. It becomes trust *only* when an authorized reviewer, holding an
 * explicit permission, records a verification with a method, an evidence
 * reference, a reason, a server-derived actor and a timestamp — appended to an
 * immutable history. Nothing else in the platform may mint verified state:
 * not the applicant, not the employer, not the Copilot, not an admin acting
 * without provenance.
 *
 * Deliberately NOT in this checkpoint:
 *   - no external network calls (no GitHub/Figma API, no link fetching or
 *     scraping — see EXTERNAL_EVIDENCE_FETCH_ENABLED)
 *   - no code sandbox, no code execution, no practical assessment
 * Developer verification here is evidence-based only.
 *
 * Client- and server-safe: pure JS, no Node/DOM globals beyond WHATWG `URL`.
 */

// ---------------------------------------------------------------------------
// 1. Claim state machine
// ---------------------------------------------------------------------------

/** Canonical claim statuses. Never rename stored values. */
export const SKILL_CLAIM_STATUSES = Object.freeze({
  CLAIMED: 'claimed',
  EVIDENCE_SUBMITTED: 'evidence_submitted',
  VERIFICATION_PENDING: 'verification_pending',
  EVIDENCE_BACKED: 'evidence_backed',
  VERIFIED: 'verified',
  NEEDS_INFORMATION: 'needs_information',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
});

const S = SKILL_CLAIM_STATUSES;

const CLAIM_STATUS_SET = new Set(Object.values(S));

export function isValidClaimStatus(value) {
  return typeof value === 'string' && CLAIM_STATUS_SET.has(value);
}

/**
 * Explicit allowed transitions: from → Set<to>.
 * Anything not listed is rejected server-side. `revoked` is terminal.
 */
export const ALLOWED_CLAIM_TRANSITIONS = Object.freeze({
  [S.CLAIMED]: new Set([S.EVIDENCE_SUBMITTED, S.REVOKED]),
  [S.EVIDENCE_SUBMITTED]: new Set([
    S.VERIFICATION_PENDING,
    S.NEEDS_INFORMATION,
    S.REJECTED,
    S.REVOKED,
  ]),
  [S.VERIFICATION_PENDING]: new Set([
    S.EVIDENCE_BACKED,
    S.VERIFIED,
    S.NEEDS_INFORMATION,
    S.REJECTED,
    S.REVOKED,
  ]),
  [S.EVIDENCE_BACKED]: new Set([
    S.VERIFICATION_PENDING,
    S.VERIFIED,
    S.NEEDS_INFORMATION,
    S.REJECTED,
    S.EXPIRED,
    S.REVOKED,
  ]),
  [S.VERIFIED]: new Set([S.EXPIRED, S.REVOKED, S.NEEDS_INFORMATION]),
  [S.NEEDS_INFORMATION]: new Set([
    S.EVIDENCE_SUBMITTED,
    S.VERIFICATION_PENDING,
    S.REJECTED,
    S.REVOKED,
  ]),
  [S.REJECTED]: new Set([S.EVIDENCE_SUBMITTED, S.REVOKED]),
  [S.EXPIRED]: new Set([S.EVIDENCE_SUBMITTED, S.VERIFICATION_PENDING, S.REVOKED]),
  [S.REVOKED]: new Set([]),
});

export function isValidClaimTransition(from, to) {
  if (!isValidClaimStatus(from) || !isValidClaimStatus(to)) return false;
  return ALLOWED_CLAIM_TRANSITIONS[from]?.has(to) ?? false;
}

// ---------------------------------------------------------------------------
// 2. Transition authority — who may move a claim, and what they must supply
// ---------------------------------------------------------------------------

/** Actor classes permitted to drive a transition. */
export const TRANSITION_ACTORS = Object.freeze({
  APPLICANT: 'applicant',
  REVIEWER: 'reviewer',
  SYSTEM: 'system',
});

/** Permission strings mirrored in server/src/config/rbac.js. */
export const SKILL_VERIFICATION_PERMISSIONS = Object.freeze({
  READ: 'skill_verification:read',
  REVIEW: 'skill_verification:review',
  APPROVE: 'skill_verification:approve',
  REVOKE: 'skill_verification:revoke',
});

const P = SKILL_VERIFICATION_PERMISSIONS;

/**
 * Requirements per target status.
 *
 * `requiresEvidenceRef` is true exactly for the states that grant trust
 * (evidence_backed, verified) — those are the transitions that must carry
 * provenance. Reviewer actions always require a method and a reason.
 */
const TRANSITION_REQUIREMENTS = Object.freeze({
  [S.EVIDENCE_SUBMITTED]: { actor: TRANSITION_ACTORS.APPLICANT, permission: null, requiresMethod: false, requiresReason: false, requiresEvidenceRef: false },
  [S.VERIFICATION_PENDING]: { actor: TRANSITION_ACTORS.APPLICANT, permission: null, requiresMethod: false, requiresReason: false, requiresEvidenceRef: false },
  [S.EVIDENCE_BACKED]: { actor: TRANSITION_ACTORS.REVIEWER, permission: P.REVIEW, requiresMethod: true, requiresReason: true, requiresEvidenceRef: true },
  [S.VERIFIED]: { actor: TRANSITION_ACTORS.REVIEWER, permission: P.APPROVE, requiresMethod: true, requiresReason: true, requiresEvidenceRef: true },
  [S.NEEDS_INFORMATION]: { actor: TRANSITION_ACTORS.REVIEWER, permission: P.REVIEW, requiresMethod: true, requiresReason: true, requiresEvidenceRef: false },
  [S.REJECTED]: { actor: TRANSITION_ACTORS.REVIEWER, permission: P.REVIEW, requiresMethod: true, requiresReason: true, requiresEvidenceRef: false },
  [S.REVOKED]: { actor: TRANSITION_ACTORS.REVIEWER, permission: P.REVOKE, requiresMethod: true, requiresReason: true, requiresEvidenceRef: false },
  [S.EXPIRED]: { actor: TRANSITION_ACTORS.SYSTEM, permission: null, requiresMethod: false, requiresReason: false, requiresEvidenceRef: false },
  [S.CLAIMED]: { actor: TRANSITION_ACTORS.APPLICANT, permission: null, requiresMethod: false, requiresReason: false, requiresEvidenceRef: false },
});

/**
 * What a given target status demands. Returns null for unknown statuses so
 * callers fail closed rather than defaulting to "applicant may do it".
 */
export function getTransitionRequirements(toStatus) {
  if (!isValidClaimStatus(toStatus)) return null;
  return TRANSITION_REQUIREMENTS[toStatus] ?? null;
}

/** Statuses an applicant may ever drive. Everything else needs a reviewer. */
export const APPLICANT_DRIVABLE_STATUSES = Object.freeze(
  Object.entries(TRANSITION_REQUIREMENTS)
    .filter(([, r]) => r.actor === TRANSITION_ACTORS.APPLICANT)
    .map(([status]) => status)
);

// ---------------------------------------------------------------------------
// 3. Verification methods
// ---------------------------------------------------------------------------

/**
 * How a reviewer established the outcome. Methods marked `enabled: false` are
 * declared for forward compatibility but are refused at runtime — notably
 * PRACTICAL_ASSESSMENT, which requires the code-sandbox work that is
 * explicitly out of scope, and AUTOMATED_PROVIDER_CHECK, which requires the
 * external API integration this checkpoint forbids.
 */
export const VERIFICATION_METHODS = Object.freeze({
  MANUAL_EVIDENCE_REVIEW: 'manual_evidence_review',
  DOCUMENT_REVIEW: 'document_review',
  ISSUER_CONFIRMATION: 'issuer_confirmation',
  EMPLOYER_REFERENCE: 'employer_reference',
  INTERVIEW_ASSESSMENT: 'interview_assessment',
  PRACTICAL_ASSESSMENT: 'practical_assessment',
  AUTOMATED_PROVIDER_CHECK: 'automated_provider_check',
});

const M = VERIFICATION_METHODS;

const ENABLED_METHODS = new Set([
  M.MANUAL_EVIDENCE_REVIEW,
  M.DOCUMENT_REVIEW,
  M.ISSUER_CONFIRMATION,
  M.EMPLOYER_REFERENCE,
  M.INTERVIEW_ASSESSMENT,
]);

/** Declared but refused in this checkpoint. */
export const DEFERRED_METHODS = Object.freeze([
  M.PRACTICAL_ASSESSMENT,
  M.AUTOMATED_PROVIDER_CHECK,
]);

export function isValidVerificationMethod(value) {
  return typeof value === 'string' && Object.values(M).includes(value);
}

/** True only for a method this checkpoint will actually accept. */
export function isEnabledVerificationMethod(value) {
  return typeof value === 'string' && ENABLED_METHODS.has(value);
}

// ---------------------------------------------------------------------------
// 4. Evidence types and providers (extensible)
// ---------------------------------------------------------------------------

/**
 * Evidence types are profession-neutral on purpose. A developer's repository
 * and a designer's portfolio are both "a link to work you produced"; encoding
 * `github`/`figma` as types would make every new profession a schema change.
 * The concrete platform is captured separately as a provider (below).
 */
export const SKILL_EVIDENCE_TYPES = Object.freeze({
  CODE_REPOSITORY: 'code_repository',
  LIVE_PROJECT: 'live_project',
  DESIGN_PORTFOLIO: 'design_portfolio',
  PORTFOLIO_SITE: 'portfolio_site',
  PROFESSIONAL_PROFILE: 'professional_profile',
  CREDENTIAL_CERTIFICATE: 'credential_certificate',
  PUBLICATION: 'publication',
  CASE_STUDY: 'case_study',
  WORK_SAMPLE: 'work_sample',
  OTHER_EVIDENCE: 'other_evidence',
});

const EVIDENCE_TYPE_SET = new Set(Object.values(SKILL_EVIDENCE_TYPES));

export function isValidSkillEvidenceType(value) {
  return typeof value === 'string' && EVIDENCE_TYPE_SET.has(value);
}

/**
 * Known providers, recognised by host suffix. Purely descriptive: a provider
 * match confers NO trust and NO verification. It exists so the UI can label a
 * link and so reviewers can see at a glance what they are looking at.
 * Unknown hosts are accepted and labelled `generic`.
 */
export const EVIDENCE_PROVIDERS = Object.freeze({
  GITHUB: 'github',
  GITLAB: 'gitlab',
  BITBUCKET: 'bitbucket',
  FIGMA: 'figma',
  BEHANCE: 'behance',
  DRIBBBLE: 'dribbble',
  LINKEDIN: 'linkedin',
  STACKOVERFLOW: 'stackoverflow',
  KAGGLE: 'kaggle',
  MEDIUM: 'medium',
  NPM: 'npm',
  CREDLY: 'credly',
  COURSERA: 'coursera',
  ORCID: 'orcid',
  GENERIC: 'generic',
});

/** host suffix → provider slug. Extend here when a platform is added. */
const PROVIDER_HOST_MAP = Object.freeze({
  'github.com': EVIDENCE_PROVIDERS.GITHUB,
  'github.io': EVIDENCE_PROVIDERS.GITHUB,
  'gitlab.com': EVIDENCE_PROVIDERS.GITLAB,
  'bitbucket.org': EVIDENCE_PROVIDERS.BITBUCKET,
  'figma.com': EVIDENCE_PROVIDERS.FIGMA,
  'behance.net': EVIDENCE_PROVIDERS.BEHANCE,
  'dribbble.com': EVIDENCE_PROVIDERS.DRIBBBLE,
  'linkedin.com': EVIDENCE_PROVIDERS.LINKEDIN,
  'stackoverflow.com': EVIDENCE_PROVIDERS.STACKOVERFLOW,
  'kaggle.com': EVIDENCE_PROVIDERS.KAGGLE,
  'medium.com': EVIDENCE_PROVIDERS.MEDIUM,
  'npmjs.com': EVIDENCE_PROVIDERS.NPM,
  'credly.com': EVIDENCE_PROVIDERS.CREDLY,
  'coursera.org': EVIDENCE_PROVIDERS.COURSERA,
  'orcid.org': EVIDENCE_PROVIDERS.ORCID,
});

/**
 * Map a normalized hostname to a provider slug. Matches the exact host or a
 * subdomain of it, never a mere substring — `github.com.evil.tld` must not be
 * labelled `github`.
 */
export function resolveEvidenceProvider(hostname) {
  if (typeof hostname !== 'string' || !hostname) return EVIDENCE_PROVIDERS.GENERIC;
  const host = hostname.toLowerCase();
  for (const [suffix, provider] of Object.entries(PROVIDER_HOST_MAP)) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return provider;
  }
  return EVIDENCE_PROVIDERS.GENERIC;
}

/**
 * Suggested evidence types per skill category — a UI affordance only.
 * Any valid evidence type is accepted for any skill; this list must never be
 * used to reject a submission, or non-listed professions become second-class.
 */
export const SUGGESTED_EVIDENCE_TYPES = Object.freeze({
  technical: [SKILL_EVIDENCE_TYPES.CODE_REPOSITORY, SKILL_EVIDENCE_TYPES.LIVE_PROJECT, SKILL_EVIDENCE_TYPES.PORTFOLIO_SITE],
  design: [SKILL_EVIDENCE_TYPES.DESIGN_PORTFOLIO, SKILL_EVIDENCE_TYPES.CASE_STUDY, SKILL_EVIDENCE_TYPES.PORTFOLIO_SITE],
  business: [SKILL_EVIDENCE_TYPES.CASE_STUDY, SKILL_EVIDENCE_TYPES.PROFESSIONAL_PROFILE, SKILL_EVIDENCE_TYPES.CREDENTIAL_CERTIFICATE],
  research: [SKILL_EVIDENCE_TYPES.PUBLICATION, SKILL_EVIDENCE_TYPES.CREDENTIAL_CERTIFICATE],
  language: [SKILL_EVIDENCE_TYPES.CREDENTIAL_CERTIFICATE, SKILL_EVIDENCE_TYPES.PROFESSIONAL_PROFILE],
  soft: [SKILL_EVIDENCE_TYPES.PROFESSIONAL_PROFILE, SKILL_EVIDENCE_TYPES.WORK_SAMPLE],
  other: [SKILL_EVIDENCE_TYPES.WORK_SAMPLE, SKILL_EVIDENCE_TYPES.OTHER_EVIDENCE],
});

/** Keys of SUGGESTED_EVIDENCE_TYPES must stay a subset of SKILL_CATEGORIES. */
export const SUGGESTED_EVIDENCE_CATEGORIES = Object.freeze(Object.keys(SUGGESTED_EVIDENCE_TYPES));

export function getSuggestedEvidenceTypes(skillCategory) {
  return SUGGESTED_EVIDENCE_TYPES[skillCategory] ?? SUGGESTED_EVIDENCE_TYPES.other;
}

// ---------------------------------------------------------------------------
// 5. Bounds
// ---------------------------------------------------------------------------

export const SKILL_CLAIM_LIMITS = Object.freeze({
  MAX_EVIDENCE_PER_CLAIM: 10,
  MAX_CLAIMS_PER_USER: 50,
  MAX_URL_LENGTH: 2048,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_SKILL_NAME_LENGTH: 80,
  MAX_REASON_LENGTH: 1000,
  MAX_EVIDENCE_REFS_PER_VERIFICATION: 10,
});

/**
 * External evidence links are NEVER fetched, resolved, previewed or scraped in
 * this checkpoint. Only the reference and safe metadata are stored. Flipping
 * this flag is not sufficient to enable fetching — it exists so tests can
 * assert the boundary is declared and closed.
 */
export const EXTERNAL_EVIDENCE_FETCH_ENABLED = false;

// ---------------------------------------------------------------------------
// 6. Evidence URL validation
// ---------------------------------------------------------------------------

const ALLOWED_URL_PROTOCOLS = new Set(['https:']);

/** Explicitly named so the rejection reason is auditable and testable. */
export const URL_REJECTION_REASONS = Object.freeze({
  NOT_A_STRING: 'not_a_string',
  EMPTY: 'empty',
  TOO_LONG: 'too_long',
  CONTROL_CHARACTERS: 'control_characters',
  UNPARSEABLE: 'unparseable',
  UNSUPPORTED_SCHEME: 'unsupported_scheme',
  EMBEDDED_CREDENTIALS: 'embedded_credentials',
  PRIVATE_NETWORK: 'private_network',
  MARKUP_INJECTION: 'markup_injection',
});

function hasControlCharacters(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/** Hostnames that can never constitute public proof. */
const PRIVATE_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
const PRIVATE_TLD_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

/**
 * Recover the embedded IPv4 address from an IPv4-mapped IPv6 literal.
 *
 * WHATWG URL does not preserve the readable `::ffff:127.0.0.1` spelling — it
 * normalizes to the compressed hex form `::ffff:7f00:1`, so a dotted-quad
 * match alone would let loopback through. Both spellings are handled here.
 *
 * @returns {string|null} dotted-quad IPv4, or null when not IPv4-mapped
 */
function extractMappedIpv4(inner) {
  const dotted = inner.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) return dotted[1];
  const hex = inner.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  if (Number.isNaN(high) || Number.isNaN(low)) return null;
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

/**
 * True when a normalized hostname points at loopback, a private range, a
 * link-local address or carrier-grade NAT space — none of which a third party
 * can ever open, so none of which is public proof of anything.
 *
 * Relies on WHATWG URL normalization: `https://2130706433/` and
 * `https://0x7f.1/` both arrive here already rewritten to `127.0.0.1`, so
 * decimal/octal/hex IPv4 obfuscation cannot slip past the numeric checks.
 */
export function isPrivateOrLocalHost(hostname) {
  if (typeof hostname !== 'string' || !hostname) return true;
  const host = hostname.toLowerCase();
  if (PRIVATE_HOSTNAMES.has(host)) return true;
  if (PRIVATE_TLD_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;

  // IPv6 literals arrive bracketed from URL.hostname
  if (host.startsWith('[')) {
    const inner = host.slice(1, -1);
    if (inner === '::1' || inner === '::') return true;
    if (inner.startsWith('fc') || inner.startsWith('fd')) return true; // unique-local
    if (inner.startsWith('fe80')) return true; // link-local
    const mapped = extractMappedIpv4(inner);
    if (mapped) return isPrivateOrLocalHost(mapped);
    return false;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/**
 * Validate an applicant-supplied evidence URL.
 *
 * Rejects: non-https schemes (so `javascript:`, `data:`, `file:`, `ftp:` and
 * plain `http:` are all refused), embedded credentials, control characters,
 * markup, over-long values, and any host on a private/loopback network.
 *
 * The URL is never fetched — validation is purely structural.
 *
 * @returns {{ ok: true, value: string, hostname: string, provider: string }
 *          | { ok: false, reason: string }}
 */
export function validateEvidenceUrl(rawValue) {
  if (typeof rawValue !== 'string') return { ok: false, reason: URL_REJECTION_REASONS.NOT_A_STRING };
  const trimmed = rawValue.trim();
  if (!trimmed) return { ok: false, reason: URL_REJECTION_REASONS.EMPTY };
  if (trimmed.length > SKILL_CLAIM_LIMITS.MAX_URL_LENGTH) {
    return { ok: false, reason: URL_REJECTION_REASONS.TOO_LONG };
  }
  if (hasControlCharacters(trimmed)) {
    return { ok: false, reason: URL_REJECTION_REASONS.CONTROL_CHARACTERS };
  }
  if (/[<>]/.test(trimmed)) {
    return { ok: false, reason: URL_REJECTION_REASONS.MARKUP_INJECTION };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: URL_REJECTION_REASONS.UNPARSEABLE };
  }

  if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, reason: URL_REJECTION_REASONS.UNSUPPORTED_SCHEME };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: URL_REJECTION_REASONS.EMBEDDED_CREDENTIALS };
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return { ok: false, reason: URL_REJECTION_REASONS.PRIVATE_NETWORK };
  }

  return {
    ok: true,
    value: parsed.href,
    hostname: parsed.hostname.toLowerCase(),
    provider: resolveEvidenceProvider(parsed.hostname),
  };
}

/**
 * Validate a short free-text evidence description. Rejects markup outright
 * rather than sanitizing, so nothing HTML-ish is ever persisted.
 */
export function validateEvidenceDescription(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return { ok: true, value: '' };
  if (typeof rawValue !== 'string') return { ok: false, reason: 'not_a_string' };
  const trimmed = rawValue.trim();
  if (trimmed.length > SKILL_CLAIM_LIMITS.MAX_DESCRIPTION_LENGTH) return { ok: false, reason: 'too_long' };
  if (/[<>]/.test(trimmed)) return { ok: false, reason: 'markup_injection' };
  if (hasControlCharacters(trimmed.replace(/[\r\n\t]/g, ''))) return { ok: false, reason: 'control_characters' };
  return { ok: true, value: trimmed };
}

// ---------------------------------------------------------------------------
// 7. Mass-assignment boundary
// ---------------------------------------------------------------------------

/** The only fields an applicant may ever supply when creating a claim. */
export const APPLICANT_CLAIM_INPUT_FIELDS = Object.freeze([
  'skillName',
  'skillCategory',
  'claimedLevel',
  'yearsOfExperience',
]);

/** The only fields an applicant may ever supply when attaching evidence. */
export const APPLICANT_EVIDENCE_INPUT_FIELDS = Object.freeze([
  'evidenceType',
  'url',
  'description',
]);

/**
 * Fields that carry trust. An applicant (or employer, or AI) supplying any of
 * these is not a validation nuisance to be trimmed silently — it is an attempt
 * to mint verification, so it is rejected loudly and auditably.
 */
export const TRUST_CONTROLLED_FIELDS = Object.freeze([
  'status',
  'verificationStatus',
  'verificationScore',
  'score',
  'verifiedBy',
  'verifiedByRole',
  'verifiedAt',
  'verificationLevel',
  'trustBadge',
  'badges',
  'expiresAt',
  'revokedAt',
  'revokedBy',
  'currentVerificationId',
  'verificationMethod',
  'method',
  'evidenceStatus',
  'reviewedBy',
  'reviewedAt',
]);

const TRUST_FIELD_SET = new Set(TRUST_CONTROLLED_FIELDS);

/**
 * Strip an untrusted payload down to an allowlist, refusing outright if it
 * tries to set anything trust-bearing.
 *
 * @returns {{ ok: true, value: object } | { ok: false, reason: string, fields: string[] }}
 */
export function extractApplicantInput(payload, allowedFields) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, reason: 'invalid_payload', fields: [] };
  }
  const attempted = Object.keys(payload).filter((k) => TRUST_FIELD_SET.has(k));
  if (attempted.length) {
    return { ok: false, reason: 'trust_controlled_field', fields: attempted };
  }
  const value = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) value[field] = payload[field];
  }
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// 8. Current-trust derivation
// ---------------------------------------------------------------------------

/**
 * True only when the claim is verified AND that verification is still live.
 * Revocation and expiry both remove verified standing immediately — a stored
 * `status: 'verified'` is never sufficient on its own.
 */
export function isCurrentlyVerified(claim, now = new Date()) {
  if (!claim || claim.status !== S.VERIFIED) return false;
  if (claim.revokedAt) return false;
  if (claim.expiresAt && new Date(claim.expiresAt).getTime() <= new Date(now).getTime()) return false;
  return true;
}

/**
 * The status a viewer should actually be shown, after applying revocation and
 * expiry. Storage may lag (expiry is time-based, and no worker runs in this
 * checkpoint); this function is the read-time source of truth so an expired
 * verification can never be rendered as current.
 */
export function deriveCurrentTrustState(claim, now = new Date()) {
  if (!claim || !isValidClaimStatus(claim.status)) return S.CLAIMED;
  if (claim.revokedAt) return S.REVOKED;
  const expired =
    claim.expiresAt && new Date(claim.expiresAt).getTime() <= new Date(now).getTime();
  if (expired && (claim.status === S.VERIFIED || claim.status === S.EVIDENCE_BACKED)) {
    return S.EXPIRED;
  }
  return claim.status;
}

/**
 * Display contract for every claim state. `tone` drives styling; the point is
 * that no two states collapse into one generic checkmark — an employer must be
 * able to tell "they pasted a link" from "we checked it".
 */
export const TRUST_STATE_DISPLAY = Object.freeze({
  [S.CLAIMED]: { label: 'Claimed', tone: 'neutral', verified: false, description: 'Self-reported by the applicant. Not checked.' },
  [S.EVIDENCE_SUBMITTED]: { label: 'Evidence submitted', tone: 'info', verified: false, description: 'Applicant supplied links. Not yet reviewed.' },
  [S.VERIFICATION_PENDING]: { label: 'Verification pending', tone: 'info', verified: false, description: 'Queued for review. Not yet verified.' },
  [S.EVIDENCE_BACKED]: { label: 'Evidence-backed', tone: 'progress', verified: false, description: 'A reviewer confirmed the evidence exists and is relevant. Not a full skill verification.' },
  [S.VERIFIED]: { label: 'Verified', tone: 'success', verified: true, description: 'Verified by Strideto review, with recorded method and evidence.' },
  [S.NEEDS_INFORMATION]: { label: 'Needs information', tone: 'warning', verified: false, description: 'Reviewer requested more evidence.' },
  [S.REJECTED]: { label: 'Rejected', tone: 'danger', verified: false, description: 'Evidence did not support the claim.' },
  [S.EXPIRED]: { label: 'Expired', tone: 'muted', verified: false, description: 'Verification lapsed and is no longer current.' },
  [S.REVOKED]: { label: 'Revoked', tone: 'danger', verified: false, description: 'Verification was withdrawn.' },
});

export function getTrustStateDisplay(status) {
  return TRUST_STATE_DISPLAY[status] ?? TRUST_STATE_DISPLAY[S.CLAIMED];
}

// ---------------------------------------------------------------------------
// 9. Verification score (server-derived only)
// ---------------------------------------------------------------------------

/**
 * Deterministic 0-100 confidence score derived ONLY from server-held facts:
 * the reviewed state, how many distinct evidence types a reviewer accepted,
 * and the method used. No client input reaches this function, and a claim that
 * is not currently verified/evidence-backed scores 0 by construction.
 */
export function computeVerificationScore({ status, acceptedEvidenceTypes = [], method, revokedAt, expiresAt } = {}, now = new Date()) {
  const state = deriveCurrentTrustState({ status, revokedAt, expiresAt }, now);
  if (state !== S.VERIFIED && state !== S.EVIDENCE_BACKED) return 0;

  const base = state === S.VERIFIED ? 60 : 30;
  const distinctTypes = new Set(
    (Array.isArray(acceptedEvidenceTypes) ? acceptedEvidenceTypes : []).filter(isValidSkillEvidenceType)
  );
  const evidenceBonus = Math.min(distinctTypes.size, 3) * 8;

  const methodBonus =
    method === M.ISSUER_CONFIRMATION ? 16
      : method === M.INTERVIEW_ASSESSMENT ? 12
        : method === M.DOCUMENT_REVIEW ? 8
          : method === M.EMPLOYER_REFERENCE ? 8
            : method === M.MANUAL_EVIDENCE_REVIEW ? 4
              : 0;

  return Math.max(0, Math.min(100, base + evidenceBonus + methodBonus));
}

// ---------------------------------------------------------------------------
// 10. Projections
// ---------------------------------------------------------------------------

/**
 * What an employer may see. Deliberately excludes reviewer identity, internal
 * reasons, correlation ids and raw history — an employer learns the trust
 * state and the shape of the evidence, never Strideto's internal review notes.
 */
export function projectClaimForEmployer(claim, evidence = [], now = new Date()) {
  if (!claim) return null;
  const state = deriveCurrentTrustState(claim, now);
  const display = getTrustStateDisplay(state);
  return {
    id: String(claim.id ?? claim._id ?? ''),
    skillName: claim.skillName ?? '',
    skillCategory: claim.skillCategory ?? 'other',
    claimedLevel: claim.claimedLevel ?? '',
    trustState: state,
    trustLabel: display.label,
    isCurrentlyVerified: state === S.VERIFIED,
    verificationScore: state === S.VERIFIED || state === S.EVIDENCE_BACKED ? (claim.verificationScore ?? 0) : 0,
    verifiedAt: state === S.VERIFIED ? (claim.verifiedAt ?? null) : null,
    verificationMethod: state === S.VERIFIED || state === S.EVIDENCE_BACKED ? (claim.verificationMethod ?? null) : null,
    evidenceCount: Array.isArray(evidence) ? evidence.length : (claim.evidenceCount ?? 0),
    evidence: (Array.isArray(evidence) ? evidence : []).map(projectEvidenceForEmployer),
  };
}

/**
 * Evidence as an employer may see it: type, provider label and host — never
 * the reviewer's notes, never an internal id, never anything fetched.
 */
export function projectEvidenceForEmployer(item) {
  if (!item) return null;
  return {
    evidenceType: item.evidenceType ?? SKILL_EVIDENCE_TYPES.OTHER_EVIDENCE,
    provider: item.provider ?? EVIDENCE_PROVIDERS.GENERIC,
    hostname: item.hostname ?? '',
    url: item.url ?? '',
    description: item.description ?? '',
  };
}

/**
 * Public projection — strictly narrower than the employer view. No URLs, no
 * hostnames, no counts that could fingerprint a private profile: only the
 * skill and whether it is currently verified.
 */
export function projectClaimForPublic(claim, now = new Date()) {
  if (!claim) return null;
  const state = deriveCurrentTrustState(claim, now);
  return {
    skillName: claim.skillName ?? '',
    skillCategory: claim.skillCategory ?? 'other',
    trustState: state,
    trustLabel: getTrustStateDisplay(state).label,
    isCurrentlyVerified: state === S.VERIFIED,
  };
}

// ---------------------------------------------------------------------------
// 11. Application-time snapshot
// ---------------------------------------------------------------------------

/**
 * Freeze the applicant's skill trust state at the moment they applied, so a
 * later profile edit cannot rewrite the evidence an employer decided on.
 *
 * Built exclusively from server-held claim records: the caller supplies no
 * trust values, which is what makes the snapshot unforgeable (see
 * `buildSkillSnapshot` callers — the request body never reaches this).
 */
export function buildSkillSnapshot(claims = [], now = new Date()) {
  const list = Array.isArray(claims) ? claims : [];
  return {
    capturedAt: new Date(now).toISOString(),
    skills: list.map((claim) => {
      const state = deriveCurrentTrustState(claim, now);
      return {
        skillName: claim.skillName ?? '',
        skillCategory: claim.skillCategory ?? 'other',
        claimedLevel: claim.claimedLevel ?? '',
        trustState: state,
        isCurrentlyVerified: state === S.VERIFIED,
        verificationScore: state === S.VERIFIED || state === S.EVIDENCE_BACKED ? (claim.verificationScore ?? 0) : 0,
        evidenceCount: claim.evidenceCount ?? 0,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 12. Employer filtering
// ---------------------------------------------------------------------------

/**
 * Trust filters an employer may apply. `any` is the default on purpose:
 * absence of verification is not evidence of incompetence, and the platform
 * must not quietly make unverified applicants invisible.
 */
export const EMPLOYER_TRUST_FILTERS = Object.freeze({
  ANY: 'any',
  CLAIMED: 'claimed',
  EVIDENCE_BACKED: 'evidence_backed',
  VERIFIED: 'verified',
});

const TRUST_FILTER_SET = new Set(Object.values(EMPLOYER_TRUST_FILTERS));

export function isValidEmployerTrustFilter(value) {
  return typeof value === 'string' && TRUST_FILTER_SET.has(value);
}

/**
 * Apply a trust filter to server-derived state. Takes the claim record — never
 * a caller-supplied trust value — and recomputes state before comparing.
 */
export function matchesTrustFilter(claim, filter, now = new Date()) {
  if (!isValidEmployerTrustFilter(filter) || filter === EMPLOYER_TRUST_FILTERS.ANY) return true;
  const state = deriveCurrentTrustState(claim, now);
  if (filter === EMPLOYER_TRUST_FILTERS.VERIFIED) return state === S.VERIFIED;
  if (filter === EMPLOYER_TRUST_FILTERS.EVIDENCE_BACKED) {
    return state === S.EVIDENCE_BACKED || state === S.VERIFIED;
  }
  if (filter === EMPLOYER_TRUST_FILTERS.CLAIMED) return true; // every claim is at least claimed
  return true;
}

/**
 * Whether a job may treat missing verification as disqualifying. Only true
 * when the job explicitly opted in under an accepted policy — otherwise an
 * unverified applicant stays eligible.
 */
export function requiresVerifiedSkill(job, skillName) {
  if (!job || !Array.isArray(job.verifiedSkillRequirements)) return false;
  if (job.verifiedSkillPolicyAccepted !== true) return false;
  const target = String(skillName ?? '').trim().toLowerCase();
  return job.verifiedSkillRequirements.some(
    (s) => String(s ?? '').trim().toLowerCase() === target
  );
}

// ---------------------------------------------------------------------------
// 13. Skill name normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a skill name for dedupe/lookup. Unicode-preserving (a skill may be
 * named in any script) but whitespace- and case-normalized.
 */
export function normalizeSkillName(rawValue) {
  if (typeof rawValue !== 'string') return '';
  return rawValue.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function validateSkillName(rawValue) {
  if (typeof rawValue !== 'string') return { ok: false, reason: 'not_a_string' };
  const trimmed = rawValue.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (trimmed.length > SKILL_CLAIM_LIMITS.MAX_SKILL_NAME_LENGTH) return { ok: false, reason: 'too_long' };
  if (/[<>]/.test(trimmed)) return { ok: false, reason: 'markup_injection' };
  if (hasControlCharacters(trimmed)) return { ok: false, reason: 'control_characters' };
  return { ok: true, value: trimmed, normalized: normalizeSkillName(trimmed) };
}
