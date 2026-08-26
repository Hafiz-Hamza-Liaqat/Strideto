/**
 * Unified public scholarship discovery projection.
 *
 * Merges CMS Scholarships with published institutional CanonicalScholarships
 * for the main /scholarships surface — without merging DB collections.
 *
 * No fuzzy/title-string deduplication. Source identity is preserved.
 * Client- and server-safe: pure JS, no Node/DOM globals.
 */
import { AUTHORITY_KINDS, authorityLabel, formatPublicDateOnly } from './publicTruth.js';
import { publicHttpUrlOrNull } from './safePublicUrl.js';
import { fundingTypeLabel } from '../education/scholarshipIntelligence.js';
import { coerceCountryCode, countryDisplayName } from '../international/country.js';
import { normalizeLocation } from '../international/location.js';

export const UNIFIED_SCHOLARSHIP_SOURCE = Object.freeze({
  CMS: 'cms',
  INSTITUTION_CANONICAL: 'institution_canonical',
});

/** CMS list levels → canonical DEGREE_LEVELS values that should match. */
export const CMS_LEVEL_TO_CANONICAL = Object.freeze({
  Undergraduate: ['bachelor', 'diploma', 'certificate', 'high_school'],
  Graduate: ['master', 'professional'],
  PhD: ['phd', 'postdoc'],
  Other: [],
});

/** Canonical degree level → closest CMS level label (display only). */
export const CANONICAL_LEVEL_TO_CMS = Object.freeze({
  high_school: 'Undergraduate',
  diploma: 'Undergraduate',
  certificate: 'Undergraduate',
  bachelor: 'Undergraduate',
  master: 'Graduate',
  professional: 'Graduate',
  phd: 'PhD',
  postdoc: 'PhD',
});

/** CMS fundingType free-text → canonical funding.type */
export const CMS_FUNDING_TO_CANONICAL = Object.freeze({
  'Fully Funded': 'full',
  Partial: 'partial',
  Other: 'unknown',
});

export function mapCmsLevelFilterToCanonical(level) {
  if (!level || typeof level !== 'string') return [];
  return CMS_LEVEL_TO_CANONICAL[level] || [];
}

export function mapCanonicalDegreeLevelsToCmsLabel(degreeLevels = []) {
  if (!Array.isArray(degreeLevels) || degreeLevels.length === 0) return null;
  for (const d of degreeLevels) {
    if (CANONICAL_LEVEL_TO_CMS[d]) return CANONICAL_LEVEL_TO_CMS[d];
  }
  return null;
}

/**
 * Public readiness for an institutional CanonicalScholarship in main discovery.
 * Catalog existence alone is insufficient — requires published status,
 * institutional type, linked institution, and at least one source URL.
 */
export function isInstitutionCanonicalScholarshipDiscoverable(scholarship = {}, institution = null) {
  if (!scholarship || typeof scholarship !== 'object') return false;
  if (scholarship.status !== 'published') return false;
  if (scholarship.scholarshipType !== 'institutional') return false;
  if (!scholarship.institutionId) return false;
  if (!scholarship.slug) return false;
  if (!hasPublicSourceUrl(scholarship)) return false;
  if (!institution) return false;
  if (institution.status !== 'published') return false;
  if (institution.isFixture === true || institution.demoOnly === true) return false;
  return true;
}

export function hasPublicSourceUrl(scholarship = {}) {
  const sources = Array.isArray(scholarship.sources) ? scholarship.sources : [];
  return sources.some((s) => typeof s?.sourceUrl === 'string' && s.sourceUrl.trim().length > 0);
}

/**
 * Build human-readable applicability scope without flattening to institution-wide
 * when program or intake scope is present.
 */
export function buildApplicabilityScopeSummary({
  applicability = [],
  applicablePrograms = [],
  cycleLabel = '',
  cycles = [],
} = {}) {
  const programNames = [];
  for (const a of applicability) {
    if (a?.scope === 'program' && a.programId) {
      const name = typeof a.programId === 'object' ? a.programId.name : null;
      if (name) programNames.push(name);
    }
  }
  for (const p of applicablePrograms) {
    const name = typeof p === 'object' ? p.name : null;
    if (name && !programNames.includes(name)) programNames.push(name);
  }

  const intakeLabels = [];
  if (cycleLabel && typeof cycleLabel === 'string' && cycleLabel.trim()) {
    intakeLabels.push(cycleLabel.trim());
  }
  for (const c of cycles) {
    const label = (c?.intake || c?.cycleLabel || '').trim();
    if (label && !intakeLabels.includes(label)) intakeLabels.push(label);
  }

  if (programNames.length > 0 && intakeLabels.length > 0) {
    return {
      kind: 'program_and_intake',
      label: `Available for: ${programNames.join(', ')} · ${intakeLabels.join(', ')}`,
      programs: programNames,
      intakes: intakeLabels,
    };
  }
  if (programNames.length > 0) {
    return {
      kind: 'program',
      label: `Available for: ${programNames.join(', ')}`,
      programs: programNames,
      intakes: [],
    };
  }
  if (intakeLabels.length > 0) {
    return {
      kind: 'intake',
      label: `Available for: ${intakeLabels.join(', ')}`,
      programs: [],
      intakes: intakeLabels,
    };
  }

  const hasInstitutionScope = applicability.some((a) => a?.scope === 'institution');
  if (hasInstitutionScope || applicability.length === 0) {
    return {
      kind: 'institution',
      label: 'Available institution-wide',
      programs: [],
      intakes: [],
    };
  }

  return {
    kind: 'other',
    label: 'See applicability details',
    programs: [],
    intakes: [],
  };
}

function formatCmsAmount(amount) {
  if (amount == null || amount === '') return null;
  return String(amount);
}

function formatCanonicalAmount(funding) {
  if (!funding || typeof funding !== 'object') return null;
  if (funding.amountMinor != null && funding.currency) {
    const major = Number(funding.amountMinor) / 100;
    if (!Number.isFinite(major)) return null;
    return `${funding.currency} ${major.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
  if (funding.type && funding.type !== 'unknown') {
    return fundingTypeLabel(funding.type);
  }
  return null;
}

function sortKeyDeadline(card) {
  if (!card?.deadline) return Number.POSITIVE_INFINITY;
  const t = new Date(card.deadline).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function sortKeyNewest(card) {
  if (!card?.createdAt) return 0;
  const t = new Date(card.createdAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Deterministic merge sort — never title-string dedupe. */
export function mergeUnifiedScholarshipCards(cmsCards = [], canonicalCards = [], sort = 'newest') {
  const all = [...cmsCards, ...canonicalCards];
  if (sort === 'deadline') {
    all.sort((a, b) => {
      const d = sortKeyDeadline(a) - sortKeyDeadline(b);
      if (d !== 0) return d;
      return sortKeyNewest(b) - sortKeyNewest(a);
    });
  } else {
    all.sort((a, b) => sortKeyNewest(b) - sortKeyNewest(a));
  }
  return all;
}

/**
 * Project a CMS Scholarship into the unified discovery card shape.
 * Only fields the CMS model actually supports.
 */
export function projectCmsScholarshipDiscoveryCard(doc) {
  if (!doc) return null;
  const loc = normalizeLocation(doc);
  const countryCode = loc.countryCode || coerceCountryCode(doc.country) || '';
  return {
    id: String(doc._id),
    _id: doc._id,
    sourceType: UNIFIED_SCHOLARSHIP_SOURCE.CMS,
    title: doc.title || '',
    slug: doc.slug || '',
    provider: doc.provider || '',
    institution: doc.university || null,
    institutionSlug: null,
    institutionId: null,
    country: doc.country || (countryCode ? countryDisplayName(countryCode) : null),
    countryCode: countryCode || null,
    region: loc.region || doc.province || null,
    province: doc.province || loc.region || null,
    city: loc.city || doc.city || null,
    fundingType: doc.fundingType || null,
    amount: formatCmsAmount(doc.amount),
    studyLevel: doc.level || doc.degreeLevel || null,
    field: null,
    deadline: doc.deadline || null,
    status: doc.status || null,
    detailUrl: `/scholarships/${doc.slug || doc._id}`,
    authorityKind: AUTHORITY_KINDS.SOURCE_BACKED,
    authorityLabel: authorityLabel(AUTHORITY_KINDS.SOURCE_BACKED),
    applicabilityScope: null,
    provenance: 'cms',
    createdAt: doc.createdAt || null,
    // Preserve save-compatible CMS shape fields used by the existing list UI
    level: doc.level || null,
    logoUrl: publicHttpUrlOrNull(doc.logoUrl),
    savable: true,
  };
}

/**
 * Project an institutional CanonicalScholarship + public CanonicalInstitution
 * into the unified discovery card. Geography prefers institution unless the
 * scholarship declares its own destinationCountries.
 */
export function projectInstitutionCanonicalScholarshipDiscoveryCard(
  scholarship,
  institution,
  { applicability = [], applicablePrograms = [], cycles = [] } = {}
) {
  if (!isInstitutionCanonicalScholarshipDiscoverable(scholarship, institution)) {
    return null;
  }

  const dest = Array.isArray(scholarship.destinationCountries)
    ? scholarship.destinationCountries.filter((c) => c && c !== '*')
    : [];
  const countryCode =
    (dest[0] ? coerceCountryCode(dest[0]) : '') ||
    institution.countryCode ||
    '';
  const region = institution.region || null;
  const city = institution.city || null;
  const studyLevel = mapCanonicalDegreeLevelsToCmsLabel(scholarship.degreeLevels);
  const fields = Array.isArray(scholarship.fields) ? scholarship.fields : [];
  const deadline =
    formatPublicDateOnly(scholarship.deadlineDate) ||
    (cycles[0] ? formatPublicDateOnly(cycles[0].deadlineAt) : null);
  const scope = buildApplicabilityScopeSummary({
    applicability,
    applicablePrograms,
    cycleLabel: scholarship.cycleLabel || '',
    cycles,
  });

  return {
    id: String(scholarship._id),
    _id: scholarship._id,
    sourceType: UNIFIED_SCHOLARSHIP_SOURCE.INSTITUTION_CANONICAL,
    title: scholarship.title || '',
    slug: scholarship.slug || '',
    provider: scholarship.provider?.name || institution.officialName || '',
    institution: institution.officialName || null,
    institutionSlug: institution.slug || null,
    institutionId: institution._id || null,
    country: countryCode ? countryDisplayName(countryCode) : null,
    countryCode: countryCode || null,
    region,
    province: region,
    city,
    fundingType: scholarship.funding?.type
      ? fundingTypeLabel(scholarship.funding.type)
      : null,
    amount: formatCanonicalAmount(scholarship.funding),
    studyLevel,
    field: fields.length ? fields.join(', ') : null,
    fields,
    degreeLevels: Array.isArray(scholarship.degreeLevels) ? scholarship.degreeLevels : [],
    deadline,
    status: scholarship.status,
    detailUrl: `/scholarship-intelligence/${scholarship.slug}`,
    authorityKind: AUTHORITY_KINDS.INSTITUTION_SCHOLARSHIP,
    authorityLabel: authorityLabel(AUTHORITY_KINDS.INSTITUTION_SCHOLARSHIP),
    applicabilityScope: scope,
    provenance: 'institution_canonical',
    createdAt: scholarship.createdAt || null,
    level: studyLevel,
    logoUrl: null,
    savable: false,
  };
}

/** Fields that must never appear on public unified cards. */
export const UNIFIED_SCHOLARSHIP_INTERNAL_FIELDS = Object.freeze([
  'adminNotes',
  'claimNotes',
  'verificationEvidence',
  'auditMetadata',
  'isFixture',
  'dataClass',
  'demoOnly',
  'launchEligible',
]);

export function assertNoInternalScholarshipLeak(card) {
  if (!card || typeof card !== 'object') return true;
  for (const key of UNIFIED_SCHOLARSHIP_INTERNAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(card, key) && card[key] != null) {
      return false;
    }
  }
  return true;
}
