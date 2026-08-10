/**
 * Pre-Mission-27 QA — Applicant Skill Trust × Notifications / Alerts.
 *
 * Covers QA points 21–45 (notification generation, truthfulness, privacy,
 * counters, deep links, delivery boundary, dedup/idempotency) and re-asserts
 * the trust invariants at the notification layer, where a careless copy string
 * can promote a claim that the trust engine never promoted:
 *
 *     CLAIMED != EVIDENCE_BACKED != VERIFIED
 *
 * Pure contract + real execution of the pure builder. No DB, no network, no
 * worker, no external delivery — consistent with the accepted suite alongside
 * it, and required by the "worker remains stopped" QA boundary.
 *
 * Run:
 *   node src/__tests__/skillTrustNotificationsQA.test.js
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

const load = (rel) => import(pathToFileURL(path.join(repoRoot, rel)).href);
const read = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

/**
 * Scan CODE, not prose. These files explain the delivery boundary in their
 * comments ("sends no email", "enqueues nothing"), so a naive source scan for
 * `enqueue` or `delivered` matches the very documentation that promises the
 * opposite. Strip comments first and assert against what actually executes.
 */
const codeOf = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const sv = await load('shared/career/skillVerification.js');
const stn = await load('shared/career/skillTrustNotifications.js');
const { isSafeInternalLink } = await load('client/src/utils/notificationLink.js');

const S = sv.SKILL_CLAIM_STATUSES;
const N = stn.SKILL_TRUST_NOTIFICATION_TYPES;
const R = stn.SKILL_TRUST_RECIPIENTS;

const serviceSrc = read('server/src/services/career/SkillVerificationService.js');
const bridgeSrc = read('server/src/services/career/skillTrustNotificationBridge.js');
const notifServiceSrc = read('server/src/services/notificationService.js');
const notifModelSrc = read('server/src/models/UserNotification.js');
const notifCtrlSrc = read('server/src/controllers/userNotificationsController.js');
const contractSrc = read('shared/career/skillTrustNotifications.js');

let passed = 0;
let total = 0;
const check = async (label, fn) => {
  total += 1;
  try {
    await fn();
    passed += 1;
    console.log(`  ok - ${label}`);
  } catch (err) {
    console.error(`  FAIL - ${label}`);
    console.error(`       ${err.message}`);
    process.exitCode = 1;
  }
};

// --- fixtures --------------------------------------------------------------

const CLAIM_ID = '507f1f77bcf86cd799439031';
const HISTORY_ID = '507f1f77bcf86cd799439041';
const OTHER_HISTORY_ID = '507f1f77bcf86cd799439042';
const APPLICANT_ID = '507f1f77bcf86cd799439011';
const APPLICANT_REQUEST = 'Please provide another professional profile connecting you to this work.';

const claimOf = (status, extra = {}) => ({
  _id: CLAIM_ID,
  userId: APPLICANT_ID,
  status,
  skillName: 'React',
  normalizedSkillName: 'react',
  ...extra,
});

/** Build the notifications for one transition. */
const build = (fromStatus, toStatus, extra = {}) =>
  stn.buildSkillTrustNotifications({
    fromStatus,
    toStatus,
    claim: claimOf(toStatus, extra),
    historyId: HISTORY_ID,
    applicantVisibleRequest: toStatus === S.NEEDS_INFORMATION
      ? (extra.applicantVisibleRequest ?? APPLICANT_REQUEST)
      : '',
    occurredAt: new Date('2026-08-10T12:00:00.000Z'),
  });

const applicantOf = (list) => list.find((n) => n.recipientKind === R.APPLICANT);
const staffOf = (list) => list.find((n) => n.recipientKind === R.STAFF);

console.log('\nPre-Mission-27 QA — skill trust notifications / alerts\n');

// ---------------------------------------------------------------------------
// 21. Evidence submission creates the correct applicant notification
// ---------------------------------------------------------------------------
await check('21. evidence submission notifies the applicant, without claiming trust', () => {
  const list = build(S.CLAIMED, S.EVIDENCE_SUBMITTED);
  const a = applicantOf(list);
  assert.ok(a, 'an applicant notification must be produced');
  assert.strictEqual(a.type, N.EVIDENCE_SUBMITTED);
  assert.strictEqual(a.metadata.trustState, S.EVIDENCE_SUBMITTED);
  assert.ok(/not been reviewed/i.test(a.body), 'copy must state that nothing has been reviewed yet');
  assert.ok(!/\bverified\b/i.test(`${a.title} ${a.body}`), 'submission must never read as verified');
  assert.ok(!staffOf(list), 'attaching evidence does not itself queue a review');
});

// ---------------------------------------------------------------------------
// 22. evidence_backed produces evidence-backed wording, NOT verified
// ---------------------------------------------------------------------------
await check('22. evidence_backed says evidence-backed and never "verified"', () => {
  const a = applicantOf(build(S.VERIFICATION_PENDING, S.EVIDENCE_BACKED));
  assert.strictEqual(a.type, N.EVIDENCE_BACKED);
  const text = `${a.title} ${a.body}`;
  assert.ok(/evidence-backed/i.test(text), 'copy must use the evidence-backed term');
  assert.ok(!/\bverified\b/i.test(text), 'copy must NOT say verified');
  assert.ok(!/verification approved/i.test(text), 'copy must NOT say verification approved');
  assert.strictEqual(a.metadata.trustState, S.EVIDENCE_BACKED);
});

await check('22b. the truthful-copy guard rejects verified wording for a lesser state', () => {
  assert.throws(
    () => stn.assertTruthfulCopy({
      trustState: S.EVIDENCE_BACKED,
      title: 'Your React skill is verified',
      body: '',
    }),
    /claims verification/i,
    'a "verified" title on an evidence_backed outcome must be refused'
  );
  assert.ok(
    stn.assertTruthfulCopy({ trustState: S.VERIFIED, title: 'Verification approved', body: '' }),
    'the same wording is legitimate when the state really is verified'
  );
});

// ---------------------------------------------------------------------------
// 23. verified notification only after the authoritative transition
// ---------------------------------------------------------------------------
await check('23. verified copy exists only for the verified transition', () => {
  const a = applicantOf(build(S.VERIFICATION_PENDING, S.VERIFIED));
  assert.strictEqual(a.type, N.VERIFIED);
  assert.ok(/approved/i.test(`${a.title} ${a.body}`), 'verified copy states approval');
  assert.strictEqual(a.metadata.trustState, S.VERIFIED);

  for (const state of [S.CLAIMED, S.EVIDENCE_SUBMITTED, S.VERIFICATION_PENDING, S.EVIDENCE_BACKED,
    S.NEEDS_INFORMATION, S.REJECTED, S.EXPIRED, S.REVOKED]) {
    const list = stn.buildSkillTrustNotifications({
      fromStatus: S.VERIFICATION_PENDING,
      toStatus: state,
      claim: claimOf(state),
      historyId: HISTORY_ID,
      applicantVisibleRequest: state === S.NEEDS_INFORMATION ? APPLICANT_REQUEST : '',
    });
    for (const n of list) {
      assert.notStrictEqual(n.type, N.VERIFIED, `${state} must not emit the verified notification type`);
    }
  }
});

await check('23b. the service notifies only AFTER the authoritative transition commits', () => {
  const decision = serviceSrc.slice(serviceSrc.indexOf('export async function recordVerificationDecision'));
  const commitAt = decision.indexOf('commitStatusTransition');
  const notifyAt = decision.indexOf('notifyTransition');
  const historyAt = decision.indexOf('appendHistory');
  assert.ok(commitAt > 0 && notifyAt > 0, 'decision must both commit and notify');
  assert.ok(commitAt < historyAt && historyAt < notifyAt,
    'order must be commit -> history -> notify, so nothing announces an uncommitted decision');
  assert.ok(/if \(!committed\) \{\s*return fail\(\s*'CLAIM_STATE_CHANGED'/.test(decision),
    'a lost race must return a conflict and notify nothing');
});

// ---------------------------------------------------------------------------
// 24/25. needs_information and rejected produce truthful, actionable alerts
// ---------------------------------------------------------------------------
await check('24. needs_information creates an actionable applicant alert', () => {
  const a = applicantOf(build(S.VERIFICATION_PENDING, S.NEEDS_INFORMATION));
  assert.strictEqual(a.type, N.NEEDS_INFORMATION);
  assert.ok(/respond|open your skills/i.test(a.body), 'copy must tell the applicant to act');
  assert.ok(a.body.includes(APPLICANT_REQUEST), 'copy must include the deliberately authored request');
  assert.ok(!/\bverified\b/i.test(`${a.title} ${a.body}`));
  assert.strictEqual(a.link, '/talent-profile', 'must deep-link to the surface where they can respond');
});

await check('25. rejected creates a truthful, non-final-sounding alert', () => {
  const a = applicantOf(build(S.VERIFICATION_PENDING, S.REJECTED));
  assert.strictEqual(a.type, N.REJECTED);
  assert.ok(/not approved/i.test(`${a.title} ${a.body}`), 'copy must state non-approval plainly');
  assert.ok(/again/i.test(a.body), 'copy must state that resubmission is possible');
  assert.ok(!/\bverified\b/i.test(`${a.title} ${a.body}`));
});

// ---------------------------------------------------------------------------
// 26/27. expiry and revocation
// ---------------------------------------------------------------------------
await check('26. expired verification creates an expiry alert', () => {
  const a = applicantOf(build(S.VERIFIED, S.EXPIRED));
  assert.strictEqual(a.type, N.EXPIRED);
  assert.ok(/expired|no longer current/i.test(`${a.title} ${a.body}`));
  assert.strictEqual(a.metadata.trustState, S.EXPIRED);
});

await check('27. revoked verification creates an immediate truthful alert', () => {
  const a = applicantOf(build(S.VERIFIED, S.REVOKED));
  assert.strictEqual(a.type, N.REVOKED);
  assert.ok(/revoked/i.test(`${a.title} ${a.body}`));
  assert.ok(/no longer appears/i.test(a.body), 'copy must state the badge is gone');
  assert.strictEqual(a.metadata.trustState, S.REVOKED);
});

// ---------------------------------------------------------------------------
// 28. review queue notifies the reviewer
// ---------------------------------------------------------------------------
await check('28. submission for review queues a reviewer notification', () => {
  const list = build(S.EVIDENCE_SUBMITTED, S.VERIFICATION_PENDING);
  const s = staffOf(list);
  assert.ok(s, 'a reviewer notification must be produced');
  assert.strictEqual(s.type, N.REVIEW_QUEUED);
  assert.strictEqual(s.link, '/admin/sc/trust');
  assert.ok(applicantOf(list), 'the applicant is told their claim is queued too');
});

await check('28b. a response after needs_information is distinguished for reviewers', () => {
  const s = staffOf(build(S.NEEDS_INFORMATION, S.VERIFICATION_PENDING));
  assert.strictEqual(s.type, N.INFORMATION_SUPPLIED,
    'a reply to a reviewer request is operationally distinct from a first submission');
  assert.ok(/responded|additional information/i.test(`${s.title} ${s.body}`));
});

await check('28c. reviewer recipients are permission-gated, not merely staff', () => {
  assert.ok(/hasPermission\(u\.role, PERMISSIONS\.SKILL_VERIFICATION_REVIEW\)/.test(bridgeSrc),
    'reviewer fan-out must filter by the skill_verification:review grant');
  assert.ok(/STAFF_ROLES/.test(bridgeSrc), 'and must start from staff roles only');
  assert.ok(!/notifyStaff\(/.test(bridgeSrc),
    'must NOT use the blanket notifyStaff helper, which would reach Editors with no review authority');
});

// ---------------------------------------------------------------------------
// 29. recipient is server-derived
// ---------------------------------------------------------------------------
await check('29. the recipient is server-derived from the persisted claim', () => {
  assert.ok(/userId: claim\.userId/.test(bridgeSrc),
    'applicant recipient must come from the persisted claim owner');
  assert.ok(!/req\.body|payload\.userId|payload\.recipient/.test(bridgeSrc),
    'the bridge must never read a recipient from a request');
  const bridgeImports = bridgeSrc.slice(0, bridgeSrc.indexOf('export async function'));
  assert.ok(!/routes|controller|express/i.test(bridgeImports),
    'the bridge must not be reachable from an HTTP layer');
  assert.ok(/recipientType: 'user'/.test(bridgeSrc) && /recipientType: 'staff'/.test(bridgeSrc),
    'recipient type is fixed in code, never taken from input');
});

await check('29b. the client cannot fabricate outcome, type, trust state or timestamp', () => {
  // Everything the notification asserts is computed from the transition.
  assert.ok(/trustState: toStatus/.test(contractSrc), 'trust state is the authoritative toStatus');
  assert.ok(/transitionId: historyId/.test(contractSrc), 'identity is the persisted history row');
  const forbidden = [/verifiedBy/, /reviewerId/, /actorId/];
  for (const p of forbidden) {
    assert.ok(!p.test(contractSrc), `notification metadata must not carry ${p}`);
  }
});

// ---------------------------------------------------------------------------
// 30/31/32. cross-user, employer and agent/institution access
// ---------------------------------------------------------------------------
await check('30. notification reads are always scoped to the authenticated recipient', () => {
  assert.ok(/function buildFilter\(ctx, query\)/.test(notifCtrlSrc));
  const filter = notifCtrlSrc.slice(notifCtrlSrc.indexOf('function buildFilter'));
  assert.ok(/filter\.employerId = ctx\.employerId;\s*else filter\.userId = ctx\.userId;/.test(filter),
    'every list/count query is bound to the caller identity');
  assert.ok(!/req\.query\.userId|req\.body\.userId/.test(notifCtrlSrc),
    'a caller must not be able to name another user');
  for (const fn of ['markRead', 'markAllRead', 'removeNotification', 'getUnreadCount']) {
    const block = notifCtrlSrc.slice(notifCtrlSrc.indexOf(`export const ${fn}`));
    assert.ok(/recipientContext\(req\)/.test(block.slice(0, 400)),
      `${fn} must derive its scope from the session`);
  }
});

await check('31/32. Employer, Agent and Institution cannot reach skill-review alerts', () => {
  // Skill-trust notifications are only ever written with recipientType
  // 'user' (the claim owner) or 'staff' (a permitted reviewer).
  assert.ok(!/recipientType: 'employer'/.test(bridgeSrc),
    'no skill-trust notification may target the employer realm');
  assert.ok(!/notifyEmployer/.test(bridgeSrc), 'the employer notifier must not be used here');
  // An employer session resolves to the employer recipient context, which
  // filters on employerId and therefore can never match these rows.
  const ctx = notifCtrlSrc.slice(notifCtrlSrc.indexOf('function recipientContext'));
  assert.ok(/if \(req\.employer\)/.test(ctx) && /recipientType: 'employer'/.test(ctx),
    'employer sessions are pinned to the employer recipient type');
  // Agent/Institution are valid platform realms but have no canonical inbox
  // recipient type in this release. They are explicitly denied rather than
  // falling through to a Student inbox or dereferencing a missing req.user.
  assert.ok(/if \(!req\.user\?\.userId\) return null;/.test(ctx),
    'unsupported realms cannot fall through to the user/staff inbox');
  assert.ok(/Notification inbox is not available for this account type/.test(notifCtrlSrc),
    'unsupported realms receive an explicit denial');
});

await check('31b. no employer notification is generated from profile skill activity', () => {
  const all = [];
  const statuses = Object.values(S);
  for (const from of statuses) {
    for (const to of statuses) {
      all.push(...stn.buildSkillTrustNotifications({
        fromStatus: from, toStatus: to, claim: claimOf(to), historyId: HISTORY_ID,
        applicantVisibleRequest: to === S.NEEDS_INFORMATION ? APPLICANT_REQUEST : '',
      }));
    }
  }
  assert.ok(all.length > 0, 'sanity: the sweep produced notifications');
  const kinds = new Set(all.map((n) => n.recipientKind));
  assert.deepStrictEqual([...kinds].sort(), [R.APPLICANT, R.STAFF].sort(),
    'across every transition pair, only the applicant and reviewers are ever addressed');
});

// ---------------------------------------------------------------------------
// 33. payload carries no private data
// ---------------------------------------------------------------------------
await check('33. payload carries safe references only — no notes, evidence or URLs', () => {
  const a = applicantOf(build(S.VERIFICATION_PENDING, S.EVIDENCE_BACKED, {
    // Fields a careless implementation might spread into the payload:
    reason: 'INTERNAL: referee call, sounded rehearsed',
    verifiedBy: '507f1f77bcf86cd799439013',
    verificationMethod: 'reference_check',
    proficiencyScore: 88,
  }));
  assert.deepStrictEqual(
    Object.keys(a.metadata).sort(),
    ['claimId', 'occurredAt', 'skillId', 'skillName', 'trustState', 'transitionId'].sort(),
    'metadata shape must be exactly the safe reference set'
  );
  const serialized = JSON.stringify(a);
  assert.ok(!/INTERNAL|rehearsed/.test(serialized), 'reviewer notes must never appear');
  assert.ok(!/439013/.test(serialized), 'reviewer identity must never appear');
  assert.ok(!/https?:\/\//.test(serialized), 'no evidence URL may appear');
  assert.ok(!/\b88\b/.test(serialized), 'no proficiency score may appear');
  assert.ok(!/reference_check/.test(serialized), 'verification method internals must not appear');
});

await check('33b. the bridge never forwards the reviewer reason into a notification', () => {
  assert.ok(!/reason/.test(bridgeSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')),
    'no code path in the bridge touches the reviewer reason');
});

// ---------------------------------------------------------------------------
// 34/35. unread counters and read state
// ---------------------------------------------------------------------------
await check('34. unread counters exist, and are scoped to the authenticated user', () => {
  assert.ok(/unreadCount/.test(notifCtrlSrc), 'the platform does support unread counts');
  assert.ok(/countDocuments\(\{ \.\.\.filter, read: false \}\)/.test(notifCtrlSrc),
    'the unread count is derived from the same scoped filter as the list');
  assert.ok(/export async function getUnreadCount/.test(notifServiceSrc));
  const svcCount = notifServiceSrc.slice(notifServiceSrc.indexOf('export async function getUnreadCount'));
  assert.ok(/filter\.userId = userId/.test(svcCount) && /filter\.employerId = employerId/.test(svcCount),
    'no unread count is ever computed unscoped');
});

await check('35. skill-trust notifications are ordinary UserNotification rows, so read state works', () => {
  assert.ok(/read: \{ type: Boolean, default: false \}/.test(notifModelSrc));
  assert.ok(/readAt: \{ type: Date \}/.test(notifModelSrc));
  assert.ok(/createUserNotificationOnce/.test(bridgeSrc),
    'the bridge writes through the shared notification service');
  assert.ok(!/mongoose\.model\(/.test(bridgeSrc) && !/new Schema/.test(bridgeSrc),
    'the bridge must NOT define a second notification model');
  // Category is an existing enum member, not a new vocabulary.
  assert.strictEqual(stn.SKILL_TRUST_NOTIFICATION_CATEGORY, 'verification');
  assert.ok(/'verification',/.test(notifModelSrc), 'the category already exists in the model enum');
});

// ---------------------------------------------------------------------------
// 36/43. deduplication and idempotency
// ---------------------------------------------------------------------------
await check('36. the same transition yields a stable dedupe key; a later one differs', () => {
  const first = applicantOf(build(S.VERIFICATION_PENDING, S.EVIDENCE_BACKED));
  const again = applicantOf(build(S.VERIFICATION_PENDING, S.EVIDENCE_BACKED));
  assert.strictEqual(first.dedupeKey, again.dedupeKey,
    'a retried/duplicated handling of ONE transition must collapse to one key');

  const later = applicantOf(stn.buildSkillTrustNotifications({
    fromStatus: S.EVIDENCE_BACKED,
    toStatus: S.VERIFIED,
    claim: claimOf(S.VERIFIED),
    historyId: OTHER_HISTORY_ID,
  }));
  assert.notStrictEqual(first.dedupeKey, later.dedupeKey,
    'a subsequent legitimate transition must be allowed its own notification');
});

await check('36b. dedupe is enforced by a unique index, not a read-then-write check', () => {
  assert.ok(/dedupeKey: \{ type: String/.test(notifModelSrc), 'the model carries a dedupe key');
  assert.ok(/unique: true,[\s\S]*name: 'user_notification_dedupe_unique',[\s\S]*partialFilterExpression/.test(notifModelSrc),
    'uniqueness must be enforced by the database');
  const once = notifServiceSrc.slice(notifServiceSrc.indexOf('export async function createUserNotificationOnce'));
  assert.ok(/err\?\.code === 11000/.test(once),
    'the duplicate-key race must be handled, not pre-checked');
  assert.ok(/created: false/.test(once), 'a suppressed duplicate is reported as not-created');
});

await check('43. concurrent transitions produce at most one transition and one alert', () => {
  // The compare-and-set is what makes this true: only one writer can move the
  // claim off `fromStatus`, and only the winner appends history and notifies.
  assert.ok(/async function commitStatusTransition/.test(serviceSrc));
  const cas = serviceSrc.slice(serviceSrc.indexOf('async function commitStatusTransition'));
  assert.ok(/findOneAndUpdate\(\s*\{ _id: claimId, status: fromStatus \}/.test(cas),
    'the update must be conditional on the status it authorized from');

  // Every state-changing entry point must go through it.
  for (const fn of ['addEvidence', 'submitForReview', 'recordVerificationDecision', 'applyExpiry']) {
    const block = serviceSrc.slice(serviceSrc.indexOf(`export async function ${fn}`));
    const end = block.indexOf('\nexport ', 10);
    const body = end > 0 ? block.slice(0, end) : block;
    assert.ok(/commitStatusTransition\(/.test(body), `${fn} must commit its transition atomically`);
    assert.ok(/if \(!committed\)/.test(body), `${fn} must handle losing the race`);
  }
  // And no legacy unguarded save may remain on the trust path.
  assert.ok(!/claim\.status = /.test(serviceSrc),
    'no code path may assign a status in memory and save it unguarded');
});

await check('43b. a losing reviewer writes no verification record at all', () => {
  const decision = serviceSrc.slice(serviceSrc.indexOf('export async function recordVerificationDecision'));
  const casAt = decision.indexOf('commitStatusTransition');
  const createAt = decision.indexOf('SkillVerification.create');
  assert.ok(casAt < createAt,
    'the claim transition must be won BEFORE a verification record is created, or the loser orphans one');
  assert.ok(/const verificationId = new mongoose\.Types\.ObjectId\(\)/.test(decision),
    'the verification id is pre-allocated so the claim can point at it during the CAS');
});

// ---------------------------------------------------------------------------
// 37/38. deep links and realm
// ---------------------------------------------------------------------------
await check('37. deep links resolve to the correct Student and Admin surfaces', () => {
  assert.strictEqual(stn.SKILL_TRUST_DEEP_LINKS[R.APPLICANT], '/talent-profile');
  assert.strictEqual(stn.SKILL_TRUST_DEEP_LINKS[R.STAFF], '/admin/sc/trust');

  const routes = read('client/src/routes/index.jsx');
  const constants = read('client/src/constants/index.js');
  assert.ok(/TALENT_PROFILE: '\/talent-profile'/.test(constants), 'the student route exists');
  assert.ok(/path: ROUTES\.TALENT_PROFILE/.test(routes), 'and is mounted');
  assert.ok(/path: 'sc\/trust', element: <AdminTrustCenter \/>/.test(routes), 'the admin route exists and is mounted');

  // The surfaces actually host the skill UI the link promises.
  assert.ok(/SkillClaimManager/.test(read('client/src/pages/TalentProfile/TalentProfileEditor.jsx')),
    'the student deep link lands on the skills manager');
  assert.ok(/SkillVerificationReviewPanel/.test(read('client/src/pages/Admin/AdminTrustCenter.jsx')),
    'the admin deep link lands on the review panel');
});

await check('38. an applicant is never deep-linked into the admin realm', () => {
  const statuses = Object.values(S);
  for (const from of statuses) {
    for (const to of statuses) {
      for (const n of stn.buildSkillTrustNotifications({
        fromStatus: from, toStatus: to, claim: claimOf(to), historyId: HISTORY_ID,
        applicantVisibleRequest: to === S.NEEDS_INFORMATION ? APPLICANT_REQUEST : '',
      })) {
        if (n.recipientKind === R.APPLICANT) {
          assert.ok(!/^\/admin/.test(n.link), `applicant link leaked into admin realm: ${n.link}`);
        }
        assert.ok(isSafeInternalLink(n.link), `link must pass the open-redirect guard: ${n.link}`);
      }
    }
  }
  // The admin route itself remains permission-gated regardless of the link.
  assert.ok(/perm: PERMISSIONS\.TRUST_TRIAGE/.test(read('client/src/config/adminNavConfig.js')),
    'the Trust Center remains permission-gated for anyone who follows the link');
});

// ---------------------------------------------------------------------------
// 39. notification state matches current verification state
// ---------------------------------------------------------------------------
await check('39. every notification records the resulting authoritative trust state', () => {
  const statuses = Object.values(S);
  for (const from of statuses) {
    for (const to of statuses) {
      for (const n of stn.buildSkillTrustNotifications({
        fromStatus: from, toStatus: to, claim: claimOf(to), historyId: HISTORY_ID,
        applicantVisibleRequest: to === S.NEEDS_INFORMATION ? APPLICANT_REQUEST : '',
      })) {
        assert.strictEqual(n.metadata.trustState, to,
          'the payload state must equal the transition outcome');
        assert.strictEqual(n.category, 'verification');
        assert.ok(stn.isSkillTrustNotificationType(n.type), `unknown type ${n.type}`);
      }
    }
  }
});

await check('39b. a no-op transition produces nothing', () => {
  assert.deepStrictEqual(build(S.CLAIMED, S.CLAIMED), [],
    'claim creation records claimed -> claimed and must not notify the user about their own edit');
});

// ---------------------------------------------------------------------------
// 40/41/42. delivery boundary
// ---------------------------------------------------------------------------
await check('40. external delivery is reported truthfully, never as delivered', () => {
  assert.strictEqual(stn.SKILL_TRUST_EXTERNAL_DELIVERY.EXTERNAL_STATUS, 'NOT_CONFIGURED');
  assert.ok(!/DELIVERED|delivered:\s*true|status:\s*'sent'/i.test(codeOf(contractSrc)),
    'no executable path in this domain may assert delivery');
  // In-app is the only channel this domain actually performs.
  assert.strictEqual(stn.SKILL_TRUST_EXTERNAL_DELIVERY.IN_APP, 'in_app');
});

await check('41/42. the skill trust path starts no worker and sends nothing externally', () => {
  for (const [rel, src] of [
    ['skillTrustNotificationBridge.js', bridgeSrc],
    ['SkillVerificationService.js', serviceSrc],
    ['skillTrustNotifications.js', contractSrc],
  ]) {
    const code = codeOf(src);
    for (const pattern of [
      /nodemailer/i, /sendMail/i, /sendEmail/i, /twilio/i, /sendSms/i,
      /webpush/i, /sendPush/i, /firebase/i,
      /enqueue/i, /addToQueue/i, /processQueue/i, /\bbull\b/i,
      /fetch\(/, /axios/, /\bgot\(/,
    ]) {
      assert.ok(!pattern.test(code), `${rel} must not contain ${pattern} in executable code (delivery boundary)`);
    }
    assert.ok(!/require\(|from '.*worker/i.test(code), `${rel} must not pull in a worker`);
  }
  // The bridge writes inbox rows and nothing else.
  assert.ok(/createUserNotificationOnce/.test(codeOf(bridgeSrc)));
});

// ---------------------------------------------------------------------------
// 44. revocation removes the badge and the alert reflects it
// ---------------------------------------------------------------------------
await check('44. revocation clears verified standing and the alert says so', () => {
  // Trust engine: revoked is not a current verified state.
  assert.strictEqual(
    sv.deriveCurrentTrustState({ status: S.REVOKED, revokedAt: new Date(), verifiedAt: new Date() }),
    S.REVOKED,
    'a revoked claim never derives as verified'
  );
  assert.strictEqual(
    sv.isCurrentlyVerified({ status: S.REVOKED, verifiedAt: new Date(), revokedAt: new Date() }),
    false
  );
  // Persistence: the non-verified branch clears the verified fields.
  const decision = serviceSrc.slice(serviceSrc.indexOf('export async function recordVerificationDecision'));
  assert.ok(/set\.verifiedBy = null;\s*set\.verifiedByRole = '';\s*set\.verifiedAt = null;/.test(decision),
    'any non-verified outcome must clear prior verified standing');
  assert.ok(/set\.revokedAt = now;/.test(decision), 'revocation is stamped');
  // Notification: says revoked, does not say verified.
  const a = applicantOf(build(S.VERIFIED, S.REVOKED));
  assert.strictEqual(a.metadata.trustState, S.REVOKED);
  assert.ok(!/\bverified\b/i.test(`${a.title} ${a.body}`));
});

// ---------------------------------------------------------------------------
// 45. the application snapshot stays historical
// ---------------------------------------------------------------------------
await check('45. later notifications/state changes never rewrite an application snapshot', () => {
  /*
   * The snapshot is not schema-`immutable`; its historicity is enforced by
   * write-path exclusion — it is populated once at application create and no
   * update path anywhere writes it. This asserts the mechanism that actually
   * holds, and extends it to the newly added notification path.
   */
  const appCtrl = read('server/src/controllers/applicationsController.js');
  assert.ok(/skillSnapshot/.test(appCtrl), 'sanity: the controller populates the snapshot');
  assert.ok(!/\$set[^}]*skillSnapshot|updateOne[\s\S]{0,200}skillSnapshot|findOneAndUpdate[\s\S]{0,200}skillSnapshot/.test(appCtrl),
    'no update path may rewrite a captured snapshot');

  // The notification path added here touches neither applications nor snapshots.
  assert.ok(!/Application/.test(codeOf(bridgeSrc)), 'the notification bridge must not touch applications');
  assert.ok(!/skillSnapshot/.test(codeOf(contractSrc)), 'the notification contract must not touch snapshots');
  const decision = serviceSrc.slice(serviceSrc.indexOf('export async function recordVerificationDecision'));
  assert.ok(!/skillSnapshot/.test(decision),
    'a verification decision — including revocation — must not rewrite any historical snapshot');

  // And the trust engine keeps building snapshots server-side from stored claims.
  assert.ok(/buildApplicationSkillSnapshot/.test(serviceSrc), 'the snapshot builder remains server-side');
});

// ---------------------------------------------------------------------------
// Preferences — reported truthfully, not invented
// ---------------------------------------------------------------------------
await check('P. preference capability is reported truthfully, and none is invented here', () => {
  // The platform declares a category/channel preference vocabulary, but it is
  // NOT wired into the in-app inbox write path for any domain. This QA does not
  // pretend otherwise, and invents no skill-specific preference.
  const prefs = read('shared/international/notificationPreferences.js');
  assert.ok(/NOTIFICATION_CATEGORIES/.test(prefs), 'the preference vocabulary exists');
  assert.ok(!/skill/i.test(prefs), 'it declares no skill category — none is fabricated');
  assert.ok(!/notificationPreferences/.test(bridgeSrc),
    'the bridge claims no preference enforcement it does not perform');
  assert.ok(!/quietHours/.test(bridgeSrc), 'no quiet-hours behaviour is fabricated');
});

console.log(`\n${passed}/${total} skill trust notification QA checks passed`);
if (process.exitCode) {
  console.error('\nSome skill trust notification QA checks FAILED.');
} else {
  console.log('All Pre-Mission-27 skill trust notification/alert checks passed.');
}
