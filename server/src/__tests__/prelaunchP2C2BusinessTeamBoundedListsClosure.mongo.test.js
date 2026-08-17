import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Organization } from '../models/Organization.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { GbsContextThread } from '../models/gbs/GbsContextThread.js';
import { GbsContextMessage } from '../models/gbs/GbsContextMessage.js';
import { GbsServiceListing } from '../models/gbs/GbsServiceListing.js';
import { listGbsContextMessages, listProviderGbsMessageThreads } from '../services/gbs/gbsContextMessagingService.js';
import { listSubjectListings } from '../services/gbs/serviceListingService.js';
import { getOrgMembers } from '../services/agentProfileService.js';

const TEST_URI = process.env.STRIDETO_P2C2_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_p2c2_business_team_run1';
if (!/\/strideto_p2c2_[a-z0-9_-]+(?:\?|$)/i.test(TEST_URI)) throw new Error('P2C-2 requires a disposable strideto_p2c2_* database');
let subject;
let provider;
let capturedTeamPipeline;

function planEvidence(explain) {
  const indexNames = new Set(); const stats = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.indexName === 'string') indexNames.add(value.indexName);
    if ('totalDocsExamined' in value || 'totalKeysExamined' in value) stats.push({ nReturned: value.nReturned, docs: value.totalDocsExamined, keys: value.totalKeysExamined });
    Object.values(value).forEach(visit);
  };
  visit(explain);
  const serialized = JSON.stringify(explain);
  return { indexNames: [...indexNames], stats, collscan: serialized.includes('COLLSCAN'), blockingSort: serialized.includes('SORT') };
}

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
  const owner = await AgentAccount.create({ email: 'p2c2-owner@example.test', password: 'TestPass123!', accountStatus: 'active' });
  const organization = await Organization.create({ organizationType: 'agency', displayName: 'P2C2 Agency', status: 'active' });
  subject = { subjectType: 'organization', subjectId: String(organization._id) };
  const profile = await AgentProfile.create({ agentAccountId: owner._id, organizationId: organization._id, agentType: 'agency', professionalName: 'P2C2 Agency' });
  const permissions = ['education_mobility.view', 'business_services.view'];
  const ownerMembership = await AgentMembership.create({ organizationId: organization._id, agentAccountId: owner._id, role: 'owner', active: true, domainAccess: [{ domainId: 'education_mobility', permissions }, { domainId: 'business_services', permissions }] });
  provider = { owner, organization, profile, ownerMembership };

  const accounts = await AgentAccount.insertMany(Array.from({ length: 65 }, (_, index) => ({ email: `p2c2-member-${index}@example.test`, password: 'TestPass123!', accountStatus: 'active', createdAt: new Date(1700000000000 + index), updatedAt: new Date(1700000000000 + index) })));
  await AgentMembership.insertMany(accounts.map((account, index) => ({
    organizationId: organization._id, agentAccountId: account._id, role: index % 7 === 0 ? 'admin' : 'member', active: true,
    domainAccess: index % 3 === 0
      ? [{ domainId: 'education_mobility', permissions: ['education_mobility.view'] }]
      : index % 3 === 1
        ? [{ domainId: 'business_services', permissions: ['business_services.view'] }]
        : [{ domainId: 'education_mobility', permissions: ['education_mobility.view'] }, { domainId: 'business_services', permissions: ['business_services.view'] }],
    createdAt: new Date(1700000000000 + index), updatedAt: new Date(1700000000000 + index),
  })));

  const contexts = ['request', 'quote', 'case'];
  const threads = await GbsContextThread.insertMany(Array.from({ length: 75 }, (_, index) => ({
    contextType: contexts[index % 3], contextId: new mongoose.Types.ObjectId(), contextPublicRef: `P2C2-${contexts[index % 3]}-${index}`,
    requesterUserId: new mongoose.Types.ObjectId(), providerSubjectType: subject.subjectType, providerSubjectId: subject.subjectId,
    titleSnapshot: `Conversation ${index}`, lastMessageAt: new Date(1700000000000 + index), createdAt: new Date(1700000000000 + index), updatedAt: new Date(1700000000000 + index),
  })));
  await GbsContextThread.insertMany(Array.from({ length: 5 }, (_, index) => ({ contextType: 'request', contextId: new mongoose.Types.ObjectId(), contextPublicRef: `OTHER-${index}`, requesterUserId: new mongoose.Types.ObjectId(), providerSubjectType: 'agent', providerSubjectId: 'other-provider', titleSnapshot: 'Other', lastMessageAt: new Date() })));
  await GbsContextMessage.insertMany(Array.from({ length: 65 }, (_, index) => ({ threadId: threads[0]._id, senderActorType: 'provider', senderActorId: 'provider-account', text: `Message ${index}`, createdAt: new Date(1700000000000 + index), updatedAt: new Date(1700000000000 + index) })));

  const listingStatuses = ['draft', 'under_review', 'needs_information', 'approved', 'rejected', 'suspended', 'archived'];
  await GbsServiceListing.insertMany(Array.from({ length: 65 }, (_, index) => ({
    ...subject, capabilityId: 'business_formation', countryCode: 'US', jurisdictionId: 'j:US-WY', entityTypeIds: ['et:US-WY:LLC'],
    title: `Listing ${index}`, moderationStatus: listingStatuses[index % listingStatuses.length], publicationStatus: 'private', adminReviewStatus: 'pending',
    createdAt: new Date(1700000000000 + index), updatedAt: new Date(1700000000000 + index),
  })));
  await GbsServiceListing.insertMany(Array.from({ length: 5 }, (_, index) => ({ subjectType: 'agent', subjectId: 'other-provider', capabilityId: 'business_formation', countryCode: 'US', jurisdictionId: 'j:US-WY', title: `Other ${index}`, moderationStatus: 'draft', publicationStatus: 'private', adminReviewStatus: 'pending' })));

  await GbsContextThread.collection.createIndex({ providerSubjectType: 1, providerSubjectId: 1, lastMessageAt: -1 }, { name: 'gbs_message_thread_provider_inbox' });
  await GbsContextMessage.collection.createIndex({ threadId: 1, createdAt: -1, _id: -1 }, { name: 'gbs_context_message_thread_created' });
  await GbsServiceListing.collection.createIndex({ subjectType: 1, subjectId: 1, moderationStatus: 1, updatedAt: -1 });
  await AgentMembership.collection.createIndex({ organizationId: 1, agentAccountId: 1 }, { unique: true });
  mongoose.set('debug', (collection, method, query) => { if (collection === AgentMembership.collection.name && method === 'aggregate') capturedTeamPipeline = query; });
});

after(async () => { mongoose.set('debug', false); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

test('Request, Quote, and Case thread windows are bounded, filtered, stable, and isolated', async () => {
  const first = await listProviderGbsMessageThreads({ subject, query: { page: 1, limit: 20 } });
  const last = await listProviderGbsMessageThreads({ subject, query: { page: 4, limit: 20 } });
  assert.equal(first.total, 75); assert.equal(first.items.length, 20); assert.equal(first.totalPages, 4); assert.equal(last.items.length, 15);
  assert.equal(new Set([...first.items, ...last.items].map((row) => row.id)).size, 35);
  for (const contextType of ['request', 'quote', 'case']) {
    const filtered = await listProviderGbsMessageThreads({ subject, query: { contextType, page: 2, limit: 10 } });
    assert.equal(filtered.total, 25); assert.equal(filtered.items.length, 10); assert.ok(filtered.items.every((row) => row.contextType === contextType));
  }
  const outsider = await listProviderGbsMessageThreads({ subject: { subjectType: 'agent', subjectId: 'absent' }, query: {} });
  assert.equal(outsider.total, 0);
  await assert.rejects(() => listProviderGbsMessageThreads({ subject, query: { contextType: 'education_case' } }), (error) => error.code === 'invalid_message_context');
});

test('message history remains independently bounded at 20/50', async () => {
  const thread = await GbsContextThread.findOne({ providerSubjectId: subject.subjectId, contextType: 'request' }).lean();
  const contextModel = mongoose.connection.collection('gbsservicerequests');
  await contextModel.insertOne({ _id: thread.contextId, publicRequestRef: thread.contextPublicRef, requesterUserId: thread.requesterUserId, providerSubjectType: subject.subjectType, providerSubjectId: subject.subjectId, titleSnapshot: thread.titleSnapshot });
  const result = await listGbsContextMessages({ contextType: 'request', contextRef: thread.contextPublicRef, actor: { type: 'provider', id: 'provider-account', ...subject }, query: { page: 1, limit: 999 } });
  assert.equal(result.limit, 50); assert.equal(result.total, 65); assert.equal(result.items.length, 50);
});

test('Provider listings expose bounded pages, canonical filters, and exact subject isolation', async () => {
  const first = await listSubjectListings({ ...subject, page: 1, limit: 20 });
  const last = await listSubjectListings({ ...subject, page: 4, limit: 20 });
  assert.equal(first.total, 65); assert.equal(first.totalPages, 4); assert.equal(first.items.length, 20); assert.equal(last.items.length, 5);
  const tooLarge = await listSubjectListings({ ...subject, page: -4, limit: 999 });
  assert.equal(tooLarge.page, 1); assert.equal(tooLarge.limit, 50);
  const draft = await listSubjectListings({ ...subject, moderationStatus: 'draft', page: 1, limit: 20 });
  assert.ok(draft.items.every((row) => row.moderationStatus === 'draft'));
  const other = await listSubjectListings({ subjectType: 'agent', subjectId: 'other-provider' });
  assert.equal(other.total, 5);
});

test('Business and Education Team pages are bounded and domain-isolated', async () => {
  const business1 = await getOrgMembers(provider.owner._id, { focusDomainId: 'business_services', page: 1, limit: 20 });
  const business2 = await getOrgMembers(provider.owner._id, { focusDomainId: 'business_services', page: 2, limit: 20 });
  const education = await getOrgMembers(provider.owner._id, { focusDomainId: 'education_mobility', page: 1, limit: 20 });
  assert.equal(business1.members.length, 20); assert.ok(business1.total > 40); assert.ok(business1.totalPages > 2);
  assert.equal(new Set([...business1.members, ...business2.members].map((row) => String(row._id))).size, 40);
  assert.ok(business1.members.every((row) => row.domainAccess.some((entry) => entry.domainId === 'business_services')));
  assert.ok(education.members.every((row) => row.domainAccess.some((entry) => entry.domainId === 'education_mobility')));
  const bounded = await getOrgMembers(provider.owner._id, { page: 0, limit: 999 });
  assert.equal(bounded.page, 1); assert.equal(bounded.limit, 50); assert.equal(bounded.members.length, 50);
  const searched = await getOrgMembers(provider.owner._id, { q: 'member-64', page: 1, limit: 20 });
  assert.equal(searched.total, 1); assert.ok(capturedTeamPipeline);
});

test('thread, listing, and Team query plans use indexes without collection scans', async () => {
  const threadExplain = await GbsContextThread.find({ providerSubjectType: subject.subjectType, providerSubjectId: subject.subjectId }).sort({ lastMessageAt: -1, _id: -1 }).limit(20).explain('executionStats');
  const listingExplain = await GbsServiceListing.find(subject).sort({ updatedAt: -1, _id: -1 }).limit(20).explain('executionStats');
  const teamExplain = await AgentMembership.aggregate(capturedTeamPipeline).explain('executionStats');
  const evidence = { thread: planEvidence(threadExplain), listing: planEvidence(listingExplain), team: planEvidence(teamExplain) };
  assert.equal(evidence.thread.collscan, false); assert.equal(evidence.listing.collscan, false); assert.equal(evidence.team.collscan, false);
  const threadPage = await listProviderGbsMessageThreads({ subject, query: { page: 1, limit: 20 } });
  const listingPage = await listSubjectListings({ ...subject, page: 1, limit: 20 });
  const teamPage = await getOrgMembers(provider.owner._id, { focusDomainId: 'business_services', page: 1, limit: 20 });
  const sizes = { thread: Buffer.byteLength(JSON.stringify(threadPage)), listing: Buffer.byteLength(JSON.stringify(listingPage)), team: Buffer.byteLength(JSON.stringify(teamPage)) };
  assert.ok(Object.values(sizes).every((bytes) => bytes < 100000));
  console.log(`P2C2_EXECUTION_STATS ${JSON.stringify({ evidence, sizes, operations: { thread: 2, listing: 2, team: 3 } })}`);
});
