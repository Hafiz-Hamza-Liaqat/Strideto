/**
 * Phase 17D-5 — public marketplace Mongo integrity.
 *
 *   STRIDETO_17D5_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d5_integrity_run1
 *   node src/__tests__/phase17d5Marketplace.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { Organization } from '../models/Organization.js';
import { ProviderCapability } from '../models/gbs/ProviderCapability.js';
import { ProviderDomainEnrollment } from '../models/gbs/ProviderDomainEnrollment.js';
import { GbsServiceListing } from '../models/gbs/GbsServiceListing.js';
import { ORGANIZATION_TYPES, ORGANIZATION_STATUSES } from '../../../shared/international/organization.js';
import { AGENT_TYPES } from '../../../shared/agent/constants.js';
import {
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  GBS_LISTING_MODERATION_STATUSES,
  GBS_LISTING_PUBLICATION_STATUSES,
  GBS_PRICING_MODES,
  PROVIDER_SUBJECT_TYPES,
  PROVIDER_TRUST_STATUSES,
} from '../../../shared/gbs/constants.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_DOMAIN_ENROLLMENT_STATUSES, PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { EVIDENCE_DECISIONS, EVIDENCE_TYPES } from '../../../shared/gbs/providerEvidence.js';
import { marketplaceLeakKeys } from '../../../shared/gbs/marketplaceProjection.js';
import { assignListingPublicSlugIfAbsent, generateListingPublicSlug } from '../utils/gbsListingSlug.js';
import {
  getPublicMarketplaceEnabled,
  getPublicMarketplaceListing as getPublicMarketplaceListingWithReadiness,
  listEligibleMarketplaceSitemapPaths as listEligibleMarketplaceSitemapPathsWithReadiness,
  listPublicMarketplaceListings as listPublicMarketplaceListingsWithReadiness,
} from '../services/gbs/gbsMarketplaceService.js';

const currentReviewedFixture = () => ({ productionReady: true, state: 'current_reviewed', reason: 'current_reviewed' });
const getPublicMarketplaceListing = (slug, env) => getPublicMarketplaceListingWithReadiness(slug, env, currentReviewedFixture);
const listPublicMarketplaceListings = (query, env) => listPublicMarketplaceListingsWithReadiness(query, env, currentReviewedFixture);
const listEligibleMarketplaceSitemapPaths = (env, now) => listEligibleMarketplaceSitemapPathsWithReadiness(env, now, currentReviewedFixture);

const TEST_URI = process.env.STRIDETO_17D5_TEST_MONGO_URI || '';
if (!/\/strideto_17d5_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D5_TEST_MONGO_URI must name a disposable strideto_17d5_* database');
}

const wyScope = {
  serviceCategoryIds: [],
  countryCodes: ['US'],
  jurisdictionIds: ['j:US-WY'],
  entityTypeIds: ['et:US-WY:LLC'],
  protectedTitleIds: [],
  flags: { registered_agent: false, registered_office: false },
};

const ON = { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' };
const OFF = { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' };

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: true });
  await mongoose.connection.dropDatabase();
  await Promise.all([
    AgentAccount.init(),
    AgentProfile.init(),
    Organization.init(),
    ProviderCapability.init(),
    ProviderDomainEnrollment.init(),
    GbsServiceListing.init(),
  ]);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function makeAgent(email, name) {
  const account = await AgentAccount.create({
    email,
    password: 'TestPass123!',
    accountStatus: 'active',
  });
  const home = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENT,
    displayName: `${name} Home`,
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  await AgentProfile.create({
    agentAccountId: account._id,
    organizationId: home._id,
    agentType: AGENT_TYPES.AGENT,
    professionalName: name,
    phone: '+1-555-0100',
    email,
  });
  return account;
}

async function makeAgency(name) {
  return Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENCY,
    displayName: name,
    legalName: name,
    status: ORGANIZATION_STATUSES.ACTIVE,
    phone: '+1-555-0199',
  });
}

async function enrollActive(subjectType, subjectId) {
  return ProviderDomainEnrollment.create({
    subjectType,
    subjectId: String(subjectId),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE,
  });
}

async function verifiedCapability({ subjectType, subjectId, capabilityId = 'business_formation', scope = wyScope, evidenceRefs = [] }) {
  return ProviderCapability.create({
    subjectType,
    subjectId: String(subjectId),
    capabilityId,
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    scope,
    evidenceRefs,
  });
}

async function approvedListing({
  subjectType,
  subjectId,
  capabilityId = 'business_formation',
  title,
  slug,
  pricingMode = GBS_PRICING_MODES.FIXED,
  providerFeeLines = [{ label: 'Professional formation service', amountMinor: 20000, currency: 'USD' }],
  extra = {},
}) {
  const created = await GbsServiceListing.create({
    subjectType,
    subjectId: String(subjectId),
    capabilityId,
    countryCode: 'US',
    jurisdictionId: 'j:US-WY',
    entityTypeIds: ['et:US-WY:LLC'],
    title,
    shortDescription: `${title} short`,
    description: `${title} long description`,
    includedItems: ['Articles filing support'],
    excludedItems: ['Legal advice'],
    deliveryMode: 'remote',
    languages: ['en'],
    pricingMode,
    providerFeeLines,
    providerTurnaroundEstimate: 5,
    turnaroundUnit: 'business_days',
    turnaroundIsProviderEstimate: true,
    consultationAvailable: true,
    recurringService: false,
    publicSlug: slug || null,
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
    publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
    reviewedBy: 'staff-secret',
    reviewReason: 'internal-only',
    scope: capabilityId === 'registered_agent'
      ? { ...wyScope, protectedTitleIds: ['registered_agent'], flags: { registered_agent: true, registered_office: false } }
      : wyScope,
    riskFlags: ['internal-risk'],
    creationCommandId: `cmd-17d5-${Math.random().toString(36).slice(2, 10)}`,
    ...extra,
  });
  if (created.publicSlug) return created;
  return assignListingPublicSlugIfAbsent(created);
}

function leakHit(payload) {
  const raw = JSON.stringify(payload);
  return marketplaceLeakKeys().filter((key) => {
    if (key === 'email' || key === 'phone') return new RegExp(`"${key}"\\s*:`).test(raw);
    return raw.includes(`"${key}"`);
  });
}

test('flag OFF / legacy / provider-only keep marketplace unavailable', async () => {
  process.env.BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED = '0';
  const enabledOff = await getPublicMarketplaceEnabled();
  assert.equal(enabledOff.enabled, false);

  await assert.rejects(() => listPublicMarketplaceListings({}, OFF), (err) => err.status === 404 && err.code === 'not_found');
  await assert.rejects(() => getPublicMarketplaceListing('any-slug', OFF), (err) => err.status === 404);
  await assert.rejects(
    () => listPublicMarketplaceListings({}, { BUSINESS_SERVICES_ENABLED: '1' }),
    (err) => err.status === 404
  );
  await assert.rejects(
    () => listPublicMarketplaceListings({}, { BUSINESS_SERVICES_PROVIDER_ENABLED: '1' }),
    (err) => err.status === 404
  );
  const sitemapOff = await listEligibleMarketplaceSitemapPaths(OFF);
  assert.deepEqual(sitemapOff, []);
});

test('eligible Independent listing is discoverable; privacy, search, filters, pagination, sitemap', async () => {
  const ameer = await makeAgent('ameer-17d5@example.test', 'Ameer Independent');
  await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, ameer._id);
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: ameer._id });
  const listing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: ameer._id,
    title: 'Wyoming LLC formation support 17D5',
    slug: 'wyoming-llc-formation-support-17d5',
  });
  assert.equal(listing.publicationStatus, 'private');
  assert.ok(listing.publicSlug);
  assert.notEqual(listing.publicSlug, String(listing._id));

  await assert.rejects(() => listPublicMarketplaceListings({}, OFF), (err) => err.status === 404);

  const list = await listPublicMarketplaceListings({ q: 'Wyoming LLC' }, ON);
  assert.equal(list.total, 1);
  assert.equal(list.items[0].slug, listing.publicSlug);
  assert.equal(list.items[0].subject.providerKind, 'independent');
  assert.equal(list.items[0].subject.displayName, 'Ameer Independent');
  assert.equal(list.items[0].verificationBadge.label.includes('Business formation'), true);
  assert.equal(list.items[0].professionalFeeSummary.kind, 'fixed');
  assert.equal(list.items[0].governmentFeeListed, true);
  assert.deepEqual(leakHit(list), []);
  assert.equal(JSON.stringify(list).includes(String(ameer._id)), false);
  assert.equal(JSON.stringify(list).includes('staff-secret'), false);
  assert.equal(JSON.stringify(list).includes('+1-555-0100'), false);

  const detail = await getPublicMarketplaceListing(listing.publicSlug, ON);
  assert.equal(detail.title, listing.title);
  assert.equal(detail.subject.providerKind, 'independent');
  assert.ok(detail.governmentFees.some((fee) => fee.listed && fee.amount === 100));
  assert.equal(detail.turnaroundIsProviderEstimate, true);
  assert.deepEqual(leakHit(detail), []);
  assert.equal(JSON.stringify(detail).includes('internal-only'), false);
  assert.equal(JSON.stringify(detail).includes('internal-risk'), false);

  await assert.rejects(() => getPublicMarketplaceListing(listing.publicSlug, OFF), (err) => err.status === 404);
  await assert.rejects(() => getPublicMarketplaceListing('does-not-exist', ON), (err) => err.status === 404);

  const filtered = await listPublicMarketplaceListings({ subjectType: 'agent', capabilityId: 'business_formation', sort: 'title' }, ON);
  assert.equal(filtered.items[0].slug, listing.publicSlug);

  await assert.rejects(
    () => listPublicMarketplaceListings({ sort: 'recommended' }, ON),
    (err) => err.status === 400 && err.details.includes('sort')
  );
  await assert.rejects(
    () => listPublicMarketplaceListings({ subjectType: 'membership' }, ON),
    (err) => err.status === 400
  );

  const paged = await listPublicMarketplaceListings({ page: 1, limit: 99 }, ON);
  assert.equal(paged.limit, 50);

  const sitemap = await listEligibleMarketplaceSitemapPaths(ON);
  assert.ok(sitemap.includes('/business-services'));
  assert.ok(sitemap.includes(`/business-services/${listing.publicSlug}`));
});

test('Agency vs Independent exact-subject isolation', async () => {
  const independent = await makeAgent('ind-17d5@example.test', 'Independent Formation');
  const agency = await makeAgency('North Star Agency');
  await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, independent._id);
  await enrollActive(PROVIDER_SUBJECT_TYPES.ORGANIZATION, agency._id);
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: independent._id });
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: agency._id });

  const indListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Shared formation title',
    slug: 'shared-formation-title-ind',
  });
  const agencyListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: agency._id,
    title: 'Shared formation title',
    slug: 'shared-formation-title-agency',
  });

  const mixedCap = await listPublicMarketplaceListings({ q: 'Shared formation title' }, ON);
  const kinds = mixedCap.items.filter((row) => row.slug === indListing.publicSlug || row.slug === agencyListing.publicSlug);
  assert.equal(kinds.length, 2);
  assert.equal(kinds.find((r) => r.slug === indListing.publicSlug).subject.providerKind, 'independent');
  assert.equal(kinds.find((r) => r.slug === agencyListing.publicSlug).subject.providerKind, 'agency');
  assert.equal(kinds.find((r) => r.slug === agencyListing.publicSlug).subject.displayName, 'North Star Agency');
  assert.equal(JSON.stringify(kinds).includes('memberships'), false);

  const swapped = await GbsServiceListing.create({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(independent._id),
    capabilityId: 'business_formation',
    countryCode: 'US',
    jurisdictionId: 'j:US-WY',
    entityTypeIds: ['et:US-WY:LLC'],
    title: 'Unauthorized cross-subject listing',
    publicSlug: 'unauthorized-cross-subject',
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
    publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PUBLIC,
    scope: wyScope,
    pricingMode: GBS_PRICING_MODES.QUOTE_REQUIRED,
    creationCommandId: 'cmd-17d5-cross',
  });
  await ProviderCapability.deleteMany({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(independent._id),
    capabilityId: 'business_formation',
  });
  await verifiedCapability({
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: agency._id,
    capabilityId: 'document_preparation',
  });
  await assert.rejects(() => getPublicMarketplaceListing(swapped.publicSlug, ON), (err) => err.status === 404);
});

test('publication truth table and live revocation', async () => {
  const agent = await makeAgent('revoke-17d5@example.test', 'Revoke Independent');
  const enrollment = await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, agent._id);
  const cap = await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: agent._id });
  const listing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: agent._id,
    title: 'Revocation fixture formation',
    slug: 'revocation-fixture-formation',
  });

  const visible = await getPublicMarketplaceListing(listing.publicSlug, ON);
  assert.equal(visible.slug, listing.publicSlug);

  await ProviderCapability.updateOne({ _id: cap._id }, { $set: { trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED } });
  await assert.rejects(() => getPublicMarketplaceListing(listing.publicSlug, ON), (err) => err.status === 404);

  await ProviderCapability.updateOne({ _id: cap._id }, { $set: { trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED, status: GRANT_STATUSES.SUSPENDED } });
  await assert.rejects(() => getPublicMarketplaceListing(listing.publicSlug, ON), (err) => err.status === 404);

  await ProviderCapability.updateOne({ _id: cap._id }, { $set: { status: GRANT_STATUSES.REVOKED } });
  await assert.rejects(() => getPublicMarketplaceListing(listing.publicSlug, ON), (err) => err.status === 404);

  await ProviderCapability.updateOne({ _id: cap._id }, { $set: { status: GRANT_STATUSES.ACTIVE, trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED } });
  await ProviderDomainEnrollment.updateOne({ _id: enrollment._id }, { $set: { status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.SETUP } });
  await assert.rejects(() => getPublicMarketplaceListing(listing.publicSlug, ON), (err) => err.status === 404);

  await ProviderDomainEnrollment.updateOne({ _id: enrollment._id }, { $set: { status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE } });
  await GbsServiceListing.updateOne({ _id: listing._id }, { $set: { moderationStatus: GBS_LISTING_MODERATION_STATUSES.SUSPENDED } });
  await assert.rejects(() => getPublicMarketplaceListing(listing.publicSlug, ON), (err) => err.status === 404);

  await GbsServiceListing.updateOne({ _id: listing._id }, {
    $set: {
      moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED,
      adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.REJECTED,
    },
  });
  await assert.rejects(() => getPublicMarketplaceListing(listing.publicSlug, ON), (err) => err.status === 404);

  await GbsServiceListing.updateOne({ _id: listing._id }, {
    $set: {
      moderationStatus: GBS_LISTING_MODERATION_STATUSES.ARCHIVED,
      adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
    },
  });
  await assert.rejects(() => getPublicMarketplaceListing(listing.publicSlug, ON), (err) => err.status === 404);

  await GbsServiceListing.updateOne({ _id: listing._id }, {
    $set: {
      moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
      adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.PENDING,
      publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PUBLIC,
    },
  });
  await assert.rejects(() => getPublicMarketplaceListing(listing.publicSlug, ON), (err) => err.status === 404);

  await GbsServiceListing.updateOne({ _id: listing._id }, {
    $set: {
      adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
      publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
      scope: { ...wyScope, jurisdictionIds: ['j:US-WY', 'j:US-DE'] },
    },
  });
  await assert.rejects(() => getPublicMarketplaceListing(listing.publicSlug, ON), (err) => err.status === 404);

  await GbsServiceListing.updateOne({ _id: listing._id }, { $set: { scope: wyScope } });
  const restored = await getPublicMarketplaceListing(listing.publicSlug, ON);
  assert.equal(restored.slug, listing.publicSlug);
  await assert.rejects(() => getPublicMarketplaceListing(listing.publicSlug, OFF), (err) => err.status === 404);
});

test('protected-title evidence missing hides RA listing; quote_required is not zero; slug stable', async () => {
  const agent = await makeAgent('ra-17d5@example.test', 'RA Independent');
  await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, agent._id);
  await verifiedCapability({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: agent._id,
    capabilityId: 'registered_agent',
    scope: {
      ...wyScope,
      protectedTitleIds: ['registered_agent'],
      flags: { registered_agent: true, registered_office: false },
    },
  });
  const ra = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: agent._id,
    capabilityId: 'registered_agent',
    title: 'Wyoming registered agent 17D5',
    slug: 'wyoming-registered-agent-17d5',
    pricingMode: GBS_PRICING_MODES.QUOTE_REQUIRED,
    providerFeeLines: [],
  });
  await assert.rejects(() => getPublicMarketplaceListing(ra.publicSlug, ON), (err) => err.status === 404);

  await ProviderCapability.updateOne(
    { subjectType: 'agent', subjectId: String(agent._id), capabilityId: 'registered_agent' },
    {
      $set: {
        evidenceRefs: [{
          evidenceType: EVIDENCE_TYPES.REGULATORY_REGISTRATION,
          decision: EVIDENCE_DECISIONS.ACCEPTED,
          titleId: 'registered_agent',
          jurisdictionId: 'j:US-WY',
          subjectType: 'agent',
          subjectId: String(agent._id),
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        }],
      },
    }
  );
  const quoted = await getPublicMarketplaceListing(ra.publicSlug, ON);
  assert.equal(quoted.professionalFeeSummary.kind, 'quote_required');
  assert.equal(quoted.professionalFeeSummary.label, 'Quote required');
  assert.equal(quoted.verificationBadge.label.includes('Registered Agent'), true);

  const original = ra.publicSlug;
  const renamed = await GbsServiceListing.findByIdAndUpdate(ra._id, { $set: { title: 'Completely different title' } }, { new: true });
  const afterRename = await assignListingPublicSlugIfAbsent(renamed);
  assert.equal(afterRename.publicSlug, original);

  const other = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: agent._id,
    title: 'Completely different title',
  });
  assert.notEqual(other.publicSlug, original);
  assert.ok(generateListingPublicSlug('Completely different title'));
});
