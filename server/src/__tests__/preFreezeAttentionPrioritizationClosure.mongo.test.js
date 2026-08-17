import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ProfessionalCase } from '../models/case/ProfessionalCase.js';
import { ProfessionalCaseApplication } from '../models/case/ProfessionalCaseApplication.js';
import { CaseDocumentRequest, CaseTask } from '../models/case/CaseRecords.js';
import { getProviderAttention } from '../controllers/agentController.js';
import { GbsServiceRequest } from '../models/gbs/GbsServiceRequest.js';
import { GbsQuote } from '../models/gbs/GbsQuote.js';
import { getProviderWorkspaceSummary } from '../services/gbs/providerWorkspaceSummaryService.js';

const URI = process.env.STRIDETO_PREFREEZE_ATTENTION_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_prefreeze_attention_run1';
if (!/\/strideto_prefreeze_attention_[a-z0-9_-]+(?:\?|$)/i.test(URI)) throw new Error('P2D-R requires a disposable strideto_prefreeze_attention_* database');

let ids;
const evidence = (explain) => {
  const indexes = new Set(); let docs = 0; let keys = 0;
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (value.indexName) indexes.add(value.indexName);
    if (typeof value.totalDocsExamined === 'number') docs = Math.max(docs, value.totalDocsExamined);
    if (typeof value.totalKeysExamined === 'number') keys = Math.max(keys, value.totalKeysExamined);
    Object.values(value).forEach(visit);
  };
  visit(explain);
  const text = JSON.stringify(explain);
  return { indexes: [...indexes], docs, keys, collscan: text.includes('COLLSCAN'), blockingSort: text.includes('SORT') };
};

before(async () => {
  await mongoose.connect(URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
  const organizationId = new mongoose.Types.ObjectId();
  const membershipId = new mongoose.Types.ObjectId();
  const otherOrganizationId = new mongoose.Types.ObjectId();
  const otherMembershipId = new mongoose.Types.ObjectId();
  const studentUserId = new mongoose.Types.ObjectId();
  const now = Date.now();
  const cases = Array.from({ length: 75 }, (_, index) => ({
    _id: new mongoose.Types.ObjectId(), studentUserId, organizationId, assignedMembershipId: membershipId,
    authorizedMembershipIds: [membershipId], caseType: 'study', workflowId: 'study-case', workflowVersion: 1,
    lifecycle: 'active', currentStage: 'intake', title: `Attention Case ${index + 1}`,
    createdAt: new Date(now - index * 60_000), updatedAt: new Date(now - index * 60_000),
  }));
  const otherCase = { _id: new mongoose.Types.ObjectId(), studentUserId: new mongoose.Types.ObjectId(), organizationId: otherOrganizationId, assignedMembershipId: otherMembershipId, authorizedMembershipIds: [otherMembershipId], caseType: 'study', workflowId: 'study-case', workflowVersion: 1, lifecycle: 'active', currentStage: 'intake', title: 'Other Provider Case', createdAt: new Date(now), updatedAt: new Date(now) };
  await ProfessionalCase.collection.insertMany([...cases, otherCase]);
  ids = { organizationId, membershipId, otherOrganizationId, otherMembershipId, cases, otherCase };
  await CaseTask.collection.insertMany([
    ...cases.slice(0, 60).map((record, index) => ({ caseId: record._id, title: `Routine ${index}`, responsibleActor: 'agent', status: 'pending', source: 'agent', dueAt: new Date(now + 30 * 86_400_000 + index), createdAt: new Date(now - index), updatedAt: new Date(now - index) })),
    { caseId: cases[70]._id, title: 'Urgent older provider task', responsibleActor: 'agent', status: 'pending', source: 'agent', dueAt: new Date(now - 86_400_000), createdAt: new Date(now - 70), updatedAt: new Date(now - 70) },
    { caseId: cases[71]._id, title: 'Completed newer-looking task', responsibleActor: 'agent', status: 'completed', source: 'agent', dueAt: new Date(now - 2 * 86_400_000), createdAt: new Date(now), updatedAt: new Date(now) },
    { caseId: otherCase._id, title: 'Other Provider urgent task', responsibleActor: 'agent', status: 'pending', source: 'agent', dueAt: new Date(now - 2 * 86_400_000), createdAt: new Date(now), updatedAt: new Date(now) },
  ]);
  await ProfessionalCaseApplication.collection.insertMany([
    ...cases.slice(0, 60).map((record, index) => ({ caseId: record._id, institutionSnapshot: { officialName: `Routine Institution ${index}` }, status: 'preparing', deadlineAt: new Date(now + 40 * 86_400_000 + index), createdAt: new Date(now - index), updatedAt: new Date(now - index) })),
    { caseId: cases[69]._id, institutionSnapshot: { officialName: 'Urgent Older Institution' }, status: 'needs_changes', deadlineAt: new Date(now - 2 * 86_400_000), createdAt: new Date(now - 69), updatedAt: new Date(now - 69) },
    { caseId: cases[72]._id, institutionSnapshot: { officialName: 'Completed Institution' }, status: 'submitted', deadlineAt: new Date(now - 3 * 86_400_000), createdAt: new Date(now), updatedAt: new Date(now) },
  ]);
  await CaseDocumentRequest.collection.insertMany([
    ...cases.slice(0, 60).map((record, index) => ({ caseId: record._id, documentType: `Routine ${index}`, requestedByMembershipId: membershipId, purpose: 'Case request', status: 'requested', dueAt: new Date(now + 50 * 86_400_000 + index), requestedAt: new Date(now - index), createdAt: new Date(now - index), updatedAt: new Date(now - index) })),
    { caseId: cases[68]._id, documentType: 'Urgent older document', requestedByMembershipId: membershipId, purpose: 'Case request', status: 'requested', dueAt: new Date(now - 3 * 86_400_000), requestedAt: new Date(now - 68), createdAt: new Date(now - 68), updatedAt: new Date(now - 68) },
    { caseId: cases[73]._id, documentType: 'Resolved document', requestedByMembershipId: membershipId, purpose: 'Case request', status: 'shared', dueAt: new Date(now - 4 * 86_400_000), requestedAt: new Date(now), createdAt: new Date(now), updatedAt: new Date(now) },
  ]);
  await ProfessionalCase.collection.createIndex({ organizationId: 1, authorizedMembershipIds: 1, lifecycle: 1 });
  await CaseTask.collection.createIndex({ responsibleActor: 1, status: 1, dueAt: 1 });
  await ProfessionalCaseApplication.collection.createIndex({ status: 1, deadlineAt: 1 });
  await CaseDocumentRequest.collection.createIndex({ status: 1, dueAt: 1 });
});

after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

test('Education attention prioritizes actionable children outside the former newest-50 Case window', async () => {
  const [tasks, applications, documents] = await getProviderAttention({ organizationId: ids.organizationId, membershipId: ids.membershipId });
  assert.ok(tasks.some((row) => row.title === 'Urgent older provider task'));
  assert.ok(applications.some((row) => row.caseId.equals(ids.cases[69]._id)));
  assert.ok(documents.some((row) => row.documentType === 'Urgent older document'));
  assert.ok(tasks.every((row) => row.status !== 'completed'));
  assert.ok(applications.every((row) => ['preparing', 'ready_for_review', 'needs_changes'].includes(row.status)));
  assert.ok(documents.every((row) => ['requested', 'available'].includes(row.status)));
  assert.ok(tasks.length <= 5 && applications.length <= 5 && documents.length <= 5);
  assert.ok(!tasks.some((row) => row.caseId.equals(ids.otherCase._id)));
});

test('Business attention bounds actionable states before limiting and preserves subject isolation', async () => {
  const listingId = new mongoose.Types.ObjectId(); const requesterUserId = new mongoose.Types.ObjectId();
  const provider = { providerSubjectType: 'agent', providerSubjectId: 'business-provider-a' };
  const other = { providerSubjectType: 'agent', providerSubjectId: 'business-provider-b' };
  await GbsServiceRequest.collection.insertMany([
    ...Array.from({ length: 7 }, (_, index) => ({ _id: new mongoose.Types.ObjectId(), publicRequestRef: `REQ-${index}`, titleSnapshot: `Request ${index}`, ...provider, status: 'submitted', createdAt: new Date(2024, 0, index + 1), requesterUserId, listingId })),
    { _id: new mongoose.Types.ObjectId(), publicRequestRef: 'REQ-URGENT-OLD', titleSnapshot: 'Urgent old request', ...provider, status: 'submitted', createdAt: new Date(2020, 0, 1), requesterUserId, listingId },
    { _id: new mongoose.Types.ObjectId(), publicRequestRef: 'REQ-OTHER', titleSnapshot: 'Other provider request', ...other, status: 'submitted', createdAt: new Date(2019, 0, 1), requesterUserId, listingId },
  ]);
  await GbsQuote.collection.insertMany(Array.from({ length: 7 }, (_, index) => ({ _id: new mongoose.Types.ObjectId(), publicQuoteRef: `QUO-${index}`, titleSnapshot: `Quote ${index}`, ...provider, status: 'sent', sentAt: new Date(2024, 0, index + 1), expiresAt: new Date(2025, 0, 1), requesterUserId, listingId })).concat([{ _id: new mongoose.Types.ObjectId(), publicQuoteRef: 'QUO-URGENT-OLD', titleSnapshot: 'Urgent old quote', ...provider, status: 'sent', sentAt: new Date(2020, 0, 1), expiresAt: new Date(2025, 0, 1), requesterUserId, listingId }]));
  const summary = await getProviderWorkspaceSummary({ subjectType: 'agent', subjectId: 'business-provider-a' });
  assert.equal(summary.attention.requests.length, 5); assert.equal(summary.attention.requests[0].ref, 'REQ-URGENT-OLD');
  assert.equal(summary.attention.quotes.length, 5); assert.equal(summary.attention.quotes[0].ref, 'QUO-URGENT-OLD');
  assert.ok(summary.attention.requests.every((row) => row.status === 'submitted'));
  assert.ok(summary.attention.quotes.every((row) => row.status === 'sent'));
});

test('Attention execution plans remain bounded and do not materialize parent IDs in Node', async () => {
  const parent = { 'case.organizationId': ids.organizationId, 'case.authorizedMembershipIds': ids.membershipId, 'case.lifecycle': { $in: ['awaiting_student_acceptance', 'active'] } };
  const explainFor = (model, match, sort) => model.aggregate([
    { $match: match },
    { $lookup: { from: 'professional_cases', localField: 'caseId', foreignField: '_id', as: 'case' } },
    { $unwind: '$case' }, { $match: parent }, { $sort: sort }, { $limit: 5 },
  ]).explain('executionStats');
  const plans = {
    tasks: evidence(await explainFor(CaseTask, { responsibleActor: 'agent', status: { $in: ['pending', 'in_progress'] } }, { dueAt: 1, _id: -1 })),
    applications: evidence(await explainFor(ProfessionalCaseApplication, { status: { $in: ['preparing', 'ready_for_review', 'needs_changes'] } }, { deadlineAt: 1, _id: -1 })),
    documents: evidence(await explainFor(CaseDocumentRequest, { status: { $in: ['requested', 'available'] } }, { dueAt: 1, _id: -1 })),
  };
  console.log(`PREFREEZE_ATTENTION_EXECUTION_STATS ${JSON.stringify(plans)}`);
  for (const [name, plan] of Object.entries(plans)) { assert.ok(plan.docs > 0, `${name} examined no documents`); assert.equal(plan.collscan, false, `${name} must not COLLSCAN`); }
});
