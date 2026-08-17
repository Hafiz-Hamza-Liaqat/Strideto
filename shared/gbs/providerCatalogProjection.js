/**
 * Safe provider-facing GBS catalog projection (Phase 17D-3).
 * Source-controlled manifest + canonical eligibility. No persistent import required.
 */
import { loadGbsCatalogManifest } from './catalog/index.js';
import { resolvePublicationEligibility } from './publicationEligibility.js';
import { CATALOG_REVIEW_STATUSES, FEE_AMOUNT_MODELS, LAUNCH_COUNTRY_CODES } from './catalogConstants.js';
import { BUSINESS_SERVICES_CAPABILITIES } from './businessServicesCapabilities.js';
import { PROTECTED_TITLES } from './protectedTitles.js';

function publicSource(src) {
  if (!src) return null;
  return {
    sourceId: src.sourceId,
    title: src.title,
    sourceUrl: src.sourceUrl,
    authorityId: src.authorityId,
    lastReviewedAt: src.lastReviewedAt || null,
    reviewDueAt: src.reviewDueAt || null,
    reviewStatus: src.reviewStatus,
    retrievedAt: src.retrievedAt || null,
  };
}

function projectFee(fee, sourceById, now) {
  const eligibility = resolvePublicationEligibility(fee, { now });
  const amountIsCatalogued = fee.amountModel !== FEE_AMOUNT_MODELS.NOT_CATALOGUED;
  return {
    feeId: fee.feeId,
    jurisdictionId: fee.jurisdictionId,
    authorityId: fee.authorityId,
    entityTypeId: fee.entityTypeId,
    feeCategory: fee.feeCategory,
    label: fee.label,
    currency: fee.currency,
    amountModel: fee.amountModel,
    amount: amountIsCatalogued ? fee.amount : null,
    ownership: 'government',
    readOnly: true,
    eligibilityState: eligibility.state,
    eligibleCurrent: eligibility.eligibleCurrent === true,
    source: publicSource(sourceById[fee.sourceId]),
    notes: fee.notes || '',
    sourceVersion: fee.sourceVersion,
    superseded: fee.superseded === true,
  };
}

export function projectProviderCatalog({ now = new Date(), manifest = loadGbsCatalogManifest() } = {}) {
  const sourceById = Object.fromEntries(manifest.sources.map((s) => [s.sourceId, s]));
  const launch = new Set(LAUNCH_COUNTRY_CODES);

  const jurisdictions = manifest.jurisdictions.map((j) => {
    const eligibility = resolvePublicationEligibility(
      { ...j, reviewStatus: j.reviewStatus, superseded: false },
      { now }
    );
    return {
      id: j.id,
      code: j.code,
      countryCode: j.countryCode,
      name: j.name,
      level: j.level,
      parentJurisdictionId: j.parentJurisdictionId,
      launchCandidate: j.launchCandidate === true,
      launchCoverage: j.launchCoverage === true,
      structural: true,
      currentReviewed: eligibility.eligibleCurrent === true && j.reviewStatus === CATALOG_REVIEW_STATUSES.REVIEWED,
      reviewStatus: j.reviewStatus,
    };
  });

  const entityTypes = manifest.entityTypes.map((e) => ({
    entityTypeId: e.entityTypeId,
    jurisdictionId: e.jurisdictionId,
    code: e.code,
    displayName: e.displayName,
    officialName: e.officialName,
    reviewStatus: e.reviewStatus,
  }));

  const fees = manifest.fees
    .filter((f) => f.superseded !== true)
    .map((f) => projectFee(f, sourceById, now));

  const capabilities = Object.values(BUSINESS_SERVICES_CAPABILITIES).map((c) => ({
    capabilityId: c.capabilityId,
    publicName: c.publicName,
    regulated: c.regulated,
    protectedTitleRequired: c.protectedTitleRequired,
    requiredProtectedTitleId: c.requiredProtectedTitleId || null,
    jurisdictionScoped: c.jurisdictionScoped,
    entityTypeScoped: c.entityTypeScoped,
    evidenceRequired: c.evidenceRequired,
    reviewRequired: c.reviewRequired,
    allowedSubjectTypes: c.allowedSubjectTypes,
  }));

  const protectedTitles = Object.values(PROTECTED_TITLES).map((t) => ({
    titleId: t.titleId,
    publicName: t.publicName,
    evidenceGated: t.evidenceGated,
    organizationVerificationInsufficient: t.organizationVerificationInsufficient,
  }));

  return {
    researchDate: manifest.researchDate,
    launchCountryCodes: [...launch],
    capabilities,
    protectedTitles,
    jurisdictions,
    entityTypes,
    fees,
    authorities: manifest.authorities.map((a) => ({
      authorityId: a.authorityId,
      jurisdictionId: a.jurisdictionId,
      name: a.name,
      authorityType: a.authorityType,
    })),
  };
}

export function currentGovernmentFee(fees, feeId) {
  const rows = (fees || []).filter((f) => f.feeId === feeId && f.superseded !== true);
  return rows.at(-1) || null;
}

/** Canonical legal-service readiness for one jurisdiction. Geography alone is never authority. */
export function resolveJurisdictionProductionReadiness(
  jurisdictionId,
  { now = new Date(), manifest = loadGbsCatalogManifest(), catalog = null } = {}
) {
  const projection = catalog || projectProviderCatalog({ now, manifest });
  const jurisdiction = projection.jurisdictions.find((row) => row.id === String(jurisdictionId || '')) || null;
  if (!jurisdiction) {
    return { jurisdiction: null, productionReady: false, state: 'not_configured', reason: 'jurisdiction_not_configured' };
  }
  return {
    jurisdiction,
    productionReady: jurisdiction.currentReviewed === true,
    state: jurisdiction.currentReviewed ? 'current_reviewed' : jurisdiction.reviewStatus || 'structural',
    reason: jurisdiction.currentReviewed ? 'current_reviewed' : 'jurisdiction_not_current_reviewed',
  };
}
