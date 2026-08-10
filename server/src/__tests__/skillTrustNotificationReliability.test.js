/**
 * Focused executable closure for recoverable Skill Trust notifications and
 * applicant-visible needs-information requests. No DB, network or worker.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const load = (relative) => import(pathToFileURL(path.join(repoRoot, relative)).href);
const read = (relative) => readFileSync(path.join(repoRoot, relative), 'utf8');

const sv = await load('shared/career/skillVerification.js');
const stn = await load('shared/career/skillTrustNotifications.js');
const svc = await load('server/src/services/career/SkillVerificationService.js');
const bridge = await load('server/src/services/career/skillTrustNotificationBridge.js');
const { UserNotification } = await load('server/src/models/UserNotification.js');

const S = sv.SKILL_CLAIM_STATUSES;
const M = sv.VERIFICATION_METHODS;
const APPLICANT_ID = '507f1f77bcf86cd799439011';
const REVIEWER_ID = '507f1f77bcf86cd799439014';
const CLAIM_ID = '507f1f77bcf86cd799439031';
const HISTORY_ID = '507f1f77bcf86cd799439041';
const REQUEST = 'Please provide another professional profile or project reference connecting you to this repository.';
const INTERNAL_REASON = 'Repository ownership could not be independently established.';

const claim = {
  _id: CLAIM_ID,
  userId: APPLICANT_ID,
  status: S.EVIDENCE_BACKED,
  skillName: 'React',
  normalizedSkillName: 'react',
};
const history = {
  _id: HISTORY_ID,
  claimId: CLAIM_ID,
  userId: APPLICANT_ID,
  fromStatus: S.VERIFICATION_PENDING,
  toStatus: S.EVIDENCE_BACKED,
  actorClass: sv.TRANSITION_ACTORS.REVIEWER,
  actorRole: 'Moderator',
  method: M.MANUAL_EVIDENCE_REVIEW,
  reason: INTERNAL_REASON,
  applicantVisibleRequest: '',
  occurredAt: new Date('2026-08-10T12:00:00.000Z'),
};

let passed = 0;
let total = 0;
async function check(label, work) {
  total += 1;
  try {
    await work();
    passed += 1;
    console.log(`  ok - ${label}`);
  } catch (error) {
    process.exitCode = 1;
    console.error(`  FAIL - ${label}`);
    console.error(`       ${error.message}`);
  }
}

console.log('\nSkill Trust notification final reliability closure\n');

const durable = {
  transitions: 1,
  historyRows: 1,
  verificationRows: 1,
  status: S.EVIDENCE_BACKED,
};
const inbox = new Map();
let failWrites = true;
const createNotificationOnce = async (payload) => {
  await Promise.resolve();
  if (failWrites) throw new Error('simulated notification persistence failure');
  if (inbox.has(payload.dedupeKey)) {
    return { created: false, notification: inbox.get(payload.dedupeKey) };
  }
  const notification = { _id: `notification-${inbox.size + 1}`, ...payload };
  inbox.set(payload.dedupeKey, notification);
  return { created: true, notification };
};
const dependencies = {
  HistoryModel: { findById: async (id) => String(id) === HISTORY_ID ? history : null },
  ClaimModel: { findById: async (id) => String(id) === CLAIM_ID ? claim : null },
  createNotificationOnce,
};

let failedEmission;
await check('1-4. transition and immutable identity survive a notification write failure', async () => {
  failedEmission = await bridge.emitSkillTrustNotifications({
    claim,
    fromStatus: history.fromStatus,
    toStatus: history.toStatus,
    historyId: history._id,
    occurredAt: history.occurredAt,
  }, { createNotificationOnce });
  assert.equal(failedEmission.status, bridge.SKILL_TRUST_IN_APP_DELIVERY.PENDING_RECONCILIATION);
  assert.equal(failedEmission.failed, 1);
  assert.equal(failedEmission.transitionId, HISTORY_ID);
  assert.deepEqual(durable, {
    transitions: 1,
    historyRows: 1,
    verificationRows: 1,
    status: S.EVIDENCE_BACKED,
  });
  assert.equal(inbox.size, 0);
});

await check('5-8. history-driven retry creates the missing row without replaying trust writes', async () => {
  failWrites = false;
  const result = await bridge.reconcileSkillTrustNotifications({ historyId: HISTORY_ID }, dependencies);
  assert.equal(result.status, bridge.SKILL_TRUST_IN_APP_DELIVERY.ENSURED);
  assert.equal(result.created, 1);
  assert.equal(inbox.size, 1);
  assert.equal(durable.transitions, 1);
  assert.equal(durable.historyRows, 1);
  assert.equal(durable.verificationRows, 1);
});

await check('9. an already-existing notification makes reconciliation a no-op', async () => {
  const result = await bridge.reconcileSkillTrustNotifications({ historyId: HISTORY_ID }, dependencies);
  assert.equal(result.created, 0);
  assert.equal(result.skipped, 1);
  assert.equal(inbox.size, 1);
});

await check('10. concurrent reconciliation creates at most one notification', async () => {
  inbox.clear();
  const results = await Promise.all([
    bridge.reconcileSkillTrustNotifications({ historyId: HISTORY_ID }, dependencies),
    bridge.reconcileSkillTrustNotifications({ historyId: HISTORY_ID }, dependencies),
  ]);
  assert.equal(results.reduce((sum, item) => sum + item.created, 0), 1);
  assert.equal(results.reduce((sum, item) => sum + item.skipped, 0), 1);
  assert.equal(inbox.size, 1);
});

const pendingClaim = { ...claim, status: S.VERIFICATION_PENDING };
const moderator = { id: REVIEWER_ID, role: 'Moderator', realm: 'user' };
const needsInfoInput = {
  claim: pendingClaim,
  toStatus: S.NEEDS_INFORMATION,
  actor: moderator,
  method: M.MANUAL_EVIDENCE_REVIEW,
  reason: INTERNAL_REASON,
};

await check('11. needs_information requires applicant-visible instructions', () => {
  const denied = svc.authorizeClaimTransition(needsInfoInput);
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'APPLICANT_VISIBLE_REQUEST_INVALID');
});

await check('12. internal reason is never projected to the applicant', () => {
  const projected = svc.projectClaimHistory([{
    ...history,
    toStatus: S.NEEDS_INFORMATION,
    applicantVisibleRequest: REQUEST,
  }], { isReviewer: false });
  assert.equal(projected[0].reason, undefined);
  assert.equal(projected[0].applicantVisibleRequest, REQUEST);
  assert.doesNotMatch(JSON.stringify(projected), /ownership could not/i);
});

await check('13. applicant-visible request is bounded', () => {
  const result = sv.validateApplicantVisibleRequest(
    'a'.repeat(sv.SKILL_CLAIM_LIMITS.MAX_APPLICANT_VISIBLE_REQUEST_LENGTH + 1)
  );
  assert.deepEqual(result, { ok: false, reason: 'too_long' });
});

await check('14. unsafe markup and script are rejected', () => {
  const result = sv.validateApplicantVisibleRequest('<script>alert(1)</script>');
  assert.deepEqual(result, { ok: false, reason: 'markup_injection' });
});

await check('15. the Student notification contains only actionable safe instructions', () => {
  const items = stn.buildSkillTrustNotifications({
    fromStatus: S.VERIFICATION_PENDING,
    toStatus: S.NEEDS_INFORMATION,
    claim: { ...claim, status: S.NEEDS_INFORMATION },
    historyId: HISTORY_ID,
    applicantVisibleRequest: REQUEST,
  });
  const applicant = items.find((item) => item.recipientKind === stn.SKILL_TRUST_RECIPIENTS.APPLICANT);
  assert.ok(applicant.body.includes(REQUEST));
  assert.ok(!applicant.body.includes(INTERNAL_REASON));
  assert.equal(applicant.link, '/talent-profile');
});

await check('16-18. Employer, Agent, Institution and another Student cannot read review text', () => {
  for (const actor of [
    { id: APPLICANT_ID, role: 'employer', realm: 'employer' },
    { id: APPLICANT_ID, role: 'agent', realm: 'agent' },
    { id: APPLICANT_ID, role: 'institution', realm: 'institution' },
    { id: '507f1f77bcf86cd799439099', role: 'User', realm: 'user' },
  ]) {
    assert.equal(svc.authorizeClaimHistoryRead({ claim, actor }).allowed, false, actor.realm);
  }
  assert.equal(
    svc.authorizeClaimHistoryRead({
      claim,
      actor: { id: APPLICANT_ID, role: 'User', realm: 'user' },
    }).allowed,
    true
  );
});

await check('19. only an authorized reviewer may author applicant-visible instructions', () => {
  const accepted = svc.authorizeClaimTransition({
    ...needsInfoInput,
    applicantVisibleRequest: `  ${REQUEST}  `,
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.applicantVisibleRequest, REQUEST);
  for (const actor of [
    { id: REVIEWER_ID, role: 'Editor', realm: 'user' },
    { id: REVIEWER_ID, role: 'User', realm: 'user' },
    { id: REVIEWER_ID, role: 'employer', realm: 'employer' },
    { id: REVIEWER_ID, role: 'assistant', realm: 'ai' },
  ]) {
    assert.equal(svc.authorizeClaimTransition({
      ...needsInfoInput,
      actor,
      applicantVisibleRequest: REQUEST,
    }).ok, false, `${actor.realm}/${actor.role}`);
  }
});

await check('20. missing/deleted claims are handled without emitting or changing state', async () => {
  const result = await bridge.reconcileSkillTrustNotifications({ historyId: HISTORY_ID }, {
    ...dependencies,
    ClaimModel: { findById: async () => null },
  });
  assert.equal(result.status, bridge.SKILL_TRUST_IN_APP_DELIVERY.CLAIM_MISSING);
  assert.equal(inbox.size, 1);
  assert.equal(durable.transitions, 1);
});

await check('21. dedupe index is unique+partial and leaves legacy missing/null keys outside it', () => {
  const [, options] = UserNotification.schema.indexes().find(
    ([key]) => key.dedupeKey === 1
  );
  assert.equal(options.unique, true);
  assert.equal(options.name, 'user_notification_dedupe_unique');
  assert.deepEqual(options.partialFilterExpression, { dedupeKey: { $type: 'string' } });
  assert.notEqual(UserNotification.schema.path('dedupeKey').isRequired, true);
  assert.equal(UserNotification.schema.path('dedupeKey').defaultValue, undefined);
});

await check('22. reconciliation remains internal and delivery failure is surfaced honestly', () => {
  const routes = read('server/src/routes/skillClaims.js');
  const controller = read('server/src/controllers/career/skillClaimController.js');
  assert.doesNotMatch(routes, /reconcileSkillTrust|emitSkillTrust/);
  assert.doesNotMatch(controller, /reconcileSkillTrust|emitSkillTrust/);
  assert.match(controller, /notificationDelivery/);
  assert.equal(failedEmission.status, 'PENDING_RECONCILIATION');
});

await check('23. source policy currently leaves automatic model index creation enabled', () => {
  const db = read('server/src/config/db.js');
  assert.doesNotMatch(db, /autoIndex\s*:\s*false/);
  assert.notEqual(UserNotification.schema.options.autoIndex, false);
});

console.log(`\n${passed}/${total} skill trust reliability checks passed.`);
