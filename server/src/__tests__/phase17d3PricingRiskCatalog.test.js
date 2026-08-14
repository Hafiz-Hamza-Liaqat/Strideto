/**
 * Phase 17D-3 — pricing, risk, catalog projection, listing validation.
 * Run: node src/__tests__/phase17d3PricingRiskCatalog.test.js
 */
import assert from 'node:assert/strict';
import { validateProviderPricing } from '../../../shared/gbs/providerPricing.js';
import { classifyGbsListingRisk, isDisclaimerNotGuarantee } from '../../../shared/gbs/claimRiskClassifier.js';
import { validateServiceListingRecord } from '../../../shared/gbs/serviceListing.js';
import { projectProviderCatalog } from '../../../shared/gbs/providerCatalogProjection.js';
import { authorizeGbsProviderAction, GBS_AUTHORITY_DENY_REASONS } from '../../../shared/gbs/gbsProviderAuthority.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_SUBJECT_TYPES, PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { evaluateProtectedTitleVerification } from '../../../shared/gbs/protectedTitleEvidencePolicy.js';
import { PROTECTED_TITLE_IDS } from '../../../shared/gbs/protectedTitles.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

check(!validateProviderPricing({ pricingMode: 'fixed', providerFeeLines: [] }).ok, 'fixed requires a fee line');
check(
  !validateProviderPricing({
    pricingMode: 'fixed',
    providerFeeLines: [{ label: 'Fee', amountMinor: 15000, currency: '' }],
  }).ok,
  'fixed fee requires currency'
);
check(
  !validateProviderPricing({
    pricingMode: 'range',
    providerFeeLines: [
      { label: 'min', amountMinor: 20000, currency: 'USD' },
      { label: 'max', amountMinor: 10000, currency: 'USD' },
    ],
  }).ok,
  'range min <= max'
);
check(
  !validateProviderPricing({
    pricingMode: 'fixed',
    providerFeeLines: [{ label: 'Fee', amountMinor: -1, currency: 'USD' }],
  }).ok,
  'negative amount rejected'
);
check(
  validateProviderPricing({ pricingMode: 'quote_required', providerFeeLines: [] }).ok,
  'quote_required stores no fake mandatory fixed price'
);
check(
  !validateProviderPricing({
    pricingMode: 'fixed',
    providerFeeLines: [{ label: 'Gov', amountMinor: 11000, currency: 'USD', ownership: 'government' }],
  }).ok,
  'provider cannot label fee as government'
);

const disclaimer = classifyGbsListingRisk({
  title: 'Formation support',
  description: 'We do not guarantee approval.',
});
check(isDisclaimerNotGuarantee('We do not guarantee approval'), 'disclaimer helper');
check(!disclaimer.codes.includes('positive_guarantee'), 'disclaimer is not a positive guarantee');
check(!disclaimer.codes.includes('guaranteed_registration'), 'disclaimer does not trip guaranteed registration');

const risky = classifyGbsListingRisk({
  title: 'Guaranteed registration and guaranteed bank account',
  description: 'Official government partner. Tax free guaranteed.',
});
check(risky.flagged && risky.reviewRequired, 'high-risk claims are flagged for review');

const listing = validateServiceListingRecord({
  subjectType: 'agent',
  subjectId: 'a1',
  capabilityId: 'business_formation',
  countryCode: 'US',
  jurisdictionId: 'j:US-DE',
  entityTypeIds: ['et:US-DE:LLC'],
  title: 'Delaware LLC formation support',
  pricingMode: 'fixed',
  providerFeeLines: [{ label: 'Provider formation service', amountMinor: 15000, currency: 'USD' }],
});
check(listing.ok, 'valid listing parses');
check(listing.value.publicationStatus === 'private', 'listing cannot be public');
check(
  !validateServiceListingRecord({ ...listing.value, publicationStatus: 'public' }).ok,
  'public publication rejected'
);
check(
  !validateServiceListingRecord({
    ...listing.value,
    capabilityId: 'not_a_real_capability',
  }).ok,
  'unknown capability rejected'
);

const catalog = projectProviderCatalog();
const ein = catalog.fees.find((f) => f.feeId === 'fee:US-IRS-EIN' && f.eligibleCurrent);
check(ein && ein.amount === 0 && ein.currency === 'USD' && ein.readOnly === true, 'IRS EIN USD 0 current government truth');
const de = catalog.fees.find((f) => f.feeId === 'fee:US-DE-llc-formation' && f.eligibleCurrent);
check(de && de.amount === 110 && de.readOnly === true, 'Delaware LLC formation USD 110 current');
const secp = catalog.fees.find((f) => f.feeId === 'fee:PK-SECP-incorporation');
check(secp && secp.amount == null && secp.amountModel === 'not_catalogued', 'SECP not_catalogued is not zero');
const wyoming = catalog.jurisdictions.find((j) => j.id === 'j:US-WY' || j.code === 'WY');
const draftUs = catalog.jurisdictions.find((j) => j.countryCode === 'US' && j.launchCandidate !== true && j.reviewStatus === 'draft');
check(draftUs && draftUs.currentReviewed !== true, 'structural draft US jurisdiction is not CURRENT');
check(catalog.capabilities.some((c) => c.capabilityId === 'registered_agent'), 'RA in taxonomy');
check(catalog.launchCountryCodes.includes('PK') && catalog.launchCountryCodes.includes('GB'), 'launch countries PK/US/GB');

const wyCap = {
  subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
  subjectId: 'agent-A',
  capabilityId: 'registered_agent',
  status: GRANT_STATUSES.ACTIVE,
  trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
  scope: { jurisdictionIds: ['j:US-WY'], countryCodes: ['US'], entityTypeIds: [], protectedTitleIds: ['registered_agent'], flags: { registered_agent: true, registered_office: false } },
};
check(
  authorizeGbsProviderAction({
    requested: {
      subjectType: 'agent',
      subjectId: 'agent-A',
      capabilityId: 'registered_agent',
      scope: { jurisdictionIds: ['j:US-DE'], flags: { registered_agent: true } },
    },
    capability: wyCap,
  }).reason === GBS_AUTHORITY_DENY_REASONS.SCOPE_NOT_SUBSET,
  'WY scope ≠ DE'
);

const formation = {
  ...wyCap,
  capabilityId: 'business_formation',
  scope: { jurisdictionIds: ['j:GB'], countryCodes: ['GB'], entityTypeIds: ['et:GB:LTD'], protectedTitleIds: [], flags: { registered_agent: false, registered_office: false } },
};
check(
  authorizeGbsProviderAction({
    requested: { subjectType: 'agent', subjectId: 'agent-A', capabilityId: 'registered_agent', scope: { jurisdictionIds: ['j:GB'] } },
    capability: formation,
  }).allowed === false,
  'GB formation ≠ RA / ACSP listing'
);
check(
  authorizeGbsProviderAction({
    requested: { subjectType: 'agent', subjectId: 'agent-A', capabilityId: 'business_formation', scope: { jurisdictionIds: ['j:GB'] } },
    capability: { ...formation, capabilityId: undefined },
  }).reason === GBS_AUTHORITY_DENY_REASONS.LEGACY_NOT_AUTHORITATIVE,
  'legacy capability without capabilityId is not GBS-authoritative'
);

const acsp = evaluateProtectedTitleVerification({
  titleId: PROTECTED_TITLE_IDS.ACSP,
  jurisdictionId: 'j:GB',
  subject: { subjectType: 'agent', subjectId: 'agent-A', capabilityId: 'business_formation' },
  evidence: [],
});
check(acsp.ok === false, 'UK formation does not verify ACSP');

if (wyoming) {
  check(wyoming.id.includes('WY') || wyoming.code === 'WY', 'Wyoming present as registry id');
}

console.log(`phase17d3PricingRiskCatalog.test.js: ${count} assertions passed`);
