import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentService } from '../models/agent/AgentService.js';
import { OrganizationVerification } from '../models/OrganizationVerification.js';
import { ProfessionalCase } from '../models/case/ProfessionalCase.js';
import { ProfessionalCaseApplication } from '../models/case/ProfessionalCaseApplication.js';
import { CaseApprovalRequest, CaseDocumentRequest, CaseEvent, CaseNote, CaseTask } from '../models/case/CaseRecords.js';
import { getPublicDirectory } from '../services/agentProfileService.js';
import { getCase } from '../services/caseManagementService.js';
import { provisionMissingIndexes, PUBLIC_EDUCATION_DIRECTORY_CRITICAL_INDEXES } from '../services/platform/criticalIndexProvision.js';

const URI = process.env.STRIDETO_P2C3_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_p2c3_directory_case_run1';
if (!/\/strideto_p2c3_[a-z0-9_-]+(?:\?|$)/i.test(URI)) throw new Error('P2C-3 requires a disposable strideto_p2c3_* database');
let directoryPipelines = [];
let ids;

function evidence(explain) {
  const indexes = new Set(); let docs = 0; let keys = 0;
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (value.indexName) indexes.add(value.indexName);
    if (typeof value.totalDocsExamined === 'number') docs = Math.max(docs, value.totalDocsExamined);
    if (typeof value.totalKeysExamined === 'number') keys = Math.max(keys, value.totalKeysExamined);
    Object.values(value).forEach(visit);
  };
  visit(explain);
  const serialized = JSON.stringify(explain);
  return { indexes: [...indexes], docs, keys, collscan: serialized.includes('COLLSCAN'), blockingSort: serialized.includes('SORT') };
}

before(async () => {
  await mongoose.connect(URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
  const now = 1700000000000;
  const profiles = Array.from({ length: 250 }, (_, index) => {
    const organizationId = new mongoose.Types.ObjectId();
    return {
      _id: new mongoose.Types.ObjectId(), agentAccountId: new mongoose.Types.ObjectId(), organizationId,
      slug: `directory-provider-${index}`, professionalName: `Directory Provider ${index}`,
      agentType: index % 2 ? 'agency' : 'agent', countryCode: index % 3 ? 'PK' : 'GB',
      destinationCountries: index % 4 ? ['GB'] : ['US'], serviceCountries: ['PK'], languages: ['en'],
      specialties: ['Education guidance'], professionalSummary: 'Public safe summary', website: '', officialEmail: `private-${index}@example.test`,
      createdAt: new Date(now + index), updatedAt: new Date(now + index),
    };
  });
  await AgentProfile.collection.insertMany(profiles);
  await OrganizationVerification.collection.insertMany(profiles.map((profile, index) => ({
    organizationId: profile.organizationId, status: index < 200 ? 'approved' : 'pending', riskLevel: 'low', createdAt: new Date(now), updatedAt: new Date(now),
  })));
  const services = profiles.flatMap((profile, index) => ([
    { organizationId: profile.organizationId, agentProfileId: profile._id, title: `Active ${index}`, category: index % 2 ? 'university_application_support' : 'career_guidance', status: 'active', createdAt: new Date(now + index), updatedAt: new Date(now + index) },
    { organizationId: profile.organizationId, agentProfileId: profile._id, title: `Archived ${index}`, category: 'test_guidance', status: 'archived', createdAt: new Date(now + index), updatedAt: new Date(now + index) },
  ]));
  await AgentService.collection.insertMany(services);
  await provisionMissingIndexes({ collection: AgentProfile.collection, expected: PUBLIC_EDUCATION_DIRECTORY_CRITICAL_INDEXES });
  await AgentProfile.collection.createIndex({ countryCode: 1, profileStatus: 1 });
  await AgentProfile.collection.createIndex({ destinationCountries: 1 });
  await OrganizationVerification.collection.createIndex({ organizationId: 1 }, { unique: true });
  await AgentService.collection.createIndex({ organizationId: 1, status: 1 });
  await AgentService.collection.createIndex({ category: 1, status: 1 });

  const studentUserId = new mongoose.Types.ObjectId();
  const organizationId = new mongoose.Types.ObjectId();
  const membershipId = new mongoose.Types.ObjectId();
  const professionalCase = await ProfessionalCase.create({ studentUserId, organizationId, assignedMembershipId: membershipId, authorizedMembershipIds: [membershipId], caseType: 'study', workflowId: 'study-case', workflowVersion: 1, lifecycle: 'active', currentStage: 'intake', title: 'Large bounded Case' });
  ids = { studentUserId, organizationId, membershipId, caseId: professionalCase._id };
  const dates = (count) => Array.from({ length: count }, (_, index) => new Date(now + index));
  await ProfessionalCaseApplication.insertMany(dates(65).map((createdAt, index) => ({ caseId: ids.caseId, institutionSnapshot: { officialName: `Institution ${index}` }, status: 'preparing', createdAt, updatedAt: createdAt })));
  await CaseTask.insertMany(dates(100).map((createdAt, index) => ({ caseId: ids.caseId, title: `Task ${index}`, responsibleActor: index % 2 ? 'student' : 'agent', status: index < 55 ? 'pending' : 'completed', source: 'agent', createdAt, updatedAt: createdAt })));
  await CaseDocumentRequest.insertMany(dates(100).map((createdAt, index) => ({ caseId: ids.caseId, documentType: `Document ${index}`, requestedByMembershipId: membershipId, purpose: 'Exact Case request', status: 'requested', requestedAt: createdAt, createdAt, updatedAt: createdAt })));
  await CaseEvent.insertMany(dates(250).map((createdAt) => ({ caseId: ids.caseId, organizationId, eventType: 'case_activity', actorType: 'system', actorId: 'system', createdAt })));
  await CaseNote.insertMany(dates(35).map((createdAt, index) => ({ caseId: ids.caseId, authorMembershipId: membershipId, visibility: index % 2 ? 'shared' : 'agent_private', body: `Note ${index}`, createdAt, updatedAt: createdAt })));
  await CaseApprovalRequest.insertMany(dates(35).map((createdAt, index) => ({ caseId: ids.caseId, actionType: 'scope_change', requestedByMembershipId: membershipId, explanation: `Approval ${index}`, status: 'pending', requestedAt: createdAt, createdAt, updatedAt: createdAt })));
  for (const collection of [ProfessionalCaseApplication, CaseTask, CaseDocumentRequest, CaseEvent, CaseNote, CaseApprovalRequest]) await collection.collection.createIndex({ caseId: 1 });
  mongoose.set('debug', (collection, method, query) => {
    if (collection === AgentProfile.collection.name && method === 'aggregate') directoryPipelines.push(query);
  });
});

after(async () => { mongoose.set('debug', false); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

test('directory pages and combined filters preserve unique verified Provider semantics without Node ID arrays', async () => {
  const first = await getPublicDirectory({ page: 1, limit: 20 });
  const middle = await getPublicDirectory({ page: 5, limit: 20 });
  const last = await getPublicDirectory({ page: 10, limit: 20 });
  assert.equal(first.total, 200); assert.equal(first.profiles.length, 20); assert.equal(middle.profiles.length, 20); assert.equal(last.profiles.length, 20);
  assert.equal(new Set([...first.profiles, ...middle.profiles, ...last.profiles].map((row) => row.slug)).size, 60);
  const category = await getPublicDirectory({ serviceCategory: 'university_application_support', countryCode: 'PK', destinationCountry: 'GB', agentType: 'agency', page: 1, limit: 20 });
  assert.ok(category.total > 0); assert.ok(category.profiles.every((row) => row.agentType === 'agency' && row.countryCode === 'PK' && row.destinationCountries.includes('GB')));
  assert.equal((await getPublicDirectory({ serviceCategory: 'test_guidance' })).total, 0, 'archived-only services do not qualify');
  assert.equal('officialEmail' in first.profiles[0], false); assert.equal(first.profiles[0].educationProfessionalVerification.verified, true);
  assert.ok(directoryPipelines.length >= 5);
});

test('all repeatable Case children are bounded, independently pageable, and open tasks are discoverable', async () => {
  const first = await getCase('student', ids.studentUserId, ids.caseId, { taskStatus: 'open' });
  assert.equal(first.applications.length, 20); assert.equal(first.childPagination.applications.total, 65);
  assert.equal(first.tasks.length, 20); assert.equal(first.childPagination.tasks.total, 55); assert.ok(first.tasks.every((row) => ['pending', 'in_progress'].includes(row.status)));
  assert.equal(first.documentRequests.length, 20); assert.equal(first.childPagination.documentRequests.total, 100);
  assert.equal(first.timeline.length, 20); assert.equal(first.childPagination.timeline.total, 250);
  assert.ok(first.notes.length <= 20); assert.equal(first.childPagination.notes.total, 17);
  assert.equal(first.approvals.length, 20); assert.equal(first.childPagination.approvals.total, 35);
  const older = await getCase('student', ids.studentUserId, ids.caseId, { applicationsPage: 4, tasksPage: 3, taskStatus: 'open', documentRequestsPage: 5, timelinePage: 13, approvalsPage: 2 });
  assert.equal(older.applications.length, 5); assert.equal(older.tasks.length, 15); assert.equal(older.documentRequests.length, 20); assert.equal(older.timeline.length, 10); assert.equal(older.approvals.length, 15);
  const clamped = await getCase('student', ids.studentUserId, ids.caseId, { applicationsLimit: 999, timelineLimit: -1 });
  assert.equal(clamped.childPagination.applications.limit, 50); assert.equal(clamped.childPagination.timeline.limit, 20);
  await assert.rejects(() => getCase('student', new mongoose.Types.ObjectId(), ids.caseId), (error) => error.status === 404);
  const bytes = Buffer.byteLength(JSON.stringify(first));
  assert.ok(bytes < 150000);
  console.log(`P2C3_CASE_PAYLOAD ${JSON.stringify({ initialBytes: bytes, applications: Buffer.byteLength(JSON.stringify(first.applications)), tasks: Buffer.byteLength(JSON.stringify(first.tasks)), documents: Buffer.byteLength(JSON.stringify(first.documentRequests)), timeline: Buffer.byteLength(JSON.stringify(first.timeline)) })}`);
});

test('directory and Case-child execution plans use scoped indexes without collection scans', async () => {
  const baselineExplain = await AgentProfile.aggregate(directoryPipelines[0]).explain('executionStats');
  const combinedPipeline = directoryPipelines.find((pipeline) => JSON.stringify(pipeline).includes('university_application_support'));
  const categoryExplain = await AgentProfile.aggregate(combinedPipeline).explain('executionStats');
  const applicationExplain = await ProfessionalCaseApplication.find({ caseId: ids.caseId }).sort({ createdAt: 1, _id: 1 }).limit(20).explain('executionStats');
  const taskExplain = await CaseTask.find({ caseId: ids.caseId, status: { $in: ['pending', 'in_progress'] } }).sort({ createdAt: -1, _id: -1 }).limit(20).explain('executionStats');
  const documentExplain = await CaseDocumentRequest.find({ caseId: ids.caseId }).sort({ createdAt: -1, _id: -1 }).limit(20).explain('executionStats');
  const timelineExplain = await CaseEvent.find({ caseId: ids.caseId }).sort({ createdAt: 1, _id: 1 }).limit(20).explain('executionStats');
  const plans = { baseline: evidence(baselineExplain), category: evidence(categoryExplain), applications: evidence(applicationExplain), tasks: evidence(taskExplain), documents: evidence(documentExplain), timeline: evidence(timelineExplain) };
  for (const [name, plan] of Object.entries(plans)) assert.equal(plan.collscan, false, `${name} must not COLLSCAN`);
  const response = await getPublicDirectory({ page: 1, limit: 20 });
  console.log(`P2C3_EXECUTION_STATS ${JSON.stringify({ plans, directoryBytes: Buffer.byteLength(JSON.stringify(response)), fixture: { profiles: 250, services: 500, verifications: 250, applications: 65, tasks: 100, documents: 100, timeline: 250 } })}`);
});

test('public directory index provisioning is create-only and idempotent', async () => {
  await AgentProfile.collection.createIndex({ professionalName: 1 }, { name: 'p2c3_keep_me' });
  const first = await provisionMissingIndexes({ collection: AgentProfile.collection, expected: PUBLIC_EDUCATION_DIRECTORY_CRITICAL_INDEXES });
  const second = await provisionMissingIndexes({ collection: AgentProfile.collection, expected: PUBLIC_EDUCATION_DIRECTORY_CRITICAL_INDEXES });
  assert.deepEqual(first.created, []); assert.deepEqual(second.created, []);
  assert.ok((await AgentProfile.collection.indexes()).some((index) => index.name === 'p2c3_keep_me'));
});
