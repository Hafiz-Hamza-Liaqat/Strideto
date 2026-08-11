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

// ── Role display (maps to existing vocabulary; do not invent duplicate roles) ─

export const INSTITUTION_ROLE_LABELS = Object.freeze({
  [INSTITUTION_ROLES.OWNER]: 'Owner',
  [INSTITUTION_ROLES.ADMIN]: 'Admin',
  [INSTITUTION_ROLES.EDITOR]: 'Admissions / Program Manager',
  [INSTITUTION_ROLES.VIEWER]: 'Viewer',
});

/** Editor also covers Data Manager capability (official facts, Test Acceptance, scholarships). */
export const INSTITUTION_ROLE_CAPABILITY_NOTES = Object.freeze({
  [INSTITUTION_ROLES.EDITOR]: 'Admissions, programs, intakes, Test Acceptance, scholarships, and official data.',
});

// ── Team invitations ──────────────────────────────────────────────────────────

export const INSTITUTION_INVITE_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

export const INSTITUTION_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INSTITUTION_INVITE_EMAIL_MAX = 254;
export const INSTITUTION_INVITABLE_ROLES = Object.freeze([
  INSTITUTION_ROLES.ADMIN,
  INSTITUTION_ROLES.EDITOR,
  INSTITUTION_ROLES.VIEWER,
]);

export const isInvitableInstitutionRole = (role) => INSTITUTION_INVITABLE_ROLES.includes(role);

// ── Application modes (internal Strideto vs official external URL) ────────────

export const APPLICATION_MODES = Object.freeze({
  INTERNAL: 'internal',
  EXTERNAL: 'external',
  BOTH: 'both',
  NOT_CONFIGURED: 'not_configured',
});

const APPLICATION_MODE_SET = new Set(Object.values(APPLICATION_MODES));
export const isValidApplicationMode = (v) => typeof v === 'string' && APPLICATION_MODE_SET.has(v);

export const INTAKE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  OPEN: 'open',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
});

const INTAKE_STATUS_SET = new Set(Object.values(INTAKE_STATUSES));
export const isValidIntakeStatus = (v) => typeof v === 'string' && INTAKE_STATUS_SET.has(v);

// ── Date-only (YYYY-MM-DD). No timezone invention. ────────────────────────────

export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Project a Date or ISO string to YYYY-MM-DD using UTC calendar date only. */
export function toDateOnlyUtc(value) {
  if (!value) return '';
  if (typeof value === 'string' && isDateOnly(value)) return value;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Admission application states (server-authoritative) ───────────────────────

export const ADMISSION_STATES = Object.freeze({
  RECEIVED: 'received',
  UNDER_REVIEW: 'under_review',
  NEEDS_INFORMATION: 'needs_information',
  SHORTLISTED: 'shortlisted',
  INTERVIEW: 'interview',
  OFFER: 'offer',
  ADMITTED: 'admitted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
});

const ADMISSION_STATE_SET = new Set(Object.values(ADMISSION_STATES));
export const isValidAdmissionState = (v) => typeof v === 'string' && ADMISSION_STATE_SET.has(v);

/** Institution-settable review states. Student cannot self-admit. */
export const INSTITUTION_ADMISSION_TRANSITIONS = Object.freeze({
  [ADMISSION_STATES.RECEIVED]: new Set([
    ADMISSION_STATES.UNDER_REVIEW,
    ADMISSION_STATES.NEEDS_INFORMATION,
    ADMISSION_STATES.REJECTED,
  ]),
  [ADMISSION_STATES.UNDER_REVIEW]: new Set([
    ADMISSION_STATES.NEEDS_INFORMATION,
    ADMISSION_STATES.SHORTLISTED,
    ADMISSION_STATES.INTERVIEW,
    ADMISSION_STATES.OFFER,
    ADMISSION_STATES.ADMITTED,
    ADMISSION_STATES.REJECTED,
  ]),
  [ADMISSION_STATES.NEEDS_INFORMATION]: new Set([
    ADMISSION_STATES.UNDER_REVIEW,
    ADMISSION_STATES.REJECTED,
  ]),
  [ADMISSION_STATES.SHORTLISTED]: new Set([
    ADMISSION_STATES.INTERVIEW,
    ADMISSION_STATES.OFFER,
    ADMISSION_STATES.ADMITTED,
    ADMISSION_STATES.REJECTED,
    ADMISSION_STATES.UNDER_REVIEW,
  ]),
  [ADMISSION_STATES.INTERVIEW]: new Set([
    ADMISSION_STATES.OFFER,
    ADMISSION_STATES.ADMITTED,
    ADMISSION_STATES.REJECTED,
    ADMISSION_STATES.SHORTLISTED,
  ]),
  [ADMISSION_STATES.OFFER]: new Set([
    ADMISSION_STATES.ADMITTED,
    ADMISSION_STATES.REJECTED,
    ADMISSION_STATES.WITHDRAWN,
  ]),
  [ADMISSION_STATES.ADMITTED]: new Set([]),
  [ADMISSION_STATES.REJECTED]: new Set([]),
  [ADMISSION_STATES.WITHDRAWN]: new Set([]),
});

export const isValidInstitutionAdmissionTransition = (from, to) => {
  if (!isValidAdmissionState(from) || !isValidAdmissionState(to)) return false;
  return INSTITUTION_ADMISSION_TRANSITIONS[from]?.has(to) ?? false;
};

/** Student may withdraw from non-terminal Institution states except admitted. */
export const STUDENT_WITHDRAWABLE = new Set([
  ADMISSION_STATES.RECEIVED,
  ADMISSION_STATES.UNDER_REVIEW,
  ADMISSION_STATES.NEEDS_INFORMATION,
  ADMISSION_STATES.SHORTLISTED,
  ADMISSION_STATES.INTERVIEW,
  ADMISSION_STATES.OFFER,
]);

export const CONSENT_SCOPES = Object.freeze({
  ADMISSION_APPLICATION: 'admission_application',
});

export const APPLICATION_SNAPSHOT_FIELDS = Object.freeze([
  'displayName',
  'email',
  'nationality',
  'countryOfResidence',
  'phone',
  'highestQualification',
  'intendedProgramNote',
]);

export const CLIENT_FORBIDDEN_ADMISSION_STATES = Object.freeze([
  ADMISSION_STATES.ADMITTED,
  ADMISSION_STATES.OFFER,
]);

// ── Search bounds ─────────────────────────────────────────────────────────────

export const INSTITUTION_QUERY_MAX = 80;

export function boundedInstitutionQuery(raw) {
  return String(raw || '').trim().slice(0, INSTITUTION_QUERY_MAX);
}

export function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Launch billing (Phase 0: free) ────────────────────────────────────────────

export const INSTITUTION_LAUNCH_BILLING = Object.freeze({
  planCode: 'free',
  planLabel: 'Free',
  providerState: 'not_configured',
  included: Object.freeze([
    'Institution profile',
    'Verification submission',
    'Canonical Program management',
    'Official data maintenance',
  ]),
  futureProducts: Object.freeze([
    { code: 'promotion', label: 'Promotion', state: 'not_configured' },
    { code: 'lead_product', label: 'Lead product', state: 'not_configured' },
    { code: 'advanced_analytics', label: 'Advanced analytics', state: 'not_configured' },
    { code: 'paid_admission_product', label: 'Paid admission product', state: 'not_configured' },
  ]),
});

export const portalIdentityLabel = (verificationStatus) =>
  verificationStatus === 'approved' ? 'Verified Institution' : 'Institution Portal';

export const isVerifiedWordingAllowed = (verificationStatus) =>
  verificationStatus === 'approved';

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
const HTTP_URL_RE = /^https?:\/\//i;

/**
 * Claim UI collects representative authority as a URL. ObjectIds remain valid
 * VerificationEvidence refs. Never pass raw mixed strings into ObjectId fields.
 */
export function splitAuthorityEvidence(refs = []) {
  const objectIds = [];
  const urls = [];
  for (const ref of Array.isArray(refs) ? refs : []) {
    if (ref && typeof ref === 'object') {
      const url = String(ref.url || ref.sourceUrl || '').trim();
      if (HTTP_URL_RE.test(url)) urls.push(url.slice(0, 500));
      continue;
    }
    const value = String(ref || '').trim();
    if (OBJECT_ID_RE.test(value)) objectIds.push(value);
    else if (HTTP_URL_RE.test(value)) urls.push(value.slice(0, 500));
  }
  return { objectIds, urls };
}
