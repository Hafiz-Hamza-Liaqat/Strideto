import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const provider = read('pages/Agent/AgentCaseDetail.jsx');
const applications = read('components/cases/ProviderCaseApplications.jsx');
const student = read('pages/Cases/CaseDetail.jsx');
const consultation = read('pages/Consultations/ConsultationDetail.jsx');
const trust = read('pages/Trust/TrustCenter.jsx');
const messages = read('components/consultations/MessageThread.jsx');
const api = read('services/agentService.js');

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`✓ ${name}`); }

check('Provider Case has route-appropriate h1 and operational sections', () => {
  assert.match(provider, /<h1/);
  for (const value of ['Case workflow', 'Tasks and next actions', 'Case documents', 'Case notes', 'Student approvals', 'Case activity timeline']) assert.match(provider, new RegExp(value));
});
check('Provider can create multiple structured applications', () => {
  assert.match(applications, /Add application/);
  assert.match(applications, /STRIDETO catalog/);
  assert.match(applications, /External institution snapshot/);
  assert.match(applications, /crypto\.randomUUID/);
});
check('Provider application statuses are explicitly non-authoritative', () => {
  assert.match(applications, /Provider-attested/);
  assert.match(applications, /not an official institution acknowledgment or decision/i);
});
check('Provider tasks preserve responsibility', () => {
  assert.match(provider, /responsibleActor/);
  assert.match(provider, /Mark Provider task complete/);
});
check('Provider never lists arbitrary Student Vault documents', () => {
  assert.doesNotMatch(provider, /vaultApi\.list/);
  assert.match(provider, /Student’s Vault is never listed here/);
});
check('Student Case answers Provider, service, and both next actions', () => {
  for (const value of ['Provider', 'Education service', 'My next action', 'Provider next action']) assert.match(student, new RegExp(value));
});
check('Student sees all structured application dimensions and history', () => {
  for (const value of ['Applications in this Case', 'institution', 'program', 'intake', 'Deadline', 'Submitted', 'Application history']) assert.match(student, new RegExp(value, 'i'));
});
check('Student exact Vault controls are visible and labelled', () => {
  assert.match(student, /Exact Vault document/);
  assert.match(student, /Share exact document/);
  assert.match(student, /Revoke this document share/);
});
check('Case messages are accessible to both parties and context-labelled', () => {
  assert.match(provider, /title="Case messages"/);
  assert.match(student, /title="Case messages"/);
  assert.match(messages, /placeholder/);
  assert.match(messages, /readOnly/);
});
check('Consultation and Case messages remain separate', () => {
  assert.match(student, /separate from your consultation messages/);
  assert.match(consultation, /studentConsultationApi\.getMessages/);
});
check('Student review button is eligibility-gated', () => {
  assert.match(student, /reviewEligibility\?\.eligible/);
  assert.match(consultation, /reviewEligibility\?\.eligible/);
});
check('Trust Center creates review, report, and professional dispute', () => {
  assert.match(trust, /createReview/);
  assert.match(trust, /createReport/);
  assert.match(trust, /openDispute/);
  assert.match(trust, /separate from payment disputes/i);
});
check('Case client API includes applications, messages, sharing, and revoke', () => {
  for (const value of ['createCaseApplication', 'updateCaseApplication', 'getCaseMessages', 'sendCaseMessage', 'shareDocument', 'revokeDocument']) assert.match(api, new RegExp(value));
});
check('touched pages preserve accessible primary headings', () => {
  assert.match(student, /<h1/);
  assert.match(trust, /<h1/);
  assert.match(consultation, /<h1/);
});

console.log(`prelaunchEducationCaseApplicationTrustClosure.test.js: ${passed} assertions passed`);
