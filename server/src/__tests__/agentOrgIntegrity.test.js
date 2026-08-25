/**
 * STRIDETO Remediation Phase 1 — Agent/Agency Organization Integrity
 *
 * Regression coverage for:
 *   PROFILE-01 through PROFILE-03  — public profile resolution
 *   DIRECTORY-01, DIRECTORY-02     — public directory filtering
 *   MARKETPLACE-01 through MARKETPLACE-03 — publicProjection author identity
 *   SECURITY-01                    — suspended/revoked hard deny unchanged
 *   QA-01                          — qa_test override semantics unchanged
 *
 * No DB / network. All checks are static source analysis or unit logic.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const svc = read('server/src/services/agentProfileService.js');
const mkt = read('server/src/services/agentMarketplaceService.js');

let passed = 0;
async function check(label, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok - ${label}`);
  } catch (e) {
    console.error(`  FAIL - ${label}\n       ${e.message}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// PROFILE-01  Valid profile + active matching membership → public profile works
// ---------------------------------------------------------------------------
await check('PROFILE-01 getPublicProfileBySlug continues to resolve org verification after integrity gate', () => {
  // The membership check must come BEFORE the org/verification data fetch,
  // and the function must still reach the verification fetch when membership is intact.
  const fn = svc.split('export async function getPublicProfileBySlug')[1]
    .split('export async function getPublicDirectory')[0];
  assert.match(fn, /AgentMembership\.exists/, 'membership integrity check must be present');
  assert.match(fn, /getVerificationStatus\(profile\.organizationId\)/, 'verification fetch must follow');
  // Membership check must appear before the verification check in source order
  const membershipPos = fn.indexOf('AgentMembership.exists');
  const verificationPos = fn.indexOf('getVerificationStatus(profile.organizationId)');
  assert.ok(membershipPos < verificationPos, 'membership check must precede verification fetch');
});

// ---------------------------------------------------------------------------
// PROFILE-02  Missing active membership → public profile suppressed
// ---------------------------------------------------------------------------
await check('PROFILE-02 missing active membership triggers 404 and audit event', () => {
  const fn = svc.split('export async function getPublicProfileBySlug')[1]
    .split('export async function getPublicDirectory')[0];
  assert.match(fn, /agent_public_profile_integrity_failure/, 'integrity failure audit event must be emitted');
  assert.match(fn, /err\.status = 404.*Profile not found|Profile not found[\s\S]*err\.status = 404/, 'must 404 on integrity failure');
  // Must not continue to return org/services/trust data
  const integrityBlock = fn.split('agent_public_profile_integrity_failure')[0];
  const afterIntegrity = fn.split('agent_public_profile_integrity_failure')[1];
  assert.match(afterIntegrity, /throw err/, 'must throw after logging integrity failure');
});

// ---------------------------------------------------------------------------
// PROFILE-03  Membership to Org A but profile.organizationId = Org B → Org B data not returned
// ---------------------------------------------------------------------------
await check('PROFILE-03 membership check binds agentAccountId and organizationId together', () => {
  const fn = svc.split('export async function getPublicProfileBySlug')[1]
    .split('export async function getPublicDirectory')[0];
  // The exists() call must use BOTH agentAccountId and organizationId from the profile
  assert.match(fn, /agentAccountId: profile\.agentAccountId[\s\S]*organizationId: profile\.organizationId/, 'must bind both IDs from profile');
  assert.match(fn, /active: true/, 'must require active membership');
});

// ---------------------------------------------------------------------------
// DIRECTORY-01  Invalid profile-to-org membership → excluded from public directory
// ---------------------------------------------------------------------------
await check('DIRECTORY-01 public directory pipeline filters profiles lacking active membership', () => {
  const fn = svc.split('export async function getPublicDirectory')[1]
    .split('export async function domainError')[0];
  assert.match(fn, /AgentMembership\.collection\.name/, 'directory must lookup AgentMembership collection');
  assert.match(fn, /activeMembership\.0.*\$exists.*true|activeMembership.*exists.*true/, 'must filter out profiles with no active membership');
});

// ---------------------------------------------------------------------------
// DIRECTORY-02  Valid profile remains discoverable
// ---------------------------------------------------------------------------
await check('DIRECTORY-02 directory verification gate still requires OrganizationVerification.APPROVED', () => {
  const fn = svc.split('export async function getPublicDirectory')[1]
    .split('export async function domainError')[0];
  // Existing education verification gate must remain
  assert.match(fn, /VERIFICATION_STATUSES\.APPROVED/, 'education verification gate must remain');
  assert.match(fn, /educationVerification\.0.*\$exists.*true|educationVerification.*exists.*true/, 'education verification filter must remain');
  // Membership gate must also be present (not replacing the existing gate)
  assert.match(fn, /activeMembership\.0.*\$exists.*true/, 'membership gate must be additive, not a replacement');
});

// ---------------------------------------------------------------------------
// MARKETPLACE-01  Agency with multiple profiles → publicProjection does NOT pick arbitrary profile
// ---------------------------------------------------------------------------
await check('MARKETPLACE-01 publicProjection uses exact author identity, not bare organizationId', () => {
  const projBlock = mkt.split('async function publicProjection')[1]
    .split('async function resolvePublicReferences')[0];
  // Must NOT contain a bare findOne({ organizationId: post.organizationId }) for profile
  assert.doesNotMatch(projBlock, /AgentProfile\.findOne\(\s*\{\s*organizationId: post\.organizationId\s*\}/, 'bare organizationId profile lookup must be gone');
  // Must use authorAgentAccountId for the profile lookup
  assert.match(projBlock, /agentAccountId: post\.authorAgentAccountId/, 'must use post.authorAgentAccountId for profile resolution');
  assert.match(projBlock, /organizationId: post\.organizationId/, 'must still scope to post.organizationId');
});

// ---------------------------------------------------------------------------
// MARKETPLACE-02  Post author exact match exists → exact author profile projected
// ---------------------------------------------------------------------------
await check('MARKETPLACE-02 publicProjection finds author by agentAccountId + organizationId', () => {
  const projBlock = mkt.split('async function publicProjection')[1]
    .split('async function resolvePublicReferences')[0];
  assert.match(
    projBlock,
    /AgentProfile\.findOne\(\s*\{[\s\S]*agentAccountId: post\.authorAgentAccountId[\s\S]*organizationId: post\.organizationId[\s\S]*\}/,
    'profile lookup must use both authorAgentAccountId and organizationId'
  );
});

// ---------------------------------------------------------------------------
// MARKETPLACE-03  Org-owned post remains valid when original author profile unavailable
// ---------------------------------------------------------------------------
await check('MARKETPLACE-03 moderatePost entitlement fallback uses active membership, not bare org query', () => {
  const moderateBlock = mkt.split('export async function moderatePost')[1]
    .split('export const agentMarketplaceInternals')[0];
  // The original bare findOne({ organizationId }) fallback must be gone
  assert.doesNotMatch(
    moderateBlock,
    /AgentProfile\.findOne\(\s*\{\s*organizationId: post\.organizationId\s*\}/,
    'bare organizationId profile fallback must be removed from moderatePost'
  );
  // Must use active membership-based fallback
  assert.match(moderateBlock, /AgentMembership\.findOne/, 'fallback must go through AgentMembership');
  assert.match(moderateBlock, /active: true/, 'fallback membership must be active');
  assert.match(moderateBlock, /owner.*admin|admin.*owner/, 'fallback must prefer owner/admin role');
});

// ---------------------------------------------------------------------------
// MARKETPLACE-03 (continued) org-owned post publication is NOT conditional on author membership
// ---------------------------------------------------------------------------
await check('MARKETPLACE-03b publication decision does not check author membership for post visibility', () => {
  // The public listing queries use organizationId + publicationStatus + moderationStatus.
  // They must NOT require the original author to still be a member.
  const publicListBlock = mkt.split('export async function listPublicMarketplace')[1]
    .split('export async function getPublicPost')[0];
  assert.doesNotMatch(publicListBlock, /authorAgentAccountId.*membership|membership.*authorAgentAccountId/, 'post listing must not gate on author membership');
});

// ---------------------------------------------------------------------------
// SECURITY-01  Suspended/revoked hard deny is unchanged
// ---------------------------------------------------------------------------
await check('SECURITY-01 suspended/revoked organizations are denied even via qa_test path', () => {
  const fn = svc.split('export async function getPublicProfileBySlug')[1]
    .split('export async function getPublicDirectory')[0];
  // The suspended/revoked check must still exist and come before the qa_test override check
  assert.match(fn, /isSuspendedOrRevoked/, 'suspended/revoked check must remain');
  const suspendPos = fn.indexOf('isSuspendedOrRevoked');
  const qaOverridePos = fn.indexOf('QA_TEST');
  assert.ok(suspendPos < qaOverridePos, 'suspended/revoked hard deny must fire before qa_test check');
});

await check('SECURITY-01b suspended/revoked verification status denies capability', async () => {
  const { isSuspendedOrRevoked, canExercisePrivilegedCapability } = await import('../../../shared/international/verification.js');
  for (const s of ['suspended', 'revoked']) {
    assert.equal(isSuspendedOrRevoked(s), true, `${s} must be treated as suspended/revoked`);
    assert.equal(canExercisePrivilegedCapability(s), false, `${s} must deny capability`);
  }
});

// ---------------------------------------------------------------------------
// QA-01  qa_test override semantics unchanged
// ---------------------------------------------------------------------------
await check('QA-01 qa_test override still allows QA providers through the public profile path', () => {
  const fn = svc.split('export async function getPublicProfileBySlug')[1]
    .split('export async function getPublicDirectory')[0];
  assert.match(fn, /overrideType !== OVERRIDE_TYPES\.QA_TEST/, 'qa_test check must remain');
  assert.match(fn, /qaTestAccess = true/, 'qaTestAccess flag must be set');
  assert.match(fn, /qaTestProvider: true/, 'QA provider flag must be projected');
});

await check('QA-01b qa_test provider is not displayed as organically verified', () => {
  const fn = svc.split('export async function getPublicProfileBySlug')[1]
    .split('export async function getPublicDirectory')[0];
  assert.match(fn, /educationVerified.*!qaTestAccess|!qaTestAccess.*educationVerified/, 'qa_test providers must not receive educationVerified=true');
});

// ---------------------------------------------------------------------------
// Integrity audit event uses no sensitive personal data
// ---------------------------------------------------------------------------
await check('integrity audit event exposes only slug and profileId, no org secrets', () => {
  const fn = svc.split('export async function getPublicProfileBySlug')[1]
    .split('export async function getPublicDirectory')[0];
  const auditBlock = fn.split('agent_public_profile_integrity_failure')[1].split('throw err')[0];
  assert.doesNotMatch(auditBlock, /verificationStatus|organizationId|legalName|email|phone/, 'integrity audit must not log sensitive org fields');
  assert.match(auditBlock, /slug.*profile\.slug|profileId.*profile\._id/, 'integrity audit logs only slug/profileId');
});

if (!process.exitCode) {
  console.log(`\nStrideto Phase 1 Integrity: ${passed}/${passed} tests passed.`);
}
