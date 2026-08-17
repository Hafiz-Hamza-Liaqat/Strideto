import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { UserCapabilityGrant } from '../models/capability/UserCapabilityGrant.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { Organization } from '../models/Organization.js';
import { ProviderCapability } from '../models/gbs/ProviderCapability.js';
import { ProviderDomainEnrollment } from '../models/gbs/ProviderDomainEnrollment.js';
import { GbsServiceListing } from '../models/gbs/GbsServiceListing.js';
import { GbsServiceRequest } from '../models/gbs/GbsServiceRequest.js';
import { GbsQuote } from '../models/gbs/GbsQuote.js';
import { GbsCase } from '../models/gbs/GbsCase.js';
import { GbsContextThread } from '../models/gbs/GbsContextThread.js';
import { GbsContextMessage } from '../models/gbs/GbsContextMessage.js';
import { IdempotencyRecord } from '../models/platform/IdempotencyRecord.js';
import { UserNotification } from '../models/UserNotification.js';
import { createCustomerServiceRequest, getPrivateBetaServiceEntry } from '../services/gbs/gbsServiceRequestService.js';

const currentReviewedFixture = () => ({ productionReady: true, state: 'current_reviewed', reason: 'current_reviewed' });
import { createGbsContextMessage, listGbsContextMessages } from '../services/gbs/gbsContextMessagingService.js';
import { provisionMissingIndexes, GBS_CONTEXT_MESSAGE_CRITICAL_INDEXES, GBS_CONTEXT_THREAD_CRITICAL_INDEXES, GBS_SERVICE_REQUEST_CRITICAL_INDEXES } from '../services/platform/criticalIndexProvision.js';
import { GBS_MESSAGE_ACTOR_TYPES, GBS_MESSAGE_CONTEXT_TYPES } from '../../../shared/gbs/contextMessaging.js';

const TEST_URI = process.env.STRIDETO_P1B_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_p1b_intake_messaging_run1';
if (!/\/strideto_p1b_[a-z0-9_-]+(?:\?|$)/i.test(TEST_URI)) throw new Error('P1B requires a disposable strideto_p1b_* database');

let buyer; let otherBuyer; let provider; let listing;
const subject = () => ({ subjectType: 'agent', subjectId: String(provider._id) });
const buyerActor = (id) => ({ type: GBS_MESSAGE_ACTOR_TYPES.BUSINESS_CLIENT, id: String(id) });
const providerActor = (id = provider._id) => ({ type: GBS_MESSAGE_ACTOR_TYPES.PROVIDER, id: String(id), ...subject() });

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(), UserCapabilityGrant.init(), AgentAccount.init(), AgentProfile.init(), Organization.init(),
    ProviderCapability.init(), ProviderDomainEnrollment.init(), GbsServiceListing.init(), GbsServiceRequest.init(),
    IdempotencyRecord.init(), UserNotification.init(),
  ]);
  await provisionMissingIndexes({ collection: GbsContextThread.collection, expected: GBS_CONTEXT_THREAD_CRITICAL_INDEXES });
  await provisionMissingIndexes({ collection: GbsContextMessage.collection, expected: GBS_CONTEXT_MESSAGE_CRITICAL_INDEXES });
  await provisionMissingIndexes({ collection: GbsServiceRequest.collection, expected: GBS_SERVICE_REQUEST_CRITICAL_INDEXES });

  buyer = await User.create({ email: 'p1b-buyer@example.test', password: 'TestPass123!', name: 'P1B Buyer', role: 'User' });
  otherBuyer = await User.create({ email: 'p1b-other@example.test', password: 'TestPass123!', name: 'Other Buyer', role: 'User' });
  for (const user of [buyer, otherBuyer]) {
    await UserCapabilityGrant.create({ userId: user._id, capability: 'business_client', status: 'active', grantedAt: new Date(), grantedBy: String(user._id), grantReason: 'p1b_test' });
  }
  provider = await AgentAccount.create({ email: 'p1b-provider@example.test', password: 'TestPass123!', accountStatus: 'active' });
  const home = await Organization.create({ organizationType: 'agent', displayName: 'P1B Provider', status: 'active' });
  await AgentProfile.create({ agentAccountId: provider._id, organizationId: home._id, agentType: 'agent', professionalName: 'P1B Provider', providerDomainInitializationState: 'ready' });
  const scope = { serviceCategoryIds: [], countryCodes: ['US'], jurisdictionIds: ['j:US-WY'], entityTypeIds: ['et:US-WY:LLC'], protectedTitleIds: [], flags: { registered_agent: false, registered_office: false } };
  await ProviderDomainEnrollment.create({ ...subject(), domainId: 'business_services', status: 'active' });
  await ProviderCapability.create({ ...subject(), capabilityId: 'business_formation', status: 'active', trustStatus: 'verified', scope });
  listing = await GbsServiceListing.create({ ...subject(), capabilityId: 'business_formation', countryCode: 'US', jurisdictionId: 'j:US-WY', entityTypeIds: ['et:US-WY:LLC'], title: 'Private formation support', shortDescription: 'Private beta support', description: 'Private beta support for an eligible client.', deliveryMode: 'remote', languages: ['en'], pricingMode: 'quote_required', publicSlug: 'p1b-private-formation', moderationStatus: 'approved', adminReviewStatus: 'approved', publicationStatus: 'private', scope, creationCommandId: 'p1b-listing-command' });
});

after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

test('private intake works with marketplace off while public intake remains closed and idempotent', async () => {
  const entry = await getPrivateBetaServiceEntry({ userId: buyer._id, listingSlug: listing.publicSlug, env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' }, readinessResolver: currentReviewedFixture });
  assert.equal(entry.privateBeta, true);
  const body = { listingSlug: listing.publicSlug, creationCommandId: 'p1b-request-command', actingFor: 'self', entityTypeId: 'et:US-WY:LLC', customerSummary: 'Need formation preparation.' };
  const first = await createCustomerServiceRequest({ userId: buyer._id, body, intakeChannel: 'private_beta', env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' }, readinessResolver: currentReviewedFixture });
  const replay = await createCustomerServiceRequest({ userId: buyer._id, body, intakeChannel: 'private_beta', env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' }, readinessResolver: currentReviewedFixture });
  assert.equal(first.publicRequestRef, replay.publicRequestRef);
  assert.equal(first.intakeChannel, 'private_beta');
  await assert.rejects(() => createCustomerServiceRequest({ userId: buyer._id, body: { ...body, creationCommandId: 'p1b-public-command' }, env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' } }), (error) => error.status === 404);
});

test('request messages are exact-context, sanitized, bounded, and fail closed across customers/providers', async () => {
  const request = await GbsServiceRequest.findOne({ requesterUserId: buyer._id });
  const contextRef = request.publicRequestRef;
  const sent = await createGbsContextMessage({ contextType: GBS_MESSAGE_CONTEXT_TYPES.REQUEST, contextRef, actor: buyerActor(buyer._id), body: { text: '<b>Hello</b> provider' } });
  assert.equal(sent.text, 'Hello provider');
  await createGbsContextMessage({ contextType: GBS_MESSAGE_CONTEXT_TYPES.REQUEST, contextRef, actor: providerActor(), body: { text: 'Hello client' } });
  const result = await listGbsContextMessages({ contextType: GBS_MESSAGE_CONTEXT_TYPES.REQUEST, contextRef, actor: buyerActor(buyer._id), query: { limit: 1 } });
  assert.equal(result.items.length, 1);
  assert.equal(result.total, 2);
  await assert.rejects(() => listGbsContextMessages({ contextType: GBS_MESSAGE_CONTEXT_TYPES.REQUEST, contextRef, actor: buyerActor(otherBuyer._id) }), (error) => error.status === 404);
  const otherProvider = new mongoose.Types.ObjectId();
  await assert.rejects(() => listGbsContextMessages({ contextType: GBS_MESSAGE_CONTEXT_TYPES.REQUEST, contextRef, actor: { ...providerActor(otherProvider), subjectId: String(otherProvider) } }), (error) => error.status === 404);
});

test('Quote and Case conversations remain distinct and retain historical access', async () => {
  const request = await GbsServiceRequest.findOne({ requesterUserId: buyer._id });
  const quoteId = new mongoose.Types.ObjectId();
  const caseId = new mongoose.Types.ObjectId();
  await GbsQuote.collection.insertOne({
    _id: quoteId, publicQuoteRef: 'P1B-QUOTE-REF', serviceRequestId: request._id,
    requesterUserId: buyer._id, ...subject(), titleSnapshot: 'Private formation support',
    status: 'accepted', createdAt: new Date(), updatedAt: new Date(),
  });
  await GbsCase.collection.insertOne({
    _id: caseId, publicCaseRef: 'P1B-CASE-REF', quoteId, serviceRequestId: request._id,
    requesterUserId: buyer._id, ...subject(), titleSnapshot: 'Private formation support',
    status: 'in_progress', createdAt: new Date(), updatedAt: new Date(),
  });
  await createGbsContextMessage({ contextType: GBS_MESSAGE_CONTEXT_TYPES.QUOTE, contextRef: 'P1B-QUOTE-REF', actor: buyerActor(buyer._id), body: { text: 'Accepted quote question' } });
  await createGbsContextMessage({ contextType: GBS_MESSAGE_CONTEXT_TYPES.CASE, contextRef: 'P1B-CASE-REF', actor: buyerActor(buyer._id), body: { text: 'Case preparation update' } });
  const quote = await listGbsContextMessages({ contextType: GBS_MESSAGE_CONTEXT_TYPES.QUOTE, contextRef: 'P1B-QUOTE-REF', actor: buyerActor(buyer._id) });
  const gbsCase = await listGbsContextMessages({ contextType: GBS_MESSAGE_CONTEXT_TYPES.CASE, contextRef: 'P1B-CASE-REF', actor: buyerActor(buyer._id) });
  assert.equal(quote.items[0].text, 'Accepted quote question');
  assert.equal(gbsCase.items[0].text, 'Case preparation update');
  assert.notEqual(quote.context.contextType, gbsCase.context.contextType);
  await assert.rejects(() => listGbsContextMessages({ contextType: GBS_MESSAGE_CONTEXT_TYPES.CASE, contextRef: 'P1B-CASE-REF', actor: buyerActor(otherBuyer._id) }), (error) => error.status === 404);
});

test('critical message index provisioning is idempotent and models keep autoIndex off', async () => {
  const threads = await provisionMissingIndexes({ collection: GbsContextThread.collection, expected: GBS_CONTEXT_THREAD_CRITICAL_INDEXES });
  const messages = await provisionMissingIndexes({ collection: GbsContextMessage.collection, expected: GBS_CONTEXT_MESSAGE_CRITICAL_INDEXES });
  assert.deepEqual(threads.created, []);
  assert.deepEqual(messages.created, []);
  assert.equal(GbsContextThread.schema.options.autoIndex, false);
  assert.equal(GbsContextMessage.schema.options.autoIndex, false);
});
