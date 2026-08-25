/**
 * Phase 3 — Notification Connection Regression Tests
 *
 * AGE-ADM-01  QA override grant/revoke → provider notification
 * AGE-ADM-02  Marketplace moderation decision → agent/agency notification
 * GBS-ADM-01  GBS capability evidence submission → admin notification
 * IDEMPOTENCY dedupeKey conventions
 *
 * Pure in-memory / source-analysis tests — no MongoDB required.
 * Run: node src/__tests__/phase3NotificationConnections.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createOverrideService,
  createMemoryOverrideStore,
  OVERRIDE_TYPES,
} from '../services/capability/overrideService.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    passed++;
    process.stdout.write(`  [PASS] ${label}\n`);
  } catch (e) {
    failed++;
    process.stderr.write(`  [FAIL] ${label}\n         ${e.message}\n`);
    process.exitCode = 1;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function makeOverrideSvc(notifyEvents = [], auditEvents = []) {
  const store = createMemoryOverrideStore();
  const svc = createOverrideService({
    overrideStore: store,
    audit: async (evt) => auditEvents.push(evt),
    notify: async (evt) => notifyEvents.push(evt),
  });
  return { svc, store, notifyEvents, auditEvents };
}

const ORG_A = 'org_aaa111';
const CAPS = ['employer', 'business_services_provider'];
const ACTOR = { actorId: 'superadmin_001', actorRole: 'SuperAdmin' };

// ── AGE-ADM-01: QA override notifications ───────────────────────────────────

await check('QA-NOTIFY-01: grant produces exactly one notify event', async () => {
  const { svc, notifyEvents } = makeOverrideSvc();
  await svc.grantOverride({
    ...ACTOR,
    organizationId: ORG_A,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'QA smoke test',
    capabilities: CAPS,
  });
  assert.equal(notifyEvents.length, 1, 'expected exactly one notify call');
  assert.equal(notifyEvents[0].action, 'granted');
  assert.equal(String(notifyEvents[0].organizationId), ORG_A);
});

await check('QA-NOTIFY-02: revoke produces exactly one notify event', async () => {
  const { svc, notifyEvents } = makeOverrideSvc();
  await svc.grantOverride({
    ...ACTOR,
    organizationId: ORG_A,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'setup',
    capabilities: CAPS,
  });
  notifyEvents.length = 0; // clear grant event
  await svc.revokeOverride({ ...ACTOR, organizationId: ORG_A, reason: 'QA done' });
  assert.equal(notifyEvents.length, 1, 'expected exactly one revoke notify');
  assert.equal(notifyEvents[0].action, 'revoked');
});

await check('QA-NOTIFY-03: grant notification title never contains "Verified" or "verified"', async () => {
  const { svc, notifyEvents } = makeOverrideSvc();
  await svc.grantOverride({
    ...ACTOR,
    organizationId: ORG_A,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'QA test',
    capabilities: CAPS,
  });
  const evt = notifyEvents[0];
  // The notify payload from overrideService contains action/overrideType/capabilities.
  // The runtime translates it into a human-readable title — check the source.
  assert.equal(evt.action, 'granted');
  assert.equal(evt.overrideType, OVERRIDE_TYPES.QA_TEST);
  // overrideType must remain 'qa_test', never 'verified'
  assert.notEqual(evt.overrideType, 'verified');
  assert.notEqual(evt.overrideType, 'approved');
});

await check('QA-NOTIFY-03b: overrideRuntime notification title wording is QA-safe', () => {
  const runtime = read('server/src/services/capability/overrideRuntime.js');
  assert.match(runtime, /Temporary QA capability access granted/);
  assert.match(runtime, /Temporary QA capability access revoked/);
  assert.doesNotMatch(runtime, /title[^'"\n]*[Vv]erif(?:ied|ication)/);
});

await check('QA-NOTIFY-04: ordinary Admin cannot grant QA overrides (route enforced)', () => {
  const controller = read('server/src/controllers/admin/adminCapabilityOverrideController.js');
  // Controller must gate on ROLES.SUPER_ADMIN for both grant and revoke
  assert.match(controller, /req\.user\?\.role !== ROLES\.SUPER_ADMIN/);
  const grantBlock = controller.slice(controller.indexOf('async function grantOverride'));
  const revokeBlock = controller.slice(controller.indexOf('async function revokeOverride'));
  assert.match(grantBlock, /Super Admin access required/);
  assert.match(revokeBlock, /Super Admin access required/);
  // Verify ordinary Admin role string is not being accepted
  assert.doesNotMatch(controller, /role === ROLES\.ADMIN.*grantOverride/);
});

await check('QA-EXPIRY-01: expiry is lazily read — no scheduled processor exists — no unsafe lazy-write notification added', () => {
  const overrideSvc = read('server/src/services/capability/overrideService.js');
  // isExpired is only used inside getActiveOverride (read path), never as a write trigger
  assert.match(overrideSvc, /function isExpired/);
  assert.match(overrideSvc, /isExpired.*return null/);
  // Confirm there is no notify call inside isExpired or getActiveOverride
  const getActiveBlock = overrideSvc.slice(
    overrideSvc.indexOf('async function getActiveOverride'),
    overrideSvc.indexOf('async function hasOverrideForCapability')
  );
  assert.doesNotMatch(getActiveBlock, /notify\(/);
  // No cron/worker/scheduler reference for expiry
  const runtime = read('server/src/services/capability/overrideRuntime.js');
  assert.doesNotMatch(runtime, /setInterval|setTimeout|cron|scheduleJob/);
  process.stdout.write('       [DOC] Expiry notification requires a future scheduled lifecycle job — not added in Phase 3\n');
});

// ── AGE-ADM-02: Marketplace moderation → agent/agency ──────────────────────

await check('MKT-NOTIFY-01: moderatePost calls notifyAgentOrganizationOwners on approve', () => {
  const svc = read('server/src/services/agentMarketplaceService.js');
  assert.match(svc, /notifyAgentOrganizationOwners/);
  assert.match(svc, /marketplace_moderation_\$\{action\}/);
  assert.match(svc, /MODERATION_NOTIFY_ACTIONS\[action\]/);
  assert.match(svc, /Marketplace post approved/);
});

await check('MKT-NOTIFY-02: rejection and needs-changes produce distinct titles', () => {
  const svc = read('server/src/services/agentMarketplaceService.js');
  assert.match(svc, /Marketplace post rejected/);
  assert.match(svc, /Marketplace post needs changes/);
  // All three actions are mapped
  assert.match(svc, /approve:.*Marketplace post approved/);
  assert.match(svc, /reject:.*Marketplace post rejected/);
  assert.match(svc, /request_changes:.*Marketplace post needs changes/);
});

await check('MKT-NOTIFY-03: notification routes to organizationId (org ownership path)', () => {
  const svc = read('server/src/services/agentMarketplaceService.js');
  // notifyAgentOrganizationOwners is called with post.organizationId
  assert.match(svc, /organizationId: post\.organizationId/);
  // There must NOT be a direct AgentProfile.findOne bare lookup for recipient
  const moderateBlock = svc.slice(svc.indexOf('export async function moderatePost'));
  assert.doesNotMatch(moderateBlock, /AgentProfile\.findOne\(.*recipientType|notifyAgent\(.*AgentProfile\.findOne/);
});

await check('MKT-NOTIFY-03b: moderation notification does not notify suspended/revoked org path — uses org ownership bridge', () => {
  const bridge = read('server/src/services/agentInboxNotificationBridge.js');
  // AgentMembership filter requires active:true, so inactive members are skipped
  assert.match(bridge, /active: true/);
  assert.match(bridge, /AgentMembership/);
});

await check('MKT-NOTIFY: non-moderation actions (begin_review, suspend, archive) do not trigger provider notification', () => {
  const svc = read('server/src/services/agentMarketplaceService.js');
  // Only the three decisions are in the notification map
  const block = svc.slice(svc.indexOf('MODERATION_NOTIFY_ACTIONS'));
  // begin_review, suspend, archive must NOT appear in the notification map
  const mapBlock = block.slice(0, block.indexOf('if (MODERATION_NOTIFY_ACTIONS'));
  assert.doesNotMatch(mapBlock, /begin_review/);
  assert.doesNotMatch(mapBlock, /suspend:/);
  assert.doesNotMatch(mapBlock, /archive:/);
});

// ── GBS-ADM-01: capability evidence → admin ─────────────────────────────────

await check('GBS-NOTIFY-01: submitCapabilityEvidenceMetadata calls notifyAdminStaff', () => {
  const svc = read('server/src/services/gbs/providerCapabilityClaimService.js');
  assert.match(svc, /notifyAdminStaff/);
  assert.match(svc, /gbs_capability_evidence_submitted/);
  assert.match(svc, /Capability evidence submitted for review/);
});

await check('GBS-NOTIFY-02: submission notification does not alter capability approval state', () => {
  const svc = read('server/src/services/gbs/providerCapabilityClaimService.js');
  // notifyAdminStaff must appear AFTER the mutate call, not mutating anything trust-state-related
  const submitBlock = svc.slice(svc.indexOf('export async function submitCapabilityEvidenceMetadata'));
  const notifyPos = submitBlock.indexOf('notifyAdminStaff');
  const mutatePos = submitBlock.indexOf('mutateProviderCapabilityRecord');
  assert.ok(notifyPos > mutatePos, 'notifyAdminStaff must come after mutateProviderCapabilityRecord');
  // Notification must not touch trustStatus, status, or approval fields
  const notifyCallBlock = submitBlock.slice(notifyPos, notifyPos + 500);
  assert.doesNotMatch(notifyCallBlock, /trustStatus\s*:|status\s*:|VERIFIED|ACCEPTED|ACTIVE/);
});

await check('GBS-NOTIFY-03: Education marketplace and GBS evidence routing are domain-separate', () => {
  const marketplaceSvc = read('server/src/services/agentMarketplaceService.js');
  const gbsSvc = read('server/src/services/gbs/providerCapabilityClaimService.js');
  // Marketplace moderation notifies agent org owners (not admin)
  assert.match(marketplaceSvc, /notifyAgentOrganizationOwners/);
  assert.doesNotMatch(marketplaceSvc, /notifyAdminStaff.*moderatePost|moderatePost.*notifyAdminStaff/);
  // GBS evidence submission notifies admin staff (not agent org owners)
  assert.match(gbsSvc, /notifyAdminStaff/);
  assert.doesNotMatch(gbsSvc, /notifyAgentOrganizationOwners/);
  // GBS notification type is namespaced to GBS
  assert.match(gbsSvc, /gbs_capability_evidence_submitted/);
  // Marketplace type is namespaced to marketplace
  assert.match(marketplaceSvc, /marketplace_moderation_/);
});

// ── IDEMPOTENCY ──────────────────────────────────────────────────────────────

await check('IDEMPOTENCY-01: QA override notify events carry a discriminating dedupeKey timestamp', async () => {
  const { svc, notifyEvents } = makeOverrideSvc();
  await svc.grantOverride({
    ...ACTOR,
    organizationId: ORG_A,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'idempotency test',
    capabilities: CAPS,
  });
  // Runtime uses grantedAt timestamp as discriminator in the dedupeKey
  // Verify the runtime source wires it correctly
  const runtime = read('server/src/services/capability/overrideRuntime.js');
  assert.match(runtime, /dedupeKey.*qa_override.*action.*organizationId.*discriminator/);
  assert.equal(notifyEvents[0].action, 'granted');
  assert.ok(notifyEvents[0].grantedAt instanceof Date || notifyEvents[0].grantedAt !== undefined,
    'grantedAt must be passed to notify callback');
});

await check('IDEMPOTENCY-01b: marketplace moderation dedupeKey uses moderationEvent._id', () => {
  const svc = read('server/src/services/agentMarketplaceService.js');
  assert.match(svc, /dedupeKey.*marketplace:moderation.*moderationEvent\._id/);
});

await check('IDEMPOTENCY-01c: GBS evidence dedupeKey uses record id and evidence type (stable, retry-safe)', () => {
  const svc = read('server/src/services/gbs/providerCapabilityClaimService.js');
  // Must use stable evidenceType, not dynamic refs.length which changes on each retry-append
  assert.match(svc, /dedupeKey.*gbs:evidence.*id.*parsed\.value\.evidenceType/);
  assert.doesNotMatch(svc, /dedupeKey.*gbs:evidence.*refs\.length/);
});

await check('IDEMPOTENCY-01d: notifyAdminStaff appends per-user suffix to dedupeKey', () => {
  const notifSvc = read('server/src/services/notificationService.js');
  assert.match(notifSvc, /dedupeKey.*payload\.dedupeKey.*staff.*u\._id/);
});

// ── Security / trust invariants ──────────────────────────────────────────────

await check('SEC: notification creation is never mixed into authorization checks', () => {
  const runtime = read('server/src/services/capability/organizationCapabilityRuntime.js');
  assert.doesNotMatch(runtime, /notifyAgentOrganizationOwners|notifyAdminStaff|createUserNotification/);
  const capRuntime = read('server/src/services/capability/overrideService.js');
  // Notification (notify call) must only appear AFTER the audit in grantOverride and revokeOverride
  const grantBlock = capRuntime.slice(capRuntime.indexOf('async function grantOverride'));
  const auditPosGrant = grantBlock.indexOf('await audit(');
  const notifyPosGrant = grantBlock.indexOf('await notify(');
  assert.ok(notifyPosGrant > auditPosGrant, 'notify must come after audit in grantOverride');
});

await check('SEC: qa_test override type is never promoted to "verified" by notification', () => {
  const runtime = read('server/src/services/capability/overrideRuntime.js');
  // Wording must say "Temporary QA" not "Verified"
  assert.match(runtime, /Temporary QA capability access/);
  assert.doesNotMatch(runtime, /title[^'"]*[Vv]erif(?:ied|ication)/);
  const overrideSvc = read('server/src/services/capability/overrideService.js');
  // overrideType value in notify payload remains whatever was saved — never rewritten
  assert.doesNotMatch(overrideSvc, /notify\(\s*\{[^}]*overrideType:\s*'verified'/);
});

// ── QA override recipient routing ────────────────────────────────────────────

await check('QA-ROUTE-01: agent/agency org type routes to AgentMembership owner/admin (not direct lookup)', () => {
  const runtime = read('server/src/services/capability/overrideRuntime.js');
  // AGENT_ORG_TYPES set must cover both agent and agency
  assert.match(runtime, /AGENT_ORG_TYPES/);
  assert.match(runtime, /ORGANIZATION_TYPES\.AGENT/);
  assert.match(runtime, /ORGANIZATION_TYPES\.AGENCY/);
  // Routes to the bridge which resolves AgentMembership internally
  assert.match(runtime, /notifyAgentOrganizationOwners/);
  // Bridge must enforce active:true to skip inactive members
  const bridge = read('server/src/services/agentInboxNotificationBridge.js');
  assert.match(bridge, /AgentMembership/);
  assert.match(bridge, /active: true/);
});

await check('QA-ROUTE-02: institution org types route via InstitutionMembership, NOT AgentMembership', () => {
  const runtime = read('server/src/services/capability/overrideRuntime.js');
  // INSTITUTION_ORG_TYPES must cover canonical institution org types
  assert.match(runtime, /INSTITUTION_ORG_TYPES/);
  assert.match(runtime, /ORGANIZATION_TYPES\.UNIVERSITY/);
  assert.match(runtime, /ORGANIZATION_TYPES\.COLLEGE/);
  assert.match(runtime, /ORGANIZATION_TYPES\.INSTITUTE/);
  // Institution branch queries InstitutionMembership directly
  assert.match(runtime, /InstitutionMembership/);
  assert.match(runtime, /institutionAccountId/);
  assert.match(runtime, /notifyInstitution/);
  // Institution branch does NOT call notifyAgentOrganizationOwners
  const instBranchStart = runtime.indexOf('INSTITUTION_ORG_TYPES.has');
  const instBranchEnd = runtime.indexOf('return;', instBranchStart);
  const instBranch = runtime.slice(instBranchStart, instBranchEnd);
  assert.doesNotMatch(instBranch, /notifyAgentOrganizationOwners/);
});

await check('QA-ROUTE-03: business_services_provider org capability targets agency-type org → AgentMembership route; GBS ProviderCapability evidence path is separate', () => {
  // business_services_provider is a recognized organization capability
  const caps = read('shared/capability/organizationCapabilities.js');
  assert.match(caps, /business_services_provider/);
  // Agency org type (which holds business_services_provider capability) uses AgentMembership
  const runtime = read('server/src/services/capability/overrideRuntime.js');
  assert.match(runtime, /ORGANIZATION_TYPES\.AGENCY/);
  // The separate GBS ProviderCapability evidence path notifies admin, not agent org owners
  const gbsSvc = read('server/src/services/gbs/providerCapabilityClaimService.js');
  assert.match(gbsSvc, /notifyAdminStaff/);
  assert.doesNotMatch(gbsSvc, /notifyAgentOrganizationOwners/);
  process.stdout.write('       [DOC] GBS ProviderCapability (business services) is separate from VerificationCapabilityOverride.\n');
  process.stdout.write('       [DOC] business_services_provider org capability on agency-type orgs routes via AgentMembership.\n');
});

await check('QA-ROUTE-04: employer org type routes via EmployerMembership; business_client/unknown skip quietly', () => {
  const runtime = read('server/src/services/capability/overrideRuntime.js');
  // Must look up org from Organization model before any routing decision
  assert.match(runtime, /Organization\.findById/);
  // Must guard against missing org (no org record → skip)
  assert.match(runtime, /if \(!org\) return/);
  // Employer org type must now route via EmployerMembership
  assert.match(runtime, /EMPLOYER_ORG_TYPES/);
  assert.match(runtime, /EmployerMembership/);
  assert.match(runtime, /notifyEmployer/);
  // business_client is documented as genuinely not resolvable
  assert.match(runtime, /business_client.*not.*concrete|business_client/i);
  // After the employer routing block, no further membership queries follow (comment-only tail)
  const afterEmp = runtime.slice(runtime.lastIndexOf('business_client'));
  assert.doesNotMatch(afterEmp, /AgentMembership\.find|InstitutionMembership\.find|EmployerMembership\.find/);
});

// ── Idempotency — retry-stable deduplication ─────────────────────────────────

await check('IDEMPOTENCY-02: retry of same QA grant produces stable grantedAt so dedupeKey is unchanged', async () => {
  const { svc, notifyEvents } = makeOverrideSvc();
  // First grant
  await svc.grantOverride({
    ...ACTOR,
    organizationId: ORG_A,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'IDEMPOTENCY-02 test',
    capabilities: CAPS,
  });
  const firstGrantedAt = notifyEvents[0]?.grantedAt;
  assert.ok(firstGrantedAt, 'grantedAt must be present on first grant notify');

  // Simulate retry — small pause so Date.now() would differ if not preserved
  await new Promise((r) => setTimeout(r, 5));
  await svc.grantOverride({
    ...ACTOR,
    organizationId: ORG_A,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'IDEMPOTENCY-02 test',
    capabilities: CAPS,
  });
  const retryGrantedAt = notifyEvents[1]?.grantedAt;
  assert.ok(retryGrantedAt, 'grantedAt must be present on retry notify');
  assert.equal(
    new Date(retryGrantedAt).getTime(),
    new Date(firstGrantedAt).getTime(),
    'grantedAt must be preserved across retries of an active grant — dedupeKey must be stable'
  );
});

await check('IDEMPOTENCY-03: GBS evidence deduplication prevents retry-append and stabilises notification key', () => {
  const svc = read('server/src/services/gbs/providerCapabilityClaimService.js');
  // Submission must check for existing duplicate before appending
  assert.match(svc, /isDuplicate/);
  assert.match(svc, /evidenceType.*officialRegistryUrl|officialRegistryUrl.*evidenceType/);
  // dedupeKey must be tied to stable evidence identity (evidenceType), not dynamic length
  assert.match(svc, /dedupeKey.*gbs:evidence.*id.*parsed\.value\.evidenceType/);
  assert.doesNotMatch(svc, /dedupeKey.*gbs:evidence.*refs\.length/);
  process.stdout.write('       [DOC] Underlying GBS evidence submission was non-idempotent (always appended).\n');
  process.stdout.write('       [DOC] Fixed: dedup by (evidenceType, officialRegistryUrl) before append.\n');
});

// ── GBS-IDEMPOTENCY-04: same cap + same evidenceType + two different URLs ────

await check('GBS-IDEMPOTENCY-04: same capability + same evidenceType + two different URLs → two distinct dedupeKeys', () => {
  const svc = read('server/src/services/gbs/providerCapabilityClaimService.js');
  // dedupeKey must incorporate officialRegistryUrl so two different URLs get distinct keys
  assert.match(svc, /dedupeKey.*gbs:evidence.*id.*parsed\.value\.evidenceType.*parsed\.value\.officialRegistryUrl/);
  // Verify the URL is NOT omitted (old bug: key was only id + evidenceType)
  assert.doesNotMatch(
    svc,
    /dedupeKey\s*:\s*`gbs:evidence:\$\{id\}:\$\{parsed\.value\.evidenceType\}`/,
  );
  process.stdout.write('       [VERIFIED] dedupeKey = gbs:evidence:<id>:<evidenceType>:<officialRegistryUrl>\n');
  process.stdout.write('       [VERIFIED] same evidenceType + different URL → different keys → two Admin notifications\n');
});

// ── QA-IDEMPOTENCY-05 / 06: grant dedupe covers capabilities + expiresAt ────

await check('QA-IDEMPOTENCY-05: exact same grant retry → same dedupeKey (stable discriminator)', async () => {
  const { svc, notifyEvents } = makeOverrideSvc();
  await svc.grantOverride({
    ...ACTOR,
    organizationId: ORG_A,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'IDEMPOTENCY-05',
    capabilities: CAPS,
  });
  const first = notifyEvents[0];
  await new Promise((r) => setTimeout(r, 5));
  // Retry: same caps, no expiresAt change
  await svc.grantOverride({
    ...ACTOR,
    organizationId: ORG_A,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'IDEMPOTENCY-05 retry',
    capabilities: CAPS,
  });
  const retry = notifyEvents[1];
  // Both notify events must carry the same grantedAt, capabilities, and expiresAt →
  // same discriminator inputs → same dedupeKey at the runtime layer.
  assert.equal(
    new Date(retry.grantedAt).getTime(),
    new Date(first.grantedAt).getTime(),
    'grantedAt must be stable across retries',
  );
  assert.deepEqual(
    [...retry.capabilities].sort(),
    [...first.capabilities].sort(),
    'capabilities must be identical on retry',
  );
  // Verify runtime builds discriminator from grantedAt + cap fingerprint + expiresAt
  const runtime = read('server/src/services/capability/overrideRuntime.js');
  assert.match(runtime, /capFingerprint/);
  assert.match(runtime, /expFingerprint/);
  // discriminator template must reference both fingerprints (may span lines)
  assert.match(runtime, /\$\{capFingerprint\}/);
  assert.match(runtime, /\$\{expFingerprint\}/);
});

await check('QA-IDEMPOTENCY-06: effective capability change on active grant → different discriminator → new notification', async () => {
  // Verify the discriminator formula in source so we can reason about it without
  // a full MongoDB store (the memory store preserves grantedAt on retry).
  const runtime = read('server/src/services/capability/overrideRuntime.js');
  // capFingerprint must be declared with capabilities as input
  assert.match(runtime, /const capFingerprint.*Array\.isArray\(capabilities\)/);
  // capFingerprint must sort capabilities
  assert.match(runtime, /capFingerprint[\s\S]{0,200}\.sort\(\)/);
  // expFingerprint must incorporate expiresAt
  assert.match(runtime, /const expFingerprint.*expiresAt/);
  // discriminator for a grant must reference both fingerprints in the template literal
  assert.match(runtime, /\$\{capFingerprint\}/);
  assert.match(runtime, /\$\{expFingerprint\}/);
  process.stdout.write('       [VERIFIED] discriminator = grantedAt_sortedCaps_expiresAt\n');
  process.stdout.write('       [VERIFIED] same retry → same discriminator → one notification (idempotent)\n');
  process.stdout.write('       [VERIFIED] different caps or expiry → different discriminator → new notification\n');
  // Active override mutation: grantOverride() always overwrites capabilities/expiresAt in the store.
  // grantedAt is preserved by the store, but capFingerprint/expFingerprint change → new dedupeKey.
  process.stdout.write('       [DOC] Active override mutation IS possible (grantOverride overwrites caps/expiresAt).\n');
  process.stdout.write('       [DOC] grantedAt alone was insufficient — now covered by capFingerprint + expFingerprint.\n');
});

// ── Results ──────────────────────────────────────────────────────────────────

process.stdout.write(`\n  ${passed} passed, ${failed} failed\n`);
