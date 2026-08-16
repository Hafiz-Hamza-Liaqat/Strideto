/**
 * Phase 17D-9A — filing authorization grant/revoke/claim and external filing.
 *
 *   STRIDETO_17D9A_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d9a_integrity_run1
 *   node src/__tests__/phase17d9aFilingAuthorization.mongo.test.js
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
import { GbsCaseFilingAuthorization } from '../models/gbs/GbsCaseFilingAuthorization.js';
import { GbsExternalFilingSubmission } from '../models/gbs/GbsExternalFilingSubmission.js';
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
  PROVIDER_SUBJECT_TYPES,
  PROVIDER_TRUST_STATUSES,
} from '../../../shared/gbs/constants.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_DOMAIN_ENROLLMENT_STATUSES, PROVIDER_DOMAIN_IDS, PROVIDER_DOMAIN_INITIALIZATION_STATES } from '../../../shared/provider/providerDomains.js';
import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { GBS_AUDIT_EVENTS } from '../../../shared/security/gbsAuditEvents.js';
import { USER_CAPABILITY_IDS } from '../../../shared/capability/userCapabilities.js';
import { createReviewedActiveClone } from '../../../shared/gbs/requirementPackContract.js';
import { registryWithPacks } from '../../../shared/gbs/requirementPackRegistry.js';
import { US_WY_LLC_REQUIREMENT_PACK_V1 } from '../../../shared/gbs/requirementPacks/usWyLlcV1.js';
import {
  createApprovedSyntheticLegalText,
} from '../../../shared/gbs/filingAuthorizationLegalText.js';
import { assignListingPublicSlugIfAbsent } from '../utils/gbsListingSlug.js';
import { activateBusinessClient } from '../services/gbs/gbsBuyerActivationService.js';
import {
  createCustomerServiceRequest,
  readyForQuoteProviderServiceRequest,
  reviewProviderServiceRequest,
} from '../services/gbs/gbsServiceRequestService.js';
import {
  acceptCustomerQuote,
  createProviderQuote,
  sendProviderQuote,
  updateProviderQuoteDraft,
} from '../services/gbs/gbsQuoteService.js';
import {
  cancelCustomerCase,
  ensureGbsCaseForAcceptedQuote,
} from '../services/gbs/gbsCaseService.js';
import {
  attestProviderRaConsent,
  updateCustomerRequirementFact,
  updateProviderRequirementCheck,
  updateProviderRequirementFact,
} from '../services/gbs/gbsRequirementPackService.js';
import {
  claimAuthorizationForSubmission,
  getCustomerFilingAuthorization,
  getProviderFilingAuthorization,
  grantCustomerFilingAuthorization,
  invalidateFilingAuthorization,
  revokeCustomerFilingAuthorization,
} from '../services/gbs/gbsFilingAuthorizationService.js';
import { attestProviderExternalFiling } from '../services/gbs/gbsExternalFilingService.js';

const TEST_URI = process.env.STRIDETO_17D9A_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d9a_integrity_run1';
if (!/\/strideto_17d9a_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D9A_TEST_MONGO_URI must name a disposable strideto_17d9a_* database');
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
const FLAGS = {
  BUSINESS_SERVICES_ENABLED: '1',
  GBS_WYOMING_FORMATION_ENABLED: '1',
  GBS_FILING_AUTHORIZATION_ENABLED: '1',
  GBS_EXTERNAL_FILING_ATTESTATION_ENABLED: '1',
};
const USD_FEE = [{ label: 'Formation support', amountMinor: 50000, currency: 'USD' }];
const activePack = createReviewedActiveClone(US_WY_LLC_REQUIREMENT_PACK_V1);
const activeRegistry = registryWithPacks([activePack]);
const approvedText = createApprovedSyntheticLegalText();
const legalRegistry = [approvedText];
let seq = 0;
function nid(prefix) {
  seq += 1;
  return `${prefix}-${seq}-${Date.now().toString(36)}`;
}

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: true });
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(), UserCapabilityGrant.init(), AgentAccount.init(), AgentProfile.init(),
    AgentMembership.init(), Organization.init(), ProviderCapability.init(),
    ProviderDomainEnrollment.init(), GbsServiceListing.init(), GbsServiceRequest.init(),
    GbsQuote.init(), GbsCase.init(), GbsCaseFilingAuthorization.init(),
    GbsExternalFilingSubmission.init(), IdempotencyRecord.init(), UserNotification.init(),
    AuditLog.init(), BackgroundJob.init(),
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
    phone: '+13075550100',
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
async function approvedListing({ subjectType, subjectId, title }) {
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
    providerFeeLines: [],
    publicSlug: null,
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
    publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
    scope: wyScope,
    creationCommandId: nid('listing'),
  });
  return assignListingPublicSlugIfAbsent(created);
}

async function sentAcceptedQuote({ customer, listing, subject, actor, customerActor, cmdPrefix, registry }) {
  const createdReq = await createCustomerServiceRequest({
    userId: customer._id,
    body: {
      listingSlug: listing.publicSlug,
      creationCommandId: nid(`${cmdPrefix}-req`),
      actingFor: GBS_SERVICE_REQUEST_ACTING_FOR.SELF,
      entityTypeId: 'et:US-WY:LLC',
      customerSummary: 'Need Wyoming LLC formation support.',
    },
    env: ON,
  });
  const stored = await GbsServiceRequest.findOne({ publicRequestRef: createdReq.publicRequestRef });
  const reviewed = await reviewProviderServiceRequest({
    subject,
    requestRef: createdReq.publicRequestRef,
    expectedVersion: stored.recordVersion,
    body: { expectedVersion: stored.recordVersion },
  });
  await readyForQuoteProviderServiceRequest({
    subject,
    requestRef: createdReq.publicRequestRef,
    expectedVersion: reviewed.recordVersion,
    body: { expectedVersion: reviewed.recordVersion },
    env: OFF,
  });
  const created = await createProviderQuote({
    subject,
    requestRef: createdReq.publicRequestRef,
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
    env: { ...OFF, ...(registry ? { GBS_WYOMING_FORMATION_ENABLED: '1' } : {}) },
    requirementPackRegistry: registry,
  });
  return { accepted, listing, subject };
}

const ADDRESS = {
  line1: '123 Capitol Ave',
  city: 'Cheyenne',
  state: 'WY',
  postalCode: '82001',
};

async function setFact(fn, args, factKey, value) {
  const record = await GbsCase.findOne({ publicCaseRef: args.caseRef });
  return fn({
    ...args,
    expectedVersion: record.recordVersion,
    body: { expectedVersion: record.recordVersion, factKey, value, commandId: nid(factKey) },
  });
}

async function completeMandatory({ customer, subject, actor, caseRef }) {
  const customerArgs = { userId: customer._id, caseRef, actor: { userId: customer._id, role: 'User' } };
  const providerArgs = { subject, caseRef, actor };
  await setFact(updateCustomerRequirementFact, customerArgs, 'proposed_entity_name', 'Peak Range LLC');
  await setFact(updateCustomerRequirementFact, customerArgs, 'close_llc_election', false);
  await setFact(updateCustomerRequirementFact, customerArgs, 'ra_source', 'customer_individual');
  await setFact(updateCustomerRequirementFact, customerArgs, 'mailing_address', ADDRESS);
  await setFact(updateCustomerRequirementFact, customerArgs, 'principal_office_address', ADDRESS);
  await setFact(updateCustomerRequirementFact, customerArgs, 'entity_email', 'ops@example.com');
  await setFact(updateProviderRequirementFact, providerArgs, 'ra_kind', 'individual');
  await setFact(updateProviderRequirementFact, providerArgs, 'ra_name', 'Jordan Hale');
  await setFact(updateProviderRequirementFact, providerArgs, 'ra_registered_office_street', '200 W 24th St');
  await setFact(updateProviderRequirementFact, providerArgs, 'ra_registered_office_city', 'Cheyenne');
  await setFact(updateProviderRequirementFact, providerArgs, 'ra_registered_office_state', 'WY');
  await setFact(updateProviderRequirementFact, providerArgs, 'ra_registered_office_postal_code', '82001');
  await setFact(updateProviderRequirementFact, providerArgs, 'ra_email', 'ra@example.com');
  await setFact(updateProviderRequirementFact, providerArgs, 'ra_phone', '+13075551212');
  await setFact(updateProviderRequirementFact, providerArgs, 'organizer_print_name', 'Jordan Hale');
  await setFact(updateProviderRequirementFact, providerArgs, 'filing_contact_name', 'Casey Filings');
  await setFact(updateProviderRequirementFact, providerArgs, 'filing_contact_phone', '+13075551313');
}

async function attestManual(subject, actor, caseRef) {
  for (const checkKey of ['name_distinguishability_search_performed', 'restricted_name_words_reviewed', 'ra_eligibility_confirmed']) {
    const record = await GbsCase.findOne({ publicCaseRef: caseRef });
    await updateProviderRequirementCheck({
      subject,
      caseRef,
      expectedVersion: record.recordVersion,
      body: { expectedVersion: record.recordVersion, checkKey, attested: true, commandId: nid(checkKey) },
      actor,
    });
  }
  const beforeMethod = await GbsCase.findOne({ publicCaseRef: caseRef });
  await updateProviderRequirementCheck({
    subject,
    caseRef,
    expectedVersion: beforeMethod.recordVersion,
    body: {
      expectedVersion: beforeMethod.recordVersion,
      checkKey: 'filing_method_selected',
      attested: true,
      selectedMethod: 'wyobiz_online',
      commandId: nid('filing'),
    },
    actor,
  });
  const beforeRa = await GbsCase.findOne({ publicCaseRef: caseRef });
  await attestProviderRaConsent({
    subject,
    caseRef,
    expectedVersion: beforeRa.recordVersion,
    body: { expectedVersion: beforeRa.recordVersion, attested: true, commandId: nid('ra') },
    actor,
  });
}

async function seedReadyCase({ prefix, customer, listing, subject, actor, customerActor }) {
  const demo = await sentAcceptedQuote({
    customer, listing, subject, actor, customerActor, cmdPrefix: prefix, registry: activeRegistry,
  });
  await ensureGbsCaseForAcceptedQuote({
    quote: await GbsQuote.findOne({ publicQuoteRef: demo.accepted.publicQuoteRef }),
    requirementPackRegistry: activeRegistry,
    env: FLAGS,
  });
  const record = await GbsCase.findOne({ publicCaseRef: demo.accepted.publicCaseRef });
  await completeMandatory({ customer, subject, actor, caseRef: record.publicCaseRef });
  await attestManual(subject, actor, record.publicCaseRef);
  return GbsCase.findOne({ publicCaseRef: record.publicCaseRef });
}

function grantBody(record, text, commandId) {
  return {
    expectedVersion: record.recordVersion,
    commandId,
    legalTextId: text.legalTextId,
    legalTextVersion: text.legalTextVersion,
    legalTextHash: text.legalTextHash,
    affirmed: true,
  };
}

test('production constants stay unavailable; quote accept and RA consent do not create authorization', async () => {
  const customer = await makeUser('prod-9a@example.com', 'Prod Customer');
  await activateBusinessClient({ userId: customer._id, actor: { userId: customer._id } });
  const independent = await makeAgent('prod-ind-9a@example.com', 'Prod Independent');
  await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, independent._id);
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: independent._id });
  const listing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Prod formation',
  });
  const subject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) };
  const actor = { agentAccountId: independent._id, role: 'agent' };
  const customerActor = { userId: customer._id, role: 'User' };
  const demo = await sentAcceptedQuote({
    customer, listing, subject, actor, customerActor, cmdPrefix: 'prod', registry: undefined,
  });
  const record = await GbsCase.findOne({ publicCaseRef: demo.accepted.publicCaseRef });
  const auths = await GbsCaseFilingAuthorization.countDocuments({ caseId: record._id });
  assert.equal(auths, 0);
  const state = await getCustomerFilingAuthorization({ userId: customer._id, caseRef: record.publicCaseRef });
  assert.equal(state.available, false);
  assert.equal(state.reason, 'requirement_pack_not_active');
  assert.equal(state.canGrant, false);
  assert.equal(state.eligibleLegalText, null);
  await assert.rejects(
    () => grantCustomerFilingAuthorization({
      userId: customer._id,
      caseRef: record.publicCaseRef,
      expectedVersion: record.recordVersion,
      body: grantBody(record, approvedText, nid('prod-grant')),
      actor: customerActor,
    }),
    (err) => err.code === 'requirement_pack_not_active' || err.code === 'legal_text_not_approved'
  );
});

test('synthetic grant, revoke, isolation, claim/attest, races, and fail-closed audit', async () => {
  const customer = await makeUser('buyer-9a@example.com', 'Amina Buyer');
  const other = await makeUser('other-9a@example.com', 'Other Person');
  const staff = await makeUser('staff-9a@example.com', 'Staffer', 'Admin');
  await activateBusinessClient({ userId: customer._id, actor: { userId: customer._id } });
  await activateBusinessClient({ userId: other._id, actor: { userId: other._id } });
  const independent = await makeAgent('ind-9a@example.com', 'Independent Ameer');
  const otherInd = await makeAgent('ind2-9a@example.com', 'Independent Other');
  const agency = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENCY,
    displayName: 'Agency Nine A',
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  const agencyOwner = await makeAgent('agency-9a@example.com', 'Agency Owner');
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
  await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, independent._id);
  await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, otherInd._id);
  await enrollActive(PROVIDER_SUBJECT_TYPES.ORGANIZATION, agency._id);
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: independent._id });
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: otherInd._id });
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: agency._id });
  const listing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Wyoming formation support',
  });
  const otherListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: otherInd._id,
    title: 'Other independent formation',
  });
  const indSubject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) };
  const otherSubject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(otherInd._id) };
  const actor = { agentAccountId: independent._id, role: 'agent' };
  const otherActor = { agentAccountId: otherInd._id, role: 'agent' };
  const customerActor = { userId: customer._id, role: 'User' };

  const record = await seedReadyCase({
    prefix: 'e2e', customer, listing, subject: indSubject, actor, customerActor,
  });
  const raOnly = await GbsCaseFilingAuthorization.countDocuments({ caseId: record._id });
  assert.equal(raOnly, 0, 'RA consent does not create filing authorization');

  const available = await getCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: record.publicCaseRef,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(available.available, true);
  assert.equal(available.canGrant, true);
  assert.equal(available.eligibleLegalText.legalTextHash, approvedText.legalTextHash);
  assert.equal(available.providerDisplayName.length > 0, true);

  await assert.rejects(
    () => getCustomerFilingAuthorization({ userId: other._id, caseRef: record.publicCaseRef }),
    (err) => err.status === 404
  );
  await assert.rejects(
    () => getProviderFilingAuthorization({ subject: otherSubject, caseRef: record.publicCaseRef, env: FLAGS }),
    (err) => err.status === 404
  );

  const staleText = createApprovedSyntheticLegalText({ version: 2 });
  await assert.rejects(
    () => grantCustomerFilingAuthorization({
      userId: customer._id,
      caseRef: record.publicCaseRef,
      expectedVersion: record.recordVersion,
      body: grantBody(record, approvedText, nid('stale')),
      actor: customerActor,
      env: FLAGS,
      registry: activeRegistry,
      legalTextRegistry: [staleText],
    }),
    (err) => err.status === 409 && err.code === 'filing_authorization_text_changed'
  );

  const cmd = nid('grant');
  const granted = await grantCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: record.publicCaseRef,
    expectedVersion: record.recordVersion,
    body: grantBody(record, approvedText, cmd),
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(granted.current.status, 'active');
  assert.equal(granted.authorizedForExternalFiling, true);
  const replay = await grantCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: record.publicCaseRef,
    expectedVersion: record.recordVersion,
    body: grantBody(record, approvedText, cmd),
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(replay.current.publicAuthorizationRef, granted.current.publicAuthorizationRef);
  await assert.rejects(
    () => grantCustomerFilingAuthorization({
      userId: customer._id,
      caseRef: record.publicCaseRef,
      expectedVersion: record.recordVersion,
      body: { ...grantBody(record, approvedText, cmd), legalTextHash: 'b'.repeat(64) },
      actor: customerActor,
      env: FLAGS,
      registry: activeRegistry,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.code === 'idempotency_conflict' || err.code === 'filing_authorization_text_changed'
  );
  assert.equal(await GbsCaseFilingAuthorization.countDocuments({ caseId: record._id }), 1);

  await assert.rejects(
    () => grantCustomerFilingAuthorization({
      userId: staff._id,
      caseRef: record.publicCaseRef,
      expectedVersion: record.recordVersion,
      body: grantBody(record, approvedText, nid('staff')),
      actor: { userId: staff._id, role: 'Admin' },
      env: FLAGS,
      registry: activeRegistry,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.status === 404
  );

  const providerView = await getProviderFilingAuthorization({
    subject: indSubject,
    caseRef: record.publicCaseRef,
    env: FLAGS,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(providerView.current.status, 'active');
  assert.equal(providerView.canGrant, false);
  assert.equal(providerView.canRevoke, false);
  assert.equal(providerView.externalSubmissionEligible, true);

  const grantAudits = await AuditLog.find({ action: GBS_AUDIT_EVENTS.GBS_CASE_FILING_AUTHORIZATION_GRANTED }).lean();
  assert.ok(grantAudits.length >= 1);
  for (const row of grantAudits) {
    const blob = JSON.stringify(row);
    assert.equal(blob.includes('ops@example.com'), false);
    assert.equal(blob.includes('123 Capitol'), false);
    assert.equal(/TEST ONLY/.test(blob), false);
    assert.equal(blob.toLowerCase().includes('password'), false);
  }

  const otherCase = await seedReadyCase({
    prefix: 'other', customer: other, listing: otherListing, subject: otherSubject, actor: otherActor,
    customerActor: { userId: other._id, role: 'User' },
  });
  await assert.rejects(
    () => grantCustomerFilingAuthorization({
      userId: customer._id,
      caseRef: otherCase.publicCaseRef,
      expectedVersion: otherCase.recordVersion,
      body: grantBody(otherCase, approvedText, nid('cross')),
      actor: customerActor,
      env: FLAGS,
      registry: activeRegistry,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.status === 404
  );

  const origCreate = AuditLog.create.bind(AuditLog);
  AuditLog.create = async () => { throw new Error('audit down'); };
  const preFail = await GbsCaseFilingAuthorization.countDocuments({ caseId: otherCase._id });
  await assert.rejects(
    () => grantCustomerFilingAuthorization({
      userId: other._id,
      caseRef: otherCase.publicCaseRef,
      expectedVersion: otherCase.recordVersion,
      body: grantBody(otherCase, approvedText, nid('audit-fail')),
      actor: { userId: other._id, role: 'User' },
      env: FLAGS,
      registry: activeRegistry,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.code === 'audit_unavailable'
  );
  assert.equal(await GbsCaseFilingAuthorization.countDocuments({ caseId: otherCase._id }), preFail);
  AuditLog.create = origCreate;

  const otherGranted = await grantCustomerFilingAuthorization({
    userId: other._id,
    caseRef: otherCase.publicCaseRef,
    expectedVersion: otherCase.recordVersion,
    body: grantBody(otherCase, approvedText, nid('other-grant')),
    actor: { userId: other._id, role: 'User' },
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  const otherAuth = await GbsCaseFilingAuthorization.findOne({ publicAuthorizationRef: otherGranted.current.publicAuthorizationRef });
  await UserCapabilityGrant.updateOne(
    { userId: other._id, capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT },
    { $set: { status: GRANT_STATUSES.REVOKED } }
  );
  await assert.rejects(
    () => grantCustomerFilingAuthorization({
      userId: other._id,
      caseRef: otherCase.publicCaseRef,
      expectedVersion: otherCase.recordVersion,
      body: grantBody(otherCase, approvedText, nid('lost-grant')),
      actor: { userId: other._id, role: 'User' },
      env: FLAGS,
      registry: activeRegistry,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.code === 'business_client_required' || err.code === 'conflicting_authorization'
  );
  const revokedAfterLoss = await revokeCustomerFilingAuthorization({
    userId: other._id,
    caseRef: otherCase.publicCaseRef,
    expectedVersion: otherAuth.recordVersion,
    body: { expectedVersion: otherAuth.recordVersion, publicAuthorizationRef: otherAuth.publicAuthorizationRef, commandId: nid('loss-revoke') },
    actor: { userId: other._id, role: 'User' },
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(revokedAfterLoss.current.status, 'revoked');
  await assert.rejects(
    () => revokeCustomerFilingAuthorization({
      userId: customer._id,
      caseRef: otherCase.publicCaseRef,
      expectedVersion: otherAuth.recordVersion,
      body: { expectedVersion: otherAuth.recordVersion, publicAuthorizationRef: otherAuth.publicAuthorizationRef, commandId: nid('provider-no') },
      actor: customerActor,
      env: FLAGS,
      registry: activeRegistry,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.status === 404
  );

  const packChangeCase = await seedReadyCase({
    prefix: 'pack', customer, listing, subject: indSubject, actor, customerActor,
  });
  const packGranted = await grantCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: packChangeCase.publicCaseRef,
    expectedVersion: packChangeCase.recordVersion,
    body: grantBody(packChangeCase, approvedText, nid('pack-grant')),
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  await GbsCase.updateOne(
    { _id: packChangeCase._id },
    { $set: { 'requirementPackSnapshot.packVersion': 2, 'requirementPackSnapshot.sourceSnapshotHash': 'deadbeef' } }
  );
  const afterPack = await getCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: packChangeCase.publicCaseRef,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(afterPack.authorizedForExternalFiling, false);
  const packAuth = await GbsCaseFilingAuthorization.findOne({ publicAuthorizationRef: packGranted.current.publicAuthorizationRef });
  assert.ok(packAuth);

  const providerChangeCase = await seedReadyCase({
    prefix: 'pchg', customer, listing, subject: indSubject, actor, customerActor,
  });
  const pchgGranted = await grantCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: providerChangeCase.publicCaseRef,
    expectedVersion: providerChangeCase.recordVersion,
    body: grantBody(providerChangeCase, approvedText, nid('pchg-grant')),
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  const pchgAuth = await GbsCaseFilingAuthorization.findOne({ publicAuthorizationRef: pchgGranted.current.publicAuthorizationRef });
  await GbsCase.updateOne({ _id: providerChangeCase._id }, { $set: { providerSubjectId: String(otherInd._id) } });
  const invalidated = await invalidateFilingAuthorization({
    authorizationId: pchgAuth._id,
    reasonCode: 'provider_changed',
    actor: { role: 'system' },
  });
  assert.equal(invalidated.status, 'invalidated');
  const afterProvider = await getCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: providerChangeCase.publicCaseRef,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(afterProvider.authorizedForExternalFiling, false);

  const lossCase = await seedReadyCase({
    prefix: 'aloss', customer, listing, subject: indSubject, actor, customerActor,
  });
  await grantCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: lossCase.publicCaseRef,
    expectedVersion: lossCase.recordVersion,
    body: grantBody(lossCase, approvedText, nid('aloss-grant')),
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id), capabilityId: 'business_formation' },
    { $set: { status: GRANT_STATUSES.REVOKED } }
  );
  const afterLoss = await getCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: lossCase.publicCaseRef,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(afterLoss.authorizedForExternalFiling, false);
  const lossLive = await GbsCase.findById(lossCase._id);
  await assert.rejects(
    () => attestProviderExternalFiling({
      subject: indSubject,
      caseRef: lossCase.publicCaseRef,
      expectedVersion: lossLive.recordVersion,
      body: {
        expectedVersion: lossLive.recordVersion,
        filingMethod: 'wyobiz_online',
        authorityId: 'auth:US-WY-SOS',
        providerConfirmation: true,
        commandId: nid('aloss-attest'),
      },
      actor,
      env: FLAGS,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.code === 'provider_authority_lost' || err.code === 'filing_authorization_not_claimable' || err.code === 'requirements_not_ready'
  );
  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id), capabilityId: 'business_formation' },
    { $set: { status: GRANT_STATUSES.ACTIVE } }
  );

  const termCase = await seedReadyCase({
    prefix: 'term', customer, listing, subject: indSubject, actor, customerActor,
  });
  await grantCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: termCase.publicCaseRef,
    expectedVersion: termCase.recordVersion,
    body: grantBody(termCase, approvedText, nid('term-grant')),
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  const liveTerm = await GbsCase.findById(termCase._id);
  await cancelCustomerCase({
    userId: customer._id,
    caseRef: termCase.publicCaseRef,
    expectedVersion: liveTerm.recordVersion,
    body: { expectedVersion: liveTerm.recordVersion, reasonCode: 'other' },
    actor: customerActor,
  });
  const cancelledTerm = await GbsCase.findById(termCase._id);
  await assert.rejects(
    () => grantCustomerFilingAuthorization({
      userId: customer._id,
      caseRef: termCase.publicCaseRef,
      expectedVersion: cancelledTerm.recordVersion,
      body: grantBody(cancelledTerm, approvedText, nid('term-new')),
      actor: customerActor,
      env: FLAGS,
      registry: activeRegistry,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.code === 'case_terminal'
  );
  assert.equal(await GbsCaseFilingAuthorization.countDocuments({ caseId: termCase._id }), 1);

  const e2eCase = await seedReadyCase({
    prefix: 'flow', customer, listing, subject: indSubject, actor, customerActor,
  });
  const e2eGranted = await grantCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: e2eCase.publicCaseRef,
    expectedVersion: e2eCase.recordVersion,
    body: grantBody(e2eCase, approvedText, nid('flow-grant')),
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(e2eGranted.authorizedForExternalFiling, true);
  const flowAttestCmd = nid('flow-attest');
  const attested = await attestProviderExternalFiling({
    subject: indSubject,
    caseRef: e2eCase.publicCaseRef,
    expectedVersion: e2eCase.recordVersion,
    body: {
      expectedVersion: e2eCase.recordVersion,
      filingMethod: 'wyobiz_online',
      authorityId: 'auth:US-WY-SOS',
      providerConfirmation: true,
      commandId: flowAttestCmd,
    },
    actor,
    env: FLAGS,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(attested.externalSubmissionState, 'submitted_externally');
  assert.equal(attested.current.status, 'used');
  assert.equal(await GbsExternalFilingSubmission.countDocuments({ caseId: e2eCase._id }), 1);
  const stillOpen = await GbsCase.findById(e2eCase._id);
  assert.notEqual(stillOpen.status, 'completed');
  await assert.rejects(
    () => attestProviderExternalFiling({
      subject: indSubject,
      caseRef: e2eCase.publicCaseRef,
      expectedVersion: stillOpen.recordVersion,
      body: {
        expectedVersion: stillOpen.recordVersion,
        filingMethod: 'paper_mail',
        authorityId: 'auth:US-WY-SOS',
        providerConfirmation: true,
        commandId: nid('flow-retry'),
      },
      actor,
      env: FLAGS,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.code === 'external_filing_already_recorded' || err.code === 'filing_authorization_not_claimable'
  );
  const attestReplay = await attestProviderExternalFiling({
    subject: indSubject,
    caseRef: e2eCase.publicCaseRef,
    expectedVersion: e2eCase.recordVersion,
    body: {
      expectedVersion: e2eCase.recordVersion,
      filingMethod: 'wyobiz_online',
      authorityId: 'auth:US-WY-SOS',
      providerConfirmation: true,
      commandId: flowAttestCmd,
    },
    actor,
    env: FLAGS,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(attestReplay.submission.publicSubmissionRef, attested.submission.publicSubmissionRef);

  const revokeCase = await seedReadyCase({
    prefix: 'rev', customer, listing, subject: indSubject, actor, customerActor,
  });
  const revGranted = await grantCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: revokeCase.publicCaseRef,
    expectedVersion: revokeCase.recordVersion,
    body: grantBody(revokeCase, approvedText, nid('rev-grant')),
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  const revAuth = await GbsCaseFilingAuthorization.findOne({ publicAuthorizationRef: revGranted.current.publicAuthorizationRef });
  const revCmd = nid('rev-cmd');
  const revoked = await revokeCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: revokeCase.publicCaseRef,
    expectedVersion: revAuth.recordVersion,
    body: { expectedVersion: revAuth.recordVersion, publicAuthorizationRef: revAuth.publicAuthorizationRef, commandId: revCmd },
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(revoked.authorizedForExternalFiling, false);
  const revReplay = await revokeCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: revokeCase.publicCaseRef,
    expectedVersion: revAuth.recordVersion,
    body: { expectedVersion: revAuth.recordVersion, publicAuthorizationRef: revAuth.publicAuthorizationRef, commandId: revCmd },
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(revReplay.current.status, 'revoked');
  await assert.rejects(
    () => attestProviderExternalFiling({
      subject: indSubject,
      caseRef: revokeCase.publicCaseRef,
      expectedVersion: revokeCase.recordVersion,
      body: {
        expectedVersion: revokeCase.recordVersion,
        filingMethod: 'wyobiz_online',
        authorityId: 'auth:US-WY-SOS',
        providerConfirmation: true,
        commandId: nid('rev-attest'),
      },
      actor,
      env: FLAGS,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.code === 'filing_authorization_not_claimable' || err.code === 'external_filing_not_available'
  );

  const raceCase = await seedReadyCase({
    prefix: 'race', customer, listing, subject: indSubject, actor, customerActor,
  });
  const raceGranted = await grantCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: raceCase.publicCaseRef,
    expectedVersion: raceCase.recordVersion,
    body: grantBody(raceCase, approvedText, nid('race-grant')),
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  const raceAuth = await GbsCaseFilingAuthorization.findOne({ publicAuthorizationRef: raceGranted.current.publicAuthorizationRef });
  const raceRecord = await GbsCase.findById(raceCase._id);
  const [revokeResult, claimResult] = await Promise.allSettled([
    revokeCustomerFilingAuthorization({
      userId: customer._id,
      caseRef: raceCase.publicCaseRef,
      expectedVersion: raceAuth.recordVersion,
      body: { expectedVersion: raceAuth.recordVersion, publicAuthorizationRef: raceAuth.publicAuthorizationRef, commandId: nid('race-revoke') },
      actor: customerActor,
      env: FLAGS,
      registry: activeRegistry,
      legalTextRegistry: legalRegistry,
    }),
    claimAuthorizationForSubmission({
      authorizationId: raceAuth._id,
      record: raceRecord,
      subject: indSubject,
      actor,
      env: FLAGS,
      expectedVersion: raceAuth.recordVersion,
      legalTextRegistry: legalRegistry,
    }),
  ]);
  const revokeWon = revokeResult.status === 'fulfilled' && revokeResult.value.current?.status === 'revoked';
  const claimWon = claimResult.status === 'fulfilled' && claimResult.value.status === 'claimed_for_submission';
  assert.equal(revokeWon !== claimWon, true, 'exactly one of revoke or claim wins');
  const finalRace = await GbsCaseFilingAuthorization.findById(raceAuth._id);
  assert.ok(['revoked', 'claimed_for_submission'].includes(finalRace.status));
});
