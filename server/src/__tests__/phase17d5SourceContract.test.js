/**
 * Phase 17D-5 — public Business Services marketplace source contract.
 * Run: node src/__tests__/phase17d5SourceContract.test.js
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  isBusinessServicesEnabled,
  isBusinessServicesProviderEnabled,
  isBusinessServicesPublicMarketplaceEnabled,
  GBS_PUBLIC_MARKETPLACE_FEATURE_FLAG,
  GBS_MARKETPLACE_BOUNDS,
  GBS_LISTING_MODERATION_STATUSES,
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
} from '../../../shared/gbs/constants.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { PROVIDER_DOMAIN_IDS, PROVIDER_DOMAIN_ENROLLMENT_STATUSES } from '../../../shared/provider/providerDomains.js';
import { evaluatePublicMarketplaceEligibility, MARKETPLACE_DENY_REASONS } from '../../../shared/gbs/marketplaceEligibility.js';
import {
  assertMarketplaceProjectionSafe,
  marketplaceListingProjection,
  professionalFeeSummary,
  verificationBadge,
} from '../../../shared/gbs/marketplaceProjection.js';
import { generateListingPublicSlug } from '../utils/gbsListingSlug.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

check(GBS_PUBLIC_MARKETPLACE_FEATURE_FLAG === 'BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED', 'marketplace flag name');
check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'unset marketplace flag is OFF');
check(isBusinessServicesPublicMarketplaceEnabled({ BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' }) === false, '0 is OFF');
check(isBusinessServicesPublicMarketplaceEnabled({ BUSINESS_SERVICES_ENABLED: '1' }) === false, 'legacy BUSINESS_SERVICES_ENABLED cannot enable marketplace');
check(isBusinessServicesPublicMarketplaceEnabled({ BUSINESS_SERVICES_PROVIDER_ENABLED: '1' }) === false, 'provider flag cannot enable marketplace');
check(
  isBusinessServicesProviderEnabled({ BUSINESS_SERVICES_PROVIDER_ENABLED: '1' }) === true &&
    isBusinessServicesPublicMarketplaceEnabled({ BUSINESS_SERVICES_PROVIDER_ENABLED: '1' }) === false,
  'provider workspace is separate from marketplace'
);
check(isBusinessServicesEnabled({ BUSINESS_SERVICES_ENABLED: '1' }) === true, 'legacy flag still enables foundation');
check(isBusinessServicesPublicMarketplaceEnabled({ BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' }) === true, 'explicit 1 enables marketplace');
check(GBS_MARKETPLACE_BOUNDS.PAGE_DEFAULT === 20 && GBS_MARKETPLACE_BOUNDS.PAGE_MAX === 50, 'pagination bounds');
check(GBS_MARKETPLACE_BOUNDS.SEARCH_MAX === 80, 'search length bound');

const envExample = read('.env.example');
check(/BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0/.test(envExample), 'env example documents marketplace OFF');
check(!/BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=1/.test(envExample), 'env example does not enable marketplace');
const prodExample = read('.env.production.example');
check(/BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0/.test(prodExample), 'production example marketplace OFF');
check(!/BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=1/.test(prodExample), 'production example does not enable marketplace');

const publicRoutes = read('server/src/routes/gbsPublic.js');
check(publicRoutes.includes("'/business-services/enabled'"), 'anonymous enabled probe');
check(publicRoutes.includes("'/business-services/listings'"), 'anonymous list route');
check(publicRoutes.includes("'/business-services/listings/:listingSlug'"), 'anonymous detail route');
check(publicRoutes.includes('searchLimiter'), 'list uses searchLimiter');
check(!/\.(post|put|patch|delete)\(/.test(publicRoutes), 'no public write verbs');

const indexJs = read('server/src/index.js');
check(indexJs.includes('gbsPublicRouter'), 'public GBS router mounted from server index');
check(indexJs.includes('apiLimiter'), 'apiLimiter remains on /api');
const indexRoutes = read('server/src/routes/index.js');
check(!/gbsPublic|business-services/.test(indexRoutes), 'server routes barrel does not host public GBS marketplace');

const agentRoutes = read('server/src/routes/agent.js');
check(!agentRoutes.includes("'/business-services'"), 'agent router has no anonymous /business-services mount');

const clientRoutes = read('client/src/routes/index.jsx');
check(clientRoutes.includes('ROUTES.BUSINESS_SERVICES'), 'public hub uses ROUTES.BUSINESS_SERVICES');
check(clientRoutes.includes('ROUTES.BUSINESS_SERVICES_LISTING'), 'public detail uses listing slug route');
check(!clientRoutes.includes("path: '/business-services'"), 'literal path string avoided so predecessor contracts stay valid');
check(!clientRoutes.includes("pages/Business/"), 'no Business Client workspace pages');
check(!/business-services\/providers/.test(clientRoutes), 'no /business-services/providers');
check(!/path: '\/business'|ROUTES\.BUSINESS_CLIENT/.test(clientRoutes), 'no /business client dashboard');

const constants = read('client/src/constants/index.js');
check(constants.includes("BUSINESS_SERVICES: '/business-services'"), 'hub path');
check(constants.includes("BUSINESS_SERVICES_LISTING: '/business-services/:listingSlug'"), 'detail slug path');

const pageReg = read('shared/pageRegistry.js');
check(!/\/business-services/.test(pageReg), 'disabled marketplace is not a static indexable pageRegistry entry');
const indexable = read('shared/seo/publicIndexablePages.js');
check(!indexable.includes("'/business-services'"), 'INDEXABLE_STATIC_PATHS does not advertise GBS while OFF');

const robotsTxt = read('client/public/robots.txt');
check(!/Allow:\s*\/business-services/.test(robotsTxt), 'robots does not advertise GBS marketplace');

const seoCtrl = read('server/src/controllers/seoController.js');
check(seoCtrl.includes('listEligibleMarketplaceSitemapPaths'), 'XML sitemap consults live GBS eligibility');

const listingModel = read('server/src/models/gbs/GbsServiceListing.js');
check(listingModel.includes('publicSlug'), 'additive publicSlug field');
check(listingModel.includes('unique: true, sparse: true'), 'publicSlug unique sparse index');

const slugUtil = read('server/src/utils/gbsListingSlug.js');
check(slugUtil.includes('assignListingPublicSlugIfAbsent'), 'slug assigned once');
check(slugUtil.includes('opaqueSuffix') || slugUtil.includes('randomBytes'), 'collision uses opaque suffix');
check(!/String\(listing\._id\)/.test(slugUtil), 'slug generator does not use raw Mongo id');

const cas = read('server/src/services/platform/optimisticConcurrency.js');
check(cas.includes('delete $set.publicSlug'), 'providers cannot mutate publicSlug');

const review = read('server/src/services/gbs/serviceListingReviewService.js');
check(review.includes('assignListingPublicSlugIfAbsent'), 'Admin approve assigns slug when ready');

const svc = read('server/src/services/gbs/gbsMarketplaceService.js');
check(svc.includes('evaluatePublicMarketplaceEligibility'), 'list/detail re-run live eligibility');
check(svc.includes('escapeRegex'), 'search input is escaped');
check(svc.includes('CANDIDATE_WINDOW'), 'candidate window is bounded');
check(!svc.includes('memberships[0]'), 'no memberships[0] identity');
check(svc.includes("sort === 'title' ? 'title' : 'newest'"), 'sort allowlist newest/title');
check(!/recommended|featured|sponsored|most trusted/i.test(svc), 'no paid/fake ranking');
check(svc.includes('marketplaceListingProjection'), 'dedicated public DTO');
check(!svc.includes('publicListingProjection('), 'does not reuse provider/admin projection');

const eligibilitySrc = read('shared/gbs/marketplaceEligibility.js');
check(eligibilitySrc.includes('isBusinessServicesDomainEnrollmentActive'), 'public eligibility requires active domain');
check(eligibilitySrc.includes('PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES'), 'domainId is business_services');
check(eligibilitySrc.includes('PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE'), 'setup is not enough');
check(eligibilitySrc.includes('evaluateListingPublicationGate'), 'consumes 17D-4 publication gate');
check(eligibilitySrc.includes('GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED'), 'Admin approval required');

const projectionSrc = read('shared/gbs/marketplaceProjection.js');
for (const key of [
  'subjectId',
  'reviewedBy',
  'reviewReason',
  'adminReviewStatus',
  'moderationStatus',
  'publicationStatus',
  'riskFlags',
  'recordVersion',
  'email',
  'phone',
  'whatsapp',
]) {
  check(projectionSrc.includes(`'${key}'`), `leak key list includes ${key}`);
}

const providerCtrl = read('server/src/controllers/gbsProviderController.js');
check(providerCtrl.includes('isBusinessServicesPublicMarketplaceEnabled'), 'provider enabled probe uses real marketplace helper');

const marketplaceCtrl = read('server/src/controllers/gbsMarketplaceController.js');
check(marketplaceCtrl.includes("Cache-Control', 'no-store'"), 'detail/list Cache-Control no-store');
check(marketplaceCtrl.includes("error: 'not_found'"), 'generic 404 body');

check(!existsSync(path.join(root, 'server/src/models/gbs/ServiceRequest.js')), 'no ServiceRequest model');
check(!existsSync(path.join(root, 'server/src/models/gbs/Quote.js')), 'no Quote model');
check(!existsSync(path.join(root, 'server/src/models/gbs/FormationCase.js')), 'no FormationCase model');

const wyScope = {
  countryCodes: ['US'],
  jurisdictionIds: ['j:US-WY'],
  entityTypeIds: ['et:US-WY:LLC'],
};
const listing = {
  _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  subjectType: 'agent',
  subjectId: 'subj-1',
  capabilityId: 'business_formation',
  title: 'Wyoming LLC formation',
  shortDescription: 'Formation support',
  description: 'Private notes must not leak.',
  countryCode: 'US',
  jurisdictionId: 'j:US-WY',
  entityTypeIds: ['et:US-WY:LLC'],
  scope: wyScope,
  pricingMode: 'fixed',
  providerFeeLines: [{ label: 'Professional fee', amountMinor: 20000, currency: 'GBP' }],
  moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
  adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
  publicationStatus: 'private',
  reviewedBy: 'staff-1',
  reviewedAt: new Date(),
  reviewReason: 'internal',
  riskFlags: ['x'],
  recordVersion: 4,
  schemaVersion: '17d-1.0',
  creationCommandId: 'cmd-secret',
  publicSlug: 'wyoming-llc-formation',
};
const capability = {
  subjectType: 'agent',
  subjectId: 'subj-1',
  capabilityId: 'business_formation',
  status: GRANT_STATUSES.ACTIVE,
  trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
  scope: wyScope,
};
const domain = {
  subjectType: 'agent',
  subjectId: 'subj-1',
  domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE,
};

const off = evaluatePublicMarketplaceEligibility({
  env: {},
  listing,
  capability,
  domainEnrollment: domain,
});
check(off.allowed === false && off.reason === MARKETPLACE_DENY_REASONS.MARKETPLACE_DISABLED, 'marketplace OFF hides otherwise valid listing');

const unapproved = evaluatePublicMarketplaceEligibility({
  env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
  listing: { ...listing, adminReviewStatus: 'pending', moderationStatus: 'under_review' },
  capability,
  domainEnrollment: domain,
});
check(unapproved.allowed === false, 'Admin unapproved listing hidden');

const unverified = evaluatePublicMarketplaceEligibility({
  env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
  listing,
  capability: { ...capability, trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED },
  domainEnrollment: domain,
});
check(unverified.allowed === false, 'unverified capability hidden');

const suspendedCap = evaluatePublicMarketplaceEligibility({
  env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
  listing,
  capability: { ...capability, status: GRANT_STATUSES.SUSPENDED },
  domainEnrollment: domain,
});
check(suspendedCap.allowed === false, 'suspended capability hidden');

const setupDomain = evaluatePublicMarketplaceEligibility({
  env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
  listing,
  capability,
  domainEnrollment: { ...domain, status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.SETUP },
});
check(setupDomain.allowed === false, 'domain setup is not public eligibility');

const wrongSubjectDomain = evaluatePublicMarketplaceEligibility({
  env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
  listing,
  capability,
  domainEnrollment: { ...domain, subjectType: 'organization', subjectId: 'agency-1' },
});
check(wrongSubjectDomain.allowed === false, 'Agency domain cannot authorize Independent listing');

const wrongCapSubject = evaluatePublicMarketplaceEligibility({
  env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
  listing,
  capability: { ...capability, subjectType: 'organization', subjectId: 'agency-1' },
  domainEnrollment: domain,
});
check(wrongCapSubject.allowed === false, 'Agency capability cannot authorize Independent listing');

const invalidScope = evaluatePublicMarketplaceEligibility({
  env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
  listing: { ...listing, scope: { ...wyScope, jurisdictionIds: ['j:US-WY', 'j:US-DE'] } },
  capability,
  domainEnrollment: domain,
});
check(invalidScope.allowed === false, 'scope outside capability is hidden');

const suspendedListing = evaluatePublicMarketplaceEligibility({
  env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
  listing: { ...listing, moderationStatus: GBS_LISTING_MODERATION_STATUSES.SUSPENDED },
  capability,
  domainEnrollment: domain,
});
check(suspendedListing.allowed === false, 'suspended listing hidden');

const visible = evaluatePublicMarketplaceEligibility({
  env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
  listing,
  capability,
  domainEnrollment: domain,
});
check(visible.allowed === true, 'all requirements valid → eligible');

const dto = marketplaceListingProjection(listing, {
  identity: { type: 'agent', displayName: 'Ameer Independent', providerKind: 'independent' },
  jurisdictionName: 'Wyoming',
  entityLabels: ['Wyoming LLC'],
  governmentFees: [{ label: 'Wyoming LLC Articles', amount: 100, currency: 'USD', eligibleCurrent: true, amountModel: 'fixed' }],
});
check(assertMarketplaceProjectionSafe(dto) === true, 'public DTO excludes leak keys');
check(!JSON.stringify(dto).includes('subj-1'), 'subjectId not projected');
check(!JSON.stringify(dto).includes('staff-1'), 'reviewedBy not projected');
check(dto.subject.providerKind === 'independent' && dto.subject.displayName === 'Ameer Independent', 'exact Independent identity');
check(dto.professionalFeeSummary.label.includes('Professional service fee'), 'professional fee labelled');
check(dto.governmentFees[0].ownership === 'government' && dto.governmentFees[0].listed === true, 'government fees separate');
check(verificationBadge(listing, null, 'Wyoming').label.includes('Business formation'), 'capability-specific badge');
check(!verificationBadge(listing).label.includes('Verified Provider'), 'no generic Verified Provider');

const quote = professionalFeeSummary({ pricingMode: 'quote_required', providerFeeLines: [{ amountMinor: 0, currency: 'USD' }] });
check(quote.kind === 'quote_required' && quote.label === 'Quote required', 'quote_required is not a zero price');

const slugA = generateListingPublicSlug('Wyoming LLC formation');
const slugB = generateListingPublicSlug('Wyoming LLC formation', { attempt: 1 });
check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugA), 'slug is URL-safe');
check(slugA !== slugB, 'collision retry changes slug');
check(!/^[a-f0-9]{24}$/.test(slugA), 'slug is not a raw Mongo id');

console.log(`phase17d5SourceContract.test.js: ${count} assertions passed`);
