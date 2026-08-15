/**
 * Phase 17D-7 — Quote Mongo integrity.
 *
 *   STRIDETO_17D7_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d7_integrity_run1
 *   node src/__tests__/phase17d7Quote.mongo.test.js
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
import { GbsQuote } from '../models/gbs/GbsQuote.js';
import { GbsCase } from '../models/gbs/GbsCase.js';
import { IdempotencyRecord } from '../models/platform/IdempotencyRecord.js';
import { UserNotification } from '../models/UserNotification.js';
import { AuditLog } from '../models/AuditLog.js';
import { BackgroundJob } from '../models/BackgroundJob.js';
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
import { USER_CAPABILITY_IDS } from '../../../shared/capability/userCapabilities.js';
import { PROVIDER_DOMAIN_ENROLLMENT_STATUSES, PROVIDER_DOMAIN_IDS, PROVIDER_DOMAIN_INITIALIZATION_STATES } from '../../../shared/provider/providerDomains.js';
import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../shared/security/gbsAuditEvents.js';
import { computeQuoteTotals, isOpaqueQuoteRef, snapshotOfficialFee } from '../../../shared/gbs/quoteContract.js';
import { FEE_AMOUNT_MODELS } from '../../../shared/gbs/catalogConstants.js';
import { assignListingPublicSlugIfAbsent } from '../utils/gbsListingSlug.js';
import { activateBusinessClient } from '../services/gbs/gbsBuyerActivationService.js';
import {
  cancelCustomerServiceRequest,
  createCustomerServiceRequest,
  readyForQuoteProviderServiceRequest,
  reviewProviderServiceRequest,
} from '../services/gbs/gbsServiceRequestService.js';
import { assertProviderDomainAccess } from '../services/gbs/providerDomainService.js';
import {
  acceptCustomerQuote,
  createProviderQuote,
  declineCustomerQuote,
  getCustomerQuote,
  sendProviderQuote,
  updateProviderQuoteDraft,
  withdrawProviderQuote,
} from '../services/gbs/gbsQuoteService.js';
import { requireNonStaffUser } from '../middleware/requireNonStaffUser.js';

const TEST_URI = process.env.STRIDETO_17D7_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d7_integrity_run1';
if (!/\/strideto_17d7_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D7_TEST_MONGO_URI must name a disposable strideto_17d7_* database');
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
const USD_FEE = [{ label: 'Formation support', amountMinor: 50000, currency: 'USD' }];
let seq = 0;
function nid(prefix) {
  seq += 1;
  return `${prefix}-${seq}-${Date.now().toString(36)}`;
}

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
    GbsQuote.init(),
    GbsCase.init(),
    IdempotencyRecord.init(),
    UserNotification.init(),
    AuditLog.init(),
    BackgroundJob.init(),
  ]);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function makeUser(email, name = 'Customer', role = 'User') {
  return User.create({ email, password: 'TestPass123!', name, role });
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

async function verifiedCapability({ subjectType, subjectId }) {
  return ProviderCapability.create({
    subjectType,
    subjectId: String(subjectId),
    capabilityId: 'business_formation',
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    scope: wyScope,
  });
}

async function approvedListing({
  subjectType,
  subjectId,
  title,
  slug,
  pricingMode = GBS_PRICING_MODES.QUOTE_REQUIRED,
  providerFeeLines = [],
  extra = {},
}) {
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
    pricingMode,
    providerFeeLines,
    publicSlug: slug || null,
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
    publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
    scope: wyScope,
    creationCommandId: nid('listing'),
    ...extra,
  });
  if (created.publicSlug) return created;
  return assignListingPublicSlugIfAbsent(created);
}

function intake(listing, commandId) {
  return {
    listingSlug: listing.publicSlug,
    creationCommandId: commandId,
    actingFor: GBS_SERVICE_REQUEST_ACTING_FOR.SELF,
    customerSummary: 'Need Wyoming LLC formation support.',
  };
}

async function readyRequest({ customer, listing, subject, cmd }) {
  const created = await createCustomerServiceRequest({
    userId: customer._id,
    body: intake(listing, cmd),
    env: ON,
  });
  const stored = await GbsServiceRequest.findOne({ publicRequestRef: created.publicRequestRef });
  const reviewed = await reviewProviderServiceRequest({
    subject,
    requestRef: created.publicRequestRef,
    expectedVersion: stored.recordVersion,
    body: { expectedVersion: stored.recordVersion },
  });
  const ready = await readyForQuoteProviderServiceRequest({
    subject,
    requestRef: created.publicRequestRef,
    expectedVersion: reviewed.recordVersion,
    body: { expectedVersion: reviewed.recordVersion },
    env: OFF,
  });
  return { created, ready, stored, requestRef: created.publicRequestRef };
}

async function fillDraft({ subject, requestRef, actor, commandId, fees = USD_FEE, officialFeeIds, validForDays }) {
  const created = await createProviderQuote({
    subject,
    requestRef,
    body: { creationCommandId: commandId },
    actor,
    env: OFF,
  });
  const body = {
    expectedVersion: created.recordVersion,
    professionalFeeLines: fees,
    providerTerms: 'Plain text terms only.',
  };
  if (officialFeeIds) body.officialFeeIds = officialFeeIds;
  if (validForDays != null) body.validForDays = validForDays;
  return updateProviderQuoteDraft({
    subject,
    quoteRef: created.publicQuoteRef,
    expectedVersion: created.recordVersion,
    body,
    actor,
  });
}

function providerActor(agent) {
  return { id: String(agent._id), agentAccountId: agent._id, role: 'agent' };
}

test('quote origin, exact subject, duties, money, honesty, lifecycle, races', async () => {
  const customer = await makeUser('buyer-17d7@example.com', 'Amina Buyer');
  const other = await makeUser('other-17d7@example.com', 'Other Person');
  const staff = await makeUser('staff-17d7@example.com', 'Staff Person', 'Admin');
  const independent = await makeAgent('ind-17d7@example.com', 'Independent Ameer');
  const otherInd = await makeAgent('ind2-17d7@example.com', 'Independent Other');
  const agency = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENCY,
    displayName: 'Long Agency Name For Overflow Testing LLC',
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  const agencyOwner = await makeAgent('agency-owner-17d7@example.com', 'Agency Owner');
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
  const viewMember = await makeAgent('view-17d7@example.com', 'View Member');
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
  const requestsMember = await makeAgent('req-17d7@example.com', 'Requests Member');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: requestsMember._id,
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
  const quotesMember = await makeAgent('quote-17d7@example.com', 'Quotes Member');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: quotesMember._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: [
        PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW,
        PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE,
      ],
    }],
  });
  const eduOnly = await makeAgent('edu-17d7@example.com', 'Edu Only');
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
    slug: 'wy-llc-ind-17d7',
  });
  const agencyListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: agency._id,
    title: 'Wyoming LLC formation Agency',
    slug: 'wy-llc-agency-17d7',
  });
  const fixedListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Fixed price listing',
    slug: 'wy-llc-fixed-17d7',
    pricingMode: GBS_PRICING_MODES.FIXED,
    providerFeeLines: [{ label: 'Fixed formation', amountMinor: 50000, currency: 'USD', ownership: 'provider' }],
  });
  const startListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Starting at listing',
    slug: 'wy-llc-start-17d7',
    pricingMode: GBS_PRICING_MODES.STARTING_AT,
    providerFeeLines: [{ label: 'Starting formation', amountMinor: 40000, currency: 'USD', ownership: 'provider' }],
  });
  const rangeListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Range listing',
    slug: 'wy-llc-range-17d7',
    pricingMode: GBS_PRICING_MODES.RANGE,
    providerFeeLines: [
      { label: 'Min', amountMinor: 20000, currency: 'USD', ownership: 'provider' },
      { label: 'Max', amountMinor: 80000, currency: 'USD', ownership: 'provider' },
    ],
  });

  await activateBusinessClient({ userId: customer._id, actor: { userId: customer._id } });
  await activateBusinessClient({ userId: other._id, actor: { userId: other._id } });

  const indSubject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) };
  const otherSubject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(otherInd._id) };
  const agencySubject = { subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: String(agency._id) };
  const actor = providerActor(independent);
  const agencyActor = providerActor(agencyOwner);
  const customerActor = { id: String(customer._id), userId: customer._id };

  const submitted = await createCustomerServiceRequest({
    userId: customer._id,
    body: intake(listing, nid('cmd-sub')),
    env: ON,
  });
  await assert.rejects(
    () => createProviderQuote({
      subject: indSubject,
      requestRef: submitted.publicRequestRef,
      body: { creationCommandId: nid('q-bad-status') },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409 && err.code === 'invalid_status_transition'
  );

  const ready = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-ready') });
  await assert.rejects(
    () => createProviderQuote({
      subject: otherSubject,
      requestRef: ready.requestRef,
      body: { creationCommandId: nid('q-wrong-ind') },
      actor: providerActor(otherInd),
      env: OFF,
    }),
    (err) => err.status === 404
  );

  const createCmd = nid('q-create');
  const draft = await fillDraft({
    subject: indSubject,
    requestRef: ready.requestRef,
    actor,
    commandId: createCmd,
    officialFeeIds: ['fee:US-WY-llc-articles'],
  });
  assert.equal(draft.status, 'draft');
  const storedDraft = await GbsQuote.findOne({ publicQuoteRef: draft.publicQuoteRef }).lean();
  assert.equal(isOpaqueQuoteRef(draft.publicQuoteRef), true);
  assert.notEqual(draft.publicQuoteRef, String(storedDraft._id));
  assert.equal(draft.subtotalProfessionalMinor, 50000);
  assert.equal(draft.officialFeeLines[0].feeId, 'fee:US-WY-llc-articles');
  assert.equal(draft.officialFeeLines[0].amountMinor, 10000);
  assert.equal(draft.thirdPartyFeeLines?.length || 0, 0);
  assert.equal(draft.validForDays, 7);

  const replay = await createProviderQuote({
    subject: indSubject,
    requestRef: ready.requestRef,
    body: { creationCommandId: createCmd },
    actor,
    env: OFF,
  });
  assert.equal(replay.publicQuoteRef, draft.publicQuoteRef);
  assert.equal(await GbsQuote.countDocuments({ creationCommandId: createCmd }), 1);

  await assert.rejects(
    () => createProviderQuote({
      subject: indSubject,
      requestRef: ready.requestRef,
      body: { creationCommandId: nid('q-second-active') },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );

  const raced = await Promise.allSettled([
    createProviderQuote({
      subject: indSubject,
      requestRef: ready.requestRef,
      body: { creationCommandId: createCmd },
      actor,
      env: OFF,
    }),
    createProviderQuote({
      subject: indSubject,
      requestRef: ready.requestRef,
      body: { creationCommandId: createCmd },
      actor,
      env: OFF,
    }),
  ]);
  assert.equal(raced.every((row) => row.status === 'fulfilled'), true);
  assert.equal(raced[0].value.publicQuoteRef, raced[1].value.publicQuoteRef);

  await assert.rejects(
    () => updateProviderQuoteDraft({
      subject: indSubject,
      quoteRef: draft.publicQuoteRef,
      expectedVersion: draft.recordVersion,
      body: {
        expectedVersion: draft.recordVersion,
        professionalFeeLines: [
          { label: 'USD work', amountMinor: 1000, currency: 'USD' },
          { label: 'GBP work', amountMinor: 1000, currency: 'GBP' },
        ],
      },
      actor,
    }),
    (err) => err.status === 400
  );
  await assert.rejects(
    () => updateProviderQuoteDraft({
      subject: indSubject,
      quoteRef: draft.publicQuoteRef,
      expectedVersion: draft.recordVersion,
      body: { expectedVersion: draft.recordVersion, officialFeeIds: ['fee:FAKE-GOV'] },
      actor,
    }),
    (err) => err.status === 400 && err.code === 'official_fee_not_catalogued'
  );

  const mixedTotals = computeQuoteTotals({
    currency: 'USD',
    professionalFeeLines: [{ amountMinor: 50000, currency: 'USD' }],
    officialFeeLines: [
      snapshotOfficialFee({
        feeId: 'fee:US-WY-llc-articles',
        label: 'Wyoming LLC Articles',
        currency: 'USD',
        amountModel: FEE_AMOUNT_MODELS.FIXED,
        amount: 100,
        eligibleCurrent: true,
      }),
      snapshotOfficialFee({
        feeId: 'fee:GB-CH-incorporation-online',
        label: 'Companies House digital incorporation',
        currency: 'GBP',
        amountModel: FEE_AMOUNT_MODELS.FIXED,
        amount: 100,
        eligibleCurrent: true,
      }),
    ],
  });
  assert.equal(mixedTotals.totalCustomerAmountMinor, null);
  assert.equal(mixedTotals.officialFeeGroups.length, 2);

  await assert.rejects(
    () => updateProviderQuoteDraft({
      subject: indSubject,
      quoteRef: draft.publicQuoteRef,
      expectedVersion: 999,
      body: { expectedVersion: 999, professionalFeeLines: USD_FEE },
      actor,
    }),
    (err) => err.status === 409 && err.code === 'optimistic_concurrency_conflict'
  );

  const sent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: draft.publicQuoteRef,
    expectedVersion: draft.recordVersion,
    body: { expectedVersion: draft.recordVersion },
    actor,
    env: OFF,
  });
  assert.equal(sent.status, 'sent');
  assert.equal(sent.validForDays, 7);
  const dayMs = sent.expiresAt.getTime() - sent.sentAt.getTime();
  assert.ok(dayMs >= 6 * 24 * 60 * 60 * 1000 && dayMs <= 8 * 24 * 60 * 60 * 1000, 'default expiry is 7 calendar days');
  const sendReplay = await sendProviderQuote({
    subject: indSubject,
    quoteRef: draft.publicQuoteRef,
    expectedVersion: sent.recordVersion,
    body: { expectedVersion: sent.recordVersion },
    actor,
    env: OFF,
  });
  assert.equal(sendReplay.status, 'sent');
  assert.equal(sendReplay.recordVersion, sent.recordVersion);
  await assert.rejects(
    () => updateProviderQuoteDraft({
      subject: indSubject,
      quoteRef: sent.publicQuoteRef,
      expectedVersion: sent.recordVersion,
      body: { expectedVersion: sent.recordVersion, professionalFeeLines: USD_FEE },
      actor,
    }),
    (err) => err.status === 409 && err.code === 'quote_revision_immutable'
  );

  const customerView = await getCustomerQuote({ userId: customer._id, quoteRef: sent.publicQuoteRef });
  assert.equal(customerView.status, 'sent');
  assert.equal(customerView.email, undefined);
  assert.equal(customerView.phone, undefined);
  assert.ok(!JSON.stringify(customerView).includes('buyer-17d7@example.com'));
  await assert.rejects(
    () => getCustomerQuote({ userId: other._id, quoteRef: sent.publicQuoteRef }),
    (err) => err.status === 404
  );

  await assert.rejects(
    () => cancelCustomerServiceRequest({
      userId: customer._id,
      requestRef: ready.requestRef,
      expectedVersion: ready.ready.recordVersion,
    }),
    (err) => err.status === 409 && err.code === 'quote_decision_required'
  );

  const staffDenied = await new Promise((resolve) => {
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; resolve(this); return this; },
    };
    requireNonStaffUser(
      { user: { userId: String(staff._id), role: 'Admin' } },
      res,
      () => resolve({ statusCode: 200 })
    ).catch((err) => resolve({ statusCode: 500, err }));
  });
  assert.equal(staffDenied.statusCode, 403);

  const accepted = await acceptCustomerQuote({
    userId: customer._id,
    quoteRef: sent.publicQuoteRef,
    expectedVersion: sent.recordVersion,
    body: { expectedVersion: sent.recordVersion },
    actor: customerActor,
    env: OFF,
  });
  assert.equal(accepted.status, 'accepted');
  const acceptReplay = await acceptCustomerQuote({
    userId: customer._id,
    quoteRef: sent.publicQuoteRef,
    expectedVersion: accepted.recordVersion,
    body: { expectedVersion: accepted.recordVersion },
    actor: customerActor,
    env: OFF,
  });
  assert.equal(acceptReplay.status, 'accepted');
  const requestAfter = await GbsServiceRequest.findOne({ publicRequestRef: ready.requestRef }).lean();
  assert.equal(requestAfter.status, S.READY_FOR_QUOTE);
  assert.equal(await mongoose.connection.db.listCollections({ name: 'formationcases' }).hasNext(), false);
  assert.equal(await mongoose.connection.db.listCollections({ name: 'payments' }).hasNext(), false);
  await assert.rejects(
    () => createProviderQuote({
      subject: indSubject,
      requestRef: ready.requestRef,
      body: { creationCommandId: nid('q-after-accept') },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );
  await assert.rejects(
    () => cancelCustomerServiceRequest({
      userId: customer._id,
      requestRef: ready.requestRef,
      expectedVersion: requestAfter.recordVersion,
    }),
    (err) => err.status === 409 && err.code === 'quote_already_accepted'
  );

  const createdAudit = await AuditLog.find({ action: GBS_AUDIT_EVENTS.GBS_QUOTE_CREATED, targetId: String((await GbsQuote.findOne({ publicQuoteRef: sent.publicQuoteRef }))._id) }).lean();
  assert.ok(createdAudit.length >= 1);
  assert.equal(createdAudit.some((row) => JSON.stringify(row).includes('Plain text terms')), false);
  const jobs = await BackgroundJob.find({ type: 'email' }).lean();
  assert.equal(jobs.some((job) => JSON.stringify(job.payload || {}).includes('Formation support')), false);
  assert.equal(
    await UserNotification.countDocuments({
      type: 'gbs_quote_sent',
      userId: customer._id,
    }),
    1
  );

  const declineReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-decline') });
  const declineDraft = await fillDraft({
    subject: indSubject,
    requestRef: declineReady.requestRef,
    actor,
    commandId: nid('q-decline'),
  });
  const declineSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: declineDraft.publicQuoteRef,
    expectedVersion: declineDraft.recordVersion,
    body: { expectedVersion: declineDraft.recordVersion },
    actor,
    env: OFF,
  });
  const declined = await declineCustomerQuote({
    userId: customer._id,
    quoteRef: declineSent.publicQuoteRef,
    expectedVersion: declineSent.recordVersion,
    body: { expectedVersion: declineSent.recordVersion, declineReasonCode: 'price' },
    actor: customerActor,
  });
  assert.equal(declined.status, 'declined');
  const replacement = await createProviderQuote({
    subject: indSubject,
    requestRef: declineReady.requestRef,
    body: { creationCommandId: nid('q-repl-decline') },
    actor,
    env: OFF,
  });
  assert.equal(replacement.quoteRevision, 2);
  assert.equal(replacement.status, 'draft');
  const oldDeclined = await GbsQuote.findOne({ publicQuoteRef: declineSent.publicQuoteRef }).lean();
  assert.equal(oldDeclined.status, 'declined');
  assert.equal(oldDeclined.subtotalProfessionalMinor, 50000);

  const withdrawReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-wd') });
  const wdDraft = await fillDraft({
    subject: indSubject,
    requestRef: withdrawReady.requestRef,
    actor,
    commandId: nid('q-wd'),
  });
  const wdSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: wdDraft.publicQuoteRef,
    expectedVersion: wdDraft.recordVersion,
    body: { expectedVersion: wdDraft.recordVersion },
    actor,
    env: OFF,
  });
  const withdrawn = await withdrawProviderQuote({
    subject: indSubject,
    quoteRef: wdSent.publicQuoteRef,
    expectedVersion: wdSent.recordVersion,
    body: { expectedVersion: wdSent.recordVersion },
    actor,
  });
  assert.equal(withdrawn.status, 'withdrawn');
  const wdReplace = await createProviderQuote({
    subject: indSubject,
    requestRef: withdrawReady.requestRef,
    body: { creationCommandId: nid('q-repl-wd') },
    actor,
    env: OFF,
  });
  assert.equal(wdReplace.quoteRevision, 2);

  const expReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-exp') });
  const expDraft = await fillDraft({
    subject: indSubject,
    requestRef: expReady.requestRef,
    actor,
    commandId: nid('q-exp'),
    validForDays: 1,
  });
  const expSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: expDraft.publicQuoteRef,
    expectedVersion: expDraft.recordVersion,
    body: { expectedVersion: expDraft.recordVersion, validForDays: 1 },
    actor,
    env: OFF,
  });
  const future = new Date(expSent.expiresAt.getTime() + 1000);
  await assert.rejects(
    () => acceptCustomerQuote({
      userId: customer._id,
      quoteRef: expSent.publicQuoteRef,
      expectedVersion: expSent.recordVersion,
      body: { expectedVersion: expSent.recordVersion },
      actor: customerActor,
      env: OFF,
      now: future,
    }),
    (err) => err.status === 409 && (err.code === 'quote_expired' || err.code === 'invalid_status_transition')
  );
  const persisted = await GbsQuote.findOne({ publicQuoteRef: expSent.publicQuoteRef }).lean();
  assert.equal(persisted.status, 'expired');
  const expReplace = await createProviderQuote({
    subject: indSubject,
    requestRef: expReady.requestRef,
    body: { creationCommandId: nid('q-repl-exp') },
    actor,
    env: OFF,
  });
  assert.equal(expReplace.status, 'draft');

  const getReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-get') });
  const getDraft = await fillDraft({
    subject: indSubject,
    requestRef: getReady.requestRef,
    actor,
    commandId: nid('q-get'),
    validForDays: 1,
  });
  const getSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: getDraft.publicQuoteRef,
    expectedVersion: getDraft.recordVersion,
    body: { expectedVersion: getDraft.recordVersion, validForDays: 1 },
    actor,
    env: OFF,
  });
  const projected = await getCustomerQuote({
    userId: customer._id,
    quoteRef: getSent.publicQuoteRef,
    now: new Date(getSent.expiresAt.getTime() + 1000),
  });
  assert.equal(projected.effectiveStatus, 'expired');
  const stillSent = await GbsQuote.findOne({ publicQuoteRef: getSent.publicQuoteRef }).lean();
  assert.equal(stillSent.status, 'sent');

  const daysReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-days') });
  const daysDraft = await fillDraft({
    subject: indSubject,
    requestRef: daysReady.requestRef,
    actor,
    commandId: nid('q-days'),
  });
  await assert.rejects(
    () => sendProviderQuote({
      subject: indSubject,
      quoteRef: daysDraft.publicQuoteRef,
      expectedVersion: daysDraft.recordVersion,
      body: { expectedVersion: daysDraft.recordVersion, validForDays: 31 },
      actor,
      env: OFF,
    }),
    (err) => err.status === 400
  );
  await assert.rejects(
    () => sendProviderQuote({
      subject: indSubject,
      quoteRef: daysDraft.publicQuoteRef,
      expectedVersion: daysDraft.recordVersion,
      body: { expectedVersion: daysDraft.recordVersion, validForDays: 0 },
      actor,
      env: OFF,
    }),
    (err) => err.status === 400
  );

  const conflictReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-idf') });
  const conflictDraft = await fillDraft({
    subject: indSubject,
    requestRef: conflictReady.requestRef,
    actor,
    commandId: nid('q-idf'),
  });
  const conflictId = nid('send-conflict');
  const conflictPair = await Promise.allSettled([
    sendProviderQuote({
      subject: indSubject,
      quoteRef: conflictDraft.publicQuoteRef,
      expectedVersion: conflictDraft.recordVersion,
      body: { expectedVersion: conflictDraft.recordVersion, commandId: conflictId, validForDays: 7 },
      actor,
      env: OFF,
    }),
    sendProviderQuote({
      subject: indSubject,
      quoteRef: conflictDraft.publicQuoteRef,
      expectedVersion: conflictDraft.recordVersion,
      body: { expectedVersion: conflictDraft.recordVersion, commandId: conflictId, validForDays: 8 },
      actor,
      env: OFF,
    }),
  ]);
  assert.equal(conflictPair.filter((row) => row.status === 'fulfilled').length, 1);
  assert.equal(conflictPair.some((row) => row.status === 'rejected' && (row.reason?.code === 'idempotency_conflict' || row.reason?.code === 'invalid_status_transition' || row.reason?.code === 'optimistic_concurrency_conflict')), true);
  assert.equal(conflictPair.some((row) => row.status === 'rejected' && Number(row.reason?.status) >= 500), false);

  const fixedReady = await readyRequest({ customer, listing: fixedListing, subject: indSubject, cmd: nid('cmd-fixed') });
  const fixedDraft = await fillDraft({
    subject: indSubject,
    requestRef: fixedReady.requestRef,
    actor,
    commandId: nid('q-fixed-bad'),
    fees: [{ label: 'Mismatch', amountMinor: 60000, currency: 'USD' }],
  });
  await assert.rejects(
    () => sendProviderQuote({
      subject: indSubject,
      quoteRef: fixedDraft.publicQuoteRef,
      expectedVersion: fixedDraft.recordVersion,
      body: { expectedVersion: fixedDraft.recordVersion },
      actor,
      env: OFF,
    }),
    (err) => err.status === 400 && err.code === 'fixed_price_mismatch'
  );
  const fixedOk = await updateProviderQuoteDraft({
    subject: indSubject,
    quoteRef: fixedDraft.publicQuoteRef,
    expectedVersion: fixedDraft.recordVersion,
    body: { expectedVersion: fixedDraft.recordVersion, professionalFeeLines: USD_FEE },
    actor,
  });
  const fixedSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: fixedOk.publicQuoteRef,
    expectedVersion: fixedOk.recordVersion,
    body: { expectedVersion: fixedOk.recordVersion },
    actor,
    env: OFF,
  });
  assert.equal(fixedSent.status, 'sent');

  const startReady = await readyRequest({ customer, listing: startListing, subject: indSubject, cmd: nid('cmd-start') });
  const startDraft = await fillDraft({
    subject: indSubject,
    requestRef: startReady.requestRef,
    actor,
    commandId: nid('q-start'),
    fees: [{ label: 'Undercut', amountMinor: 30000, currency: 'USD' }],
  });
  await assert.rejects(
    () => sendProviderQuote({
      subject: indSubject,
      quoteRef: startDraft.publicQuoteRef,
      expectedVersion: startDraft.recordVersion,
      body: { expectedVersion: startDraft.recordVersion },
      actor,
      env: OFF,
    }),
    (err) => err.status === 400 && err.code === 'starting_at_undercut'
  );

  const rangeReady = await readyRequest({ customer, listing: rangeListing, subject: indSubject, cmd: nid('cmd-range') });
  const rangeDraft = await fillDraft({
    subject: indSubject,
    requestRef: rangeReady.requestRef,
    actor,
    commandId: nid('q-range'),
    fees: [{ label: 'Outside', amountMinor: 90000, currency: 'USD' }],
  });
  await assert.rejects(
    () => sendProviderQuote({
      subject: indSubject,
      quoteRef: rangeDraft.publicQuoteRef,
      expectedVersion: rangeDraft.recordVersion,
      body: { expectedVersion: rangeDraft.recordVersion },
      actor,
      env: OFF,
    }),
    (err) => err.status === 400 && err.code === 'range_price_outside'
  );

  const agencyReady = await readyRequest({ customer, listing: agencyListing, subject: agencySubject, cmd: nid('cmd-ag') });
  await assert.rejects(
    () => createProviderQuote({
      subject: indSubject,
      requestRef: agencyReady.requestRef,
      body: { creationCommandId: nid('q-wrong-ag') },
      actor,
      env: OFF,
    }),
    (err) => err.status === 404
  );
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
      permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE,
    }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => assertProviderDomainAccess({
      agentAccountId: String(requestsMember._id),
      subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
      subjectId: String(agency._id),
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE,
    }),
    (err) => err.status === 403
  );
  await assertProviderDomainAccess({
    agentAccountId: String(quotesMember._id),
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: String(agency._id),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE,
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
  const agencyQuote = await createProviderQuote({
    subject: agencySubject,
    requestRef: agencyReady.requestRef,
    body: { creationCommandId: nid('q-ag') },
    actor: agencyActor,
    env: OFF,
  });
  const agencyStoredQuote = await GbsQuote.findOne({ publicQuoteRef: agencyQuote.publicQuoteRef }).lean();
  assert.equal(agencyStoredQuote.providerSubjectType, PROVIDER_SUBJECT_TYPES.ORGANIZATION);
  assert.equal(String(agencyStoredQuote.providerSubjectId), String(agency._id));

  const raceReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-race') });
  const raceDraft = await fillDraft({
    subject: indSubject,
    requestRef: raceReady.requestRef,
    actor,
    commandId: nid('q-race'),
  });
  const raceSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: raceDraft.publicQuoteRef,
    expectedVersion: raceDraft.recordVersion,
    body: { expectedVersion: raceDraft.recordVersion },
    actor,
    env: OFF,
  });
  const racePair = await Promise.allSettled([
    acceptCustomerQuote({
      userId: customer._id,
      quoteRef: raceSent.publicQuoteRef,
      expectedVersion: raceSent.recordVersion,
      body: { expectedVersion: raceSent.recordVersion },
      actor: customerActor,
      env: OFF,
    }),
    withdrawProviderQuote({
      subject: indSubject,
      quoteRef: raceSent.publicQuoteRef,
      expectedVersion: raceSent.recordVersion,
      body: { expectedVersion: raceSent.recordVersion },
      actor,
    }),
  ]);
  const raceWins = racePair.filter((row) => row.status === 'fulfilled');
  const raceFails = racePair.filter((row) => row.status === 'rejected');
  assert.equal(raceWins.length, 1);
  assert.equal(raceFails.length, 1);
  const raceStatus = (await GbsQuote.findOne({ publicQuoteRef: raceSent.publicQuoteRef }).lean()).status;
  assert.ok(raceStatus === 'accepted' || raceStatus === 'withdrawn');

  const decRaceReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-decrace') });
  const decDraft = await fillDraft({
    subject: indSubject,
    requestRef: decRaceReady.requestRef,
    actor,
    commandId: nid('q-decrace'),
  });
  const decSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: decDraft.publicQuoteRef,
    expectedVersion: decDraft.recordVersion,
    body: { expectedVersion: decDraft.recordVersion },
    actor,
    env: OFF,
  });
  const decPair = await Promise.allSettled([
    acceptCustomerQuote({
      userId: customer._id,
      quoteRef: decSent.publicQuoteRef,
      expectedVersion: decSent.recordVersion,
      body: { expectedVersion: decSent.recordVersion },
      actor: customerActor,
      env: OFF,
    }),
    declineCustomerQuote({
      userId: customer._id,
      quoteRef: decSent.publicQuoteRef,
      expectedVersion: decSent.recordVersion,
      body: { expectedVersion: decSent.recordVersion, declineReasonCode: 'scope' },
      actor: customerActor,
    }),
  ]);
  assert.equal(decPair.filter((row) => row.status === 'fulfilled').length, 1);
  const decStatus = (await GbsQuote.findOne({ publicQuoteRef: decSent.publicQuoteRef }).lean()).status;
  assert.ok(decStatus === 'accepted' || decStatus === 'declined');
  assert.notEqual(decStatus.includes('accepted') && decStatus.includes('declined'), true);

  const grantReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-grant') });
  const grantDraft = await fillDraft({
    subject: indSubject,
    requestRef: grantReady.requestRef,
    actor,
    commandId: nid('q-grant'),
  });
  const grantSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: grantDraft.publicQuoteRef,
    expectedVersion: grantDraft.recordVersion,
    body: { expectedVersion: grantDraft.recordVersion },
    actor,
    env: OFF,
  });
  await UserCapabilityGrant.updateOne(
    { userId: customer._id, capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT },
    { $set: { status: GRANT_STATUSES.SUSPENDED } }
  );
  await assert.rejects(
    () => acceptCustomerQuote({
      userId: customer._id,
      quoteRef: grantSent.publicQuoteRef,
      expectedVersion: grantSent.recordVersion,
      body: { expectedVersion: grantSent.recordVersion },
      actor: customerActor,
      env: OFF,
    }),
    (err) => err.status === 403 && err.code === 'business_client_required'
  );
  await assert.rejects(
    () => declineCustomerQuote({
      userId: customer._id,
      quoteRef: grantSent.publicQuoteRef,
      expectedVersion: grantSent.recordVersion,
      body: { expectedVersion: grantSent.recordVersion, declineReasonCode: 'other' },
      actor: customerActor,
    }),
    (err) => err.status === 403 && err.code === 'business_client_required'
  );
  await UserCapabilityGrant.updateOne(
    { userId: customer._id, capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT },
    { $set: { status: GRANT_STATUSES.ACTIVE } }
  );

  const lossReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-loss') });
  const lossDraft = await fillDraft({
    subject: indSubject,
    requestRef: lossReady.requestRef,
    actor,
    commandId: nid('q-loss'),
  });
  const lossSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: lossDraft.publicQuoteRef,
    expectedVersion: lossDraft.recordVersion,
    body: { expectedVersion: lossDraft.recordVersion },
    actor,
    env: OFF,
  });
  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    { $set: { status: GRANT_STATUSES.SUSPENDED } }
  );
  const readable = await getCustomerQuote({ userId: customer._id, quoteRef: lossSent.publicQuoteRef });
  assert.ok(readable.publicQuoteRef);
  await assert.rejects(
    () => acceptCustomerQuote({
      userId: customer._id,
      quoteRef: lossSent.publicQuoteRef,
      expectedVersion: lossSent.recordVersion,
      body: { expectedVersion: lossSent.recordVersion },
      actor: customerActor,
      env: OFF,
    }),
    (err) => err.status === 409
  );
  const stillWithdraw = await withdrawProviderQuote({
    subject: indSubject,
    quoteRef: lossSent.publicQuoteRef,
    expectedVersion: lossSent.recordVersion,
    body: { expectedVersion: lossSent.recordVersion },
    actor,
  });
  assert.equal(stillWithdraw.status, 'withdrawn');
  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    { $set: { status: GRANT_STATUSES.ACTIVE } }
  );

  const domainReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-dom') });
  const domainDraft = await fillDraft({
    subject: indSubject,
    requestRef: domainReady.requestRef,
    actor,
    commandId: nid('q-dom'),
  });
  const domainSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: domainDraft.publicQuoteRef,
    expectedVersion: domainDraft.recordVersion,
    body: { expectedVersion: domainDraft.recordVersion },
    actor,
    env: OFF,
  });
  await ProviderDomainEnrollment.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    { $set: { status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.SETUP } }
  );
  await assert.rejects(
    () => acceptCustomerQuote({
      userId: customer._id,
      quoteRef: domainSent.publicQuoteRef,
      expectedVersion: domainSent.recordVersion,
      body: { expectedVersion: domainSent.recordVersion },
      actor: customerActor,
      env: OFF,
    }),
    (err) => err.status === 409
  );
  await ProviderDomainEnrollment.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    { $set: { status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE } }
  );

  async function assertListingBlocks(moderationStatus, slug) {
    const blockedListing = await approvedListing({
      subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
      subjectId: independent._id,
      title: `Blocked ${slug}`,
      slug,
    });
    const blockedReady = await readyRequest({
      customer,
      listing: blockedListing,
      subject: indSubject,
      cmd: nid(`cmd-${slug}`),
    });
    const blockedDraft = await fillDraft({
      subject: indSubject,
      requestRef: blockedReady.requestRef,
      actor,
      commandId: nid(`q-${slug}`),
    });
    const blockedSent = await sendProviderQuote({
      subject: indSubject,
      quoteRef: blockedDraft.publicQuoteRef,
      expectedVersion: blockedDraft.recordVersion,
      body: { expectedVersion: blockedDraft.recordVersion },
      actor,
      env: OFF,
    });
    await GbsServiceListing.updateOne({ _id: blockedListing._id }, { $set: { moderationStatus } });
    await assert.rejects(
      () => acceptCustomerQuote({
        userId: customer._id,
        quoteRef: blockedSent.publicQuoteRef,
        expectedVersion: blockedSent.recordVersion,
        body: { expectedVersion: blockedSent.recordVersion },
        actor: customerActor,
        env: OFF,
      }),
      (err) => err.status === 409
    );
  }
  await assertListingBlocks(GBS_LISTING_MODERATION_STATUSES.SUSPENDED, 'wy-llc-sus-17d7');
  await assertListingBlocks(GBS_LISTING_MODERATION_STATUSES.REJECTED, 'wy-llc-rej-17d7');
  await assertListingBlocks(GBS_LISTING_MODERATION_STATUSES.ARCHIVED, 'wy-llc-arc-17d7');

  const cancelDraftReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-cdraft') });
  const cancelDraft = await fillDraft({
    subject: indSubject,
    requestRef: cancelDraftReady.requestRef,
    actor,
    commandId: nid('q-cdraft'),
  });
  const cancelled = await cancelCustomerServiceRequest({
    userId: customer._id,
    requestRef: cancelDraftReady.requestRef,
    expectedVersion: cancelDraftReady.ready.recordVersion,
  });
  assert.equal(cancelled.status, S.CANCELLED);
  const leftover = await GbsQuote.findOne({ publicQuoteRef: cancelDraft.publicQuoteRef }).lean();
  assert.equal(leftover.status, 'withdrawn');
  await assert.rejects(
    () => sendProviderQuote({
      subject: indSubject,
      quoteRef: cancelDraft.publicQuoteRef,
      expectedVersion: leftover.recordVersion,
      body: { expectedVersion: leftover.recordVersion },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );

  const cancelAcceptReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-cacc') });
  const cancelAcceptDraft = await fillDraft({
    subject: indSubject,
    requestRef: cancelAcceptReady.requestRef,
    actor,
    commandId: nid('q-cacc'),
  });
  const cancelAcceptSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: cancelAcceptDraft.publicQuoteRef,
    expectedVersion: cancelAcceptDraft.recordVersion,
    body: { expectedVersion: cancelAcceptDraft.recordVersion },
    actor,
    env: OFF,
  });
  await GbsServiceRequest.updateOne(
    { publicRequestRef: cancelAcceptReady.requestRef },
    { $set: { status: S.CANCELLED } }
  );
  await assert.rejects(
    () => acceptCustomerQuote({
      userId: customer._id,
      quoteRef: cancelAcceptSent.publicQuoteRef,
      expectedVersion: cancelAcceptSent.recordVersion,
      body: { expectedVersion: cancelAcceptSent.recordVersion },
      actor: customerActor,
      env: OFF,
    }),
    (err) => err.status === 409
  );

  const statuses = Object.values(GBS_SERVICE_REQUEST_STATUSES);
  assert.equal(statuses.includes('quote_sent') || statuses.includes('quote_accepted'), false);
  const first = await GbsQuote.findOne({ publicQuoteRef: sent.publicQuoteRef }).lean();
  try {
    await GbsQuote.collection.insertOne({
      publicQuoteRef: first.publicQuoteRef,
      creationCommandId: nid('dup-ref'),
    });
    assert.fail('duplicate publicQuoteRef must be rejected');
  } catch (err) {
    assert.equal(Number(err.code), 11000);
  }
  const quoteIndexes = await GbsQuote.collection.indexes();
  assert.equal(quoteIndexes.some((idx) => idx.name === 'gbs_quote_public_ref_unique' && idx.unique === true), true);
  assert.equal(quoteIndexes.some((idx) => idx.name === 'gbs_quote_active_slot_unique' && idx.unique === true), true);
  assert.equal(redactAuditMetadata({ providerTerms: 'hidden', publicQuoteRef: 'x' }).providerTerms, undefined);
});
