import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentService } from '../models/agent/AgentService.js';
import { Consultation } from '../models/consultation/Consultation.js';
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import { Program } from '../models/education/Program.js';
import { ProfessionalCaseApplication } from '../models/case/ProfessionalCaseApplication.js';
import { VaultDocument } from '../models/vault/VaultDocument.js';
import { DocumentAccessGrant } from '../models/vault/DocumentAccessGrant.js';
import { CaseApprovalRequest, CaseDocumentRequest } from '../models/case/CaseRecords.js';
import { ProfessionalReview } from '../models/trust/ProfessionalReview.js';
import { ProfessionalDispute } from '../models/trust/ProfessionalDispute.js';
import {
  createApplication,
  createTask,
  decideApproval,
  decideProposal,
  getCase,
  listMessages,
  proposeCase,
  requestApproval,
  requestDocument,
  resolveCaseDocument,
  revokeSharedDocument,
  sendMessage,
  shareDocument,
  transitionLifecycle,
  updateApplication,
  completeTask,
} from '../services/caseManagementService.js';
import {
  createReport,
  createReview,
  openDispute,
  reviewEligibility,
} from '../services/professionalTrustService.js';
import {
  EDUCATION_CASE_APPLICATION_CRITICAL_INDEXES,
  PROFESSIONAL_TRUST_CRITICAL_INDEXES,
  provisionMissingIndexes,
} from '../services/platform/criticalIndexProvision.js';

function runtimeDisposableUri() {
  if (process.env.STRIDETO_P1A_TEST_MONGO_URI) return process.env.STRIDETO_P1A_TEST_MONGO_URI;
  if (process.env.STRIDETO_P1A_USE_RUNTIME_MONGO === '1' && process.env.MONGO_URI) {
    const value = new URL(process.env.MONGO_URI);
    value.pathname = '/strideto_p1a_case_application_run1';
    value.search = '';
    return value.toString();
  }
  return 'mongodb://127.0.0.1:27017/strideto_p1a_case_application_run1';
}

const TEST_URI = runtimeDisposableUri();
if (!/\/strideto_p1a_[a-z0-9_-]+(?:\?|$)/i.test(TEST_URI)) {
  throw new Error('P1A Mongo test URI must name a disposable strideto_p1a_* database');
}

let student;
let otherStudent;
let provider;
let otherProvider;
let businessOnlyProvider;
let membership;
let service;
let consultation;
let professionalCase;
let institution;
let program;

async function makeProvider(suffix, { businessOnly = false, agency = false } = {}) {
  const account = await AgentAccount.create({ email: `p1a-${suffix}@example.test`, password: 'TestPass123!', accountStatus: 'active' });
  const organization = await Organization.create({ organizationType: agency ? 'agency' : 'agent', displayName: `P1A ${suffix}`, status: 'active' });
  const profile = await AgentProfile.create({
    agentAccountId: account._id,
    organizationId: organization._id,
    agentType: agency ? 'agency' : 'agent',
    professionalName: `Provider ${suffix}`,
    providerDomainInitializationState: businessOnly ? 'ready' : 'legacy',
  });
  const row = await AgentMembership.create({
    organizationId: organization._id,
    agentAccountId: account._id,
    role: 'owner',
    active: true,
    ...(businessOnly ? { domainAccess: [{ domainId: 'business_services', permissions: ['business_services.view', 'business_services.cases.manage'] }] } : {}),
  });
  return { account, organization, profile, membership: row };
}

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
  await provisionMissingIndexes({ collection: ProfessionalCaseApplication.collection, expected: EDUCATION_CASE_APPLICATION_CRITICAL_INDEXES });
  await provisionMissingIndexes({ collection: ProfessionalReview.collection, expected: PROFESSIONAL_TRUST_CRITICAL_INDEXES.reviews });
  await provisionMissingIndexes({ collection: ProfessionalDispute.collection, expected: PROFESSIONAL_TRUST_CRITICAL_INDEXES.disputes });
  student = await User.create({ name: 'P1A Student', email: 'p1a-student@example.test', password: 'TestPass123!' });
  otherStudent = await User.create({ name: 'Other Student', email: 'p1a-other-student@example.test', password: 'TestPass123!' });
  provider = await makeProvider('education');
  otherProvider = await makeProvider('other-education');
  businessOnlyProvider = await makeProvider('business-only', { businessOnly: true });
  membership = provider.membership;
  service = await AgentService.create({
    organizationId: provider.organization._id,
    agentProfileId: provider.profile._id,
    title: 'University Application Support',
    category: 'university_application_support',
    status: 'active',
  });
  consultation = await Consultation.create({
    studentUserId: student._id,
    organizationId: provider.organization._id,
    assignedMembershipId: membership._id,
    agentServiceId: service._id,
    status: 'completed',
    requestedWindow: { start: new Date('2026-08-01T10:00:00Z'), end: new Date('2026-08-01T11:00:00Z') },
    confirmedStart: new Date('2026-08-01T10:00:00Z'),
    durationMinutes: 60,
    timezone: 'UTC',
    meetingMode: 'video',
    purpose: 'Application planning',
    paymentState: 'free',
    completion: { completedAt: new Date('2026-08-01T11:00:00Z'), outcomeNote: 'Completed' },
  });
  institution = await CanonicalInstitution.create({ officialName: 'P1A University', slug: 'p1a-university', countryCode: 'GB', institutionType: 'university', status: 'published' });
  program = await Program.create({
    institutionId: institution._id,
    name: 'P1A Computing',
    slug: 'p1a-computing',
    country: 'GB',
    status: 'published',
    intakes: [{ cycleLabel: 'September 2027', startDate: '2027-09-01', deadlineDate: '2027-01-31', status: 'published' }],
  });
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('completed consultation proposes but does not auto-activate Case; Student consent activates', async () => {
  const proposed = await proposeCase(provider.account._id, { consultationId: consultation._id, caseType: 'study', title: 'P1A Application Case', destinationCountry: 'GB' });
  assert.equal(proposed.lifecycle, 'awaiting_student_acceptance');
  professionalCase = proposed;
  const accepted = await decideProposal(student._id, proposed.id, { decision: 'accept' });
  assert.equal(accepted.lifecycle, 'active');
});

test('one Case supports zero, one, and multiple independent applications', async () => {
  let detail = await getCase('student', student._id, professionalCase.id);
  assert.equal(detail.applications.length, 0);
  const first = await createApplication(provider.account._id, professionalCase.id, {
    institutionId: institution._id,
    programId: program._id,
    intakeCycleLabel: 'September 2027',
  }, 'p1a-create-application-0001');
  assert.equal(first.created, true);
  assert.equal(first.application.institution.officialName, 'P1A University');
  assert.equal(first.application.program.name, 'P1A Computing');
  assert.equal(first.application.intake.cycleLabel, 'September 2027');
  const retried = await createApplication(provider.account._id, professionalCase.id, {
    institutionId: institution._id,
    programId: program._id,
  }, 'p1a-create-application-0001');
  assert.equal(retried.created, false);
  assert.equal(retried.application.id, first.application.id);
  await createApplication(provider.account._id, professionalCase.id, {
    institutionName: 'External College',
    programName: 'Design',
    intakeCycleLabel: 'Spring 2028',
    destinationCountry: 'CA',
  }, 'p1a-create-application-0002');
  detail = await getCase('student', student._id, professionalCase.id);
  assert.equal(detail.applications.length, 2);
  assert.notEqual(detail.applications[0].id, detail.applications[1].id);
});

test('Student, Provider, Agency, and Education/Business boundaries fail closed', async () => {
  await assert.rejects(() => getCase('student', otherStudent._id, professionalCase.id), (error) => error.status === 404);
  await assert.rejects(() => createApplication(otherProvider.account._id, professionalCase.id, { institutionName: 'Denied', destinationCountry: 'US' }, 'p1a-denied-other-provider'), (error) => error.status === 404);
  await assert.rejects(() => createApplication(businessOnlyProvider.account._id, professionalCase.id, { institutionName: 'Denied', destinationCountry: 'US' }, 'p1a-denied-business-provider'), (error) => error.status === 403 && /Education Case authority/.test(error.message));

  const agencyProvider = await makeProvider('education-agency', { agency: true });
  const agencyService = await AgentService.create({
    organizationId: agencyProvider.organization._id,
    agentProfileId: agencyProvider.profile._id,
    title: 'Agency University Application Support',
    category: 'university_application_support',
    status: 'active',
  });
  const agencyConsultation = await Consultation.create({
    studentUserId: otherStudent._id,
    organizationId: agencyProvider.organization._id,
    assignedMembershipId: agencyProvider.membership._id,
    agentServiceId: agencyService._id,
    status: 'completed',
    requestedWindow: { start: new Date('2026-08-02T10:00:00Z'), end: new Date('2026-08-02T11:00:00Z') },
    confirmedStart: new Date('2026-08-02T10:00:00Z'),
    durationMinutes: 60,
    timezone: 'UTC',
    meetingMode: 'video',
    purpose: 'Agency application planning',
    paymentState: 'free',
    completion: { completedAt: new Date('2026-08-02T11:00:00Z'), outcomeNote: 'Completed' },
  });
  const agencyCase = await proposeCase(agencyProvider.account._id, { consultationId: agencyConsultation._id, caseType: 'study', title: 'Agency-owned Education Case', destinationCountry: 'GB' });
  await decideProposal(otherStudent._id, agencyCase.id, { decision: 'accept' });
  await createApplication(agencyProvider.account._id, agencyCase.id, { institutionName: 'Agency External College', programName: 'Agency Program', destinationCountry: 'GB' }, 'p1a-agency-owned-application');
  await assert.rejects(() => createApplication(provider.account._id, agencyCase.id, { institutionName: 'Independent access denied', destinationCountry: 'GB' }, 'p1a-independent-to-agency-denied'), (error) => error.status === 404);
});

test('status validation, exact submission approval, and independent updates work', async () => {
  const detail = await getCase('agent', provider.account._id, professionalCase.id);
  const [first, second] = detail.applications;
  await assert.rejects(() => updateApplication(provider.account._id, professionalCase.id, first.id, { status: 'officially_admitted' }), (error) => error.status === 400);
  await assert.rejects(() => updateApplication(provider.account._id, professionalCase.id, first.id, { status: 'provider_recorded_offer' }), (error) => error.status === 409);
  await updateApplication(provider.account._id, professionalCase.id, first.id, { status: 'ready_for_submission' });
  await assert.rejects(() => updateApplication(provider.account._id, professionalCase.id, first.id, { status: 'provider_attested_submitted', submissionMethod: 'agent_assisted_external' }), (error) => error.status === 409);
  const approval = await requestApproval(provider.account._id, professionalCase.id, { actionType: 'external_submission', explanation: 'Approve exact application submission', proposedAction: { applicationId: first.id } });
  await decideApproval(student._id, professionalCase.id, approval.id, { decision: 'approve' });
  const submitted = await updateApplication(provider.account._id, professionalCase.id, first.id, { status: 'provider_attested_submitted', submissionMethod: 'agent_assisted_external' });
  assert.equal(submitted.status, 'provider_attested_submitted');
  const unchangedSecond = (await getCase('student', student._id, professionalCase.id)).applications.find((row) => row.id === second.id);
  assert.equal(unchangedSecond.status, 'preparing');
});

test('task responsibility and exact Case messages are enforced', async () => {
  const studentTask = await createTask(provider.account._id, professionalCase.id, { title: 'Upload transcript', responsibleActor: 'student' });
  const providerTask = await createTask(provider.account._id, professionalCase.id, { title: 'Review transcript', responsibleActor: 'agent' });
  await assert.rejects(() => completeTask('agent', provider.account._id, professionalCase.id, studentTask.id), (error) => error.status === 404);
  await assert.rejects(() => completeTask('student', student._id, professionalCase.id, providerTask.id), (error) => error.status === 404);
  assert.equal((await completeTask('student', student._id, professionalCase.id, studentTask.id)).status, 'completed');
  assert.equal((await completeTask('agent', provider.account._id, professionalCase.id, providerTask.id)).status, 'completed');
  await sendMessage('student', student._id, professionalCase.id, { text: 'Student Case message' });
  await sendMessage('agent', provider.account._id, professionalCase.id, { text: 'Provider Case message' });
  const messages = await listMessages('student', student._id, professionalCase.id);
  assert.equal(messages.total, 2);
  await assert.rejects(() => listMessages('student', otherStudent._id, professionalCase.id), (error) => error.status === 404);
});

test('exact Vault share permits access and revocation immediately denies', async () => {
  const request = await requestDocument(provider.account._id, professionalCase.id, { documentType: 'Transcript', purpose: 'Application review' });
  const document = await VaultDocument.create({ ownerUserId: student._id, documentType: 'transcript', displayName: 'P1A Transcript' });
  const shared = await shareDocument(student._id, professionalCase.id, request.id, { documentId: document._id });
  assert.equal(shared.status, 'shared');
  const storedRequest = await CaseDocumentRequest.findById(request.id).lean();
  const grant = await DocumentAccessGrant.findById(storedRequest.grantId).lean();
  assert.equal(grant.granteeId, String(membership._id));
  assert.equal(grant.caseRef, String(professionalCase.id));
  assert.deepEqual(grant.permissions, ['view']);
  assert.equal((await resolveCaseDocument(provider.account._id, professionalCase.id, request.id)).access, 'granted');
  await revokeSharedDocument(student._id, professionalCase.id, request.id);
  await assert.rejects(() => resolveCaseDocument(provider.account._id, professionalCase.id, request.id), (error) => error.status === 404);
  const revoked = await DocumentAccessGrant.findById(storedRequest.grantId).lean();
  assert.equal(revoked.status, 'revoked');
});

test('only canonical completed Case is review eligible; review/report/dispute bind exact Case', async () => {
  assert.equal((await reviewEligibility(student._id, 'professional_case', professionalCase.id)).eligible, false);
  await transitionLifecycle('agent', provider.account._id, professionalCase.id, { lifecycle: 'closing' });
  const closureApproval = await requestApproval(provider.account._id, professionalCase.id, { actionType: 'case_closure', explanation: 'Approve Case completion' });
  await decideApproval(student._id, professionalCase.id, closureApproval.id, { decision: 'approve' });
  await transitionLifecycle('agent', provider.account._id, professionalCase.id, { lifecycle: 'completed' });
  assert.equal((await reviewEligibility(student._id, 'professional_case', professionalCase.id)).eligible, true);
  const review = await createReview(student._id, { interactionType: 'professional_case', interactionId: professionalCase.id, rating: 5, title: 'Professional support', body: 'The Provider communicated clearly throughout the Case.' });
  assert.equal(review.verifiedInteraction, true);
  await assert.rejects(() => createReview(student._id, { interactionType: 'professional_case', interactionId: professionalCase.id, rating: 5, body: 'This duplicate review must not be accepted.' }), (error) => error.status === 409);
  const report = await createReport(student._id, { targetType: 'professional_case', targetId: professionalCase.id, category: 'poor_service', description: 'A private test report tied to this exact Case.' });
  assert.equal(String(report.organizationId), String(provider.organization._id));
  const dispute = await openDispute(student._id, { contextType: 'professional_case', contextId: professionalCase.id, category: 'service_quality', summary: 'A professional service test dispute for this exact Case.' });
  assert.equal(String(dispute.studentUserId), String(student._id));
  assert.equal(await ProfessionalReview.countDocuments({ interactionId: professionalCase.id }), 1);
});

test('completed Case applications are immutable and index provisioning is idempotent', async () => {
  const application = await ProfessionalCaseApplication.findOne({ caseId: professionalCase.id }).lean();
  await assert.rejects(() => updateApplication(provider.account._id, professionalCase.id, application._id, { deadlineAt: '2028-01-01' }), (error) => error.status === 409);
  const first = await provisionMissingIndexes({ collection: ProfessionalCaseApplication.collection, expected: EDUCATION_CASE_APPLICATION_CRITICAL_INDEXES });
  const second = await provisionMissingIndexes({ collection: ProfessionalCaseApplication.collection, expected: EDUCATION_CASE_APPLICATION_CRITICAL_INDEXES });
  assert.equal(first.comparison.ok, true);
  assert.deepEqual(second.created, []);
  assert.equal(await CaseApprovalRequest.countDocuments({ caseId: professionalCase.id, status: 'approved' }) >= 2, true);
});
