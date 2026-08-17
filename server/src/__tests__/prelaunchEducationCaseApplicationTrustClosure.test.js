import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CASE_APPLICATION_STATUSES,
  canTransitionCaseApplicationStatus,
} from '../../../shared/services/cases.js';
import { ProfessionalCaseApplication } from '../models/case/ProfessionalCaseApplication.js';

const read = (path) => fs.readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const service = read('server/src/services/caseManagementService.js');
const routes = read('server/src/routes/cases.js');
const trust = read('server/src/services/professionalTrustService.js');
const model = read('server/src/models/case/ProfessionalCaseApplication.js');
const providerUi = read('client/src/pages/Agent/AgentCaseDetail.jsx');
const providerApplicationsUi = read('client/src/components/cases/ProviderCaseApplications.jsx');
const studentUi = read('client/src/pages/Cases/CaseDetail.jsx');
const trustUi = read('client/src/pages/Trust/TrustCenter.jsx');
const messagesUi = read('client/src/components/consultations/MessageThread.jsx');
const clientApi = read('client/src/services/agentService.js');

test('application lifecycle is minimal, truthful, and transition validated', () => {
  assert.deepEqual(CASE_APPLICATION_STATUSES, [
    'preparing', 'ready_for_submission', 'provider_attested_submitted', 'awaiting_decision',
    'provider_recorded_offer', 'provider_recorded_unsuccessful', 'withdrawn', 'completed',
  ]);
  assert.equal(canTransitionCaseApplicationStatus('preparing', 'ready_for_submission'), true);
  assert.equal(canTransitionCaseApplicationStatus('preparing', 'provider_recorded_offer'), false);
  assert.equal(canTransitionCaseApplicationStatus('completed', 'preparing'), false);
});

test('application model is additive 1:N, opaque, catalog-linked, and autoIndex-off', () => {
  assert.equal(ProfessionalCaseApplication.schema.options.autoIndex, false);
  assert.match(model, /caseId:[\s\S]*ref: 'ProfessionalCase'[\s\S]*required: true/);
  assert.match(model, /institutionId:[\s\S]*ref: 'CanonicalInstitution'/);
  assert.match(model, /programId:[\s\S]*ref: 'Program'/);
  assert.match(model, /statusHistory/);
  assert.doesNotMatch(model, /GbsCase|EducationApplicationInstitution|EducationApplicationProgram/);
});

test('server derives application authority from exact parent Case', () => {
  assert.match(service, /createApplication[\s\S]*caseForAgent\(agentAccountId, caseId\)/);
  assert.match(service, /updateApplication[\s\S]*caseForAgent\(agentAccountId, caseId\)/);
  assert.match(service, /ProfessionalCaseApplication\.findOne\(\{ _id:[\s\S]*caseId: record\._id/);
  assert.match(service, /Education Case authority required/);
  assert.match(service, /EDUCATION_CASES_MANAGE/);
  assert.doesNotMatch(service, /GbsCase/);
});

test('canonical institution, program, and embedded intake are reused', () => {
  assert.match(service, /CanonicalInstitution\.findOne/);
  assert.match(service, /Program\.findOne/);
  assert.match(service, /program\.institutionId/);
  assert.match(service, /program\.intakes/);
  assert.match(service, /bounded institution name/);
});

test('create is retry-safe without collapsing legitimate multi-application Cases', () => {
  assert.match(model, /caseId: 1, creationCommandId: 1/);
  assert.match(service, /Idempotency-Key/);
  assert.match(service, /error\?\.code === 11000/);
  assert.doesNotMatch(model, /institutionId: 1, programId: 1/);
});

test('application submission remains Provider-attested and Student-approved', () => {
  assert.match(service, /provider_attested_submitted/);
  assert.match(service, /Student approval is required before Provider-attested submission/);
  assert.match(service, /authorized_integration_future/);
  assert.match(providerApplicationsUi, /not an official institution acknowledgment or decision/i);
  assert.match(studentUi, /Provider-maintained STRIDETO workflow records/i);
});

test('Case detail returns zero or many applications and hides internal notes from Student', () => {
  assert.match(service, /ProfessionalCaseApplication\.find\(\{ caseId: record\._id \}\)/);
  assert.match(service, /actorType === 'student' \? \{ visibility: 'shared' \}/);
  assert.match(providerApplicationsUi, /zero or many applications/i);
  assert.match(studentUi, /Some guidance Cases do not require applications/);
});

test('Provider UI exposes operational Case capabilities', () => {
  const combined = `${providerUi}\n${providerApplicationsUi}`;
  for (const term of ['Education applications', 'Tasks and next actions', 'Case documents', 'Case notes', 'Student approvals', 'Case messages', 'Case activity timeline']) {
    assert.match(combined, new RegExp(term));
  }
  assert.match(providerUi, /Provider internal only/);
  assert.match(providerUi, /Student-visible/);
});

test('Student UI answers progress, next action, documents, messages, and history', () => {
  for (const term of ['Provider', 'Education service', 'My next action', 'Provider next action', 'Applications in this Case', 'Case document sharing', 'Case messages', 'Case activity timeline']) {
    assert.match(studentUi, new RegExp(term));
  }
  assert.match(studentUi, /shareDocument/);
  assert.match(studentUi, /revokeDocument/);
  assert.doesNotMatch(studentUi, /agent_private/);
});

test('Case messaging stays contextual and distinct from consultation', () => {
  assert.match(routes, /cases\/:caseId\/messages/);
  assert.doesNotMatch(routes, /consultations\/threads/);
  assert.match(messagesUi, /title = 'Consultation messages'/);
  assert.match(studentUi, /separate from your consultation messages/);
  assert.match(providerUi, /separate from the consultation thread/);
});

test('Vault sharing is exact, server-derived, and revocable', () => {
  assert.match(service, /granteeId: String\(record\.assignedMembershipId\)/);
  assert.match(service, /caseRef: String\(record\._id\)/);
  assert.match(service, /permissions: \['view'\]/);
  assert.match(service, /revokeDocumentGrant/);
  assert.match(routes, /delete\('\/cases\/:caseId\/document-requests\/:requestId\/share'/);
  assert.match(clientApi, /revokeDocument/);
  assert.doesNotMatch(providerUi, /vaultApi\.list/);
});

test('canonical completed lifecycle drives review eligibility', () => {
  assert.match(trust, /anchor\.lifecycle === 'completed'/);
  assert.match(trust, /anchor\.processCompleted === true/);
  assert.match(trust, /Boolean\(anchor\.closedAt\)/);
  assert.doesNotMatch(trust, /anchor\.lifecycle === 'closed'/);
});

test('Student trust creation UI is exact-context and server verified', () => {
  assert.match(studentUi, /trustLink\('review'\)/);
  assert.match(studentUi, /trustLink\('report'\)/);
  assert.match(studentUi, /trustLink\('dispute'\)/);
  assert.match(trustUi, /studentTrustApi\.createReview/);
  assert.match(trustUi, /studentTrustApi\.createReport/);
  assert.match(trustUi, /studentTrustApi\.openDispute/);
  assert.match(trustUi, /server verifies that this exact interaction belongs to you/i);
});

test('all new routes retain authenticated Student or Agent boundaries', () => {
  assert.match(routes, /const s=\[\.\.\.studentProductAuth\]/);
  assert.match(routes, /const s=.*a=\[requireAuth,requireAgentAuth\]/);
  assert.match(routes, /post\('\/agent\/cases\/:caseId\/applications',\.\.\.a/);
  assert.match(routes, /post\('\/cases\/:caseId\/document-requests\/:requestId\/share',\.\.\.s/);
});
