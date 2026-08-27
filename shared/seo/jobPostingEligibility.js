/**
 * JobPosting structured-data eligibility policy (SEO-P0B).
 *
 * Emitting `schema.org/JobPosting` is a publication claim: it asserts to Google
 * for Jobs that the page is the authoritative posting for that job. STRIDETO
 * carries two very different kinds of job record and only one of them may make
 * that claim:
 *
 *   A. Employer-authorized / native publication — the hiring organization
 *      posted the job through the STRIDETO employer workflow. `jobsGraphEligible`
 *      is set to true by that workflow and by nothing else.
 *
 *   B. Editorially curated external opportunity — STRIDETO found a real job on
 *      an official source and links the user out to it. STRIDETO has no
 *      authorization to publish on that employer's behalf, so the page stays a
 *      normal indexable WebPage with an official-source link and emits NO
 *      JobPosting.
 *
 * Authorization is never inferred. The presence of an external apply URL, a
 * source URL, a source website, or an employer *name* proves nothing about
 * publication authority, so none of them is consulted here. Only the explicit
 * `jobsGraphEligible` flag counts, and it defaults to false.
 *
 * Placement is also policy: JobPosting belongs on the single job detail page
 * and nowhere else. Collection, search, category, city, province and other
 * ItemList landing pages must never embed JobPosting objects — an ItemList may
 * point at the detail pages, but it may not create eligibility for the list.
 */
import { deriveJobWorkMode } from '../publicDiscovery/publicTruth.js';

/** Surfaces that may ask for JobPosting markup. Only DETAIL can ever qualify. */
export const JOB_POSTING_SURFACES = Object.freeze({
  DETAIL: 'detail',
  LISTING: 'listing',
});

export const JOB_POSTING_INELIGIBLE_REASONS = Object.freeze({
  MISSING_JOB: 'missing_job',
  LISTING_SURFACE: 'listing_surface',
  NOT_AUTHORIZED: 'not_authorized',
  NOT_PUBLICLY_OPEN: 'not_publicly_open',
  INCOMPLETE_REQUIRED_FIELDS: 'incomplete_required_fields',
});

/** Publication states that are never public, and therefore never eligible. */
const NON_PUBLIC_PUBLICATION_STATES = Object.freeze([
  'draft',
  'pending_review',
  'rejected',
  'closed',
  'expired',
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPastDate(value, now) {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d < now;
}

/**
 * True only for an employer-authorized/native publication.
 * Explicit flag only — never derived from apply URLs, source URLs or names.
 */
export function isJobsGraphAuthorized(job) {
  return job?.jobsGraphEligible === true;
}

/**
 * Public availability gate: draft, closed, expired and deadline-passed jobs
 * must not carry JobPosting markup.
 */
export function isJobPostingPubliclyOpen(job, now = new Date()) {
  if (!job) return false;
  if (text(job.status) && text(job.status).toLowerCase() !== 'active') return false;
  const publication = text(job.publicationState).toLowerCase();
  if (publication && NON_PUBLIC_PUBLICATION_STATES.includes(publication)) return false;
  if (job.acceptingApplications === false) return false;
  if (job.availability && job.availability !== 'open') return false;
  if (isPastDate(job.applicationsCloseAt, now)) return false;
  if (isPastDate(job.deadline, now)) return false;
  if (isPastDate(job.visibleUntil, now)) return false;
  return true;
}

/**
 * Truthful country for the job, taken only from geography the Job record
 * already carries. `countryCode` is the canonical ISO 3166-1 alpha-2 field on
 * the Job model (and on the public projection); `country` is tolerated for
 * legacy/imported records that stored a name instead. Never defaulted and never
 * inferred from the site's home market — STRIDETO does not guess a country.
 */
export function jobPostingCountry(job) {
  return text(job?.countryCode) || text(job?.country);
}

/**
 * Fully remote, using the product's own derivation (`deriveJobWorkMode`), so
 * structured data agrees with the work-mode the page displays. Hybrid is not
 * remote: it has real premises and keeps a physical jobLocation.
 */
export function isFullyRemoteJob(job) {
  return deriveJobWorkMode(job || {}) === 'remote';
}

/**
 * Fields Google requires, checked against the same values the page shows.
 * A job that cannot fill these truthfully must not claim eligibility.
 *
 * datePosted — `publishedAt` is STRIDETO's canonical publication timestamp
 * (Job.js requires it for the `active` publication state) and `createdAt` is the
 * legacy/pre-canonical fallback. Either one satisfies the requirement; the
 * emitter resolves them in that same order.
 *
 * validThrough is NOT required. It is optional in the Google contract, and an
 * otherwise valid, authorized, currently open job with no known closing date
 * must not be made ineligible just because it has no expiry. A closing date
 * that has already passed is caught by isJobPostingPubliclyOpen instead.
 */
export function missingJobPostingRequiredFields(job) {
  const missing = [];
  if (!text(job?.title)) missing.push('title');
  if (!text(job?.description)) missing.push('description');
  if (!text(job?.organization) && !text(job?.company)) missing.push('hiringOrganization');
  if (!job?.createdAt && !job?.publishedAt) missing.push('datePosted');

  // Location truth, split by work mode.
  //
  // Remote: Google's work-from-home JobPosting contract requires TELECOMMUTE to
  // be paired with applicantLocationRequirements naming at least one country
  // where an applicant may actually be based. STRIDETO has exactly one truthful
  // source for that (the job's own country), so a remote job without it fails
  // closed rather than shipping an unqualified TELECOMMUTE claim.
  //
  // Physical: a jobLocation must carry a real place, and the Google contract
  // requires addressCountry inside its PostalAddress. A job with a city or
  // region but no country cannot fill that truthfully, so it fails closed too —
  // it is never back-filled from the site's home market.
  const country = jobPostingCountry(job);
  if (isFullyRemoteJob(job)) {
    if (!country) missing.push('applicantLocationRequirements');
  } else {
    const hasPlace =
      text(job?.city) || text(job?.province) || text(job?.region) || text(job?.location);
    if (!hasPlace) missing.push('jobLocation');
    else if (!country) missing.push('jobLocation.addressCountry');
  }
  return missing;
}

/**
 * Single decision point for every JobPosting emission in the product.
 *
 * @param {object|null} job Public job projection (never a raw admin document).
 * @param {{ surface?: string, now?: Date }} options
 * @returns {{ eligible: boolean, reason: string|null, missingFields: string[] }}
 */
export function evaluateJobPostingEligibility(job, { surface, now = new Date() } = {}) {
  const deny = (reason, missingFields = []) => ({ eligible: false, reason, missingFields });

  if (!job) return deny(JOB_POSTING_INELIGIBLE_REASONS.MISSING_JOB);
  if (surface !== JOB_POSTING_SURFACES.DETAIL) {
    return deny(JOB_POSTING_INELIGIBLE_REASONS.LISTING_SURFACE);
  }
  if (!isJobsGraphAuthorized(job)) {
    return deny(JOB_POSTING_INELIGIBLE_REASONS.NOT_AUTHORIZED);
  }
  if (!isJobPostingPubliclyOpen(job, now)) {
    return deny(JOB_POSTING_INELIGIBLE_REASONS.NOT_PUBLICLY_OPEN);
  }
  const missingFields = missingJobPostingRequiredFields(job);
  if (missingFields.length) {
    return deny(JOB_POSTING_INELIGIBLE_REASONS.INCOMPLETE_REQUIRED_FIELDS, missingFields);
  }
  return { eligible: true, reason: null, missingFields: [] };
}
