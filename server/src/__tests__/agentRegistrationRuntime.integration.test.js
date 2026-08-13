import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

const TEST_URI = process.env.STRIDETO_AGENT_REGISTRATION_TEST_MONGO_URI || '';
if (!/\/strideto_agent_registration_runtime_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_AGENT_REGISTRATION_TEST_MONGO_URI must name a disposable strideto_agent_registration_runtime_* database');
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'agent-registration-test-access-secret-0001';
process.env.REFRESH_SECRET = 'agent-registration-test-refresh-secret-0002';

const { createAgentRegisterHandler } = await import('../controllers/agentAuthController.js');
const { AgentAccount } = await import('../models/agent/AgentAccount.js');
const { AgentProfile } = await import('../models/agent/AgentProfile.js');
const { AgentMembership } = await import('../models/agent/AgentMembership.js');
const { Organization } = await import('../models/Organization.js');
const { OrganizationVerification } = await import('../models/OrganizationVerification.js');

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const handler = createAgentRegisterHandler({
  writeAudit: async () => {},
  issueSession: async (_res, account) => ({
    ok: true,
    body: {
      account: { _id: account._id, email: account.email, accountStatus: account.accountStatus },
      accessToken: 'disposable-test-token',
      expiresIn: '15m',
    },
  }),
});

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: true });
  await mongoose.connection.dropDatabase();
  await Promise.all([
    AgentAccount.init(), AgentProfile.init(), AgentMembership.init(),
    Organization.init(), OrganizationVerification.init(),
  ]);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('valid Agent registration succeeds beside a same-email Student in restricted onboarding', async () => {
  const email = 'same-representative@example.test';
  await mongoose.connection.collection('users').insertOne({
    email,
    name: 'Disposable Student Realm Subject',
    role: 'User',
  });

  const res = responseDouble();
  await handler({
    body: {
      email: email.toUpperCase(),
      password: 'ValidPass9',
      displayName: 'Disposable Agent Practice',
      agentType: 'agent',
      countryCode: 'pk',
      acceptedTerms: true,
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.accepted, true);
  assert.equal(res.body.requiresVerification, true);
  assert.equal(res.body.accessToken, undefined);
  const [account, organization, profile, membership, verification] = await Promise.all([
    AgentAccount.findOne({ email }).lean(),
    Organization.findOne({ displayName: 'Disposable Agent Practice' }).lean(),
    AgentProfile.findOne({}).lean(),
    AgentMembership.findOne({}).lean(),
    OrganizationVerification.findOne({}).lean(),
  ]);
  assert.ok(account && organization && profile && membership && verification);
  assert.equal(organization.status, 'draft');
  assert.equal(verification.status, 'draft');
  assert.equal(membership.role, 'owner');
  assert.equal(membership.active, true);
  assert.equal(String(profile.organizationId), String(organization._id));
  assert.equal(await mongoose.connection.collection('users').countDocuments({ email }), 1);
});

test('same-realm duplicate is a non-enumerating 201 and creates no second organization', async () => {
  const beforeCount = await Organization.countDocuments();
  const res = responseDouble();
  await handler({
    body: {
      email: 'same-representative@example.test',
      password: 'ValidPass9',
      displayName: 'Must Not Be Created',
      agentType: 'agency',
      countryCode: 'GB',
      acceptedTerms: true,
    },
  }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.accepted, true);
  assert.equal(res.body.requiresVerification, true);
  assert.doesNotMatch(JSON.stringify(res.body), /already exists|already registered/i);
  assert.equal(await Organization.countDocuments(), beforeCount);
});

test('invalid country and weak password return actionable 422 responses', async () => {
  const countryRes = responseDouble();
  await handler({ body: {
    email: 'invalid-country@example.test', password: 'ValidPass9',
    displayName: 'Invalid Country', agentType: 'agent', countryCode: 'XX', acceptedTerms: true,
  } }, countryRes);
  assert.equal(countryRes.statusCode, 422);
  assert.match(countryRes.body.error, /ISO 3166-1/);

  const passwordRes = responseDouble();
  await handler({ body: {
    email: 'weak-password@example.test', password: 'alllowercase',
    displayName: 'Weak Password', agentType: 'agent', countryCode: 'PK', acceptedTerms: true,
  } }, passwordRes);
  assert.equal(passwordRes.statusCode, 422);
  assert.match(passwordRes.body.error, /uppercase/);
});
