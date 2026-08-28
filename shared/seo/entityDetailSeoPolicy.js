/**
 * SEO-P3 — public detail page indexability and route ownership.
 */
import { PUB_STATUSES } from '../education/taxonomy.js';
import { isValidSourceUrl } from '../international/evidence.js';
import { UNIFIED_SCHOLARSHIP_SOURCE } from '../publicDiscovery/unifiedScholarshipDiscovery.js';

/** Job detail sitemap/index eligibility aligns with public listing filter truth. */
export function isJobDetailPubliclyEligible(job) {
  if (!job?.slug) return false;
  if (job.status !== 'active') return false;
  const approval = job.approvalStatus;
  if (approval && approval !== 'approved') return false;
  const pub = job.publicationState;
  if (pub && pub !== 'active') return false;
  return true;
}

export function isCmsScholarshipDetailEligible(doc) {
  return Boolean(doc?.slug) && doc.status === 'active';
}

export function isIntlScholarshipDetailEligible(doc) {
  return Boolean(doc?.slug) && doc.status === 'active';
}

export function isCanonicalScholarshipDetailEligible(doc) {
  return Boolean(doc?.slug) && doc.status === PUB_STATUSES.PUBLISHED;
}

function hasNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Substantive source evidence on CanonicalInstitution.sources[].
 * sourceType alone (e.g. official/government/institution) is classification
 * metadata, not public profile content. Requires a valid public URL or publisher.
 */
export function isSubstantiveInstitutionSourceEvidence(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (hasNonEmptyText(entry.sourceUrl) && isValidSourceUrl(entry.sourceUrl)) return true;
  if (hasNonEmptyText(entry.publisher)) return true;
  return false;
}

/**
 * Meaningful public profile content for CanonicalInstitution detail indexing.
 * Uses only model fields (sources evidence) or caller-supplied related counts
 * from published programs / current published TestAcceptance claims — not
 * identity/location alone.
 */
export function hasMeaningfulInstitutionProfile(
  institution,
  { programCount = 0, acceptedTestCount = 0 } = {}
) {
  if (!institution) return false;

  if (Number(programCount) > 0) return true;
  if (Number(acceptedTestCount) > 0) return true;

  const sources = Array.isArray(institution.sources) ? institution.sources : [];
  return sources.some(isSubstantiveInstitutionSourceEvidence);
}

export function isCanonicalInstitutionDetailEligible(
  doc,
  { programCount = 0, acceptedTestCount = 0 } = {}
) {
  if (!doc?.slug || doc.status !== PUB_STATUSES.PUBLISHED) return false;
  if (!hasNonEmptyText(doc.officialName)) return false;
  if (!hasNonEmptyText(doc.countryCode)) return false;
  return hasMeaningfulInstitutionProfile(doc, { programCount, acceptedTestCount });
}

export function isProgramDetailIndexable(program) {
  if (!program?.slug || program.status !== PUB_STATUSES.PUBLISHED) return false;
  if (!program.name && !program.title) return false;
  if (!program.institutionId && !program.canonicalInstitutionId) return false;
  const hasContext =
    Boolean(program.description) ||
    Boolean(program.summary) ||
    (Array.isArray(program.degreeLevels) && program.degreeLevels.length > 0) ||
    (Array.isArray(program.fields) && program.fields.length > 0);
  return hasContext;
}

/**
 * Canonical public detail route per scholarship source — no cross-model merging.
 */
export function resolveScholarshipDetailPath(item) {
  if (!item) return null;
  const source = item.sourceType || item.provenance;
  if (source === UNIFIED_SCHOLARSHIP_SOURCE.INSTITUTION_CANONICAL || source === 'institution_canonical') {
    return item.slug ? `/scholarship-intelligence/${item.slug}` : null;
  }
  if (source === UNIFIED_SCHOLARSHIP_SOURCE.INTL || source === 'intl') {
    return item.slug ? `/intl-scholarships/${item.slug}` : `/intl-scholarships/${item._id || item.id}`;
  }
  return item.slug ? `/scholarships/${item.slug}` : null;
}

export function resolveInstitutionDetailPath(institution, { legacy = false } = {}) {
  if (!institution?.slug) return null;
  return legacy
    ? `/schools-and-colleges/${institution.slug}`
    : `/institutions/${institution.slug}`;
}

/** Duplicate canonical identity guard — same slug different route families stay distinct by model. */
export function scholarshipRouteOwnership(sourceType) {
  switch (sourceType) {
    case UNIFIED_SCHOLARSHIP_SOURCE.INSTITUTION_CANONICAL:
    case 'institution_canonical':
      return { detailPrefix: '/scholarship-intelligence/', listPath: '/scholarship-intelligence' };
    case 'intl':
      return { detailPrefix: '/intl-scholarships/', listPath: '/intl-scholarships' };
    case UNIFIED_SCHOLARSHIP_SOURCE.CMS:
    case 'cms':
    default:
      return { detailPrefix: '/scholarships/', listPath: '/scholarships' };
  }
}
