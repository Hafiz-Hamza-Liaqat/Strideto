/**
 * Executable HTTP-controller contracts for Skill Trust and the canonical
 * notification inbox. Uses injected model/service seams; no DB or network.
 */
import assert from 'node:assert/strict';
import {
  recordSkillVerification,
  getSkillClaimHistory,
} from '../controllers/career/skillClaimController.js';
import {
  getUnreadCount,
  listUserNotifications,
  markAllRead,
  markRead,
} from '../controllers/userNotificationsController.js';
import {
  authorizeClaimTransition,
  skillVerificationService,
} from '../services/career/SkillVerificationService.js';
import { UserNotification } from '../models/UserNotification.js';
import {
  SKILL_CLAIM_STATUSES,
  VERIFICATION_METHODS,
} from '../../../shared/career/skillVerification.js';

const USER_ID = '507f1f77bcf86cd799439011';
const REVIEWER_ID = '507f1f77bcf86cd799439014';
const EMPLOYER_ID = '507f1f77bcf86cd799439021';
const CLAIM_ID = '507f1f77bcf86cd799439031';
const NOTIFICATION_ID = '507f1f77bcf86cd799439051';

let passed = 0;
let total = 0;

async function check(label, action) {
  total += 1;
  try {
    await action();
    passed += 1;
    console.log(`  ok - ${label}`);
  } catch (error) {
    process.exitCode = 1;
    console.error(`  FAIL - ${label}`);
    console.error(`       ${error.message}`);
  }
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

async function invoke(handler, req) {
  const res = response();
  let nextError;
  await handler(req, res, (error) => { nextError = error; });
  if (nextError) throw nextError;
  return res;
}

async function withMethod(object, name, replacement, action) {
  const original = object[name];
  object[name] = replacement;
  try {
    return await action();
  } finally {
    object[name] = original;
  }
}

console.log('\nSkill Trust HTTP and inbox runtime contracts\n');

await check('1. reviewer identity and decision fields are server-derived/bounded at HTTP', async () => {
  let received;
  const res = await withMethod(
    skillVerificationService,
    'recordVerificationDecision',
    async (input) => {
      received = input;
      return {
        ok: true,
        claim: {
          status: SKILL_CLAIM_STATUSES.EVIDENCE_BACKED,
          proficiencyScore: null,
          verificationMethod: VERIFICATION_METHODS.MANUAL_EVIDENCE_REVIEW,
          verifiedAt: null,
          expiresAt: null,
        },
        notificationDelivery: {
          status: 'ENSURED',
          transitionId: 'private-transition-id',
          created: 3,
        },
      };
    },
    () => invoke(recordSkillVerification, {
      user: { userId: REVIEWER_ID, role: 'Moderator' },
      params: { claimId: CLAIM_ID },
      id: 'request-correlation',
      body: {
        toStatus: SKILL_CLAIM_STATUSES.EVIDENCE_BACKED,
        method: VERIFICATION_METHODS.MANUAL_EVIDENCE_REVIEW,
        reason: 'Internal review reason',
        applicantVisibleRequest: '',
        evidenceRefs: ['evidence-one'],
        recipientType: 'employer',
        recipientId: EMPLOYER_ID,
        notificationType: 'skill_verified',
        verifiedBy: USER_ID,
      },
    })
  );

  assert.deepEqual(received.actor, {
    id: REVIEWER_ID,
    role: 'Moderator',
    realm: 'user',
  });
  assert.equal(received.claimId, CLAIM_ID);
  assert.equal(received.recipientType, undefined);
  assert.equal(received.recipientId, undefined);
  assert.equal(received.notificationType, undefined);
  assert.equal(received.verifiedBy, undefined);
  assert.deepEqual(res.body.notificationDelivery, {
    inAppStatus: 'ENSURED',
    externalStatus: 'NOT_CONFIGURED',
  });
  assert.doesNotMatch(JSON.stringify(res.body), /private-transition-id|created/);
});

await check('2. pending reconciliation is surfaced without leaking fan-out details', async () => {
  const res = await withMethod(
    skillVerificationService,
    'recordVerificationDecision',
    async () => ({
      ok: true,
      claim: {
        status: SKILL_CLAIM_STATUSES.NEEDS_INFORMATION,
        proficiencyScore: null,
        verificationMethod: VERIFICATION_METHODS.MANUAL_EVIDENCE_REVIEW,
      },
      notificationDelivery: {
        status: 'PENDING_RECONCILIATION',
        transitionId: 'private-transition-id',
        failed: 1,
      },
    }),
    () => invoke(recordSkillVerification, {
      user: { userId: REVIEWER_ID, role: 'Moderator' },
      params: { claimId: CLAIM_ID },
      body: {
        toStatus: SKILL_CLAIM_STATUSES.NEEDS_INFORMATION,
        method: VERIFICATION_METHODS.MANUAL_EVIDENCE_REVIEW,
        reason: 'Internal reason',
        applicantVisibleRequest: 'Please attach an issuer-backed reference.',
        evidenceRefs: [],
      },
    })
  );
  assert.equal(res.body.notificationDelivery.inAppStatus, 'PENDING_RECONCILIATION');
  assert.equal(res.body.notificationDelivery.externalStatus, 'NOT_CONFIGURED');
  assert.doesNotMatch(JSON.stringify(res.body), /private-transition-id|Internal reason|failed/);
});

await check('3. wrong realms cannot turn the reviewer controller into verification authority', async () => {
  const pendingClaim = {
    _id: CLAIM_ID,
    userId: USER_ID,
    status: SKILL_CLAIM_STATUSES.VERIFICATION_PENDING,
  };
  const requests = [
    { employer: { employerId: EMPLOYER_ID }, expected: 403 },
    { agent: { subjectId: EMPLOYER_ID }, expected: 403 },
    { institution: { subjectId: EMPLOYER_ID }, expected: 403 },
    { expected: 401 },
  ];
  await withMethod(
    skillVerificationService,
    'recordVerificationDecision',
    async (input) => authorizeClaimTransition({
      claim: pendingClaim,
      actor: input.actor,
      toStatus: input.toStatus,
      method: input.method,
      reason: input.reason,
      evidenceRefs: input.evidenceRefs,
    }),
    async () => {
      for (const item of requests) {
        const res = await invoke(recordSkillVerification, {
          ...item,
          params: { claimId: CLAIM_ID },
          body: {
            toStatus: SKILL_CLAIM_STATUSES.EVIDENCE_BACKED,
            method: VERIFICATION_METHODS.MANUAL_EVIDENCE_REVIEW,
            reason: 'Reviewed evidence',
            evidenceRefs: ['evidence-one'],
          },
        });
        assert.equal(res.statusCode, item.expected);
        assert.notEqual(res.body?.data?.trustState, SKILL_CLAIM_STATUSES.EVIDENCE_BACKED);
      }
    }
  );
});

await check('4. owner history response cannot expose the internal reviewer reason', async () => {
  const safeRequest = 'Please attach an issuer-backed reference.';
  let actor;
  const res = await withMethod(
    skillVerificationService,
    'getClaimHistory',
    async (input) => {
      actor = input.actor;
      return {
        ok: true,
        history: [{
          toStatus: SKILL_CLAIM_STATUSES.NEEDS_INFORMATION,
          applicantVisibleRequest: safeRequest,
          occurredAt: new Date('2026-08-10T12:00:00.000Z'),
        }],
      };
    },
    () => invoke(getSkillClaimHistory, {
      user: { userId: USER_ID, role: 'User' },
      params: { claimId: CLAIM_ID },
    })
  );
  assert.deepEqual(actor, { id: USER_ID, role: 'User', realm: 'user' });
  assert.equal(res.body.data[0].applicantVisibleRequest, safeRequest);
  assert.equal(res.body.data[0].reason, undefined);
});

await check('5. list and unread APIs use the same authenticated Student scope', async () => {
  const filters = [];
  const originalFind = UserNotification.find;
  const originalCount = UserNotification.countDocuments;
  UserNotification.find = (filter) => {
    filters.push({ operation: 'find', filter });
    return {
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean: async () => [{ _id: NOTIFICATION_ID, read: false }],
    };
  };
  UserNotification.countDocuments = async (filter) => {
    filters.push({ operation: 'count', filter });
    return filter.read === false ? 1 : 1;
  };
  try {
    const list = await invoke(listUserNotifications, {
      user: { userId: USER_ID, role: 'User' },
      query: { page: '1', limit: '20' },
    });
    const count = await invoke(getUnreadCount, {
      user: { userId: USER_ID, role: 'User' },
      query: {},
    });
    assert.equal(list.body.unreadCount, 1);
    assert.equal(count.body.unreadCount, 1);
    for (const { filter } of filters) {
      assert.equal(filter.recipientType, 'user');
      assert.equal(filter.userId, USER_ID);
      assert.equal(filter.employerId, undefined);
    }
  } finally {
    UserNotification.find = originalFind;
    UserNotification.countDocuments = originalCount;
  }
});

await check('6. mark-read requires notification id, realm, and owner together', async () => {
  const original = UserNotification.findOneAndUpdate;
  let received;
  UserNotification.findOneAndUpdate = async (filter, update, options) => {
    received = { filter, update, options };
    return { _id: NOTIFICATION_ID, read: true };
  };
  try {
    const res = await invoke(markRead, {
      user: { userId: USER_ID, role: 'User' },
      params: { id: NOTIFICATION_ID },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(received.filter, {
      _id: NOTIFICATION_ID,
      recipientType: 'user',
      userId: USER_ID,
    });
    assert.equal(received.update.read, true);
    assert.ok(received.update.readAt instanceof Date);
    assert.deepEqual(received.options, { new: true });
  } finally {
    UserNotification.findOneAndUpdate = original;
  }
});

await check('7. mark-all-read is scoped and does not alter another user counter', async () => {
  const original = UserNotification.updateMany;
  let received;
  UserNotification.updateMany = async (filter, update) => {
    received = { filter, update };
    return { modifiedCount: 2 };
  };
  try {
    const res = await invoke(markAllRead, {
      user: { userId: USER_ID, role: 'User' },
      query: {},
    });
    assert.deepEqual(received.filter, {
      recipientType: 'user',
      userId: USER_ID,
      read: false,
    });
    assert.equal(res.body.updated, 2);
  } finally {
    UserNotification.updateMany = original;
  }
});

await check('8. Employer inbox APIs remain pinned to Employer identity', async () => {
  const original = UserNotification.countDocuments;
  let received;
  UserNotification.countDocuments = async (filter) => {
    received = filter;
    return 4;
  };
  try {
    const res = await invoke(getUnreadCount, {
      employer: { employerId: EMPLOYER_ID },
      query: {},
    });
    assert.equal(res.body.unreadCount, 4);
    assert.deepEqual(received, {
      recipientType: 'employer',
      employerId: EMPLOYER_ID,
      read: false,
    });
  } finally {
    UserNotification.countDocuments = original;
  }
});

await check('9. Agent and Institution inbox requests receive explicit wrong-realm denial', async () => {
  for (const req of [
    { agent: { subjectId: USER_ID }, query: {} },
    { institution: { subjectId: USER_ID }, query: {} },
  ]) {
    const res = await invoke(getUnreadCount, req);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /not available for this account type/i);
  }
});

await check('10. an invalid notification id is rejected before any write', async () => {
  const original = UserNotification.findOneAndUpdate;
  let writes = 0;
  UserNotification.findOneAndUpdate = async () => { writes += 1; };
  try {
    const res = await invoke(markRead, {
      user: { userId: USER_ID, role: 'User' },
      params: { id: 'not-an-object-id' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(writes, 0);
  } finally {
    UserNotification.findOneAndUpdate = original;
  }
});

console.log(`\n${passed}/${total} Skill Trust HTTP/inbox checks passed.`);
