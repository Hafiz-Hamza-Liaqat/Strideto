/**
 * Pre-Mission-27 operational closure for bounded notification recovery and
 * controlled dedupe-index rollout. Pure/injected: no DB, worker, or network.
 */
import assert from 'node:assert/strict';
import { UserNotification } from '../models/UserNotification.js';
import {
  SkillTrustReconciliationError,
  assertReconciliationConfirmation,
  executeReconciliation,
  isSuccessfulReconciliationStatus,
  parseReconciliationArgs,
  reconciliationHelpText,
  reconciliationOutput,
  runCli as runReconciliationCli,
} from '../scripts/reconcileSkillTrustNotification.js';
import {
  NotificationIndexReadinessError,
  USER_NOTIFICATION_DEDUPE_INDEX,
  assertIndexApplyConfirmation,
  compareNotificationDedupeIndex,
  executeNotificationIndexReadiness,
  inspectNotificationIndexes,
  notificationIndexHelpText,
  parseIndexArgs,
  runCli as runIndexCli,
} from '../scripts/provisionUserNotificationDedupeIndex.js';
import { SKILL_TRUST_IN_APP_DELIVERY } from '../services/career/skillTrustNotificationBridge.js';

const HISTORY_ID = '507f1f77bcf86cd799439041';
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

console.log('\nSkill Trust notification operational readiness\n');

await check('1. recovery accepts exactly one valid immutable history id', () => {
  assert.deepEqual(parseReconciliationArgs(['--history-id', HISTORY_ID]), {
    mode: 'reconcile',
    historyId: HISTORY_ID,
  });
  assert.throws(
    () => parseReconciliationArgs([]),
    (error) => error instanceof SkillTrustReconciliationError
      && error.code === 'INVALID_ARGUMENTS'
  );
  assert.throws(
    () => parseReconciliationArgs(['--history-id', HISTORY_ID, '--all']),
    (error) => error instanceof SkillTrustReconciliationError
      && error.code === 'INVALID_ARGUMENTS'
  );
  assert.throws(
    () => parseReconciliationArgs(['--history-id', 'not-an-object-id']),
    (error) => error instanceof SkillTrustReconciliationError
      && error.code === 'INVALID_HISTORY_ID'
  );
  assert.match(reconciliationHelpText(), /No default scan is available/);
});

await check('2. recovery requires explicit operator confirmation', () => {
  assert.throws(
    () => assertReconciliationConfirmation({}),
    (error) => error instanceof SkillTrustReconciliationError
      && error.code === 'RECONCILIATION_CONFIRMATION_REQUIRED'
  );
  assert.doesNotThrow(() => assertReconciliationConfirmation({
    STRIDETO_NOTIFICATION_RECONCILE_CONFIRM: '1',
  }));
});

await check('3. ensured and not-applicable outcomes succeed; unresolved outcomes fail', async () => {
  for (const status of [
    SKILL_TRUST_IN_APP_DELIVERY.ENSURED,
    SKILL_TRUST_IN_APP_DELIVERY.NOT_APPLICABLE,
  ]) {
    assert.equal(isSuccessfulReconciliationStatus(status), true);
    const execution = await executeReconciliation({
      historyId: HISTORY_ID,
      reconcile: async () => ({ status, transitionId: HISTORY_ID }),
    });
    assert.equal(execution.exitCode, 0);
  }
  for (const status of [
    SKILL_TRUST_IN_APP_DELIVERY.PENDING_RECONCILIATION,
    SKILL_TRUST_IN_APP_DELIVERY.HISTORY_MISSING,
    SKILL_TRUST_IN_APP_DELIVERY.CLAIM_MISSING,
    SKILL_TRUST_IN_APP_DELIVERY.IDENTITY_MISMATCH,
  ]) {
    assert.equal(isSuccessfulReconciliationStatus(status), false);
  }
});

await check('4. recovery CLI connects once, reconciles once, and disconnects', async () => {
  const calls = [];
  const output = [];
  const exitCode = await runReconciliationCli({
    args: ['--history-id', HISTORY_ID],
    environment: {
      MONGO_URI: 'mongodb://secret.invalid/strideto',
      STRIDETO_NOTIFICATION_RECONCILE_CONFIRM: '1',
    },
    connect: async () => calls.push('connect'),
    disconnect: async () => calls.push('disconnect'),
    reconcile: async ({ historyId }) => {
      calls.push(`reconcile:${historyId}`);
      return {
        status: SKILL_TRUST_IN_APP_DELIVERY.ENSURED,
        transitionId: historyId,
        created: 1,
        skipped: 0,
        failed: 0,
      };
    },
    output: (line) => output.push(line),
  });
  assert.equal(exitCode, 0);
  assert.deepEqual(calls, ['connect', `reconcile:${HISTORY_ID}`, 'disconnect']);
  assert.match(output.join('\n'), /STATUS ENSURED/);
  assert.doesNotMatch(output.join('\n'), /secret\.invalid/);
});

await check('5. failed recovery is honest, bounded, and still disconnects', async () => {
  let reconcileCalls = 0;
  let disconnectCalls = 0;
  const output = [];
  const exitCode = await runReconciliationCli({
    args: ['--history-id', HISTORY_ID],
    environment: {
      MONGO_URI: 'mongodb://secret.invalid/strideto',
      STRIDETO_NOTIFICATION_RECONCILE_CONFIRM: '1',
    },
    connect: async () => undefined,
    disconnect: async () => { disconnectCalls += 1; },
    reconcile: async () => {
      reconcileCalls += 1;
      return {
        status: SKILL_TRUST_IN_APP_DELIVERY.PENDING_RECONCILIATION,
        transitionId: HISTORY_ID,
        created: 0,
        skipped: 0,
        failed: 1,
      };
    },
    output: (line) => output.push(line),
  });
  assert.equal(exitCode, 1);
  assert.equal(reconcileCalls, 1);
  assert.equal(disconnectCalls, 1);
  assert.match(output.join('\n'), /FAILED 1/);
});

await check('6. operational output contains no notification body or recipient data', () => {
  const text = reconciliationOutput({
    status: SKILL_TRUST_IN_APP_DELIVERY.ENSURED,
    transitionId: HISTORY_ID,
    created: 1,
    skipped: 2,
    failed: 0,
    body: 'private review reason',
    userId: 'private-user-id',
  });
  assert.doesNotMatch(text, /private review reason|private-user-id/);
  assert.match(text, /CREATED 1/);
});

const matchingIndex = {
  name: USER_NOTIFICATION_DEDUPE_INDEX.name,
  key: { dedupeKey: 1 },
  unique: true,
  partialFilterExpression: { dedupeKey: { $type: 'string' } },
};

await check('7. source disables automatic notification index creation', () => {
  assert.equal(UserNotification.schema.options.autoIndex, false);
  assert.equal(UserNotification.schema.options.autoCreate, false);
});

await check('8. readiness verifies the exact unique partial dedupe index', () => {
  assert.deepEqual(compareNotificationDedupeIndex([matchingIndex]), {
    status: 'MATCH',
    ready: true,
    differences: [],
  });
  assert.equal(compareNotificationDedupeIndex([]).status, 'MISSING');
  const mismatch = compareNotificationDedupeIndex([{
    ...matchingIndex,
    partialFilterExpression: { dedupeKey: { $exists: true } },
  }]);
  assert.equal(mismatch.status, 'MISMATCH');
  assert.deepEqual(mismatch.differences, ['partialFilterExpression']);
});

await check('9. verify mode is default and cannot mutate indexes', async () => {
  assert.equal(parseIndexArgs([]), 'verify');
  assert.equal(parseIndexArgs(['--verify']), 'verify');
  assert.equal(parseIndexArgs(['--apply']), 'apply');
  assert.equal(parseIndexArgs(['--help']), 'help');
  let creates = 0;
  const execution = await executeNotificationIndexReadiness({
    mode: 'verify',
    inspectIndexes: async () => [],
    createIndex: async () => { creates += 1; },
    output: () => undefined,
  });
  assert.equal(execution.exitCode, 1);
  assert.equal(creates, 0);
});

await check('10. apply requires confirmation and refuses mismatched replacement', async () => {
  assert.throws(
    () => assertIndexApplyConfirmation('apply', {}),
    (error) => error instanceof NotificationIndexReadinessError
      && error.code === 'APPLY_CONFIRMATION_REQUIRED'
  );
  assert.doesNotThrow(() => assertIndexApplyConfirmation('verify', {}));
  await assert.rejects(
    () => executeNotificationIndexReadiness({
      mode: 'apply',
      inspectIndexes: async () => [{ ...matchingIndex, unique: false }],
      createIndex: async () => assert.fail('must not replace a mismatched index'),
      output: () => undefined,
    }),
    (error) => error instanceof NotificationIndexReadinessError
      && error.code === 'MISMATCHED_INDEX_REQUIRES_OPERATOR_REVIEW'
  );
});

await check('11. confirmed apply creates only the missing exact index then re-verifies', async () => {
  let present = false;
  let createCalls = 0;
  const execution = await executeNotificationIndexReadiness({
    mode: 'apply',
    inspectIndexes: async () => present ? [matchingIndex] : [],
    createIndex: async (key, options) => {
      createCalls += 1;
      assert.deepEqual(key, { dedupeKey: 1 });
      assert.equal(options.name, USER_NOTIFICATION_DEDUPE_INDEX.name);
      assert.equal(options.unique, true);
      assert.deepEqual(options.partialFilterExpression, {
        dedupeKey: { $type: 'string' },
      });
      present = true;
    },
    output: () => undefined,
  });
  assert.equal(createCalls, 1);
  assert.equal(execution.exitCode, 0);
});

await check('12. absent collection is treated as missing; unrelated errors remain fatal', async () => {
  assert.deepEqual(await inspectNotificationIndexes(async () => {
    throw Object.assign(new Error('missing'), { code: 26 });
  }), []);
  await assert.rejects(
    () => inspectNotificationIndexes(async () => {
      throw Object.assign(new Error('unauthorized'), { code: 13 });
    }),
    /unauthorized/
  );
});

await check('13. index CLI never connects for help or unconfirmed apply', async () => {
  let connects = 0;
  assert.equal(await runIndexCli({
    args: ['--help'],
    connect: async () => { connects += 1; },
    output: () => undefined,
  }), 0);
  const errors = [];
  assert.equal(await runIndexCli({
    args: ['--apply'],
    environment: { MONGO_URI: 'mongodb://secret.invalid/strideto' },
    connect: async () => { connects += 1; },
    errorOutput: (line) => errors.push(line),
  }), 1);
  assert.equal(connects, 0);
  assert.deepEqual(errors, ['ERROR APPLY_CONFIRMATION_REQUIRED']);
  assert.doesNotMatch(notificationIndexHelpText(), /secret\.invalid/);
});

console.log(`\n${passed}/${total} Skill Trust notification operational checks passed.`);
