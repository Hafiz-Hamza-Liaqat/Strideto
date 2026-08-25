/**
 * Public discovery truth model (Phase 7).
 * Distinguishes authority kinds. Never upgrades Agent advice or AI output
 * to official Institution/government fact.
 */
import {
  formatOpeningsCount,
  isSpecifiedOpeningsCount,
  parseOpeningsCount,
  OPENINGS_COUNT_UNSPECIFIED_LABEL,
} from '../employer/openingsCount.js';
import { FRESHNESS_STATES } from '../trust/sourceVerification.js';
import { DATE_ONLY_RE } from '../institution/institutionPortal.js';

export const NOT_SPECIFIED = 'Not specified';
export const NOT_TRACKED = 'Not tracked';
export const NOT_CONFIGURED = 'Not configured';

export const AUTHORITY_KINDS = Object.freeze({
  EMPLOYER_POSTED: 'employer_posted',
  OFFICIAL_INSTITUTION: 'official_institution',
  INSTITUTION_SCHOLARSHIP: 'institution_scholarship',
  SOURCE_BACKED: 'source_backed',
  AGENT_STATEMENT: 'agent_statement',
  STRIDETO_RECOMMENDATION: 'strideto_recommendation',
  USER_GENERATED: 'user_generated',
  UNKNOWN: 'unknown',
});

export const AUTHORITY_LABELS = Object.freeze({
  [AUTHORITY_KINDS.EMPLOYER_POSTED]: 'Employer-posted on Strideto',
  [AUTHORITY_KINDS.OFFICIAL_INSTITUTION]: 'Official Institution source',
  [AUTHORITY_KINDS.INSTITUTION_SCHOLARSHIP]: 'Institution-owned scholarship',
  [AUTHORITY_KINDS.SOURCE_BACKED]: 'Source-backed',
  [AUTHORITY_KINDS.AGENT_STATEMENT]: 'Agent statement',
  [AUTHORITY_KINDS.STRIDETO_RECOMMENDATION]: 'Strideto-derived recommendation',
  [AUTHORITY_KINDS.USER_GENERATED]: 'User-generated',
  [AUTHORITY_KINDS.UNKNOWN]: 'Unverified / not specified',
});

export const JOB_AVAILABILITY = Object.freeze({
  OPEN: 'open',
  DEADLINE_PASSED: 'deadline_passed',
  CLOSED: 'closed',
  EXPIRED: 'expired',
  UNAVAILABLE: 'unavailable',
});

export const PUBLIC_JOB_HIDDEN_PUBLICATION_STATES = Object.freeze([
  'draft',
  'pending_review',
  'rejected',
  'closed',
  'expired',
]);

export const FRESHNESS_PUBLIC_LABELS = Object.freeze({
  [FRESHNESS_STATES.FRESH]: 'Current',
  [FRESHNESS_STATES.REVIEW_DUE]: 'Review due — confirm with the source',
  [FRESHNESS_STATES.STALE]: 'May be out of date — verify before acting',
  [FRESHNESS_STATES.BROKEN]: 'Source currently unavailable',
  [FRESHNESS_STATES.UNKNOWN]: 'Freshness not tracked',
});

export const WORK_MODE_LABELS = Object.freeze({
  remote: 'Remote',
  hybrid: 'Hybrid',
  on_site: 'On-site',
  unspecified: NOT_SPECIFIED,
});

export const APPLICATION_MODE_LABELS = Object.freeze({
  internal: 'Apply on Strideto',
  external: 'Apply on official/employer website',
  both: 'Internal or official website',
  not_configured: NOT_CONFIGURED,
  platform: 'Apply on Strideto',
});

export function authorityLabel(kind) {
  return AUTHORITY_LABELS[kind] || AUTHORITY_LABELS[AUTHORITY_KINDS.UNKNOWN];
}

export function freshnessPublicLabel(state) {
  return FRESHNESS_PUBLIC_LABELS[state] || FRESHNESS_PUBLIC_LABELS[FRESHNESS_STATES.UNKNOWN];
}

/**
 * Public openings phrase. Never "0 openings".
 * @param {unknown} value
 * @returns {{ specified: boolean, count: number|null, phrase: string, label: string }}
 */
export function formatPublicOpenings(value) {
  const parsed = parseOpeningsCount(value, { required: false });
  if (!parsed.ok || !parsed.specified) {
    return {
      specified: false,
      count: null,
      phrase: `Openings: ${OPENINGS_COUNT_UNSPECIFIED_LABEL}`,
      label: OPENINGS_COUNT_UNSPECIFIED_LABEL,
    };
  }
  const n = parsed.value;
  return {
    specified: true,
    count: n,
    phrase: n === 1 ? '1 opening' : `${n} openings`,
    label: formatOpeningsCount(n),
  };
}

export function deriveJobWorkMode(job = {}) {
  if (job.workMode === 'remote' || job.workMode === 'hybrid' || job.workMode === 'on_site') {
    return job.workMode;
  }
  if (job.hybrid === true) return 'hybrid';
  if (job.remote === true) return 'remote';
  return 'unspecified';
}

export function deriveJobAuthority(job = {}) {
  if (job.source === 'employer' || job.employerId) return AUTHORITY_KINDS.EMPLOYER_POSTED;
  if (job.source === 'scraper' || job.sourceWebsite || job.sourceUrl) return AUTHORITY_KINDS.SOURCE_BACKED;
  return AUTHORITY_KINDS.UNKNOWN;
}

/**
 * Visibility for public list/detail. Draft/pending/rejected never public.
 * Closed/expired stay unpublished (404) unless a future historical contract exists.
 */
export function isPubliclyListableJob(job = {}, now = new Date()) {
  if (!job || job.status !== 'active') return false;
  if (job.approvalStatus && job.approvalStatus !== 'approved') return false;
  if (job.publicationState && PUBLIC_JOB_HIDDEN_PUBLICATION_STATES.includes(job.publicationState)) {
    return false;
  }
  if (job.visibleUntil) {
    const until = new Date(job.visibleUntil);
    if (!Number.isNaN(until.getTime()) && until < now) return false;
  }
  return true;
}

export function deriveJobAvailability(job = {}, now = new Date()) {
  if (!isPubliclyListableJob(job, now)) return JOB_AVAILABILITY.UNAVAILABLE;
  if (job.status === 'closed' || job.publicationState === 'closed') return JOB_AVAILABILITY.CLOSED;
  if (job.publicationState === 'expired') return JOB_AVAILABILITY.EXPIRED;
  const closeAt = job.applicationsCloseAt || job.deadline;
  if (closeAt) {
    const d = new Date(closeAt);
    if (!Number.isNaN(d.getTime()) && d < now) return JOB_AVAILABILITY.DEADLINE_PASSED;
  }
  return JOB_AVAILABILITY.OPEN;
}

export function isInternalApplyType(applyType) {
  return applyType === 'internal';
}

export function applicationsTrackedForPublic(job = {}) {
  return job.applyType === 'internal';
}

/** Date-only strings stay YYYY-MM-DD. Instants use UTC calendar date, never local TZ. */
export function formatPublicDateOnly(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && DATE_ONLY_RE.test(value.trim())) return value.trim();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function displayOrNotSpecified(value) {
  if (value == null) return NOT_SPECIFIED;
  if (typeof value === 'string' && !value.trim()) return NOT_SPECIFIED;
  if (Array.isArray(value) && value.length === 0) return NOT_SPECIFIED;
  return value;
}

export { isSpecifiedOpeningsCount, OPENINGS_COUNT_UNSPECIFIED_LABEL };

export function isCurrentAcceptanceClaim(doc, now = new Date()) {
  if (!doc) return false;
  if (doc.status && doc.status !== 'published') return false;
  if (doc.supersededById) return false;
  if (doc.effectiveUntil) {
    const until = new Date(doc.effectiveUntil);
    if (!Number.isNaN(until.getTime()) && until < now) return false;
  }
  if (doc.effectiveFrom) {
    const from = new Date(doc.effectiveFrom);
    if (!Number.isNaN(from.getTime()) && from > now) return false;
  }
  return true;
}

/** Mongo filter: published, not superseded, within effective window. */
export function currentAcceptanceMongoFilter(now = new Date()) {
  return {
    status: 'published',
    $and: [
      // Schema defaults supersededById to null — match null OR missing (legacy docs).
      {
        $or: [
          { supersededById: null },
          { supersededById: { $exists: false } },
        ],
      },
      {
        $or: [
          { effectiveUntil: null },
          { effectiveUntil: { $exists: false } },
          { effectiveUntil: { $gte: now } },
        ],
      },
      {
        $or: [
          { effectiveFrom: null },
          { effectiveFrom: { $exists: false } },
          { effectiveFrom: { $lte: now } },
        ],
      },
    ],
  };
}

export const NO_GUARANTEE_DISCLAIMER =
  'Strideto does not guarantee admission, funding, visa approval, placement, or employment outcomes.';

export const AGENT_NON_AUTHORITY_DISCLAIMER =
  'Agent statements are third-party assertions, not official Institution or government facts.';

export const EXTERNAL_APPLY_DISCLOSURE =
  'Application happens outside Strideto. Strideto does not track authoritative external application status.';
