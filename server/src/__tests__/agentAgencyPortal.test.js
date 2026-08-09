/** Mission 11 — Agent / Agency Portal focused acceptance tests. No DB/network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.STRIDETO_SECURE_AUTH_ENABLED = '1';
process.env.JWT_SECRET = 'z'.repeat(32);
process.env.REFRESH_SECRET = 'y'.repeat(32);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const source = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const constants = await import('../../../shared/agent/constants.js');
const verification = await import('../../../shared/international/verification.js');
const organization = await import('../../../shared/international/organization.js');
const { createJwtSessionProvider } = await import('../services/auth/JwtSessionProvider.js');
const { createSessionSubjectStateProvider } = await import('../services/auth/SessionSubjectStateProvider.js');
const { createAuthCookiePolicy } = await import('../services/auth/AuthCookiePolicy.js');
const { requireAgentAuth } = await import('../middleware/auth.js');
const { agentProfileServiceInternals } = await import('../services/agentProfileService.js');
const { canAccessDocument, canDownloadVersion } = await import('../services/vault/vaultAccessPolicy.js');
const { DocumentAccessGrant } = await import('../models/vault/DocumentAccessGrant.js');

let passed = 0;
async function check(label, fn) {
  try { await fn(); passed += 1; console.log(`  ok - ${label}`); }
  catch (error) { console.error(`  FAIL - ${label}\n       ${error.message}`); process.exitCode = 1; }
}

const jwtConfig = (prefix, audience) => ({
  accessSecret: prefix.repeat(32), refreshSecret: prefix.toUpperCase().repeat(32),
  issuer: 'strideto-api', accessAudience: `${audience}-access`, refreshAudience: `${audience}-refresh`,
});
const agentJwt = createJwtSessionProvider(jwtConfig('a', 'agent'));
const userJwt = createJwtSessionProvider(jwtConfig('b', 'user'));
const claims = { sub: '507f1f77bcf86cd799439011', realm: 'agent', sid: '507f1f77bcf86cd799439012', tokenVersion: 0 };

await check('1 Agent realm issues and verifies isolated access tokens', () => {
  const token = agentJwt.issueAccessToken(claims).token;
  assert.equal(agentJwt.verifyAccessToken(token).realm, 'agent');
  assert.throws(() => userJwt.verifyAccessToken(token));
});
await check('2 refresh cookie is isolated to Agent path/name', () => {
  const policy = createAuthCookiePolicy({ mode: 'development', apiOrigin: '', trustedOrigins: [], maxAgeMs: 1000 });
  assert.equal(policy.getCookiePath('agent'), '/api/auth/agent/refresh-token');
  assert.match(policy.getCookieName('agent'), /agent_rt$/);
});
await check('3 Agent authoritative session state uses AgentAccount model', async () => {
  let called = false;
  const model = { async findById() { called = true; return { accountStatus: 'active', tokenVersion: 0 }; } };
  const fallback = { async findById() { throw new Error('wrong realm'); } };
  const provider = createSessionSubjectStateProvider({ userModel: fallback, employerModel: fallback, agentModel: model });
  assert.equal((await provider.getSubjectState({ realm: 'agent', subjectId: claims.sub, expectedTokenVersion: 0 })).code, 'SUBJECT_ACTIVE');
  assert.equal(called, true);
});
function middlewareStatus(req) { let status = 200; requireAgentAuth(req, { status(code) { status = code; return this; }, json() {} }, () => {}); return status; }
await check('4 User realm is rejected from Agent mutations', () => assert.equal(middlewareStatus({ user: { userId: claims.sub } }), 401));
await check('5 Employer realm is rejected from Agent mutations', () => assert.equal(middlewareStatus({ employer: { employerId: claims.sub } }), 401));
await check('6 Agent realm passes Agent mutation guard', () => assert.equal(middlewareStatus({ agent: { agentAccountId: claims.sub } }), 200));
await check('7 agent/agency are canonical Organization types', () => {
  assert.equal(organization.validateOrganizationCore({ organizationType: 'agent', displayName: 'A' }).ok, true);
  assert.equal(organization.validateOrganizationCore({ organizationType: 'agency', displayName: 'B' }).ok, true);
});
await check('8 profile linkage enforces matching organization type', () => assert.match(source('server/src/services/agentProfileService.js'), /type !== org\.organizationType/));
await check('9 registration creates organization owner membership', () => assert.match(source('server/src/controllers/agentAuthController.js'), /role: 'owner'/));
await check('10 cross-tenant mutations include organization scope', () => assert.match(source('server/src/services/agentProfileService.js'), /_id: serviceId,[\s\S]*organizationId: profile\.organizationId/));
await check('11 pre-approval service creation is draft-only', () => assert.match(source('server/src/services/agentProfileService.js'), /status: AGENT_SERVICE_STATUSES\.DRAFT/));
await check('12 activation calls the canonical approval gate', () => assert.match(source('server/src/services/agentProfileService.js'), /data\.status === AGENT_SERVICE_STATUSES\.ACTIVE[\s\S]*assertApprovedVerification/));
await check('13 only approved verification unlocks capability', () => assert.equal(verification.canExercisePrivilegedCapability('approved'), true));
await check('14 pending verification denies capability', () => assert.equal(verification.canExercisePrivilegedCapability('under_review'), false));
await check('15 suspended/revoked/expired all deny capability', () => ['suspended', 'revoked', 'expired'].forEach((status) => assert.equal(verification.canExercisePrivilegedCapability(status), false)));
await check('16 completeness is explainable and independent of verification', () => {
  const full = Object.fromEntries(constants.COMPLETENESS_SECTIONS.map(({ key }) => [key, key === 'yearsOfExperience' ? 0 : key === 'officeLocation' ? { city: 'Lahore' } : 'value']));
  const result = agentProfileServiceInternals.computeCompleteness(full);
  assert.equal(result.score, 100); assert.equal(result.missing.length, 0);
  assert.equal('verificationStatus' in result, false);
});
await check('17 guarantee claims are rejected by normalized phrase checks', () => ['Guaranteed visa', 'guarantee admission', 'scholarship guarantee', 'guaranteed overseas job'].forEach((text) => assert.equal(agentProfileServiceInternals.containsGuaranteeLanguage(text), true)));
await check('18 trust badges derive only from accepted evidence', () => {
  assert.deepEqual(verification.deriveBadges([{ evidenceType: 'identity', status: 'pending' }]), []);
  assert.deepEqual(verification.deriveBadges([{ evidenceType: 'identity', status: 'accepted' }]), ['identity_verified']);
});
await check('19 public profile visibility uses Mission 2 approval, not profile completeness', () => assert.match(source('server/src/services/agentProfileService.js'), /getVerificationStatus\(profile\.organizationId\)[\s\S]*canExercisePrivilegedCapability/));
await check('20 public directory queries approved organizations only', () => assert.match(source('server/src/services/agentProfileService.js'), /status: VERIFICATION_STATUSES\.APPROVED/));
await check('21 public projection excludes internal and evidence fields', () => {
  const block = source('server/src/services/agentProfileService.js').split('export async function getPublicProfileBySlug')[1].split('export async function getPublicDirectory')[0];
  assert.doesNotMatch(block, /credentialReferences:/); assert.doesNotMatch(block, /officialEmail:/); assert.doesNotMatch(block, /riskLevel:/);
});
await check('22 team role and status mutations are organization-scoped', () => {
  const text = source('server/src/services/agentProfileService.js'); assert.match(text, /updateMemberRole/); assert.match(text, /updateMemberStatus/); assert.match(text, /organizationId: profile\.organizationId/);
});
await check('23 arbitrary User browsing has no Agent route', () => assert.doesNotMatch(source('server/src/routes/agent.js'), /agent\/users|users\/search/));
await check('24 relationships return no Student Profile or Vault population', () => {
  const block = source('server/src/services/agentProfileService.js').split('export async function getLeads')[1].split('export async function updateLeadStatus')[0]; assert.doesNotMatch(block, /populate|StudentProfile|Vault/);
});
await check('25 relationship queries and directory are bounded', () => {
  const text = source('server/src/services/agentProfileService.js'); assert.match(text, /Math\.min\(50/); assert.match(text, /\.limit\(limitNum\)/);
});
await check('26 Agent and relationships have zero implicit Vault access', async () => assert.deepEqual(await canAccessDocument({ actor: { type: 'agent', id: 'agent-1' }, document: { _id: 'doc-1', ownerUserId: 'user-1', status: 'active' } }), { allowed: false, reason: 'no_grant' }));
const originalFindById = DocumentAccessGrant.findById;
await check('27 exact active grant permits only its document and grantee type', async () => {
  DocumentAccessGrant.findById = () => ({ lean: async () => ({ _id: 'grant-1', documentId: 'doc-1', granteeType: 'agent', granteeId: 'agent-1', status: 'active', revokedAt: null, expiresAt: null, permissions: ['view'] }) });
  assert.equal((await canAccessDocument({ actor: { type: 'agent', id: 'agent-1' }, document: { _id: 'doc-1', ownerUserId: 'user-1', status: 'active' }, grantId: 'grant-1' })).allowed, true);
  assert.equal((await canAccessDocument({ actor: { type: 'agent', id: 'agent-1' }, document: { _id: 'doc-2', ownerUserId: 'user-1', status: 'active' }, grantId: 'grant-1' })).allowed, false);
});
await check('28 revoked/expired/wrong-realm grants deny', async () => {
  for (const grant of [
    { status: 'revoked', revokedAt: new Date(), granteeType: 'agent' },
    { status: 'active', expiresAt: new Date(Date.now() - 1000), granteeType: 'agent' },
    { status: 'active', granteeType: 'user' },
  ]) {
    DocumentAccessGrant.findById = () => ({ lean: async () => ({ _id: 'g', documentId: 'doc-1', granteeId: 'agent-1', revokedAt: null, expiresAt: null, permissions: ['view'], ...grant }) });
    assert.equal((await canAccessDocument({ actor: { type: 'agent', id: 'agent-1' }, document: { _id: 'doc-1', ownerUserId: 'u', status: 'active' }, grantId: 'g' })).allowed, false);
  }
});
DocumentAccessGrant.findById = originalFindById;
await check('29 scanner policy still blocks rejected downloads', () => assert.equal(canDownloadVersion({ scanStatus: 'rejected' }), false));
await check('30 audit metadata and UI/router contracts are safe and complete', () => {
  const service = source('server/src/services/agentProfileService.js'); assert.doesNotMatch(service, /metadata:\s*\{[^}]*password/); assert.match(service, /actor: \{ userId: agentAccountId, role: 'agent' \}/);
  const routes = source('client/src/routes/index.jsx'); for (const page of ['AgentServices', 'AgentVerification', 'AgentTeam', 'AgentLeads', 'AgentClients', 'AgentSettings', 'AgentDirectory', 'AgentPublicProfile']) assert.match(routes, new RegExp(page));
});

if (!process.exitCode) console.log(`\nMission 11 Agent / Agency Portal: ${passed}/30 tests passed.`);
