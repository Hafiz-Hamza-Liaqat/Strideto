/**
 * Phase 17D-6 — live-like indexes (autoIndex=false) + idempotency races.
 *
 *   STRIDETO_17D6_TEST_MONGO_URI=mongodb://127.0.0.1:27018/strideto_17d6_index_run1
 *   node src/__tests__/phase17d6LiveIndexIdempotency.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { Organization } from '../models/Organization.js';
import { ProviderCapability } from '../models/gbs/ProviderCapability.js';
import { ProviderDomainEnrollment } from '../models/gbs/ProviderDomainEnrollment.js';
import { GbsServiceListing } from '../models/gbs/GbsServiceListing.js';
import { GbsServiceRequest } from '../models/gbs/GbsServiceRequest.js';
import { IdempotencyRecord } from '../models/platform/IdempotencyRecord.js';
import { UserNotification } from '../models/UserNotification.js';
import { AuditLog } from '../models/AuditLog.js';
import { ORGANIZATION_TYPES, ORGANIZATION_STATUSES } from '../../../shared/international/organization.js';
import { AGENT_TYPES } from '../../../shared/agent/constants.js';
import {
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  GBS_LISTING_MODERATION_STATUSES,
  GBS_LISTING_PUBLICATION_STATUSES,
  GBS_PRICING_MODES,
  GBS_SERVICE_REQUEST_ACTING_FOR,
  PROVIDER_SUBJECT_TYPES,
  PROVIDER_TRUST_STATUSES,
} from '../../../shared/gbs/constants.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import {
  PROVIDER_DOMAIN_ENROLLMENT_STATUSES,
  PROVIDER_DOMAIN_IDS,
  PROVIDER_DOMAIN_INITIALIZATION_STATES,
} from '../../../shared/provider/providerDomains.js';
import { GBS_AUDIT_EVENTS } from '../../../shared/security/gbsAuditEvents.js';
import { assignListingPublicSlugIfAbsent } from '../utils/gbsListingSlug.js';
import { activateBusinessClient } from '../services/gbs/gbsBuyerActivationService.js';
import { createCustomerServiceRequest } from '../services/gbs/gbsServiceRequestService.js';
import {
  GBS_SERVICE_REQUEST_CRITICAL_INDEXES,
  IDEMPOTENCY_RECORD_CRITICAL_INDEXES,
  compareCriticalIndexes,
  provisionCriticalIdempotencyIndexes,
  provisionMissingIndexes,
} from '../services/platform/criticalIndexProvision.js';

const TEST_URI = process.env.STRIDETO_17D6_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d6_index_run1';
if (!/\/strideto_17d6_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D6_TEST_MONGO_URI must name a disposable strideto_17d6_* database');
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

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

function intake(listing, commandId, extra = {}) {
  return {
    listingSlug: listing.publicSlug,
    creationCommandId: commandId,
    actingFor: GBS_SERVICE_REQUEST_ACTING_FOR.SELF,
    customerSummary: 'Need Wyoming LLC formation support.',
    ...extra,
  };
}

async function makeUser(email, name = 'Customer') {
  return User.create({ email, password: 'TestPass123!', name, role: 'User' });
}

async function makeAgent(email, name) {
  const account = await AgentAccount.create({ email, password: 'TestPass123!', accountStatus: 'active' });
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
    providerDomainInitializationState: PROVIDER_DOMAIN_INITIALIZATION_STATES.READY,
  });
  return account;
}

async function approvedListing({ subjectType, subjectId, title, slug }) {
  const created = await GbsServiceListing.create({
    subjectType,
    subjectId: String(subjectId),
    capabilityId: 'business_formation',
    countryCode: 'US',
    jurisdictionId: 'j:US-WY',
    entityTypeIds: ['et:US-WY:LLC'],
    title,
    shortDescription: `${title} short`,
    description: `${title} long`,
    deliveryMode: 'remote',
    languages: ['en'],
    pricingMode: GBS_PRICING_MODES.QUOTE_REQUIRED,
    publicSlug: slug || null,
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
    publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
    scope: wyScope,
    creationCommandId: `cmd-17d6-${Math.random().toString(36).slice(2, 10)}`,
  });
  if (created.publicSlug) return created;
  return assignListingPublicSlugIfAbsent(created);
}

test('compareCriticalIndexes treats extra indexes as non-blocking extras', () => {
  const expected = GBS_SERVICE_REQUEST_CRITICAL_INDEXES;
  const actual = [
    { name: '_id_', key: { _id: 1 } },
    ...expected.map((spec) => {
      const row = { name: spec.name, key: { ...spec.key } };
      if (spec.unique === true) row.unique = true;
      if (spec.sparse === true) row.sparse = true;
      if (spec.expireAfterSeconds != null) row.expireAfterSeconds = spec.expireAfterSeconds;
      return row;
    }),
    { name: 'p17d6_keep_me', key: { leftover: 1 } },
  ];
  const comparison = compareCriticalIndexes(expected, actual);
  assert.equal(comparison.ok, true);
  assert.equal(comparison.extra.some((row) => row.name === 'p17d6_keep_me'), true);
});

test('autoIndex remains false and critical indexes are provisioned create-only', async () => {
  let before = [];
  try {
    before = await GbsServiceRequest.collection.indexes();
  } catch (err) {
    assert.equal(Number(err.code) === 26 || err.codeName === 'NamespaceNotFound', true);
  }
  assert.equal(
    before.filter((idx) => idx.name !== '_id_').length,
    0,
    'ServiceRequest starts without application indexes'
  );

  await GbsServiceRequest.collection.createIndex({ leftover: 1 }, { name: 'p17d6_keep_me' });

  const first = await provisionCriticalIdempotencyIndexes();
  const second = await provisionCriticalIdempotencyIndexes();
  const [a, b] = await Promise.all([
    provisionCriticalIdempotencyIndexes(),
    provisionCriticalIdempotencyIndexes(),
  ]);
  assert.ok(a.serviceRequest.comparison.ok && b.idempotency.comparison.ok);
  assert.equal(second.serviceRequest.created.length, 0);
  assert.equal(first.serviceRequest.comparison.ok, true);
  assert.equal(first.idempotency.comparison.ok, true);

  const reqIdx = await GbsServiceRequest.collection.indexes();
  const idemIdx = await IdempotencyRecord.collection.indexes();
  assert.equal(reqIdx.some((idx) => idx.name === 'p17d6_keep_me'), true, 'unrelated index is not removed');
  assert.equal(
    reqIdx.some((idx) => idx.name === 'gbs_service_request_creation_command_unique' && idx.unique === true),
    true
  );
  assert.equal(
    idemIdx.some((idx) => idx.name === 'idempotency_record_command_unique' && idx.unique === true),
    true
  );
  for (const spec of GBS_SERVICE_REQUEST_CRITICAL_INDEXES) {
    assert.ok(reqIdx.some((idx) => idx.name === spec.name), spec.name);
  }
  for (const spec of IDEMPOTENCY_RECORD_CRITICAL_INDEXES) {
    assert.ok(idemIdx.some((idx) => idx.name === spec.name), spec.name);
  }

  const again = await provisionMissingIndexes({
    collection: GbsServiceRequest.collection,
    expected: GBS_SERVICE_REQUEST_CRITICAL_INDEXES,
  });
  assert.deepEqual(again.created, []);
});

test('same command replays, conflicts, races, and never leaks across users', async () => {
  const customer = await makeUser('buyer-idx@example.com', 'Amina Buyer');
  const other = await makeUser('other-idx@example.com', 'Other Person');
  const independent = await makeAgent('ind-idx@example.com', 'Independent Ameer');

  await ProviderDomainEnrollment.create({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(independent._id),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE,
  });
  await ProviderCapability.create({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(independent._id),
    capabilityId: 'business_formation',
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    scope: wyScope,
  });
  const listing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Wyoming LLC formation Independent',
    slug: 'wy-llc-ind-17d6-idx',
  });

  await activateBusinessClient({ userId: customer._id, actor: { userId: customer._id } });
  await activateBusinessClient({ userId: other._id, actor: { userId: other._id } });
  await UserNotification.createCollection();
  await UserNotification.createCollection();

  const actor = { userId: customer._id };
  const created = await createCustomerServiceRequest({
    userId: customer._id,
    body: intake(listing, 'cmd-seq-1'),
    actor,
    env: ON,
  });
  const replay = await createCustomerServiceRequest({
    userId: customer._id,
    body: intake(listing, 'cmd-seq-1'),
    actor,
    env: ON,
  });
  assert.equal(replay.publicRequestRef, created.publicRequestRef);
  assert.equal(await GbsServiceRequest.countDocuments({ creationCommandId: 'cmd-seq-1' }), 1);

  await assert.rejects(
    () => createCustomerServiceRequest({
      userId: customer._id,
      body: intake(listing, 'cmd-seq-1', { customerSummary: 'Different payload' }),
      env: ON,
    }),
    (err) => err.status === 409 && err.code === 'idempotency_conflict'
  );
  assert.equal(await GbsServiceRequest.countDocuments({ creationCommandId: 'cmd-seq-1' }), 1);

  const second = await createCustomerServiceRequest({
    userId: customer._id,
    body: intake(listing, 'cmd-seq-2'),
    env: ON,
  });
  assert.notEqual(second.publicRequestRef, created.publicRequestRef);

  const raced = await Promise.all([
    createCustomerServiceRequest({
      userId: customer._id,
      body: intake(listing, 'cmd-race-1'),
      actor,
      env: ON,
    }),
    createCustomerServiceRequest({
      userId: customer._id,
      body: intake(listing, 'cmd-race-1'),
      actor,
      env: ON,
    }),
  ]);
  assert.equal(raced[0].publicRequestRef, raced[1].publicRequestRef);
  assert.equal(await GbsServiceRequest.countDocuments({ creationCommandId: 'cmd-race-1' }), 1);

  await assert.rejects(
    () => createCustomerServiceRequest({
      userId: other._id,
      body: intake(listing, 'cmd-seq-1'),
      env: ON,
    }),
    (err) => err.status === 409 && err.code === 'idempotency_conflict'
  );
  const customerRow = await GbsServiceRequest.findOne({ creationCommandId: 'cmd-seq-1' }).lean();
  assert.equal(String(customerRow.requesterUserId), String(customer._id));
  assert.equal(await GbsServiceRequest.countDocuments({ creationCommandId: 'cmd-seq-1' }), 1);

  const otherOwn = await createCustomerServiceRequest({
    userId: other._id,
    body: intake(listing, 'cmd-other-1'),
    env: ON,
  });
  assert.notEqual(otherOwn.publicRequestRef, created.publicRequestRef);

  const createdAudit = await AuditLog.countDocuments({
    action: GBS_AUDIT_EVENTS.GBS_SERVICE_REQUEST_CREATED,
    targetId: String(customerRow._id),
  });
  assert.equal(createdAudit, 1);
  const raceRow = await GbsServiceRequest.findOne({ creationCommandId: 'cmd-race-1' }).lean();
  assert.equal(
    await UserNotification.countDocuments({
      dedupeKey: `gbs:sr:provider:${raceRow._id}:gbs_service_request_received:${raceRow.status}:${raceRow.recordVersion}:${raceRow.providerSubjectId}`,
    }),
    1
  );
  assert.equal(
    await UserNotification.countDocuments({
      dedupeKey: `gbs:sr:customer:${customerRow._id}:gbs_service_request_submitted:${customerRow.status}:${customerRow.recordVersion}`,
    }),
    1
  );
});
