/**
 * provisionProductionSuperAdmin — focused contract tests.
 * Run: node server/src/__tests__/provisionProductionSuperAdmin.test.js
 *
 * Cases:
 *  1  --verify does not mutate (no changeRole, no audit called)
 *  2  production NODE_ENV required
 *  3  STRIDETO_SUPERADMIN_EMAIL required
 *  4  STRIDETO_SUPERADMIN_PRODUCTION_CONFIRM required for apply
 *  5  STRIDETO_SUPERADMIN_PROVISION_CONFIRM required for apply
 *  6  target account missing → ACCOUNT_NOT_FOUND
 *  7  target role Admin → eligible → SUPERADMIN_PROVISIONED
 *  8  target role User → ROLE_NOT_ADMIN (denied)
 *  9  target suspended → ACCOUNT_NOT_ACTIVE (denied)
 * 10  existing SuperAdmin present → apply → SUPERADMIN_ALREADY_EXISTS
 * 11  successful first bootstrap → code=SUPERADMIN_PROVISIONED, ok=true
 * 12  canonical changeUserRole called with expectedPriorRole=Admin
 * 13  audit emitted with correct action after successful apply
 * 14  final role re-read verified (findTargetAccount called twice in apply)
 * 15  email and secret values not printed in output
 * 16  second apply with existing SuperAdmin refused (SUPERADMIN_ALREADY_EXISTS)
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { runProductionSuperAdminProvisioning } from '../scripts/provisionProductionSuperAdmin.js';

assert.strictEqual(mongoose.connection.readyState, 0, 'test must remain DB-free');

let passed = 0;
function check(condition, label) {
  assert.ok(condition, label);
  passed += 1;
  process.stdout.write(`  [PASS] ${label}\n`);
}

const ACCOUNT_ID = '507f1f77bcf86cd799439022';
const TARGET_EMAIL = 'superadmin-target@example.test';

const PROD_ENV = Object.freeze({
  NODE_ENV: 'production',
  STRIDETO_SUPERADMIN_EMAIL: TARGET_EMAIL,
  STRIDETO_SUPERADMIN_PROVISION_CONFIRM: '1',
  STRIDETO_SUPERADMIN_PRODUCTION_CONFIRM: 'PROVISION_FIRST_SUPERADMIN',
});

function makeRuntime({
  superAdminCount = 0,
  finalSuperAdminCount = 1,
  accountRole = 'Admin',
  accountStatus = 'active',
  accountMissing = false,
  mutationCode = 'SUBJECT_STATE_UPDATED',
  connectError = false,
  closeError = false,
  mutationError = false,
  auditError = false,
  finalRoles = null,
} = {}) {
  const calls = {
    connect: 0,
    close: 0,
    countSuperAdmins: [],
    findTargetAccount: [],
    changeRole: [],
    audit: [],
    order: [], // call-order log for ordering assertions
  };
  let findCallIndex = 0;
  let countCallIndex = 0;
  const allFinalRoles = finalRoles ?? [accountRole, 'SuperAdmin'];

  return {
    calls,
    factory: async () => ({
      async connect() {
        calls.connect += 1;
        if (connectError) throw new Error('db connect failed');
      },
      async close() {
        calls.close += 1;
        if (closeError) throw new Error('db close failed');
      },
      async countSuperAdmins() {
        const count = countCallIndex === 0 ? superAdminCount : finalSuperAdminCount;
        countCallIndex += 1;
        calls.countSuperAdmins.push(count);
        calls.order.push('countSuperAdmins');
        return count;
      },
      async findTargetAccount(email) {
        calls.findTargetAccount.push(email);
        calls.order.push('findTargetAccount');
        if (accountMissing) return null;
        const role = allFinalRoles[Math.min(findCallIndex, allFinalRoles.length - 1)];
        findCallIndex += 1;
        return { _id: ACCOUNT_ID, role, accountStatus };
      },
      async changeRole(args) {
        calls.changeRole.push(args);
        calls.order.push('changeRole');
        if (mutationError) throw new Error('mutation failure');
        return { code: mutationCode };
      },
      async audit(args) {
        calls.audit.push(args);
        calls.order.push('audit');
        if (auditError) throw new Error('audit persistence failure');
      },
    }),
  };
}

// ─── 1: --verify does not mutate ────────────────────────────────────────────
process.stdout.write('\n1. verify does not mutate:\n');
{
  const rt = makeRuntime();
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--verify'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.ok === true, '1: verify returns ok=true');
  check(result.code === 'VERIFIED', '1: verify returns VERIFIED code');
  check(rt.calls.changeRole.length === 0, '1: changeRole NOT called during verify');
  check(rt.calls.audit.length === 0, '1: audit NOT called during verify');
}

// ─── 2: production NODE_ENV required ────────────────────────────────────────
process.stdout.write('\n2. production env required:\n');
{
  for (const env of [
    { ...PROD_ENV, NODE_ENV: 'staging' },
    { ...PROD_ENV, NODE_ENV: 'development' },
    { ...PROD_ENV, NODE_ENV: undefined },
  ]) {
    const rt = makeRuntime();
    const result = await runProductionSuperAdminProvisioning({
      argv: ['--verify'],
      env,
      runtimeFactory: rt.factory,
      write: () => {},
    });
    check(result.ok === false, `2: non-production env denied (${env.NODE_ENV})`);
    check(result.code === 'PRODUCTION_ENV_REQUIRED', `2: code=PRODUCTION_ENV_REQUIRED (${env.NODE_ENV})`);
    check(rt.calls.connect === 0, `2: no DB connection opened (${env.NODE_ENV})`);
  }
}

// ─── 3: target email required ────────────────────────────────────────────────
process.stdout.write('\n3. target email required:\n');
{
  for (const email of [undefined, '', '   ']) {
    const rt = makeRuntime();
    const result = await runProductionSuperAdminProvisioning({
      argv: ['--verify'],
      env: { ...PROD_ENV, STRIDETO_SUPERADMIN_EMAIL: email },
      runtimeFactory: rt.factory,
      write: () => {},
    });
    check(result.ok === false, `3: missing email denied (${JSON.stringify(email)})`);
    check(result.code === 'TARGET_EMAIL_REQUIRED', `3: code=TARGET_EMAIL_REQUIRED (${JSON.stringify(email)})`);
    check(rt.calls.connect === 0, '3: no DB connection opened');
  }
}

// ─── 4: STRIDETO_SUPERADMIN_PRODUCTION_CONFIRM required for apply ────────────
process.stdout.write('\n4. production confirmation required for apply:\n');
{
  const rt = makeRuntime();
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: { ...PROD_ENV, STRIDETO_SUPERADMIN_PRODUCTION_CONFIRM: undefined },
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.ok === false, '4: apply without PRODUCTION_CONFIRM denied');
  check(result.code === 'PRODUCTION_CONFIRM_REQUIRED', '4: code=PRODUCTION_CONFIRM_REQUIRED');
  check(rt.calls.connect === 0, '4: no DB connection opened');
}
{
  const rt = makeRuntime();
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: { ...PROD_ENV, STRIDETO_SUPERADMIN_PRODUCTION_CONFIRM: 'WRONG_TOKEN' },
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.ok === false, '4: apply with wrong PRODUCTION_CONFIRM token denied');
  check(result.code === 'PRODUCTION_CONFIRM_REQUIRED', '4: code=PRODUCTION_CONFIRM_REQUIRED (wrong token)');
}

// ─── 5: STRIDETO_SUPERADMIN_PROVISION_CONFIRM required for apply ─────────────
process.stdout.write('\n5. provision confirmation required for apply:\n');
{
  const rt = makeRuntime();
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: { ...PROD_ENV, STRIDETO_SUPERADMIN_PROVISION_CONFIRM: undefined },
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.ok === false, '5: apply without PROVISION_CONFIRM denied');
  check(result.code === 'PROVISION_CONFIRM_REQUIRED', '5: code=PROVISION_CONFIRM_REQUIRED');
  check(rt.calls.connect === 0, '5: no DB connection opened');
}

// ─── 6: target account missing → denied ─────────────────────────────────────
process.stdout.write('\n6. target account missing:\n');
{
  const rt = makeRuntime({ accountMissing: true });
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.ok === false, '6: missing account → denied');
  check(result.code === 'ACCOUNT_NOT_FOUND', '6: code=ACCOUNT_NOT_FOUND');
  check(rt.calls.changeRole.length === 0, '6: changeRole not called for missing account');
}

// ─── 7: target role Admin → eligible ─────────────────────────────────────────
process.stdout.write('\n7. target role Admin → eligible:\n');
{
  const rt = makeRuntime({ accountRole: 'Admin' });
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.ok === true, '7: Admin account → ok=true');
  check(result.code === 'SUPERADMIN_PROVISIONED', '7: code=SUPERADMIN_PROVISIONED');
}

// ─── 8: target role User → denied ────────────────────────────────────────────
process.stdout.write('\n8. target role User → denied:\n');
{
  for (const role of ['User', 'Editor', 'Moderator']) {
    const rt = makeRuntime({ accountRole: role, finalRoles: [role, role] });
    const result = await runProductionSuperAdminProvisioning({
      argv: ['--apply'],
      env: PROD_ENV,
      runtimeFactory: rt.factory,
      write: () => {},
    });
    check(result.ok === false, `8: ${role} role → denied`);
    check(result.code === 'ROLE_NOT_ADMIN', `8: code=ROLE_NOT_ADMIN for role=${role}`);
    check(rt.calls.changeRole.length === 0, `8: changeRole not called for ${role}`);
  }
}

// ─── 9: suspended account → denied ───────────────────────────────────────────
process.stdout.write('\n9. suspended/inactive account denied:\n');
{
  for (const status of ['suspended', 'inactive', 'pending']) {
    const rt = makeRuntime({ accountRole: 'Admin', accountStatus: status });
    const result = await runProductionSuperAdminProvisioning({
      argv: ['--apply'],
      env: PROD_ENV,
      runtimeFactory: rt.factory,
      write: () => {},
    });
    check(result.ok === false, `9: accountStatus=${status} → denied`);
    check(result.code === 'ACCOUNT_NOT_ACTIVE', `9: code=ACCOUNT_NOT_ACTIVE for status=${status}`);
    check(rt.calls.changeRole.length === 0, `9: changeRole not called for status=${status}`);
  }
}

// ─── 10: existing SuperAdmin → apply denied ──────────────────────────────────
process.stdout.write('\n10. existing SuperAdmin → apply denied:\n');
{
  const rt = makeRuntime({ superAdminCount: 1 });
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.ok === false, '10: existing SuperAdmin → ok=false');
  check(result.code === 'SUPERADMIN_ALREADY_EXISTS', '10: code=SUPERADMIN_ALREADY_EXISTS');
  check(rt.calls.changeRole.length === 0, '10: changeRole not called when SuperAdmin already exists');
  check(rt.calls.audit.length === 0, '10: audit not emitted when blocked by existing SuperAdmin');
}

// ─── 11: successful first bootstrap ─────────────────────────────────────────
process.stdout.write('\n11. successful first bootstrap:\n');
{
  const rt = makeRuntime({ superAdminCount: 0, accountRole: 'Admin' });
  const lines = [];
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: (l) => lines.push(l),
  });
  check(result.ok === true, '11: successful bootstrap → ok=true');
  check(result.code === 'SUPERADMIN_PROVISIONED', '11: code=SUPERADMIN_PROVISIONED');
  const output = lines.join('\n');
  check(output.includes('status=success'), '11: output contains status=success');
  check(output.includes('code=SUPERADMIN_PROVISIONED'), '11: output contains SUPERADMIN_PROVISIONED');
  check(output.includes('finalRole=SuperAdmin'), '11: output contains finalRole=SuperAdmin');
}

// ─── 12: canonical changeUserRole called with expectedPriorRole=Admin ────────
process.stdout.write('\n12. canonical changeUserRole used:\n');
{
  const rt = makeRuntime({ superAdminCount: 0, accountRole: 'Admin' });
  await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(rt.calls.changeRole.length === 1, '12: changeRole called exactly once');
  check(
    rt.calls.changeRole[0].expectedPriorRole === 'Admin',
    '12: changeRole called with expectedPriorRole=Admin'
  );
  check(
    rt.calls.changeRole[0].newRole === 'SuperAdmin',
    '12: changeRole called with newRole=SuperAdmin'
  );
  check(
    typeof rt.calls.changeRole[0].subjectId === 'string' && rt.calls.changeRole[0].subjectId.length > 0,
    '12: subjectId passed to changeRole'
  );
}

// ─── 13: audit emitted with correct action ────────────────────────────────────
process.stdout.write('\n13. audit emitted:\n');
{
  const rt = makeRuntime({ superAdminCount: 0, accountRole: 'Admin' });
  await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(rt.calls.audit.length === 1, '13: audit called exactly once');
  const evt = rt.calls.audit[0];
  check(evt.action === 'production.superadmin_bootstrap', '13: audit action=production.superadmin_bootstrap');
  check(evt.previousRole === 'Admin', '13: audit previousRole=Admin');
  check(evt.newRole === 'SuperAdmin', '13: audit newRole=SuperAdmin');
  check(evt.bootstrapMechanism === 'production_first_superadmin', '13: bootstrapMechanism recorded');
  check(typeof evt.targetId === 'string' && evt.targetId.length > 0, '13: targetId present in audit');
}

// ─── 14: final role re-read verified ─────────────────────────────────────────
process.stdout.write('\n14. final role re-read verified:\n');
{
  const rt = makeRuntime({ superAdminCount: 0, accountRole: 'Admin' });
  await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  // findTargetAccount: once for initial lookup, once for final re-read
  check(rt.calls.findTargetAccount.length >= 2, '14: findTargetAccount called at least twice (initial + re-read)');
  // countSuperAdmins: once before mutation, once after
  check(rt.calls.countSuperAdmins.length >= 2, '14: countSuperAdmins called at least twice (pre + post)');
}

// ─── 14b: failed final re-read → FINAL_VERIFICATION_FAILED, no audit ────────
{
  const rt = makeRuntime({
    superAdminCount: 0,
    finalSuperAdminCount: 0,
    accountRole: 'Admin',
    finalRoles: ['Admin', 'Admin'],  // re-read still returns Admin (stale read)
  });
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.ok === false, '14b: stale re-read → ok=false');
  check(result.code === 'FINAL_VERIFICATION_FAILED', '14b: code=FINAL_VERIFICATION_FAILED');
  check(rt.calls.audit.length === 0, '14b: audit NOT called when final role verification fails');
}

// ─── 15: email and secrets not printed in output ─────────────────────────────
process.stdout.write('\n15. no sensitive data in output:\n');
{
  const sensitiveEnv = {
    ...PROD_ENV,
    STRIDETO_SUPERADMIN_EMAIL: 'sensitive-user@example.test',
    MONGO_URI: 'mongodb+srv://secret:password@cluster.example.com/prod',
  };
  const lines = [];
  await runProductionSuperAdminProvisioning({
    argv: ['--verify'],
    env: sensitiveEnv,
    runtimeFactory: makeRuntime().factory,
    write: (l) => lines.push(l),
  });
  const output = lines.join('\n');
  check(!output.includes('sensitive-user@example.test'), '15: email not in verify output');
  check(!output.includes('mongodb+srv'), '15: mongo URI not in output');
  check(!output.includes('secret:password'), '15: password not in output');

  // Also test failed-path output
  const failLines = [];
  await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: { ...sensitiveEnv, NODE_ENV: 'staging' },
    runtimeFactory: makeRuntime().factory,
    write: (l) => failLines.push(l),
  });
  const failOutput = failLines.join('\n');
  check(!failOutput.includes('sensitive-user@example.test'), '15: email not in failure output');
}

// ─── 16: second apply (SuperAdmin already exists) safely refused ─────────────
process.stdout.write('\n16. second apply safely refused:\n');
{
  const rt = makeRuntime({ superAdminCount: 2 });
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.ok === false, '16: second apply refused → ok=false');
  check(result.code === 'SUPERADMIN_ALREADY_EXISTS', '16: code=SUPERADMIN_ALREADY_EXISTS');
  check(rt.calls.changeRole.length === 0, '16: changeRole not called on second apply');
  check(rt.calls.audit.length === 0, '16: audit not emitted on second apply');
}

// ─── A: final role re-read happens BEFORE success audit ──────────────────────
process.stdout.write('\nA. ordering: re-read before audit:\n');
{
  const rt = makeRuntime({ superAdminCount: 0, accountRole: 'Admin' });
  await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  const order = rt.calls.order;
  const lastFindIdx = order.lastIndexOf('findTargetAccount');  // final re-read
  const auditIdx = order.indexOf('audit');
  check(lastFindIdx !== -1 && auditIdx !== -1, 'A: both findTargetAccount and audit appear in call order');
  check(lastFindIdx < auditIdx, 'A: findTargetAccount (re-read) called BEFORE audit in apply path');
  check(order.indexOf('changeRole') < lastFindIdx, 'A: changeRole called BEFORE final re-read');
}

// ─── B: final role failure → no success audit ─────────────────────────────
process.stdout.write('\nB. final role failure → no audit:\n');
{
  const rt = makeRuntime({
    superAdminCount: 0,
    finalSuperAdminCount: 0,
    accountRole: 'Admin',
    finalRoles: ['Admin', 'Admin'],
  });
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.code === 'FINAL_VERIFICATION_FAILED', 'B: code=FINAL_VERIFICATION_FAILED');
  check(rt.calls.audit.length === 0, 'B: audit NOT called after final role verification failure');
}

// ─── C: final count failure → no success audit ───────────────────────────
process.stdout.write('\nC. final count failure → no audit:\n');
{
  // mutation succeeds, final re-read shows SuperAdmin, but count stays 0
  const rt = makeRuntime({
    superAdminCount: 0,
    finalSuperAdminCount: 0,   // post-mutation count still 0 (simulates DB inconsistency)
    accountRole: 'Admin',
    finalRoles: ['Admin', 'SuperAdmin'],
  });
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.code === 'FINAL_COUNT_VERIFICATION_FAILED', 'C: code=FINAL_COUNT_VERIFICATION_FAILED');
  check(rt.calls.audit.length === 0, 'C: audit NOT called after final count verification failure');
}

// ─── D: audit failure after confirmed promotion → SUPERADMIN_PROVISIONED_AUDIT_FAILED ─
process.stdout.write('\nD. audit failure after confirmed promotion:\n');
{
  const rt = makeRuntime({ superAdminCount: 0, accountRole: 'Admin', auditError: true });
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.code === 'SUPERADMIN_PROVISIONED_AUDIT_FAILED', 'D: code=SUPERADMIN_PROVISIONED_AUDIT_FAILED');
  check(result.ok === false, 'D: ok=false (truthful partial outcome)');
  check(result.finalRole === 'SuperAdmin', 'D: finalRole=SuperAdmin (role WAS promoted)');
  check(result.manualReviewRequired === true, 'D: manualReviewRequired=true');
}

// ─── E: audit-failure output clearly says finalRole=SuperAdmin ──────────────
process.stdout.write('\nE. audit failure output:\n');
{
  const rt = makeRuntime({ superAdminCount: 0, accountRole: 'Admin', auditError: true });
  const lines = [];
  await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: (l) => lines.push(l),
  });
  const output = lines.join('\n');
  check(output.includes('finalRole=SuperAdmin'), 'E: output contains finalRole=SuperAdmin');
  check(output.includes('SUPERADMIN_PROVISIONED_AUDIT_FAILED'), 'E: output contains SUPERADMIN_PROVISIONED_AUDIT_FAILED');
  check(output.includes('manualReviewRequired=true'), 'E: output contains manualReviewRequired=true');
  check(output.includes('status=partial'), 'E: output contains status=partial (not status=success)');
}

// ─── F: audit-failure output contains no target email/secrets ───────────────
process.stdout.write('\nF. audit failure output has no secrets:\n');
{
  const sensitiveEnv = {
    ...PROD_ENV,
    STRIDETO_SUPERADMIN_EMAIL: 'promo-target@example.test',
  };
  const rt = makeRuntime({ superAdminCount: 0, accountRole: 'Admin', auditError: true });
  const lines = [];
  await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: sensitiveEnv,
    runtimeFactory: rt.factory,
    write: (l) => lines.push(l),
  });
  const output = lines.join('\n');
  check(!output.includes('promo-target@example.test'), 'F: email not in audit-failure output');
  check(!output.includes(ACCOUNT_ID), 'F: user id not in audit-failure output');
}

// ─── G: close failure after successful provisioning does NOT change SUPERADMIN_PROVISIONED ─
process.stdout.write('\nG. close failure preserves provisioning result:\n');
{
  const rt = makeRuntime({ superAdminCount: 0, accountRole: 'Admin', closeError: true });
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.code === 'SUPERADMIN_PROVISIONED', 'G: SUPERADMIN_PROVISIONED preserved despite close failure');
  check(result.ok === true, 'G: ok=true preserved despite close failure');
  check(result.cleanupWarning === true, 'G: cleanupWarning=true attached to signal close issue');
}
{
  // close failure after SUPERADMIN_PROVISIONED_AUDIT_FAILED must also preserve partial outcome
  const rt = makeRuntime({ superAdminCount: 0, accountRole: 'Admin', auditError: true, closeError: true });
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--apply'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(
    result.code === 'SUPERADMIN_PROVISIONED_AUDIT_FAILED',
    'G: SUPERADMIN_PROVISIONED_AUDIT_FAILED preserved despite close failure'
  );
}

// ─── H: verify mode still never mutates/audits ──────────────────────────────
process.stdout.write('\nH. verify never mutates:\n');
{
  const rt = makeRuntime({ superAdminCount: 0, accountRole: 'Admin' });
  const result = await runProductionSuperAdminProvisioning({
    argv: ['--verify'],
    env: PROD_ENV,
    runtimeFactory: rt.factory,
    write: () => {},
  });
  check(result.ok === true && result.code === 'VERIFIED', 'H: verify returns VERIFIED');
  check(rt.calls.changeRole.length === 0, 'H: changeRole not called in verify mode');
  check(rt.calls.audit.length === 0, 'H: audit not called in verify mode');
  check(rt.calls.order.filter((c) => c === 'changeRole' || c === 'audit').length === 0,
    'H: no mutation operations appear in call order log during verify');
}

// ─── Summary ─────────────────────────────────────────────────────────────────
process.stdout.write(`\n${passed} checks passed.\n`);
