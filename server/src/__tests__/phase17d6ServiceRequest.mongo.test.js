/**
 * Phase 17D-6 — service request Mongo integrity.
 *
 *   STRIDETO_17D6_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d6_integrity_run1
 *   node src/__tests__/phase17d6ServiceRequest.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { UserCapabilityGrant } from '../models/capability/UserCapabilityGrant.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { Organization } from '../models/Organization.js';
import { ProviderCapability } from '../models/gbs/ProviderCapability.js';
import { ProviderDomainEnrollment } from '../models/gbs/ProviderDomainEnrollment.js';
import { GbsServiceListing } from '../models/gbs/GbsServiceListing.js';
import { GbsServiceRequest } from '../models/gbs/GbsServiceRequest.js';
import { IdempotencyRecord } from '../models/platform/IdempotencyRecord.js';
import { UserNotification } from '../models/UserNotification.js';
import { ORGANIZATION_TYPES, ORGANIZATION_STATUSES } from '../../../shared/international/organization.js';
import { AGENT_TYPES, AGENT_MEMBER_ROLES } from '../../../shared/agent/constants.js';
import {
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  GBS_LISTING_MODERATION_STATUSES,
  GBS_LISTING_PUBLICATION_STATUSES,
  GBS_PRICING_MODES,
  GBS_SERVICE_REQUEST_ACTING_FOR,
  GBS_SERVICE_REQUEST_STATUSES,
  PROVIDER_SUBJECT_TYPES,
  PROVIDER_TRUST_STATUSES,
} from '../../../shared/gbs/constants.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_DOMAIN_ENROLLMENT_STATUSES, PROVIDER_DOMAIN_IDS, PROVIDER_DOMAIN_INITIALIZATION_STATES } from '../../../shared/provider/providerDomains.js';
import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { assignListingPublicSlugIfAbsent } from '../utils/gbsListingSlug.js';
import { activateBusinessClient } from '../services/gbs/gbsBuyerActivationService.js';
import {
  cancelCustomerServiceRequest,
  createCustomerServiceRequest as createCustomerServiceRequestWithReadiness,
  declineProviderServiceRequest,
  getCustomerServiceRequest,
  listCustomerServiceRequests,
  listProviderServiceRequests,
  readyForQuoteProviderServiceRequest as readyForQuoteProviderServiceRequestWithReadiness,
  reviewProviderServiceRequest,
} from '../services/gbs/gbsServiceRequestService.js';
import { assertProviderDomainAccess } from '../services/gbs/providerDomainService.js';

const createCustomerServiceRequest = (args) => createCustomerServiceRequestWithReadiness({
  ...args,
  readinessResolver: () => ({ productionReady: true, state: 'current_reviewed', reason: 'current_reviewed' }),
});
const readyForQuoteProviderServiceRequest = (args) => readyForQuoteProviderServiceRequestWithReadiness({
  ...args,
  readinessResolver: () => ({ productionReady: true, state: 'current_reviewed', reason: 'current_reviewed' }),
});

const TEST_URI = process.env.STRIDETO_17D6_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d6_integrity_run1';
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
const OFF = { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' };
const S = GBS_SERVICE_REQUEST_STATUSES;

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: true });
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(),
    UserCapabilityGrant.init(),
    AgentAccount.init(),
    AgentProfile.init(),
    AgentMembership.init(),
    Organization.init(),
    ProviderCapability.init(),
    ProviderDomainEnrollment.init(),
    GbsServiceListing.init(),
    GbsServiceRequest.init(),
    IdempotencyRecord.init(),
    UserNotification.init(),
  ]);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

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

async function enrollActive(subjectType, subjectId) {
  return ProviderDomainEnrollment.create({
    subjectType,
    subjectId: String(subjectId),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE,
  });
}

async function verifiedCapability({ subjectType, subjectId, capabilityId = 'business_formation' }) {
  return ProviderCapability.create({
    subjectType,
    subjectId: String(subjectId),
    capabilityId,
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    scope: wyScope,
  });
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

function intake(listing, commandId, extra = {}) {
  return {
    listingSlug: listing.publicSlug,
    creationCommandId: commandId,
    actingFor: GBS_SERVICE_REQUEST_ACTING_FOR.SELF,
    customerSummary: 'Need Wyoming LLC formation support.',
    ...extra,
  };
}

test('activation, create eligibility, exact subject, idempotency, lifecycle, authority loss', async () => {
  const customer = await makeUser('buyer@example.com', 'Amina Buyer');
  const other = await makeUser('other@example.com', 'Other Person');
  const independent = await makeAgent('ind@example.com', 'Independent Ameer');
  const otherInd = await makeAgent('ind2@example.com', 'Independent Other');
  const agency = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENCY,
    displayName: 'Long Agency Name For Overflow Testing LLC',
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  const agencyOwner = await makeAgent('agency-owner@example.com', 'Agency Owner');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: agencyOwner._id,
    role: AGENT_MEMBER_ROLES.OWNER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: Object.values(PROVIDER_DOMAIN_PERMISSIONS).filter((id) => id.startsWith('business_services.')),
    }],
  });
  const viewMember = await makeAgent('view@example.com', 'View Member');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: viewMember._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: [PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW],
    }],
  });
  const manageMember = await makeAgent('manage@example.com', 'Manage Member');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: manageMember._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: [
        PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW,
        PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_REQUESTS_MANAGE,
      ],
    }],
  });
  const eduOnly = await makeAgent('edu@example.com', 'Edu Only');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: eduOnly._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
      permissions: [PROVIDER_DOMAIN_PERMISSIONS.EDUCATION_VIEW, PROVIDER_DOMAIN_PERMISSIONS.EDUCATION_CONSULTATIONS_MANAGE],
    }],
  });

  await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, independent._id);
  await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, otherInd._id);
  await enrollActive(PROVIDER_SUBJECT_TYPES.ORGANIZATION, agency._id);
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: independent._id });
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: otherInd._id });
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: agency._id });

  const listing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Wyoming LLC formation Independent',
    slug: 'wy-llc-ind-17d6',
  });
  const agencyListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: agency._id,
    title: 'Wyoming LLC formation Agency',
    slug: 'wy-llc-agency-17d6',
  });

  const first = await activateBusinessClient({ userId: customer._id, actor: { id: String(customer._id) } });
  assert.equal(first.activated, true);
  const second = await activateBusinessClient({ userId: customer._id, actor: { id: String(customer._id) } });
  assert.equal(second.idempotent, true);
  const grants = await UserCapabilityGrant.find({ userId: customer._id, capability: 'business_client' });
  assert.equal(grants.length, 1);
  assert.equal(grants[0].status, GRANT_STATUSES.ACTIVE);

  await assert.rejects(
    () => createCustomerServiceRequest({
      userId: other._id,
      body: intake(listing, 'cmd-no-grant'),
      env: ON,
    }),
    (err) => err.status === 403 || err.code === 'capability_denied' || err.code === 'not_found' || err.status === 404
  );

  await activateBusinessClient({ userId: other._id, actor: { id: String(other._id) } });

  await assert.rejects(
    () => createCustomerServiceRequest({
      userId: customer._id,
      body: intake(listing, 'cmd-hidden'),
      env: OFF,
    }),
    (err) => err.status === 404 && err.code === 'not_found'
  );

  const created = await createCustomerServiceRequest({
    userId: customer._id,
    body: intake(listing, 'cmd-create-1'),
    actor: { id: String(customer._id) },
    env: ON,
  });
  assert.equal(created.status, S.SUBMITTED);
  assert.equal(created.providerKind, 'independent');
  const stored = await GbsServiceRequest.findOne({ publicRequestRef: created.publicRequestRef }).lean();
  assert.equal(stored.providerSubjectType, PROVIDER_SUBJECT_TYPES.AGENT);
  assert.equal(String(stored.providerSubjectId), String(independent._id));
  assert.equal(String(stored.listingId), String(listing._id));
  assert.notEqual(stored.publicRequestRef, String(stored._id));
  assert.equal(/^SR-\d+$/.test(stored.publicRequestRef), false);

  await assert.rejects(
    () => createCustomerServiceRequest({
      userId: customer._id,
      body: { ...intake(listing, 'cmd-provider'), providerId: String(otherInd._id), organizationId: String(agency._id) },
      env: ON,
    }),
    (err) => err.code === 'untrusted_field'
  );

  const replay = await createCustomerServiceRequest({
    userId: customer._id,
    body: intake(listing, 'cmd-create-1'),
    env: ON,
  });
  assert.equal(replay.publicRequestRef, created.publicRequestRef);
  assert.equal(await GbsServiceRequest.countDocuments({ requesterUserId: customer._id, listingId: listing._id }), 1);

  await assert.rejects(
    () => createCustomerServiceRequest({
      userId: customer._id,
      body: intake(listing, 'cmd-create-1', { customerSummary: 'Different payload' }),
      env: ON,
    }),
    (err) => err.status === 409 && err.code === 'idempotency_conflict'
  );

  const secondReq = await createCustomerServiceRequest({
    userId: customer._id,
    body: intake(listing, 'cmd-create-2'),
    env: ON,
  });
  assert.notEqual(secondReq.publicRequestRef, created.publicRequestRef);

  const ownList = await listCustomerServiceRequests({ userId: customer._id, query: {} });
  assert.ok(ownList.items.some((row) => row.publicRequestRef === created.publicRequestRef));
  await assert.rejects(
    () => getCustomerServiceRequest({ userId: other._id, requestRef: created.publicRequestRef }),
    (err) => err.status === 404
  );

  const inbox = await listProviderServiceRequests({
    subject: { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    query: {},
  });
  assert.ok(inbox.items.some((row) => row.publicRequestRef === created.publicRequestRef));
  assert.equal(JSON.stringify(inbox.items[0]).includes(customer.email), false);
  const otherInbox = await listProviderServiceRequests({
    subject: { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(otherInd._id) },
    query: {},
  });
  assert.equal(otherInbox.items.some((row) => row.publicRequestRef === created.publicRequestRef), false);

  const reviewed = await reviewProviderServiceRequest({
    subject: { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    requestRef: created.publicRequestRef,
    expectedVersion: stored.recordVersion,
    actor: { agentAccountId: String(independent._id) },
    body: { expectedVersion: stored.recordVersion },
  });
  assert.equal(reviewed.status, S.PROVIDER_REVIEWING);
  const reviewedReplay = await reviewProviderServiceRequest({
    subject: { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    requestRef: created.publicRequestRef,
    expectedVersion: reviewed.recordVersion,
    body: { expectedVersion: reviewed.recordVersion },
  });
  assert.equal(reviewedReplay.recordVersion, reviewed.recordVersion);

  await assert.rejects(
    () => reviewProviderServiceRequest({
      subject: { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
      requestRef: created.publicRequestRef,
      expectedVersion: 0,
      body: { expectedVersion: 0 },
    }),
    (err) => err.status === 409 && err.code === 'optimistic_concurrency_conflict'
  );

  const ready = await readyForQuoteProviderServiceRequest({
    subject: { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    requestRef: created.publicRequestRef,
    expectedVersion: reviewed.recordVersion,
    body: { expectedVersion: reviewed.recordVersion },
    env: OFF,
  });
  assert.equal(ready.status, S.READY_FOR_QUOTE);
  assert.equal(await mongoose.connection.db.listCollections({ name: 'quotes' }).hasNext(), false);
  assert.equal(await GbsServiceRequest.countDocuments({ publicRequestRef: created.publicRequestRef }), 1);

  const customerView = await getCustomerServiceRequest({ userId: customer._id, requestRef: created.publicRequestRef });
  assert.equal(customerView.status, S.READY_FOR_QUOTE);

  const cancelled = await cancelCustomerServiceRequest({
    userId: customer._id,
    requestRef: created.publicRequestRef,
    expectedVersion: ready.recordVersion,
  });
  assert.equal(cancelled.status, S.CANCELLED);

  const agencyReq = await createCustomerServiceRequest({
    userId: customer._id,
    body: intake(agencyListing, 'cmd-agency-1'),
    env: ON,
  });
  const agencyStored = await GbsServiceRequest.findOne({ publicRequestRef: agencyReq.publicRequestRef }).lean();
  assert.equal(agencyStored.providerSubjectType, PROVIDER_SUBJECT_TYPES.ORGANIZATION);
  const indSeesAgency = await listProviderServiceRequests({
    subject: { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(agencyOwner._id) },
    query: {},
  });
  assert.equal(indSeesAgency.items.some((row) => row.publicRequestRef === agencyReq.publicRequestRef), false);
  const agencyInbox = await listProviderServiceRequests({
    subject: { subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: String(agency._id) },
    query: {},
  });
  assert.ok(agencyInbox.items.some((row) => row.publicRequestRef === agencyReq.publicRequestRef));

  await assertProviderDomainAccess({
    agentAccountId: String(viewMember._id),
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: String(agency._id),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW,
  });
  await assert.rejects(
    () => assertProviderDomainAccess({
      agentAccountId: String(viewMember._id),
      subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
      subjectId: String(agency._id),
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_REQUESTS_MANAGE,
    }),
    (err) => err.status === 403
  );
  await assertProviderDomainAccess({
    agentAccountId: String(manageMember._id),
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: String(agency._id),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_REQUESTS_MANAGE,
  });
  await assert.rejects(
    () => assertProviderDomainAccess({
      agentAccountId: String(eduOnly._id),
      subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
      subjectId: String(agency._id),
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW,
    }),
    (err) => err.status === 403
  );

  const declined = await declineProviderServiceRequest({
    subject: { subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: String(agency._id) },
    requestRef: agencyReq.publicRequestRef,
    expectedVersion: agencyStored.recordVersion,
    body: { expectedVersion: agencyStored.recordVersion, declineReasonCode: 'out_of_scope', declineNote: 'Not a fit.' },
  });
  assert.equal(declined.status, S.DECLINED);
  await assert.rejects(
    () => readyForQuoteProviderServiceRequest({
      subject: { subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: String(agency._id) },
      requestRef: agencyReq.publicRequestRef,
      expectedVersion: declined.recordVersion,
      body: { expectedVersion: declined.recordVersion },
      env: ON,
    }),
    (err) => err.status === 409
  );

  const lossListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Authority loss listing',
    slug: 'wy-llc-loss-17d6',
  });
  const lossReq = await createCustomerServiceRequest({
    userId: customer._id,
    body: intake(lossListing, 'cmd-loss-1'),
    env: ON,
  });
  const lossStored = await GbsServiceRequest.findOne({ publicRequestRef: lossReq.publicRequestRef });
  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id), capabilityId: 'business_formation' },
    { $set: { status: GRANT_STATUSES.SUSPENDED } }
  );
  await assert.rejects(
    () => readyForQuoteProviderServiceRequest({
      subject: { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
      requestRef: lossReq.publicRequestRef,
      expectedVersion: lossStored.recordVersion,
      body: { expectedVersion: lossStored.recordVersion },
      env: OFF,
    }),
    (err) => err.status === 403
  );
  const stillReadable = await getCustomerServiceRequest({ userId: customer._id, requestRef: lossReq.publicRequestRef });
  assert.equal(stillReadable.publicRequestRef, lossReq.publicRequestRef);

  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id), capabilityId: 'business_formation' },
    { $set: { status: GRANT_STATUSES.ACTIVE } }
  );
  await ProviderDomainEnrollment.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    { $set: { status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.SETUP } }
  );
  await assert.rejects(
    () => readyForQuoteProviderServiceRequest({
      subject: { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
      requestRef: lossReq.publicRequestRef,
      expectedVersion: lossStored.recordVersion,
      body: { expectedVersion: lossStored.recordVersion },
      env: OFF,
    }),
    (err) => err.status === 403
  );
  await ProviderDomainEnrollment.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    { $set: { status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE } }
  );

  for (const moderation of [
    GBS_LISTING_MODERATION_STATUSES.SUSPENDED,
    GBS_LISTING_MODERATION_STATUSES.REJECTED,
    GBS_LISTING_MODERATION_STATUSES.ARCHIVED,
  ]) {
    await GbsServiceListing.updateOne({ _id: lossListing._id }, { $set: { moderationStatus: moderation } });
    await assert.rejects(
      () => readyForQuoteProviderServiceRequest({
        subject: { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
        requestRef: lossReq.publicRequestRef,
        expectedVersion: lossStored.recordVersion,
        body: { expectedVersion: lossStored.recordVersion },
        env: OFF,
      }),
      (err) => err.status === 403
    );
  }

  const historical = await getCustomerServiceRequest({ userId: customer._id, requestRef: created.publicRequestRef });
  assert.equal(historical.status, S.CANCELLED);
  const collections = await mongoose.connection.db.listCollections().toArray();
  assert.equal(collections.some((c) => /formationcase|mailroom/i.test(c.name)), false);
  assert.equal(collections.some((c) => c.name === 'quotes'), false, 'no sequential quotes collection');

  const notifCount = await UserNotification.countDocuments({
    type: 'gbs_service_request_submitted',
    userId: customer._id,
  });
  assert.ok(notifCount >= 1);
});
