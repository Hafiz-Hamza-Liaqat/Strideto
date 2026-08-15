/**
 * Phase 17D-8A — GbsCase Mongo integrity.
 *
 *   STRIDETO_17D8A_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d8a_integrity_run1
 *   node src/__tests__/phase17d8aCase.mongo.test.js
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
import { isOpaqueCaseRef } from '../../../shared/gbs/caseContract.js';
import { CASE_TASK_KEYS } from '../../../shared/gbs/caseContract.js';
import { assignListingPublicSlugIfAbsent } from '../utils/gbsListingSlug.js';
import { activateBusinessClient } from '../services/gbs/gbsBuyerActivationService.js';
import {
  createCustomerServiceRequest,
  readyForQuoteProviderServiceRequest,
  reviewProviderServiceRequest,
} from '../services/gbs/gbsServiceRequestService.js';
import { assertProviderDomainAccess } from '../services/gbs/providerDomainService.js';
import {
  acceptCustomerQuote,
  createProviderQuote,
  sendProviderQuote,
  updateProviderQuoteDraft,
} from '../services/gbs/gbsQuoteService.js';
import {
  cancelCustomerCase,
  completeCustomerTask,
  completeGenericService,
  ensureCustomerCaseForQuote,
  ensureGbsCaseForAcceptedQuote,
  getCustomerCase,
  getProviderCase,
  listCustomerCases,
  listProviderCases,
  markReadyForSubmission,
  markUnableToProceed,
  requestCustomerAction,
  startPreparation,
} from '../services/gbs/gbsCaseService.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../shared/platform/optimisticConcurrency.js';

const TEST_URI = process.env.STRIDETO_17D8A_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d8a_integrity_run1';
if (!/\/strideto_17d8a_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D8A_TEST_MONGO_URI must name a disposable strideto_17d8a_* database');
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

async function approvedListing({
  subjectType,
  subjectId,
  title,
  slug,
  capabilityId = 'business_formation',
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
    description: `${title} long`,
    deliveryMode: 'remote',
    languages: ['en'],
    pricingMode: GBS_PRICING_MODES.QUOTE_REQUIRED,
    providerFeeLines: [],
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

async function sentAcceptedQuote({ customer, listing, subject, actor, customerActor, cmdPrefix }) {
  const ready = await readyRequest({ customer, listing, subject, cmd: nid(`${cmdPrefix}-req`) });
  const created = await createProviderQuote({
    subject,
    requestRef: ready.requestRef,
    body: { creationCommandId: nid(`${cmdPrefix}-q`) },
    actor,
    env: OFF,
  });
  const filled = await updateProviderQuoteDraft({
    subject,
    quoteRef: created.publicQuoteRef,
    expectedVersion: created.recordVersion,
    body: { expectedVersion: created.recordVersion, professionalFeeLines: USD_FEE, providerTerms: 'Plain text.' },
    actor,
  });
  const sent = await sendProviderQuote({
    subject,
    quoteRef: created.publicQuoteRef,
    expectedVersion: filled.recordVersion,
    body: { expectedVersion: filled.recordVersion },
    actor,
    env: OFF,
  });
  const accepted = await acceptCustomerQuote({
    userId: customer._id,
    quoteRef: sent.publicQuoteRef,
    expectedVersion: sent.recordVersion,
    body: { expectedVersion: sent.recordVersion },
    actor: customerActor,
    env: OFF,
  });
  return { ready, sent, accepted };
}

function providerActor(agent) {
  return { id: String(agent._id), agentAccountId: agent._id, role: 'agent' };
}

test('case origin, isolation, lifecycle, races, authority loss', async () => {
  const customer = await makeUser('buyer-17d8a@example.com', 'Amina Buyer');
  const other = await makeUser('other-17d8a@example.com', 'Other Person');
  const independent = await makeAgent('ind-17d8a@example.com', 'Independent Ameer');
  const otherInd = await makeAgent('ind2-17d8a@example.com', 'Independent Other');
  const agency = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENCY,
    displayName: 'Long Agency Name For Overflow Testing LLC',
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  const agencyOwner = await makeAgent('agency-owner-17d8a@example.com', 'Agency Owner');
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
  const viewMember = await makeAgent('view-17d8a@example.com', 'View Member');
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
  const requestsMember = await makeAgent('req-17d8a@example.com', 'Requests Member');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: requestsMember._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: [PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_REQUESTS_MANAGE],
    }],
  });
  const quotesMember = await makeAgent('quote-17d8a@example.com', 'Quotes Member');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: quotesMember._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: [PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE],
    }],
  });
  const casesMember = await makeAgent('cases-17d8a@example.com', 'Cases Member');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: casesMember._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: [PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE],
    }],
  });
  const eduOnly = await makeAgent('edu-17d8a@example.com', 'Edu Only');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: eduOnly._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
      permissions: [PROVIDER_DOMAIN_PERMISSIONS.EDUCATION_VIEW, PROVIDER_DOMAIN_PERMISSIONS.EDUCATION_CASES_MANAGE],
    }],
  });

  await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, independent._id);
  await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, otherInd._id);
  await enrollActive(PROVIDER_SUBJECT_TYPES.ORGANIZATION, agency._id);
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: independent._id });
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: otherInd._id });
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: agency._id });
  await verifiedCapability({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    capabilityId: 'formation_consultation',
  });

  const listing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Wyoming LLC formation Independent',
    slug: 'wy-llc-ind-17d8a',
  });
  const consultListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Formation consultation Independent',
    slug: 'wy-consult-ind-17d8a',
    capabilityId: 'formation_consultation',
  });
  const agencyListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: agency._id,
    title: 'Wyoming LLC formation Agency',
    slug: 'wy-llc-agency-17d8a',
  });

  await activateBusinessClient({ userId: customer._id, actor: { userId: customer._id } });
  await activateBusinessClient({ userId: other._id, actor: { userId: other._id } });

  const indSubject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) };
  const otherSubject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(otherInd._id) };
  const agencySubject = { subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: String(agency._id) };
  const actor = providerActor(independent);
  const agencyActor = providerActor(agencyOwner);
  const customerActor = { id: String(customer._id), userId: customer._id };

  const ready = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-main') });
  const draft = await createProviderQuote({
    subject: indSubject,
    requestRef: ready.requestRef,
    body: { creationCommandId: nid('q-main') },
    actor,
    env: OFF,
  });
  const filled = await updateProviderQuoteDraft({
    subject: indSubject,
    quoteRef: draft.publicQuoteRef,
    expectedVersion: draft.recordVersion,
    body: { expectedVersion: draft.recordVersion, professionalFeeLines: USD_FEE, providerTerms: 'Plain text.' },
    actor,
  });
  const draftStored = await GbsQuote.findOne({ publicQuoteRef: draft.publicQuoteRef });
  await assert.rejects(
    () => ensureGbsCaseForAcceptedQuote({ quote: draftStored }),
    (err) => err.status === 409 && err.code === 'quote_not_accepted'
  );
  const sent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: draft.publicQuoteRef,
    expectedVersion: filled.recordVersion,
    body: { expectedVersion: filled.recordVersion },
    actor,
    env: OFF,
  });
  const sentStored = await GbsQuote.findOne({ publicQuoteRef: sent.publicQuoteRef });
  await assert.rejects(
    () => ensureGbsCaseForAcceptedQuote({ quote: sentStored }),
    (err) => err.status === 409 && err.code === 'quote_not_accepted'
  );

  const accepted = await acceptCustomerQuote({
    userId: customer._id,
    quoteRef: sent.publicQuoteRef,
    expectedVersion: sent.recordVersion,
    body: { expectedVersion: sent.recordVersion },
    actor: customerActor,
    env: OFF,
  });
  assert.equal(accepted.status, 'accepted');
  assert.ok(isOpaqueCaseRef(accepted.publicCaseRef));
  const opened = await GbsCase.findOne({ publicCaseRef: accepted.publicCaseRef });
  assert.equal(opened.status, 'open');
  assert.equal(opened.currentMilestoneKey, 'case_opened');
  assert.equal(opened.workflowTemplateKey, 'company_formation');
  assert.equal(await GbsCase.countDocuments({ quoteId: opened.quoteId }), 1);
  const quoteAfter = await GbsQuote.findOne({ publicQuoteRef: sent.publicQuoteRef }).lean();
  assert.equal(quoteAfter.status, 'accepted');
  const requestAfter = await GbsServiceRequest.findOne({ publicRequestRef: ready.requestRef }).lean();
  assert.equal(requestAfter.status, S.READY_FOR_QUOTE);
  assert.equal(await mongoose.connection.db.listCollections({ name: 'payments' }).hasNext(), false);
  assert.equal(await mongoose.connection.db.listCollections({ name: 'documents' }).hasNext(), false);
  assert.equal(opened.submittedAt, undefined);
  assert.equal(opened.authorityReference, undefined);

  const replay = await acceptCustomerQuote({
    userId: customer._id,
    quoteRef: sent.publicQuoteRef,
    expectedVersion: accepted.recordVersion,
    body: { expectedVersion: accepted.recordVersion },
    actor: customerActor,
    env: OFF,
  });
  assert.equal(replay.publicCaseRef, accepted.publicCaseRef);
  assert.equal(await GbsCase.countDocuments({ quoteId: opened.quoteId }), 1);

  const [a, b] = await Promise.all([
    ensureGbsCaseForAcceptedQuote({ quote: quoteAfter, actor: customerActor, env: OFF }),
    ensureGbsCaseForAcceptedQuote({ quote: quoteAfter, actor: customerActor, env: OFF }),
  ]);
  assert.equal(String(a.publicCaseRef), String(b.publicCaseRef));
  assert.equal(await GbsCase.countDocuments({ quoteId: opened.quoteId }), 1);
  assert.equal(await UserNotification.countDocuments({ type: 'gbs_case_opened', userId: customer._id }), 1);
  assert.equal(await AuditLog.countDocuments({ action: GBS_AUDIT_EVENTS.GBS_CASE_CREATED, targetId: String(opened._id) }), 1);

  const recoverReady = await readyRequest({ customer, listing, subject: indSubject, cmd: nid('cmd-recover') });
  const recoverDraft = await createProviderQuote({
    subject: indSubject,
    requestRef: recoverReady.requestRef,
    body: { creationCommandId: nid('q-recover') },
    actor,
    env: OFF,
  });
  const recoverFilled = await updateProviderQuoteDraft({
    subject: indSubject,
    quoteRef: recoverDraft.publicQuoteRef,
    expectedVersion: recoverDraft.recordVersion,
    body: { expectedVersion: recoverDraft.recordVersion, professionalFeeLines: USD_FEE, providerTerms: 'Plain text.' },
    actor,
  });
  const recoverSent = await sendProviderQuote({
    subject: indSubject,
    quoteRef: recoverDraft.publicQuoteRef,
    expectedVersion: recoverFilled.recordVersion,
    body: { expectedVersion: recoverFilled.recordVersion },
    actor,
    env: OFF,
  });
  await GbsQuote.updateOne(
    { publicQuoteRef: recoverSent.publicQuoteRef },
    { $set: { status: 'accepted', acceptedAt: new Date() } }
  );
  assert.equal(await GbsCase.countDocuments({ quoteId: recoverSent.quoteId || (await GbsQuote.findOne({ publicQuoteRef: recoverSent.publicQuoteRef }))._id }), 0);
  const recoverQuote = await GbsQuote.findOne({ publicQuoteRef: recoverSent.publicQuoteRef });
  const recovered = await ensureCustomerCaseForQuote({
    userId: customer._id,
    quoteRef: recoverSent.publicQuoteRef,
    actor: customerActor,
    env: OFF,
  });
  assert.ok(isOpaqueCaseRef(recovered.publicCaseRef));
  assert.equal(await GbsCase.countDocuments({ quoteId: recoverQuote._id }), 1);
  assert.equal(recoverQuote.status, 'accepted');

  const own = await getCustomerCase({ userId: customer._id, caseRef: recovered.publicCaseRef });
  assert.equal(own.publicCaseRef, recovered.publicCaseRef);
  await assert.rejects(
    () => getCustomerCase({ userId: other._id, caseRef: recovered.publicCaseRef }),
    (err) => err.status === 404
  );
  const providerRead = await getProviderCase({ subject: indSubject, caseRef: recovered.publicCaseRef });
  assert.equal(providerRead.customerDisplayName, 'Amina Buyer');
  assert.equal(providerRead.email, undefined);
  await assert.rejects(
    () => getProviderCase({ subject: otherSubject, caseRef: recovered.publicCaseRef }),
    (err) => err.status === 404
  );

  await assert.rejects(
    () => markReadyForSubmission({
      subject: indSubject,
      caseRef: recovered.publicCaseRef,
      expectedVersion: recovered.recordVersion,
      body: { expectedVersion: recovered.recordVersion },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );

  const started = await startPreparation({
    subject: indSubject,
    caseRef: recovered.publicCaseRef,
    expectedVersion: recovered.recordVersion,
    body: { expectedVersion: recovered.recordVersion },
    actor,
    env: OFF,
  });
  assert.equal(started.status, 'in_progress');
  await assert.rejects(
    () => startPreparation({
      subject: indSubject,
      caseRef: recovered.publicCaseRef,
      expectedVersion: started.recordVersion + 7,
      body: { expectedVersion: started.recordVersion + 7 },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409 && err.code === OPTIMISTIC_CONCURRENCY_CODE
  );

  const requested = await requestCustomerAction({
    subject: indSubject,
    caseRef: recovered.publicCaseRef,
    expectedVersion: started.recordVersion,
    body: { expectedVersion: started.recordVersion, taskKey: CASE_TASK_KEYS.CONFIRM_SERVICE_SCOPE },
    actor,
    env: OFF,
  });
  assert.equal(requested.status, 'awaiting_client');
  const task = requested.customerTasks.find((row) => row.taskKey === CASE_TASK_KEYS.CONFIRM_SERVICE_SCOPE);
  const completed = await completeCustomerTask({
    userId: customer._id,
    caseRef: recovered.publicCaseRef,
    taskRef: task.publicTaskRef,
    expectedVersion: requested.recordVersion,
    body: { expectedVersion: requested.recordVersion, confirmed: true },
    actor: customerActor,
  });
  assert.equal(completed.status, 'in_progress');
  const againTask = await completeCustomerTask({
    userId: customer._id,
    caseRef: recovered.publicCaseRef,
    taskRef: task.publicTaskRef,
    expectedVersion: completed.recordVersion,
    body: { expectedVersion: completed.recordVersion, confirmed: true },
    actor: customerActor,
  });
  assert.equal(
    againTask.timelineEvents.filter((ev) => ev.eventType === 'customer_action_completed').length,
    completed.timelineEvents.filter((ev) => ev.eventType === 'customer_action_completed').length
  );

  const readyCase = await markReadyForSubmission({
    subject: indSubject,
    caseRef: recovered.publicCaseRef,
    expectedVersion: completed.recordVersion,
    body: { expectedVersion: completed.recordVersion },
    actor,
    env: OFF,
  });
  assert.equal(readyCase.status, 'ready_for_submission');
  assert.ok(readyCase.readyForSubmissionAt);
  const readyCustomer = await getCustomerCase({ userId: customer._id, caseRef: recovered.publicCaseRef });
  assert.match(readyCustomer.readyForSubmissionCopy, /next filing or submission step/);
  assert.doesNotMatch(readyCustomer.readyForSubmissionCopy, /STRIDETO filed|submitted to Companies House/);

  const raceReady = await sentAcceptedQuote({
    customer,
    listing,
    subject: indSubject,
    actor,
    customerActor,
    cmdPrefix: 'race',
  });
  const raceOpened = await getCustomerCase({ userId: customer._id, caseRef: raceReady.accepted.publicCaseRef });
  const raceStarted = await startPreparation({
    subject: indSubject,
    caseRef: raceOpened.publicCaseRef,
    expectedVersion: raceOpened.recordVersion,
    body: { expectedVersion: raceOpened.recordVersion },
    actor,
    env: OFF,
  });
  const [cancelRes, readyRes] = await Promise.allSettled([
    cancelCustomerCase({
      userId: customer._id,
      caseRef: raceOpened.publicCaseRef,
      expectedVersion: raceStarted.recordVersion,
      body: { expectedVersion: raceStarted.recordVersion, reasonCode: 'changed_mind' },
      actor: customerActor,
    }),
    markReadyForSubmission({
      subject: indSubject,
      caseRef: raceOpened.publicCaseRef,
      expectedVersion: raceStarted.recordVersion,
      body: { expectedVersion: raceStarted.recordVersion },
      actor,
      env: OFF,
    }),
  ]);
  const winners = [cancelRes, readyRes].filter((row) => row.status === 'fulfilled');
  const losers = [cancelRes, readyRes].filter((row) => row.status === 'rejected');
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.equal(losers[0].reason.status, 409);
  const raced = await GbsCase.findOne({ publicCaseRef: raceOpened.publicCaseRef }).lean();
  assert.ok(['cancelled', 'ready_for_submission'].includes(raced.status));
  assert.equal(raced.status === 'cancelled' && raced.status === 'ready_for_submission', false);
  const racedQuote = await GbsQuote.findOne({ publicQuoteRef: raceReady.accepted.publicQuoteRef }).lean();
  assert.equal(racedQuote.status, 'accepted');

  const cancelDemo = await sentAcceptedQuote({
    customer,
    listing,
    subject: indSubject,
    actor,
    customerActor,
    cmdPrefix: 'cancel',
  });
  const cancelled = await cancelCustomerCase({
    userId: customer._id,
    caseRef: cancelDemo.accepted.publicCaseRef,
    expectedVersion: (await getCustomerCase({ userId: customer._id, caseRef: cancelDemo.accepted.publicCaseRef })).recordVersion,
    body: {
      expectedVersion: (await getCustomerCase({ userId: customer._id, caseRef: cancelDemo.accepted.publicCaseRef })).recordVersion,
      reasonCode: 'no_longer_needed',
    },
    actor: customerActor,
  });
  assert.equal(cancelled.status, 'cancelled');
  const cancelQuote = await GbsQuote.findOne({ publicQuoteRef: cancelDemo.accepted.publicQuoteRef }).lean();
  assert.equal(cancelQuote.status, 'accepted');
  await assert.rejects(
    () => startPreparation({
      subject: indSubject,
      caseRef: cancelled.publicCaseRef,
      expectedVersion: cancelled.recordVersion,
      body: { expectedVersion: cancelled.recordVersion },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );

  const unableDemo = await sentAcceptedQuote({
    customer,
    listing,
    subject: indSubject,
    actor,
    customerActor,
    cmdPrefix: 'unable',
  });
  const unableOpened = await getCustomerCase({ userId: customer._id, caseRef: unableDemo.accepted.publicCaseRef });
  const unable = await markUnableToProceed({
    subject: indSubject,
    caseRef: unableOpened.publicCaseRef,
    expectedVersion: unableOpened.recordVersion,
    body: { expectedVersion: unableOpened.recordVersion, reasonCode: 'scope_issue' },
    actor,
    env: OFF,
  });
  assert.equal(unable.status, 'unable_to_proceed');

  const generic = await sentAcceptedQuote({
    customer,
    listing: consultListing,
    subject: indSubject,
    actor,
    customerActor,
    cmdPrefix: 'generic',
  });
  const genericOpened = await getCustomerCase({ userId: customer._id, caseRef: generic.accepted.publicCaseRef });
  assert.equal(genericOpened.workflowTemplateKey, 'generic_professional_service');
  const genericStarted = await startPreparation({
    subject: indSubject,
    caseRef: genericOpened.publicCaseRef,
    expectedVersion: genericOpened.recordVersion,
    body: { expectedVersion: genericOpened.recordVersion },
    actor,
    env: OFF,
  });
  const genericDone = await completeGenericService({
    subject: indSubject,
    caseRef: genericOpened.publicCaseRef,
    expectedVersion: genericStarted.recordVersion,
    body: { expectedVersion: genericStarted.recordVersion },
    actor,
    env: OFF,
  });
  assert.equal(genericDone.status, 'completed');

  await assert.rejects(
    () => completeGenericService({
      subject: indSubject,
      caseRef: recovered.publicCaseRef,
      expectedVersion: readyCase.recordVersion,
      body: { expectedVersion: readyCase.recordVersion },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );

  const authLoss = await sentAcceptedQuote({
    customer,
    listing,
    subject: indSubject,
    actor,
    customerActor,
    cmdPrefix: 'authloss',
  });
  const authOpened = await getCustomerCase({ userId: customer._id, caseRef: authLoss.accepted.publicCaseRef });
  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id), capabilityId: 'business_formation' },
    { $set: { trustStatus: PROVIDER_TRUST_STATUSES.SUSPENDED } }
  );
  await assert.rejects(
    () => startPreparation({
      subject: indSubject,
      caseRef: authOpened.publicCaseRef,
      expectedVersion: authOpened.recordVersion,
      body: { expectedVersion: authOpened.recordVersion },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );
  const stillReadable = await getCustomerCase({ userId: customer._id, caseRef: authOpened.publicCaseRef });
  assert.equal(stillReadable.status, 'open');
  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id), capabilityId: 'business_formation' },
    { $set: { trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED } }
  );

  const domainLoss = await sentAcceptedQuote({
    customer,
    listing,
    subject: indSubject,
    actor,
    customerActor,
    cmdPrefix: 'domain',
  });
  const domainOpened = await getCustomerCase({ userId: customer._id, caseRef: domainLoss.accepted.publicCaseRef });
  await ProviderDomainEnrollment.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    { $set: { status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.SETUP } }
  );
  await assert.rejects(
    () => startPreparation({
      subject: indSubject,
      caseRef: domainOpened.publicCaseRef,
      expectedVersion: domainOpened.recordVersion,
      body: { expectedVersion: domainOpened.recordVersion },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );
  await ProviderDomainEnrollment.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    { $set: { status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE } }
  );

  async function listingBlock(status, prefix) {
    const demo = await sentAcceptedQuote({
      customer,
      listing,
      subject: indSubject,
      actor,
      customerActor,
      cmdPrefix: prefix,
    });
    const item = await getCustomerCase({ userId: customer._id, caseRef: demo.accepted.publicCaseRef });
    await GbsServiceListing.updateOne({ _id: listing._id }, { $set: { moderationStatus: status } });
    await assert.rejects(
      () => startPreparation({
        subject: indSubject,
        caseRef: item.publicCaseRef,
        expectedVersion: item.recordVersion,
        body: { expectedVersion: item.recordVersion },
        actor,
        env: OFF,
      }),
      (err) => err.status === 409
    );
    await getCustomerCase({ userId: customer._id, caseRef: item.publicCaseRef });
    await GbsServiceListing.updateOne(
      { _id: listing._id },
      { $set: { moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED } }
    );
  }
  await listingBlock(GBS_LISTING_MODERATION_STATUSES.SUSPENDED, 'susp');
  await listingBlock(GBS_LISTING_MODERATION_STATUSES.REJECTED, 'rej');
  await listingBlock(GBS_LISTING_MODERATION_STATUSES.ARCHIVED, 'arch');

  const marketOff = await sentAcceptedQuote({
    customer,
    listing,
    subject: indSubject,
    actor,
    customerActor,
    cmdPrefix: 'mkt',
  });
  const marketOpened = await getCustomerCase({ userId: customer._id, caseRef: marketOff.accepted.publicCaseRef });
  const marketStarted = await startPreparation({
    subject: indSubject,
    caseRef: marketOpened.publicCaseRef,
    expectedVersion: marketOpened.recordVersion,
    body: { expectedVersion: marketOpened.recordVersion },
    actor,
    env: OFF,
  });
  assert.equal(marketStarted.status, 'in_progress');

  await UserCapabilityGrant.updateOne(
    { userId: customer._id, capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT },
    { $set: { status: GRANT_STATUSES.SUSPENDED } }
  );
  const history = await getCustomerCase({ userId: customer._id, caseRef: marketOpened.publicCaseRef });
  assert.equal(history.publicCaseRef, marketOpened.publicCaseRef);
  await assert.rejects(
    () => cancelCustomerCase({
      userId: customer._id,
      caseRef: marketOpened.publicCaseRef,
      expectedVersion: history.recordVersion,
      body: { expectedVersion: history.recordVersion, reasonCode: 'other' },
      actor: customerActor,
    }),
    (err) => err.status === 403 && err.code === 'business_client_required'
  );
  await UserCapabilityGrant.updateOne(
    { userId: customer._id, capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT },
    { $set: { status: GRANT_STATUSES.ACTIVE } }
  );

  const agencyReady = await sentAcceptedQuote({
    customer,
    listing: agencyListing,
    subject: agencySubject,
    actor: agencyActor,
    customerActor,
    cmdPrefix: 'agency',
  });
  await assert.rejects(
    () => getProviderCase({ subject: indSubject, caseRef: agencyReady.accepted.publicCaseRef }),
    (err) => err.status === 404
  );
  const agencyItem = await getProviderCase({ subject: agencySubject, caseRef: agencyReady.accepted.publicCaseRef });
  assert.ok(agencyItem.publicCaseRef);
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
      permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE,
    }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => assertProviderDomainAccess({
      agentAccountId: String(requestsMember._id),
      subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
      subjectId: String(agency._id),
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE,
    }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => assertProviderDomainAccess({
      agentAccountId: String(quotesMember._id),
      subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
      subjectId: String(agency._id),
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE,
    }),
    (err) => err.status === 403
  );
  await assertProviderDomainAccess({
    agentAccountId: String(casesMember._id),
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: String(agency._id),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE,
  });
  await assert.rejects(
    () => assertProviderDomainAccess({
      agentAccountId: String(eduOnly._id),
      subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
      subjectId: String(agency._id),
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE,
    }),
    (err) => err.status === 403
  );

  const conflictOpened = await getCustomerCase({ userId: customer._id, caseRef: agencyReady.accepted.publicCaseRef });
  const conflictStarted = await startPreparation({
    subject: agencySubject,
    caseRef: conflictOpened.publicCaseRef,
    expectedVersion: conflictOpened.recordVersion,
    body: { expectedVersion: conflictOpened.recordVersion },
    actor: agencyActor,
    env: OFF,
  });
  await requestCustomerAction({
    subject: agencySubject,
    caseRef: conflictOpened.publicCaseRef,
    expectedVersion: conflictStarted.recordVersion,
    body: {
      expectedVersion: conflictStarted.recordVersion,
      taskKey: CASE_TASK_KEYS.CONFIRM_SERVICE_SCOPE,
      commandId: 'same-task-key',
    },
    actor: agencyActor,
    env: OFF,
  });
  await assert.rejects(
    () => requestCustomerAction({
      subject: agencySubject,
      caseRef: conflictOpened.publicCaseRef,
      expectedVersion: conflictStarted.recordVersion,
      body: {
        expectedVersion: conflictStarted.recordVersion,
        taskKey: CASE_TASK_KEYS.ADDITIONAL_NOTE,
        commandId: 'same-task-key',
      },
      actor: agencyActor,
      env: OFF,
    }),
    (err) => err.status === 409 && err.code === 'idempotency_conflict'
  );

  const listed = await listCustomerCases({ userId: customer._id, query: { limit: 20 } });
  assert.ok(listed.limit <= 50);
  const providerListed = await listProviderCases({ subject: indSubject, query: { status: 'ready_for_submission' } });
  assert.ok(Array.isArray(providerListed.items));

  const audits = await AuditLog.find({ action: GBS_AUDIT_EVENTS.GBS_CASE_CUSTOMER_ACTION_COMPLETED }).lean();
  assert.equal(audits.some((row) => JSON.stringify(row).includes('confirmed')), false);
  const redacted = redactAuditMetadata({ customerValue: 'secret-name', publicCaseRef: 'ok' });
  assert.notEqual(redacted.customerValue, 'secret-name');
});
