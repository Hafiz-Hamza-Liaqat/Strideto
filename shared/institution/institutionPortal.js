/**
 * Institution Portal contract (Mission 18).
 *
 * Canonical constants for the Verified Institution Portal:
 * roles, claim states, conflict states, change categories,
 * notification events, completeness sections, and publishing policy.
 *
 * Client- and server-safe: pure JS, no Node/DOM globals.
 */

// ── Institution organization membership roles ─────────────────────────────────

export const INSTITUTION_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
});

const ROLE_SET = new Set(Object.values(INSTITUTION_ROLES));
export const isValidInstitutionRole = (v) => typeof v === 'string' && ROLE_SET.has(v);

/** Roles that may submit official changes and manage programs. */
const SUBMITTER_ROLES = new Set([INSTITUTION_ROLES.OWNER, INSTITUTION_ROLES.ADMIN, INSTITUTION_ROLES.EDITOR]);
export const canSubmitOfficialChanges = (role) => SUBMITTER_ROLES.has(role);

/** Roles that may manage team membership. */
const TEAM_MANAGER_ROLES = new Set([INSTITUTION_ROLES.OWNER, INSTITUTION_ROLES.ADMIN]);
export const canManageTeam = (role) => TEAM_MANAGER_ROLES.has(role);

// ── Canonical institution claim states ────────────────────────────────────────

export const CLAIM_STATES = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  NEEDS_INFORMATION: 'needs_information',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
});

const CLAIM_STATE_SET = new Set(Object.values(CLAIM_STATES));
export const isValidClaimState = (v) => typeof v === 'string' && CLAIM_STATE_SET.has(v);

/** Valid claim state transitions. Admin/trust review controls final linkage. */
export const CLAIM_TRANSITIONS = Object.freeze({
  [CLAIM_STATES.DRAFT]: new Set([CLAIM_STATES.SUBMITTED]),
  [CLAIM_STATES.SUBMITTED]: new Set([CLAIM_STATES.UNDER_REVIEW, CLAIM_STATES.NEEDS_INFORMATION]),
  [CLAIM_STATES.UNDER_REVIEW]: new Set([CLAIM_STATES.APPROVED, CLAIM_STATES.REJECTED, CLAIM_STATES.NEEDS_INFORMATION]),
  [CLAIM_STATES.NEEDS_INFORMATION]: new Set([CLAIM_STATES.SUBMITTED, CLAIM_STATES.UNDER_REVIEW]),
  [CLAIM_STATES.APPROVED]: new Set([CLAIM_STATES.REVOKED]),
  [CLAIM_STATES.REJECTED]: new Set([CLAIM_STATES.DRAFT]),
  [CLAIM_STATES.REVOKED]: new Set([]),
});

export const isValidClaimTransition = (from, to) => {
  if (!isValidClaimState(from) || !isValidClaimState(to)) return false;
  return CLAIM_TRANSITIONS[from]?.has(to) ?? false;
};

/** True when an approved claim grants privileged canonical authority. */
export const claimGrantsAuthority = (state) => state === CLAIM_STATES.APPROVED;

// ── Data conflict states ──────────────────────────────────────────────────────

export const CONFLICT_STATES = Object.freeze({
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  RESOLVED_INSTITUTION: 'resolved_institution',
  RESOLVED_EXISTING: 'resolved_existing',
  DISMISSED: 'dismissed',
});

const CONFLICT_STATE_SET = new Set(Object.values(CONFLICT_STATES));
export const isValidConflictState = (v) => typeof v === 'string' && CONFLICT_STATE_SET.has(v);

// ── Change event categories ───────────────────────────────────────────────────

export const CHANGE_CATEGORIES = Object.freeze({
  TUITION: 'tuition',
  DEADLINE: 'deadline',
  TEST_REQUIREMENT: 'test_requirement',
  PROGRAM_STATUS: 'program_status',
  SCHOLARSHIP_CRITERIA: 'scholarship_criteria',
  INSTITUTION_IDENTITY: 'institution_identity',
  ACCREDITATION: 'accreditation',
  INTAKE: 'intake',
  REQUIREMENT: 'requirement',
  PROVENANCE_RECONFIRMATION: 'provenance_reconfirmation',
  OTHER: 'other',
});

const CHANGE_CAT_SET = new Set(Object.values(CHANGE_CATEGORIES));
export const isValidChangeCategory = (v) => typeof v === 'string' && CHANGE_CAT_SET.has(v);

// ── Notification event types ──────────────────────────────────────────────────

export const INSTITUTION_NOTIFICATION_TYPES = Object.freeze({
  VERIFICATION_UPDATE: 'verification_update',
  CLAIM_REVIEW_RESULT: 'claim_review_result',
  CONTENT_NEEDS_CHANGES: 'content_needs_changes',
  STALE_REVIEW_DUE: 'stale_review_due',
  CONFLICT_REQUIRES_ACTION: 'conflict_requires_action',
});

const NOTIF_TYPE_SET = new Set(Object.values(INSTITUTION_NOTIFICATION_TYPES));
export const isValidNotificationType = (v) => typeof v === 'string' && NOTIF_TYPE_SET.has(v);

// ── Profile completeness sections ─────────────────────────────────────────────

export const COMPLETENESS_SECTIONS = Object.freeze([
  { key: 'legalIdentity', label: 'Legal Identity', weight: 15 },
  { key: 'officialWebsite', label: 'Official Website', weight: 10 },
  { key: 'location', label: 'Location / Address', weight: 10 },
  { key: 'contactChannels', label: 'Contact Channels', weight: 5 },
  { key: 'institutionType', label: 'Institution Type', weight: 10 },
  { key: 'academicProfile', label: 'Academic Profile', weight: 10 },
  { key: 'accreditation', label: 'Accreditation', weight: 10 },
  { key: 'verificationEvidence', label: 'Verification Evidence', weight: 15 },
  { key: 'canonicalClaim', label: 'Canonical Institution Claim', weight: 15 },
]);

/**
 * Compute explainable profile completeness.
 * completeness.score is 0-100. Does NOT imply verification or canonical ownership.
 */
export function computeInstitutionCompleteness(sections = {}) {
  let earned = 0;
  const completed = [];
  const missing = [];

  for (const def of COMPLETENESS_SECTIONS) {
    const val = sections[def.key];
    const present =
      val !== null &&
      val !== undefined &&
      val !== '' &&
      !(Array.isArray(val) && val.length === 0);
    if (present) {
      earned += def.weight;
      completed.push(def.key);
    } else {
      missing.push(def.key);
    }
  }

  return { score: Math.min(100, earned), completed, missing };
}

// ── Publishing policy ─────────────────────────────────────────────────────────

/**
 * High-impact fields require admin/data review before publishing.
 * Low-risk fields may publish directly upon approved canonical ownership.
 */
export const HIGH_IMPACT_FIELDS = Object.freeze(new Set([
  'tuition',
  'deadline',
  'applicationDeadline',
  'testRequirements',
  'admissionRequirements',
  'accreditation',
  'scholarshipCriteria',
  'programStatus',
  'discontinued',
]));

export const isHighImpactField = (field) => HIGH_IMPACT_FIELDS.has(field);

// ── Institution organization types ────────────────────────────────────────────

/** Institution-eligible organization types. Subset of ORGANIZATION_TYPES. */
export const INSTITUTION_ORGANIZATION_TYPES = Object.freeze([
  'university',
  'college',
  'institute',
  'school',
  'training_center',
]);

const INST_ORG_TYPE_SET = new Set(INSTITUTION_ORGANIZATION_TYPES);
export const isInstitutionOrgType = (v) => typeof v === 'string' && INST_ORG_TYPE_SET.has(v);

// ── Official source type for institution-submitted data ───────────────────────

export const INSTITUTION_SOURCE_TYPE = 'institution_official';
