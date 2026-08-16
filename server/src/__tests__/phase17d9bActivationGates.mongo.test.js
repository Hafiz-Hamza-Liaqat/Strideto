/**
 * Phase 17D-9B — Wyoming runtime gates, rollback, and legal-text future-use.
 *
 *   STRIDETO_17D9B_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d9b_integrity_run1
 *   node src/__tests__/phase17d9bActivationGates.mongo.test.js
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
import { PROVIDER_DOMAIN_ENROLLMENT_STATUSES, PROVIDER_DOMAIN_IDS, PROVIDER_DOMAIN_INITIALIZATION_STATES } from '../../../shared/provider/providerDomains.js';
import { LEGAL_TEXT_STATUSES } from '../../../shared/gbs/filingAuthorizationContract.js';
import { createReviewedActiveClone } from '../../../shared/gbs/requirementPackContract.js';
import { productionRequirementPackRegistry, registryWithPacks } from '../../../shared/gbs/requirementPackRegistry.js';
import { US_WY_LLC_REQUIREMENT_PACK_V1 } from '../../../shared/gbs/requirementPacks/usWyLlcV1.js';
import { createApprovedSyntheticLegalText } from '../../../shared/gbs/filingAuthorizationLegalText.js';
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
import { ensureGbsCaseForAcceptedQuote } from '../services/gbs/gbsCaseService.js';
import {
  attestProviderRaConsent,
  snapshotFieldsForNewCase,
  updateCustomerRequirementFact,
  updateProviderRequirementCheck,
  updateProviderRequirementFact,
} from '../services/gbs/gbsRequirementPackService.js';
import {
  claimAuthorizationForSubmission,
  getCustomerFilingAuthorization,
  grantCustomerFilingAuthorization,
  revokeCustomerFilingAuthorization,
} from '../services/gbs/gbsFilingAuthorizationService.js';
import { attestProviderExternalFiling } from '../services/gbs/gbsExternalFilingService.js';

const TEST_URI = process.env.STRIDETO_17D9B_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d9b_integrity_run1';
if (!/\/strideto_17d9b_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D9B_TEST_MONGO_URI must name a disposable strideto_17d9b_* database');
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
const OFF_ALL = {
  BUSINESS_SERVICES_ENABLED: '1',
  GBS_WYOMING_FORMATION_ENABLED: '0',
  GBS_FILING_AUTHORIZATION_ENABLED: '0',
  GBS_EXTERNAL_FILING_ATTESTATION_ENABLED: '0',
};
const USD_FEE = [{ label: 'Formation support', amountMinor: 50000, currency: 'USD' }];
const activePack = createReviewedActiveClone(US_WY_LLC_REQUIREMENT_PACK_V1);
const activeRegistry = registryWithPacks([activePack]);
const approvedText = createApprovedSyntheticLegalText();
const legalRegistry = [approvedText];
const quoteShape = {
  capabilityId: 'business_formation',
  jurisdictionId: 'j:US-WY',
  entityTypeId: 'et:US-WY:LLC',
};
const listingShape = { entityTypeIds: ['et:US-WY:LLC'] };
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

async function sentAcceptedQuote({ customer, listing, subject, actor, customerActor, cmdPrefix, registry, env }) {
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
    env,
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
    customer, listing, subject, actor, customerActor, cmdPrefix: prefix, registry: activeRegistry, env: { ...OFF, ...FLAGS },
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

test('runtime wyoming gate cannot activate draft pack and blocks reviewed pack unless enabled', () => {
  const off = snapshotFieldsForNewCase({
    quote: quoteShape,
    listing: listingShape,
    registry: activeRegistry,
    env: OFF_ALL,
  });
  assert.equal(off.requirementPackSnapshot, undefined);

  const draftOn = snapshotFieldsForNewCase({
    quote: quoteShape,
    listing: listingShape,
    registry: productionRequirementPackRegistry,
    env: FLAGS,
  });
  assert.equal(draftOn.requirementPackSnapshot, undefined);

  const on = snapshotFieldsForNewCase({
    quote: quoteShape,
    listing: listingShape,
    registry: activeRegistry,
    env: FLAGS,
  });
  assert.equal(on.requirementPackSnapshot.packId, US_WY_LLC_REQUIREMENT_PACK_V1.packId);
  assert.equal(on.requirementPackSnapshot.packVersion, 1);
});

test('new Case attach, grant disable rollback, owner revoke, withdrawn text cannot be claimed', async () => {
  const customer = await makeUser('buyer-9b@example.com', 'Nine Bee');
  await activateBusinessClient({ userId: customer._id, actor: { userId: customer._id } });
  const independent = await makeAgent('ind-9b@example.com', 'Independent Nine');
  await enrollActive(PROVIDER_SUBJECT_TYPES.AGENT, independent._id);
  await verifiedCapability({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: independent._id });
  const listing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: '9B formation',
  });
  const subject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) };
  const actor = { agentAccountId: independent._id, role: 'agent' };
  const customerActor = { userId: customer._id, role: 'User' };

  const blocked = await sentAcceptedQuote({
    customer, listing, subject, actor, customerActor, cmdPrefix: 'off', registry: activeRegistry, env: { ...OFF, ...OFF_ALL },
  });
  const blockedCase = await GbsCase.findOne({ publicCaseRef: blocked.accepted.publicCaseRef });
  assert.equal(blockedCase.requirementPackSnapshot, undefined);
  const blockedGet = await getCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: blockedCase.publicCaseRef,
    env: OFF_ALL,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(blockedGet.available, false);
  assert.equal(blockedGet.reason, 'wyoming_formation_feature_disabled');
  assert.equal(blockedGet.canGrant, false);

  const record = await seedReadyCase({ prefix: 'on', customer, listing, subject, actor, customerActor });
  assert.equal(record.requirementPackSnapshot.packId, US_WY_LLC_REQUIREMENT_PACK_V1.packId);

  const granted = await grantCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: record.publicCaseRef,
    expectedVersion: record.recordVersion,
    body: grantBody(record, approvedText, nid('9b-grant')),
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(granted.current.status, 'active');
  assert.equal(granted.current.expiresAt, null);
  assert.equal(granted.authorizedForExternalFiling, true);

  const disabledGet = await getCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: record.publicCaseRef,
    env: OFF_ALL,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(disabledGet.available, false);
  assert.equal(disabledGet.canGrant, false);
  assert.equal(disabledGet.canRevoke, true);
  assert.equal(disabledGet.current.status, 'active');
  assert.equal(disabledGet.authorizedForExternalFiling, false);

  await assert.rejects(
    () => grantCustomerFilingAuthorization({
      userId: customer._id,
      caseRef: record.publicCaseRef,
      expectedVersion: record.recordVersion,
      body: grantBody(record, approvedText, nid('9b-grant-off')),
      actor: customerActor,
      env: OFF_ALL,
      registry: activeRegistry,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.status === 409
  );

  const live = await GbsCaseFilingAuthorization.findOne({ publicAuthorizationRef: granted.current.publicAuthorizationRef });
  await assert.rejects(
    () => claimAuthorizationForSubmission({
      authorizationId: live._id,
      record,
      subject,
      actor,
      env: OFF_ALL,
      expectedVersion: live.recordVersion,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.code === 'filing_authorization_not_claimable'
  );
  await assert.rejects(
    () => attestProviderExternalFiling({
      subject,
      caseRef: record.publicCaseRef,
      expectedVersion: record.recordVersion,
      body: {
        expectedVersion: record.recordVersion,
        filingMethod: 'wyobiz_online',
        authorityId: 'auth:US-WY-SOS',
        providerConfirmation: true,
        commandId: nid('9b-attest-off'),
      },
      actor,
      env: OFF_ALL,
      legalTextRegistry: legalRegistry,
    }),
    (err) => err.code === 'external_filing_not_available'
  );

  const revoked = await revokeCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: record.publicCaseRef,
    expectedVersion: live.recordVersion,
    body: {
      expectedVersion: live.recordVersion,
      publicAuthorizationRef: live.publicAuthorizationRef,
      commandId: nid('9b-revoke-off'),
    },
    actor: customerActor,
    env: OFF_ALL,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(revoked.current.status, 'revoked');
  assert.equal(revoked.canRevoke, false);

  const again = await seedReadyCase({ prefix: 'wd', customer, listing, subject, actor, customerActor });
  const granted2 = await grantCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: again.publicCaseRef,
    expectedVersion: again.recordVersion,
    body: grantBody(again, approvedText, nid('9b-grant-wd')),
    actor: customerActor,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: legalRegistry,
  });
  assert.equal(granted2.authorizedForExternalFiling, true);
  const withdrawnRegistry = [{ ...approvedText, status: LEGAL_TEXT_STATUSES.WITHDRAWN }];
  const afterWithdraw = await getCustomerFilingAuthorization({
    userId: customer._id,
    caseRef: again.publicCaseRef,
    env: FLAGS,
    registry: activeRegistry,
    legalTextRegistry: withdrawnRegistry,
  });
  assert.equal(afterWithdraw.authorizedForExternalFiling, false);
  const live2 = await GbsCaseFilingAuthorization.findOne({ publicAuthorizationRef: granted2.current.publicAuthorizationRef });
  await assert.rejects(
    () => claimAuthorizationForSubmission({
      authorizationId: live2._id,
      record: again,
      subject,
      actor,
      env: FLAGS,
      expectedVersion: live2.recordVersion,
      legalTextRegistry: withdrawnRegistry,
    }),
    (err) => err.code === 'filing_authorization_not_claimable'
  );
  assert.equal(live2.status, 'active');
  const still = await GbsCase.findById(again._id);
  assert.notEqual(still.status, 'completed');
});
