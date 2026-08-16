/**
 * Phase 17D-8B2B — draft pack isolation, snapshot, facts, checks, readiness.
 *
 *   STRIDETO_17D8B2B_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d8b2b_integrity_run1
 *   node src/__tests__/phase17d8b2bRequirementPack.mongo.test.js
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
  PROVIDER_SUBJECT_TYPES,
  PROVIDER_TRUST_STATUSES,
} from '../../../shared/gbs/constants.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_DOMAIN_ENROLLMENT_STATUSES, PROVIDER_DOMAIN_IDS, PROVIDER_DOMAIN_INITIALIZATION_STATES } from '../../../shared/provider/providerDomains.js';
import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../shared/security/gbsAuditEvents.js';
import { createReviewedActiveClone } from '../../../shared/gbs/requirementPackContract.js';
import { registryWithPacks } from '../../../shared/gbs/requirementPackRegistry.js';
import { US_WY_LLC_REQUIREMENT_PACK_V1 } from '../../../shared/gbs/requirementPacks/usWyLlcV1.js';
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
  getCustomerCase,
  getProviderCase,
  markReadyForSubmission,
  startPreparation,
} from '../services/gbs/gbsCaseService.js';
import {
  attachRequirementPackSnapshot,
  attestProviderRaConsent,
  evaluateAttachedPackReadiness,
  updateCustomerRequirementFact,
  updateProviderRequirementCheck,
  updateProviderRequirementFact,
} from '../services/gbs/gbsRequirementPackService.js';

const TEST_URI = process.env.STRIDETO_17D8B2B_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d8b2b_integrity_run1';
if (!/\/strideto_17d8b2b_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D8B2B_TEST_MONGO_URI must name a disposable strideto_17d8b2b_* database');
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
const USD_FEE = [{ label: 'Formation support', amountMinor: 50000, currency: 'USD' }];
const activePack = createReviewedActiveClone(US_WY_LLC_REQUIREMENT_PACK_V1);
const activeRegistry = registryWithPacks([activePack]);
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
    GbsQuote.init(), GbsCase.init(), IdempotencyRecord.init(), UserNotification.init(),
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
    env: { ...OFF, GBS_WYOMING_FORMATION_ENABLED: '1' },
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

async function completeMandatory({ customer, subject, actor, caseRef, closeLlc = false }) {
  const customerArgs = { userId: customer._id, caseRef, actor: { userId: customer._id, role: 'User' } };
  const providerArgs = { subject, caseRef, actor };
  await setFact(updateCustomerRequirementFact, customerArgs, 'proposed_entity_name', 'Peak Range LLC');
  await setFact(updateCustomerRequirementFact, customerArgs, 'close_llc_election', closeLlc);
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

test('draft invisibility, active snapshot, facts, checks, readiness, isolation', async () => {
  const customer = await makeUser('buyer-8b2b@example.com', 'Amina Buyer');
  const other = await makeUser('other-8b2b@example.com', 'Other Person');
  const staff = await makeUser('staff-8b2b@example.com', 'Staffer', 'Admin');
  await activateBusinessClient({ userId: customer._id, actor: { userId: customer._id } });
  await activateBusinessClient({ userId: other._id, actor: { userId: other._id } });
  const independent = await makeAgent('ind-8b2b@example.com', 'Independent Ameer');
  const otherInd = await makeAgent('ind2-8b2b@example.com', 'Independent Other');
  const agency = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENCY,
    displayName: 'Agency Eight B Two B',
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  const agencyOwner = await makeAgent('agency-8b2b@example.com', 'Agency Owner');
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
  const agencyListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: agency._id,
    title: 'Agency formation support',
  });
  const indSubject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) };
  const otherSubject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(otherInd._id) };
  const agencySubject = { subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: String(agency._id) };
  const actor = { id: String(independent._id), agentAccountId: independent._id, role: 'agent' };
  const otherActor = { id: String(otherInd._id), agentAccountId: otherInd._id, role: 'agent' };
  const customerActor = { userId: customer._id, role: 'User' };

  const draftDemo = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'draft',
  });
  const draftCase = await GbsCase.findOne({ publicCaseRef: draftDemo.accepted.publicCaseRef });
  assert.equal(draftCase.requirementPackSnapshot, undefined);
  const draftDto = await getCustomerCase({ userId: customer._id, caseRef: draftCase.publicCaseRef });
  assert.equal(draftDto.requirementPack.attached, false);

  const activeDemo = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'active', registry: activeRegistry,
  });
  const activeCase = await GbsCase.findOne({ publicCaseRef: activeDemo.accepted.publicCaseRef });
  assert.equal(activeCase.requirementPackSnapshot.packId, US_WY_LLC_REQUIREMENT_PACK_V1.packId);
  assert.equal(activeCase.requirementPackSnapshot.packVersion, 1);
  assert.equal(activeCase.documentPackId, 'gbs.case_documents.empty');
  const again = await ensureGbsCaseForAcceptedQuote({
    quote: await GbsQuote.findOne({ publicQuoteRef: activeDemo.accepted.publicQuoteRef }),
    requirementPackRegistry: activeRegistry,
    env: { ...OFF, GBS_WYOMING_FORMATION_ENABLED: '1' },
  });
  assert.equal(String(again._id), String(activeCase._id));
  assert.equal(again.requirementPackSnapshot.packVersion, 1);

  const v2 = createReviewedActiveClone({ ...US_WY_LLC_REQUIREMENT_PACK_V1, packVersion: 2 });
  await assert.rejects(
    async () => attachRequirementPackSnapshot({
      record: await GbsCase.findById(activeCase._id),
      registry: registryWithPacks([v2]),
      expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion,
      actor,
      env: { GBS_WYOMING_FORMATION_ENABLED: '1' },
    }),
    (err) => err.code === 'requirement_pack_upgrade_required'
  );
  const stillV1 = await GbsCase.findById(activeCase._id);
  assert.equal(stillV1.requirementPackSnapshot.packVersion, 1);

  await assert.rejects(
    async () => updateCustomerRequirementFact({
      userId: other._id,
      caseRef: activeCase.publicCaseRef,
      expectedVersion: stillV1.recordVersion,
      body: { expectedVersion: stillV1.recordVersion, factKey: 'proposed_entity_name', value: 'Other LLC' },
    }),
    (err) => err.status === 404
  );
  await assert.rejects(
    async () => updateCustomerRequirementFact({
      userId: staff._id,
      caseRef: activeCase.publicCaseRef,
      expectedVersion: stillV1.recordVersion,
      body: { expectedVersion: stillV1.recordVersion, factKey: 'proposed_entity_name', value: 'Staff LLC' },
    }),
    (err) => err.status === 404 || err.code === 'business_client_required'
  );
  await assert.rejects(
    async () => updateProviderRequirementFact({
      subject: otherSubject,
      caseRef: activeCase.publicCaseRef,
      expectedVersion: stillV1.recordVersion,
      body: { expectedVersion: stillV1.recordVersion, factKey: 'organizer_print_name', value: 'Wrong' },
      actor: otherActor,
    }),
    (err) => err.status === 404
  );

  await startPreparation({
    subject: indSubject,
    caseRef: activeCase.publicCaseRef,
    expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion,
    body: { expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion },
    actor,
  });

  await setFact(updateCustomerRequirementFact, {
    userId: customer._id,
    caseRef: activeCase.publicCaseRef,
    actor: customerActor,
  }, 'proposed_entity_name', 'Peak Range LLC');
  const named = await GbsCase.findById(activeCase._id);
  const nameRow = named.requirementFacts.find((row) => row.factKey === 'proposed_entity_name');
  assert.equal(nameRow.suppliedByLane, 'customer');
  await setFact(updateProviderRequirementFact, {
    subject: indSubject,
    caseRef: activeCase.publicCaseRef,
    actor,
  }, 'ra_name', 'Jordan Hale');
  const afterProviderName = await GbsCase.findById(activeCase._id);
  const stillCustomer = afterProviderName.requirementFacts.find((row) => row.factKey === 'proposed_entity_name');
  assert.equal(stillCustomer.suppliedByLane, 'customer');

  await assert.rejects(
    async () => updateCustomerRequirementFact({
      userId: customer._id,
      caseRef: activeCase.publicCaseRef,
      expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion,
      body: { expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion, factKey: 'organizer_print_name', value: 'Customer Organizer' },
    }),
    (err) => err.code === 'fact_lane_denied'
  );
  await assert.rejects(
    async () => updateCustomerRequirementFact({
      userId: customer._id,
      caseRef: activeCase.publicCaseRef,
      expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion,
      body: { expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion, factKey: 'unknown_field_xyz', value: 'nope' },
    }),
    (err) => err.code === 'unknown_fact_key'
  );
  await assert.rejects(
    async () => updateCustomerRequirementFact({
      userId: customer._id,
      caseRef: activeCase.publicCaseRef,
      expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion,
      body: {
        expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion,
        factKey: 'proposed_entity_name',
        value: 'Peak Range LLC',
        packVersion: 1,
      },
    }),
    (err) => err.code === 'client_pack_selection_rejected'
  );
  await assert.rejects(
    async () => updateCustomerRequirementFact({
      userId: customer._id,
      caseRef: activeCase.publicCaseRef,
      expectedVersion: 0,
      body: { expectedVersion: 0, factKey: 'entity_email', value: 'a@b.com', commandId: nid('stale') },
    }),
    (err) => err.code === 'optimistic_concurrency_conflict' || err.status === 409
  );

  const emailVersion = (await GbsCase.findById(activeCase._id)).recordVersion;
  const cmd = nid('email-idem');
  await updateCustomerRequirementFact({
    userId: customer._id,
    caseRef: activeCase.publicCaseRef,
    expectedVersion: emailVersion,
    body: { expectedVersion: emailVersion, factKey: 'entity_email', value: 'ops@example.com', commandId: cmd },
    actor: customerActor,
  });
  const replay = await updateCustomerRequirementFact({
    userId: customer._id,
    caseRef: activeCase.publicCaseRef,
    expectedVersion: emailVersion,
    body: { expectedVersion: emailVersion, factKey: 'entity_email', value: 'ops@example.com', commandId: cmd },
    actor: customerActor,
  });
  assert.ok(replay);
  await assert.rejects(
    async () => updateCustomerRequirementFact({
      userId: customer._id,
      caseRef: activeCase.publicCaseRef,
      expectedVersion: emailVersion,
      body: { expectedVersion: emailVersion, factKey: 'entity_email', value: 'other@example.com', commandId: cmd },
      actor: customerActor,
    }),
    (err) => err.code === 'idempotency_conflict'
  );

  await assert.rejects(
    async () => setFact(updateCustomerRequirementFact, {
      userId: customer._id,
      caseRef: activeCase.publicCaseRef,
      actor: customerActor,
    }, 'ra_source', 'provider_as_ra'),
    (err) => err.code === 'provider_registered_agent_capability_required'
  );
  await assert.rejects(
    async () => setFact(updateProviderRequirementFact, {
      subject: indSubject,
      caseRef: activeCase.publicCaseRef,
      actor,
    }, 'ra_registered_office_street', 'PO Box 12'),
    (err) => err.code === 'ra_po_box_insufficient'
  );
  await assert.rejects(
    async () => setFact(updateProviderRequirementFact, {
      subject: indSubject,
      caseRef: activeCase.publicCaseRef,
      actor,
    }, 'ra_registered_office_state', 'CO'),
    (err) => err.code === 'ra_state_must_be_wy'
  );

  await completeMandatory({ customer, subject: indSubject, actor, caseRef: activeCase.publicCaseRef });
  let packed = await GbsCase.findById(activeCase._id);
  let ready = evaluateAttachedPackReadiness(packed, { professionalAuthorityAllowed: true });
  assert.equal(ready.b2bRequirementsReady, false);
  assert.ok(ready.reasons.includes('ra_written_consent_missing'));

  await attestManual(indSubject, actor, activeCase.publicCaseRef);
  packed = await GbsCase.findById(activeCase._id);
  ready = evaluateAttachedPackReadiness(packed, { professionalAuthorityAllowed: true });
  assert.equal(ready.ready, true);
  assert.equal(ready.authorizedForExternalFiling, false);
  assert.equal(packed.requirementPackSnapshot.documentRequirements.length, 0);

  const audit = await AuditLog.findOne({ action: GBS_AUDIT_EVENTS.GBS_CASE_REQUIREMENT_FACT_UPDATED }).lean();
  assert.ok(audit);
  assert.equal(redactAuditMetadata(audit.metadata).entity_email, undefined);
  const raAudit = await AuditLog.findOne({ action: GBS_AUDIT_EVENTS.GBS_CASE_RA_CONSENT_ATTESTED }).lean();
  assert.ok(raAudit);
  assert.equal(raAudit.metadata.consentKey, 'ra_written_consent');

  await assert.rejects(
    async () => attestProviderRaConsent({
      subject: indSubject,
      caseRef: activeCase.publicCaseRef,
      expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion,
      body: { expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion, attested: true, waived: true },
      actor,
    }),
    (err) => err.code === 'unknown_field' || err.code === 'client_pack_selection_rejected'
  );
  await assert.rejects(
    async () => attestProviderRaConsent({
      subject: otherSubject,
      caseRef: activeCase.publicCaseRef,
      expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion,
      body: { expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion, attested: true },
      actor: otherActor,
    }),
    (err) => err.status === 404
  );

  const closeDemo = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'close', registry: activeRegistry,
  });
  await startPreparation({
    subject: indSubject,
    caseRef: closeDemo.accepted.publicCaseRef,
    expectedVersion: (await GbsCase.findOne({ publicCaseRef: closeDemo.accepted.publicCaseRef })).recordVersion,
    body: {},
    actor,
  });
  await completeMandatory({
    customer, subject: indSubject, actor, caseRef: closeDemo.accepted.publicCaseRef, closeLlc: true,
  });
  const closePacked = await GbsCase.findOne({ publicCaseRef: closeDemo.accepted.publicCaseRef });
  const closeReady = evaluateAttachedPackReadiness(closePacked, { professionalAuthorityAllowed: true });
  assert.ok(closeReady.reasons.includes('wy_close_llc_out_of_scope'));
  assert.equal(closeReady.ready, false);

  const optionalDemo = await getCustomerCase({ userId: customer._id, caseRef: activeCase.publicCaseRef });
  assert.equal(optionalDemo.requirementPack.facts.find((row) => row.factKey === 'delayed_effective_date').optional, true);

  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id), capabilityId: 'business_formation' },
    { $set: { status: GRANT_STATUSES.SUSPENDED } }
  );
  await assert.rejects(
    async () => setFact(updateProviderRequirementFact, {
      subject: indSubject,
      caseRef: activeCase.publicCaseRef,
      actor,
    }, 'organizer_print_name', 'New Organizer'),
    (err) => err.status === 409
  );
  const lost = await GbsCase.findById(activeCase._id);
  const lostReady = evaluateAttachedPackReadiness(lost, { professionalAuthorityAllowed: false });
  assert.equal(lostReady.ready, false);
  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id), capabilityId: 'business_formation' },
    { $set: { status: GRANT_STATUSES.ACTIVE } }
  );

  const cancelDemo = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'cancel', registry: activeRegistry,
  });
  await cancelCustomerCase({
    userId: customer._id,
    caseRef: cancelDemo.accepted.publicCaseRef,
    expectedVersion: (await GbsCase.findOne({ publicCaseRef: cancelDemo.accepted.publicCaseRef })).recordVersion,
    body: { reasonCode: 'changed_mind' },
    actor: customerActor,
  });
  await assert.rejects(
    async () => setFact(updateCustomerRequirementFact, {
      userId: customer._id,
      caseRef: cancelDemo.accepted.publicCaseRef,
      actor: customerActor,
    }, 'proposed_entity_name', 'Cancelled LLC'),
    (err) => err.code === 'invalid_status_transition'
  );
  await assert.rejects(
    async () => attestProviderRaConsent({
      subject: indSubject,
      caseRef: cancelDemo.accepted.publicCaseRef,
      expectedVersion: (await GbsCase.findOne({ publicCaseRef: cancelDemo.accepted.publicCaseRef })).recordVersion,
      body: { attested: true },
      actor,
    }),
    (err) => err.code === 'invalid_status_transition'
  );

  const agencyDemo = await sentAcceptedQuote({
    customer, listing: agencyListing, subject: agencySubject,
    actor: { id: String(agencyOwner._id), agentAccountId: agencyOwner._id, role: 'agent' },
    customerActor, cmdPrefix: 'agency', registry: activeRegistry,
  });
  await assert.rejects(
    async () => getProviderCase({ subject: indSubject, caseRef: agencyDemo.accepted.publicCaseRef }),
    (err) => err.status === 404
  );
  const agencyItem = await getProviderCase({ subject: agencySubject, caseRef: agencyDemo.accepted.publicCaseRef });
  assert.equal(agencyItem.requirementPack.attached, true);

  const otherDemo = await sentAcceptedQuote({
    customer, listing: otherListing, subject: otherSubject, actor: otherActor, customerActor, cmdPrefix: 'iso', registry: activeRegistry,
  });
  await assert.rejects(
    async () => getProviderCase({ subject: indSubject, caseRef: otherDemo.accepted.publicCaseRef }),
    (err) => err.status === 404
  );

  await markReadyForSubmission({
    subject: indSubject,
    caseRef: activeCase.publicCaseRef,
    expectedVersion: (await GbsCase.findById(activeCase._id)).recordVersion,
    body: {},
    actor,
    env: OFF,
  }).catch((err) => {
    assert.ok(['requirement_pack_not_ready', 'filing_readiness_failed', 'invalid_status_transition'].includes(err.code) || err.status === 409);
  });
});
