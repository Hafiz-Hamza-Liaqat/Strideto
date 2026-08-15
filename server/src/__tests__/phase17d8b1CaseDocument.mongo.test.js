/**
 * Phase 17D-8B1 — GBS Case document isolation and fail-closed security gates.
 *
 *   STRIDETO_17D8B1_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d8b1_integrity_run1
 *   node src/__tests__/phase17d8b1CaseDocument.mongo.test.js
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
import { GbsCaseDocumentRequirement } from '../models/gbs/GbsCaseDocumentRequirement.js';
import { GbsCaseDocumentGrant } from '../models/gbs/GbsCaseDocumentGrant.js';
import { VaultDocument } from '../models/vault/VaultDocument.js';
import { VaultDocumentVersion } from '../models/vault/VaultDocumentVersion.js';
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
import { USER_CAPABILITY_IDS } from '../../../shared/capability/userCapabilities.js';
import { PROVIDER_DOMAIN_ENROLLMENT_STATUSES, PROVIDER_DOMAIN_IDS, PROVIDER_DOMAIN_INITIALIZATION_STATES } from '../../../shared/provider/providerDomains.js';
import { defaultPermissionsForInvite, PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../shared/platform/optimisticConcurrency.js';
import { IDEMPOTENCY_CODES } from '../../../shared/platform/idempotency.js';
import {
  EMPTY_DOCUMENT_PACK_ID,
  GBS_CASE_DOCUMENT_BOUNDS,
  GBS_DOCUMENT_SECURITY_CODES,
  GBS_DOCUMENT_WAIVER_REASONS,
} from '../../../shared/gbs/caseDocumentContract.js';
import { assignListingPublicSlugIfAbsent } from '../utils/gbsListingSlug.js';
import { generatePublicRequirementRef } from '../utils/gbsCaseDocumentRef.js';
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
  getCustomerCase,
  markReadyForSubmission,
  startPreparation,
} from '../services/gbs/gbsCaseService.js';
import {
  applyTestOnlyRequirementPack,
  assertProviderCaseDocumentDuty,
  completeCustomerDocumentUpload,
  downloadCustomerCaseDocument,
  downloadProviderCaseDocument,
  initializeCustomerDocumentUpload,
  listCustomerCaseDocumentRequirements,
  listProviderCaseDocumentRequirements,
  reviewProviderDocument,
  supersedeCustomerDocumentUpload,
  tryCreateHsiRequirement,
  waiveProviderDocument,
} from '../services/gbs/gbsCaseDocumentService.js';
import {
  resetGbsCaseDocumentTestScanner,
  setGbsCaseDocumentTestScanner,
} from '../services/gbs/gbsDocumentScanService.js';

const TEST_URI = process.env.STRIDETO_17D8B1_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d8b1_integrity_run1';
if (!/\/strideto_17d8b1_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D8B1_TEST_MONGO_URI must name a disposable strideto_17d8b1_* database');
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
let seq = 0;
function nid(prefix) {
  seq += 1;
  return `${prefix}-${seq}-${Date.now().toString(36)}`;
}

function pdfFile(name = 'note.pdf') {
  return { buffer: Buffer.from('%PDF-1.4\n%\n1 0 obj\n<<>>\nendobj\n'), mimeType: 'application/pdf', originalname: name };
}
function jpegFile() {
  return { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]), mimeType: 'image/jpeg', originalname: 'note.jpg' };
}
function pngFile() {
  return { buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]), mimeType: 'image/png', originalname: 'note.png' };
}
function mockRes() {
  const headers = {};
  return {
    headers,
    body: null,
    set(key, value) { headers[key] = value; return this; },
    send(buf) { this.body = buf; return this; },
  };
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
    GbsCaseDocumentRequirement.init(),
    GbsCaseDocumentGrant.init(),
    VaultDocument.init(),
    VaultDocumentVersion.init(),
    IdempotencyRecord.init(),
    UserNotification.init(),
    AuditLog.init(),
    BackgroundJob.init(),
  ]);
});

after(async () => {
  resetGbsCaseDocumentTestScanner();
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
async function approvedListing({ subjectType, subjectId, title, slug, capabilityId = 'business_formation' }) {
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
  await readyForQuoteProviderServiceRequest({
    subject,
    requestRef: created.publicRequestRef,
    expectedVersion: reviewed.recordVersion,
    body: { expectedVersion: reviewed.recordVersion },
    env: OFF,
  });
  return { created, requestRef: created.publicRequestRef };
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
  return { accepted };
}
function providerActor(agent) {
  return { id: String(agent._id), agentAccountId: agent._id, role: 'agent' };
}
function businessPerms(extra = []) {
  return [PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW, ...extra];
}

test('case document isolation, scanner gates, versioning, readiness, authority loss', { timeout: 180000 }, async () => {
  const customer = await makeUser('buyer-17d8b1@example.com', 'Amina Buyer');
  const other = await makeUser('other-17d8b1@example.com', 'Other Person');
  const independent = await makeAgent('ind-17d8b1@example.com', 'Independent Ameer');
  const otherInd = await makeAgent('ind2-17d8b1@example.com', 'Independent Other');
  const agency = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENCY,
    displayName: 'Document Agency LLC',
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  const agencyOwner = await makeAgent('agency-owner-17d8b1@example.com', 'Agency Owner');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: agencyOwner._id,
    role: AGENT_MEMBER_ROLES.OWNER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: defaultPermissionsForInvite({
        domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
        role: AGENT_MEMBER_ROLES.OWNER,
      }),
    }],
  });
  const agencyAdmin = await makeAgent('agency-admin-17d8b1@example.com', 'Agency Admin');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: agencyAdmin._id,
    role: AGENT_MEMBER_ROLES.ADMIN,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: defaultPermissionsForInvite({
        domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
        role: AGENT_MEMBER_ROLES.ADMIN,
      }),
    }],
  });
  const viewMember = await makeAgent('view-17d8b1@example.com', 'View Member');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: viewMember._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{ domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES, permissions: businessPerms() }],
  });
  const quotesMember = await makeAgent('quote-17d8b1@example.com', 'Quotes Member');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: quotesMember._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: businessPerms([PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE]),
    }],
  });
  const casesMember = await makeAgent('cases-17d8b1@example.com', 'Cases Member');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: casesMember._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: businessPerms([PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE]),
    }],
  });
  const docsMember = await makeAgent('docs-17d8b1@example.com', 'Docs Member');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: docsMember._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: businessPerms([PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE]),
    }],
  });
  const eduOnly = await makeAgent('edu-17d8b1@example.com', 'Edu Only');
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

  const listing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: independent._id,
    title: 'Wyoming LLC formation Independent',
    slug: 'wy-llc-ind-17d8b1',
  });
  const agencyListing = await approvedListing({
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: agency._id,
    title: 'Wyoming LLC formation Agency',
    slug: 'wy-llc-agency-17d8b1',
  });

  await activateBusinessClient({ userId: customer._id, actor: { userId: customer._id } });
  await activateBusinessClient({ userId: other._id, actor: { userId: other._id } });

  const indSubject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) };
  const otherSubject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(otherInd._id) };
  const agencySubject = { subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: String(agency._id) };
  const actor = providerActor(independent);
  const agencyOwnerActor = providerActor(agencyOwner);
  const agencyAdminActor = providerActor(agencyAdmin);
  const docsActor = providerActor(docsMember);
  const customerActor = { id: String(customer._id), userId: customer._id };

  const emptyAccepted = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'empty',
  });
  const emptyCase = await GbsCase.findOne({ publicCaseRef: emptyAccepted.accepted.publicCaseRef });
  assert.equal(emptyCase.documentPackId, EMPTY_DOCUMENT_PACK_ID);
  assert.equal(emptyCase.documentConsentRequired, false);
  const emptyList = await listCustomerCaseDocumentRequirements({
    userId: customer._id,
    caseRef: emptyCase.publicCaseRef,
  });
  assert.equal(emptyList.items.length, 0);
  assert.equal(emptyList.security.configured, false);
  assert.equal(emptyList.security.mode, 'not_configured');
  const emptyStarted = await startPreparation({
    subject: indSubject,
    caseRef: emptyCase.publicCaseRef,
    expectedVersion: emptyCase.recordVersion,
    body: { expectedVersion: emptyCase.recordVersion },
    actor,
    env: OFF,
  });
  const emptyReady = await markReadyForSubmission({
    subject: indSubject,
    caseRef: emptyCase.publicCaseRef,
    expectedVersion: emptyStarted.recordVersion,
    body: { expectedVersion: emptyStarted.recordVersion },
    actor,
    env: OFF,
  });
  assert.equal(emptyReady.status, 'ready_for_submission');

  const indAccepted = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'ind-docs',
  });
  const indCase = await GbsCase.findOne({ publicCaseRef: indAccepted.accepted.publicCaseRef });
  const createdReqs = await applyTestOnlyRequirementPack(indCase, { actor: customerActor });
  assert.equal(createdReqs.length, 1);
  assert.equal(createdReqs[0].caseId.toString(), String(indCase._id));
  assert.match(createdReqs[0].label, /TEST ONLY/);
  assert.equal(createdReqs[0].providerSubjectId, String(independent._id));
  const reqRef = createdReqs[0].publicRequirementRef;
  assert.equal(indCase.requesterUserId.toString(), String(customer._id));

  await assert.rejects(
    () => listCustomerCaseDocumentRequirements({ userId: other._id, caseRef: indCase.publicCaseRef }),
    (err) => err.status === 404
  );
  await assert.rejects(
    () => listProviderCaseDocumentRequirements({ subject: otherSubject, caseRef: indCase.publicCaseRef }),
    (err) => err.status === 404
  );
  const ownerList = await listCustomerCaseDocumentRequirements({
    userId: customer._id,
    caseRef: indCase.publicCaseRef,
  });
  assert.equal(ownerList.items.length, 1);
  assert.equal(ownerList.pack.packId.includes('test_low_risk'), true);

  await assert.rejects(tryCreateHsiRequirement, (err) => (
    err.status === 403 && err.code === GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_CONFIGURED
  ));

  resetGbsCaseDocumentTestScanner();
  await assert.rejects(
    () => initializeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: 0,
      body: { expectedVersion: 0, commandId: nid('init-nocfg') },
      actor: customerActor,
    }),
    (err) => err.status === 403 && err.code === GBS_DOCUMENT_SECURITY_CODES.NOT_CONFIGURED
  );
  await assert.rejects(
    () => completeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: 0,
      file: pdfFile(),
      body: { expectedVersion: 0, commandId: nid('complete-nocfg') },
      actor: customerActor,
    }),
    (err) => err.status === 403 && err.code === GBS_DOCUMENT_SECURITY_CODES.NOT_CONFIGURED
  );

  setGbsCaseDocumentTestScanner(async () => ({ scanStatus: 'clean' }));
  await initializeCustomerDocumentUpload({
    userId: customer._id,
    caseRef: indCase.publicCaseRef,
    requirementRef: reqRef,
    expectedVersion: 0,
    body: { expectedVersion: 0, commandId: nid('init-ok'), subjectId: String(otherInd._id) },
    actor: customerActor,
  });
  const pads = [];
  for (let i = 0; i < GBS_CASE_DOCUMENT_BOUNDS.MAX_ACTIVE_FILES_PER_CASE; i += 1) {
    pads.push(await GbsCaseDocumentRequirement.create({
      publicRequirementRef: generatePublicRequirementRef(),
      caseId: indCase._id,
      publicCaseRefSnapshot: indCase.publicCaseRef,
      requesterUserId: customer._id,
      providerSubjectType: indCase.providerSubjectType,
      providerSubjectId: String(indCase.providerSubjectId),
      requirementKey: `quota_pad_${i}`,
      label: 'TEST ONLY quota pad',
      documentType: 'business_operational',
      acceptedMimeTypes: ['application/pdf'],
      maxFileSize: GBS_CASE_DOCUMENT_BOUNDS.MAX_FILE_SIZE,
      sensitivityClass: 'business_confidential',
      whoProvides: 'customer',
      templateId: 'gbs.case_documents.test_low_risk_v1',
      templateVersion: 1,
      requirementVersion: 1,
      activeVaultVersionId: new mongoose.Types.ObjectId(),
      testOnly: true,
    }));
  }
  await assert.rejects(
    () => completeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: 0,
      file: pdfFile(),
      body: { expectedVersion: 0, commandId: nid('quota') },
      actor: customerActor,
    }),
    (err) => err.status === 409 && err.code === 'case_document_quota_exceeded'
  );
  await GbsCaseDocumentRequirement.deleteMany({ _id: { $in: pads.map((row) => row._id) } });

  await assert.rejects(
    () => completeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: 0,
      file: { buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), mimeType: 'image/svg+xml', originalname: 'x.svg' },
      body: { expectedVersion: 0, commandId: nid('svg') },
      actor: customerActor,
    }),
    (err) => err.status === 400
  );
  await assert.rejects(
    () => completeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: 0,
      file: { buffer: Buffer.from('<html></html>'), mimeType: 'text/html', originalname: 'x.html' },
      body: { expectedVersion: 0, commandId: nid('html') },
      actor: customerActor,
    }),
    (err) => err.status === 400
  );
  await assert.rejects(
    () => completeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: 0,
      file: { buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]), mimeType: 'application/zip', originalname: 'x.zip' },
      body: { expectedVersion: 0, commandId: nid('zip') },
      actor: customerActor,
    }),
    (err) => err.status === 400
  );
  await assert.rejects(
    () => completeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: 0,
      file: { buffer: jpegFile().buffer, mimeType: 'application/pdf', originalname: 'mismatch.pdf' },
      body: { expectedVersion: 0, commandId: nid('mismatch') },
      actor: customerActor,
    }),
    (err) => err.status === 400 && err.code === 'file_content_mismatch'
  );
  await assert.rejects(
    () => completeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: 0,
      file: { buffer: Buffer.alloc(GBS_CASE_DOCUMENT_BOUNDS.MAX_FILE_SIZE + 1, 0x25), mimeType: 'application/pdf', originalname: 'huge.pdf' },
      body: { expectedVersion: 0, commandId: nid('huge') },
      actor: customerActor,
    }),
    (err) => err.status === 400 && err.code === 'file_too_large'
  );

  const pdfCmd = nid('pdf-cmd');
  const uploadedPdf = await completeCustomerDocumentUpload({
    userId: customer._id,
    caseRef: indCase.publicCaseRef,
    requirementRef: reqRef,
    expectedVersion: 0,
    file: pdfFile(),
    body: { expectedVersion: 0, commandId: pdfCmd },
    actor: customerActor,
  });
  assert.equal(uploadedPdf.item.scanState, 'clean');
  const replay = await completeCustomerDocumentUpload({
    userId: customer._id,
    caseRef: indCase.publicCaseRef,
    requirementRef: reqRef,
    expectedVersion: 0,
    file: pdfFile(),
    body: { expectedVersion: 0, commandId: pdfCmd },
    actor: customerActor,
  });
  assert.equal(replay.item.recordVersion, uploadedPdf.item.recordVersion);
  await assert.rejects(
    () => completeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: 0,
      file: { ...pdfFile(), buffer: Buffer.concat([pdfFile().buffer, Buffer.from('x')]) },
      body: { expectedVersion: 0, commandId: pdfCmd },
      actor: customerActor,
    }),
    (err) => err.status === 409 && err.code === IDEMPOTENCY_CODES.CONFLICT
  );
  const afterPdf = await GbsCaseDocumentRequirement.findOne({ publicRequirementRef: reqRef });
  assert.equal(String(afterPdf.providerSubjectId), String(independent._id));
  const pdfVersion = await VaultDocumentVersion.findById(afterPdf.activeVaultVersionId);
  assert.equal(pdfVersion.scanStatus, 'clean');
  assert.equal(String(pdfVersion.storageKey).includes(String(customer._id)), false);
  assert.equal(pdfVersion.lifecycleStatus, 'active');
  const vaultDoc = await VaultDocument.findById(afterPdf.activeVaultDocumentId);
  assert.equal(vaultDoc.verificationStatus, 'unverified');
  assert.equal(String(vaultDoc.ownerUserId), String(customer._id));

  const jpegUp = await supersedeCustomerDocumentUpload({
    userId: customer._id,
    caseRef: indCase.publicCaseRef,
    requirementRef: reqRef,
    expectedVersion: afterPdf.recordVersion,
    file: jpegFile(),
    body: { expectedVersion: afterPdf.recordVersion, commandId: nid('jpeg') },
    actor: customerActor,
  });
  assert.equal(jpegUp.item.hasActiveDocument, true);
  const afterJpeg = await GbsCaseDocumentRequirement.findOne({ publicRequirementRef: reqRef });
  const oldPdf = await VaultDocumentVersion.findById(pdfVersion._id);
  assert.equal(oldPdf.lifecycleStatus, 'superseded');
  assert.equal(afterJpeg.activeVaultVersionNumber, 2);
  assert.equal(afterJpeg.reviewState, 'none');
  assert.notEqual(String(afterJpeg.activeVaultVersionId), String(pdfVersion._id));

  const pngUp = await supersedeCustomerDocumentUpload({
    userId: customer._id,
    caseRef: indCase.publicCaseRef,
    requirementRef: reqRef,
    expectedVersion: afterJpeg.recordVersion,
    file: pngFile(),
    body: { expectedVersion: afterJpeg.recordVersion, commandId: nid('png') },
    actor: customerActor,
  });
  assert.equal(pngUp.item.status, 'available_for_review');
  const afterPng = await GbsCaseDocumentRequirement.findOne({ publicRequirementRef: reqRef });

  await assert.rejects(
    () => reviewProviderDocument({
      subject: indSubject,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: afterPng.recordVersion - 1,
      body: { expectedVersion: afterPng.recordVersion - 1, commandId: nid('stale') },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409 && err.code === OPTIMISTIC_CONCURRENCY_CODE
  );

  await VaultDocumentVersion.updateOne({ _id: afterPng.activeVaultVersionId }, { $set: { scanStatus: 'rejected' } });
  await assert.rejects(
    () => reviewProviderDocument({
      subject: indSubject,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: afterPng.recordVersion,
      body: { expectedVersion: afterPng.recordVersion, commandId: nid('scan-race') },
      actor,
      env: OFF,
    }),
    (err) => err.status === 403 && err.code === GBS_DOCUMENT_SECURITY_CODES.SCAN_NOT_CLEAN
  );
  await VaultDocumentVersion.updateOne({ _id: afterPng.activeVaultVersionId }, { $set: { scanStatus: 'clean' } });

  const reviewed = await reviewProviderDocument({
    subject: indSubject,
    caseRef: indCase.publicCaseRef,
    requirementRef: reqRef,
    expectedVersion: afterPng.recordVersion,
    body: { expectedVersion: afterPng.recordVersion, commandId: nid('review') },
    actor,
    env: OFF,
  });
  assert.equal(reviewed.item.status, 'accepted');
  assert.equal(reviewed.item.statusLabel, 'Accepted for this Case requirement');
  const afterReview = await GbsCaseDocumentRequirement.findOne({ publicRequirementRef: reqRef });
  const vaultAfterReview = await VaultDocument.findById(afterReview.activeVaultDocumentId);
  assert.equal(vaultAfterReview.verificationStatus, 'unverified');
  await assert.rejects(
    () => supersedeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: afterReview.recordVersion,
      file: pdfFile('replace-after-accept.pdf'),
      body: { expectedVersion: afterReview.recordVersion, commandId: nid('locked') },
      actor: customerActor,
    }),
    (err) => err.status === 409 && err.code === 'accepted_document_locked'
  );

  const customerDl = mockRes();
  await downloadCustomerCaseDocument({
    userId: customer._id,
    caseRef: indCase.publicCaseRef,
    requirementRef: reqRef,
    res: customerDl,
    actor: customerActor,
  });
  assert.match(customerDl.headers['Content-Disposition'], /attachment/);
  assert.equal(customerDl.headers['Cache-Control'].includes('no-store'), true);
  assert.ok(customerDl.body?.length);

  const providerDl = mockRes();
  await downloadProviderCaseDocument({
    subject: indSubject,
    caseRef: indCase.publicCaseRef,
    requirementRef: reqRef,
    res: providerDl,
    actor,
    env: OFF,
  });
  assert.match(providerDl.headers['Content-Disposition'], /attachment/);
  assert.equal(providerDl.headers['X-Content-Type-Options'], 'nosniff');

  const accessAudit = await AuditLog.findOne({ action: 'gbs_case_document_accessed' }).sort({ createdAt: -1 }).lean();
  assert.ok(accessAudit);
  assert.equal(accessAudit.metadata?.storageKey, undefined);
  assert.equal(accessAudit.metadata?.signedUrl, undefined);
  assert.equal(accessAudit.metadata?.originalFilename, undefined);

  const startedDocs = await startPreparation({
    subject: indSubject,
    caseRef: indCase.publicCaseRef,
    expectedVersion: (await GbsCase.findById(indCase._id)).recordVersion,
    body: { expectedVersion: (await GbsCase.findById(indCase._id)).recordVersion },
    actor,
    env: OFF,
  });
  const readyDocs = await markReadyForSubmission({
    subject: indSubject,
    caseRef: indCase.publicCaseRef,
    expectedVersion: startedDocs.recordVersion,
    body: { expectedVersion: startedDocs.recordVersion },
    actor,
    env: ON,
  });
  assert.equal(readyDocs.status, 'ready_for_submission');

  const scanMatrix = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'scan',
  });
  const scanCase = await GbsCase.findOne({ publicCaseRef: scanMatrix.accepted.publicCaseRef });
  const scanReqs = await applyTestOnlyRequirementPack(scanCase, { actor: customerActor });
  const scanRef = scanReqs[0].publicRequirementRef;
  async function uploadWithScan(status, cmd) {
    setGbsCaseDocumentTestScanner(async () => ({ scanStatus: status }));
    const latest = await GbsCaseDocumentRequirement.findOne({ publicRequirementRef: scanRef });
    return completeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: scanCase.publicCaseRef,
      requirementRef: scanRef,
      expectedVersion: latest.recordVersion,
      file: pdfFile(`${status}.pdf`),
      body: { expectedVersion: latest.recordVersion, commandId: nid(cmd) },
      actor: customerActor,
    });
  }
  for (const status of ['pending', 'failed', 'rejected']) {
    const row = await uploadWithScan(status, `scan-${status}`);
    assert.notEqual(row.item.status, 'accepted');
    const latest = await GbsCaseDocumentRequirement.findOne({ publicRequirementRef: scanRef });
    await assert.rejects(
      () => reviewProviderDocument({
        subject: indSubject,
        caseRef: scanCase.publicCaseRef,
        requirementRef: scanRef,
        expectedVersion: latest.recordVersion,
        body: { expectedVersion: latest.recordVersion, commandId: nid(`rev-${status}`) },
        actor,
        env: OFF,
      }),
      (err) => err.status === 403 && err.code === GBS_DOCUMENT_SECURITY_CODES.SCAN_NOT_CLEAN
    );
    await assert.rejects(
      () => downloadProviderCaseDocument({
        subject: indSubject,
        caseRef: scanCase.publicCaseRef,
        requirementRef: scanRef,
        res: mockRes(),
        actor,
        env: OFF,
      }),
      (err) => err.status === 403
    );
  }
  setGbsCaseDocumentTestScanner(async () => ({ scanStatus: 'clean' }));
  const cleanScan = await uploadWithScan('clean', 'scan-clean');
  assert.equal(cleanScan.item.scanState, 'clean');
  const cleanLatest = await GbsCaseDocumentRequirement.findOne({ publicRequirementRef: scanRef });
  await reviewProviderDocument({
    subject: indSubject,
    caseRef: scanCase.publicCaseRef,
    requirementRef: scanRef,
    expectedVersion: cleanLatest.recordVersion,
    body: { expectedVersion: cleanLatest.recordVersion, commandId: nid('rev-clean') },
    actor,
    env: OFF,
  });

  const waiverCaseAccepted = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'waive',
  });
  const waiverCase = await GbsCase.findOne({ publicCaseRef: waiverCaseAccepted.accepted.publicCaseRef });
  const waiverReqs = await applyTestOnlyRequirementPack(waiverCase, { actor: customerActor });
  await GbsCaseDocumentRequirement.updateOne(
    { _id: waiverReqs[0]._id },
    { $set: { waivable: false } }
  );
  await assert.rejects(
    () => waiveProviderDocument({
      subject: indSubject,
      caseRef: waiverCase.publicCaseRef,
      requirementRef: waiverReqs[0].publicRequirementRef,
      expectedVersion: 0,
      body: { expectedVersion: 0, waiverReason: GBS_DOCUMENT_WAIVER_REASONS.NOT_APPLICABLE_TO_THIS_SERVICE, commandId: nid('nowaive') },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409 && err.code === 'requirement_not_waivable'
  );
  await GbsCaseDocumentRequirement.updateOne({ _id: waiverReqs[0]._id }, { $set: { waivable: true } });
  await assert.rejects(
    () => waiveProviderDocument({
      subject: indSubject,
      caseRef: waiverCase.publicCaseRef,
      requirementRef: waiverReqs[0].publicRequirementRef,
      expectedVersion: 0,
      body: { expectedVersion: 0, waiverReason: 'because_i_said_so', commandId: nid('bad-reason') },
      actor,
      env: OFF,
    }),
    (err) => err.status === 400 && err.code === 'invalid_waiver_reason'
  );
  await waiveProviderDocument({
    subject: indSubject,
    caseRef: waiverCase.publicCaseRef,
    requirementRef: waiverReqs[0].publicRequirementRef,
    expectedVersion: 0,
    body: {
      expectedVersion: 0,
      waiverReason: GBS_DOCUMENT_WAIVER_REASONS.NOT_APPLICABLE_TO_THIS_SERVICE,
      commandId: nid('waive-ok'),
    },
    actor,
    env: OFF,
  });

  const consentAccepted = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'consent',
  });
  const consentCase = await GbsCase.findOne({ publicCaseRef: consentAccepted.accepted.publicCaseRef });
  const consentReqs = await applyTestOnlyRequirementPack(consentCase, { consentRequired: true, actor: customerActor });
  await waiveProviderDocument({
    subject: indSubject,
    caseRef: consentCase.publicCaseRef,
    requirementRef: consentReqs[0].publicRequirementRef,
    expectedVersion: 0,
    body: {
      expectedVersion: 0,
      waiverReason: GBS_DOCUMENT_WAIVER_REASONS.NOT_APPLICABLE_TO_THIS_SERVICE,
      commandId: nid('consent-waive'),
    },
    actor,
    env: OFF,
  });
  const consentStarted = await startPreparation({
    subject: indSubject,
    caseRef: consentCase.publicCaseRef,
    expectedVersion: (await GbsCase.findById(consentCase._id)).recordVersion,
    body: { expectedVersion: (await GbsCase.findById(consentCase._id)).recordVersion },
    actor,
    env: OFF,
  });
  await assert.rejects(
    () => markReadyForSubmission({
      subject: indSubject,
      caseRef: consentCase.publicCaseRef,
      expectedVersion: consentStarted.recordVersion,
      body: { expectedVersion: consentStarted.recordVersion },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409 && err.code === 'filing_consent_pending'
  );

  const blockAccepted = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'block-ready',
  });
  const blockCase = await GbsCase.findOne({ publicCaseRef: blockAccepted.accepted.publicCaseRef });
  await applyTestOnlyRequirementPack(blockCase, { actor: customerActor });
  const blockStarted = await startPreparation({
    subject: indSubject,
    caseRef: blockCase.publicCaseRef,
    expectedVersion: (await GbsCase.findById(blockCase._id)).recordVersion,
    body: { expectedVersion: (await GbsCase.findById(blockCase._id)).recordVersion },
    actor,
    env: OFF,
  });
  await assert.rejects(
    () => markReadyForSubmission({
      subject: indSubject,
      caseRef: blockCase.publicCaseRef,
      expectedVersion: blockStarted.recordVersion,
      body: { expectedVersion: blockStarted.recordVersion },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409 && err.code === 'document_requirements_unsatisfied'
  );

  const cancelAccepted = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'cancel',
  });
  const cancelCase = await GbsCase.findOne({ publicCaseRef: cancelAccepted.accepted.publicCaseRef });
  const cancelReqs = await applyTestOnlyRequirementPack(cancelCase, { actor: customerActor });
  await cancelCustomerCase({
    userId: customer._id,
    caseRef: cancelCase.publicCaseRef,
    expectedVersion: (await GbsCase.findById(cancelCase._id)).recordVersion,
    body: { expectedVersion: (await GbsCase.findById(cancelCase._id)).recordVersion, reasonCode: 'changed_mind' },
    actor: customerActor,
  });
  await assert.rejects(
    () => completeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: cancelCase.publicCaseRef,
      requirementRef: cancelReqs[0].publicRequirementRef,
      expectedVersion: 0,
      file: pdfFile(),
      body: { expectedVersion: 0, commandId: nid('cancel-up') },
      actor: customerActor,
    }),
    (err) => err.status === 409
  );

  const agencyAccepted = await sentAcceptedQuote({
    customer,
    listing: agencyListing,
    subject: agencySubject,
    actor: agencyOwnerActor,
    customerActor,
    cmdPrefix: 'agency',
  });
  const agencyCase = await GbsCase.findOne({ publicCaseRef: agencyAccepted.accepted.publicCaseRef });
  const agencyReqs = await applyTestOnlyRequirementPack(agencyCase, { actor: customerActor });
  const agencyReqRef = agencyReqs[0].publicRequirementRef;
  setGbsCaseDocumentTestScanner(async () => ({ scanStatus: 'clean' }));
  await completeCustomerDocumentUpload({
    userId: customer._id,
    caseRef: agencyCase.publicCaseRef,
    requirementRef: agencyReqRef,
    expectedVersion: 0,
    file: pdfFile(),
    body: { expectedVersion: 0, commandId: nid('agency-pdf') },
    actor: customerActor,
  });
  const viewList = await listProviderCaseDocumentRequirements({
    subject: agencySubject,
    caseRef: agencyCase.publicCaseRef,
    canManageDocuments: false,
  });
  assert.equal(viewList.items[0].canDownload, false);
  assert.equal(viewList.items[0].canReview, false);

  await assert.rejects(
    () => assertProviderCaseDocumentDuty({ agentAccountId: viewMember._id, subject: agencySubject, actor: providerActor(viewMember) }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => assertProviderCaseDocumentDuty({ agentAccountId: casesMember._id, subject: agencySubject, actor: providerActor(casesMember) }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => assertProviderCaseDocumentDuty({ agentAccountId: quotesMember._id, subject: agencySubject, actor: providerActor(quotesMember) }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => assertProviderCaseDocumentDuty({ agentAccountId: agencyOwner._id, subject: agencySubject, actor: agencyOwnerActor }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => assertProviderCaseDocumentDuty({ agentAccountId: agencyAdmin._id, subject: agencySubject, actor: agencyAdminActor }),
    (err) => err.status === 403
  );
  await assert.rejects(
    () => assertProviderCaseDocumentDuty({ agentAccountId: eduOnly._id, subject: agencySubject, actor: providerActor(eduOnly) }),
    (err) => err.status === 403
  );
  await assertProviderCaseDocumentDuty({
    agentAccountId: docsMember._id,
    subject: agencySubject,
    actor: docsActor,
  });
  await assert.rejects(
    () => listProviderCaseDocumentRequirements({ subject: indSubject, caseRef: agencyCase.publicCaseRef }),
    (err) => err.status === 404
  );
  const agencyLatest = await GbsCaseDocumentRequirement.findOne({ publicRequirementRef: agencyReqRef });
  await reviewProviderDocument({
    subject: agencySubject,
    caseRef: agencyCase.publicCaseRef,
    requirementRef: agencyReqRef,
    expectedVersion: agencyLatest.recordVersion,
    body: { expectedVersion: agencyLatest.recordVersion, commandId: nid('agency-review') },
    actor: docsActor,
    env: OFF,
  });

  const lossAccepted = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'loss',
  });
  const lossCase = await GbsCase.findOne({ publicCaseRef: lossAccepted.accepted.publicCaseRef });
  const lossReqs = await applyTestOnlyRequirementPack(lossCase, { actor: customerActor });
  await completeCustomerDocumentUpload({
    userId: customer._id,
    caseRef: lossCase.publicCaseRef,
    requirementRef: lossReqs[0].publicRequirementRef,
    expectedVersion: 0,
    file: pdfFile(),
    body: { expectedVersion: 0, commandId: nid('loss-pdf') },
    actor: customerActor,
  });
  const lossReq = await GbsCaseDocumentRequirement.findOne({ publicRequirementRef: lossReqs[0].publicRequirementRef });
  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id), capabilityId: 'business_formation' },
    { $set: { trustStatus: PROVIDER_TRUST_STATUSES.SUSPENDED } }
  );
  await assert.rejects(
    () => reviewProviderDocument({
      subject: indSubject,
      caseRef: lossCase.publicCaseRef,
      requirementRef: lossReqs[0].publicRequirementRef,
      expectedVersion: lossReq.recordVersion,
      body: { expectedVersion: lossReq.recordVersion, commandId: nid('loss-rev') },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );
  await assert.rejects(
    () => downloadProviderCaseDocument({
      subject: indSubject,
      caseRef: lossCase.publicCaseRef,
      requirementRef: lossReqs[0].publicRequirementRef,
      res: mockRes(),
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );
  const stillOwned = await listCustomerCaseDocumentRequirements({
    userId: customer._id,
    caseRef: lossCase.publicCaseRef,
  });
  assert.equal(stillOwned.items.length, 1);
  await ProviderCapability.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id), capabilityId: 'business_formation' },
    { $set: { trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED } }
  );

  await ProviderDomainEnrollment.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    { $set: { status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.SETUP } }
  );
  await assert.rejects(
    () => reviewProviderDocument({
      subject: indSubject,
      caseRef: lossCase.publicCaseRef,
      requirementRef: lossReqs[0].publicRequirementRef,
      expectedVersion: lossReq.recordVersion,
      body: { expectedVersion: lossReq.recordVersion, commandId: nid('domain-rev') },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );
  await ProviderDomainEnrollment.updateOne(
    { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(independent._id) },
    { $set: { status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE } }
  );
  await GbsServiceListing.updateOne(
    { _id: listing._id },
    { $set: { moderationStatus: GBS_LISTING_MODERATION_STATUSES.SUSPENDED } }
  );
  await assert.rejects(
    () => reviewProviderDocument({
      subject: indSubject,
      caseRef: lossCase.publicCaseRef,
      requirementRef: lossReqs[0].publicRequirementRef,
      expectedVersion: lossReq.recordVersion,
      body: { expectedVersion: lossReq.recordVersion, commandId: nid('mod-rev') },
      actor,
      env: OFF,
    }),
    (err) => err.status === 409
  );
  await GbsServiceListing.updateOne(
    { _id: listing._id },
    { $set: { moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED } }
  );

  await UserCapabilityGrant.updateOne(
    { userId: customer._id, capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT },
    { $set: { status: GRANT_STATUSES.REVOKED } }
  );
  const history = await listCustomerCaseDocumentRequirements({
    userId: customer._id,
    caseRef: indCase.publicCaseRef,
  });
  assert.equal(history.items.length, 1);
  const replaceCaseAccepted = await sentAcceptedQuote({
    customer, listing, subject: indSubject, actor, customerActor, cmdPrefix: 'grantloss',
  }).catch((err) => err);
  if (replaceCaseAccepted?.status) {
    assert.equal(replaceCaseAccepted.status, 403);
  }
  await assert.rejects(
    () => completeCustomerDocumentUpload({
      userId: customer._id,
      caseRef: indCase.publicCaseRef,
      requirementRef: reqRef,
      expectedVersion: afterReview.recordVersion,
      file: pdfFile(),
      body: { expectedVersion: afterReview.recordVersion, commandId: nid('no-grant') },
      actor: customerActor,
    }),
    (err) => err.status === 403 || err.status === 409
  );
  const ownCase = await getCustomerCase({ userId: customer._id, caseRef: indCase.publicCaseRef });
  assert.ok(ownCase.publicCaseRef);

  assert.equal(process.env.NODE_ENV === 'production', false);
  resetGbsCaseDocumentTestScanner();
  const liveState = await listCustomerCaseDocumentRequirements({
    userId: customer._id,
    caseRef: emptyCase.publicCaseRef,
  });
  assert.equal(liveState.security.configured, false);
  assert.equal(liveState.security.mode, 'not_configured');
});
