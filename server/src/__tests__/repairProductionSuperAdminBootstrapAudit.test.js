/**
 * Audit-only historical SuperAdmin repair tests. No Mongo connection is used.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { runProductionSuperAdminBootstrapAuditRepair } from '../scripts/repairProductionSuperAdminBootstrapAudit.js';

assert.strictEqual(mongoose.connection.readyState, 0, 'test must remain DB-free');

const TARGET_ID = '507f1f77bcf86cd799439022';
const BASE_ENV = Object.freeze({
  NODE_ENV: 'production',
  STRIDETO_SUPERADMIN_AUDIT_REPAIR_USER_ID: TARGET_ID,
  STRIDETO_SUPERADMIN_AUDIT_REPAIR_CONFIRM: '1',
  STRIDETO_SUPERADMIN_AUDIT_REPAIR_PRODUCTION_CONFIRM: 'REPAIR_FIRST_SUPERADMIN_AUDIT',
});

let passed = 0;
const repairScriptSource = readFileSync(
  new URL('../scripts/repairProductionSuperAdminBootstrapAudit.js', import.meta.url),
  'utf8',
);
function check(condition, label) {
  assert.ok(condition, label);
  passed += 1;
  process.stdout.write(`  [PASS] ${label}\n`);
}

function makeRuntime({
  target = { _id: TARGET_ID, role: 'SuperAdmin', accountStatus: 'active' },
  superAdminCount = 1,
  claimExists = true,
  existingRepair = false,
  repairError = null,
  sharedStore = null,
} = {}) {
  const calls = { connect: 0, close: 0, findTarget: 0, count: 0, claim: 0, exists: 0, create: 0, payloads: [] };
  return {
    calls,
    factory: async () => ({
      async connect() { calls.connect += 1; },
      async close() { calls.close += 1; },
      async findTarget() { calls.findTarget += 1; return target; },
      async countSuperAdmins() { calls.count += 1; return superAdminCount; },
      async bootstrapClaimExists() { calls.claim += 1; return claimExists; },
      async repairExists() {
        calls.exists += 1;
        return existingRepair || !!sharedStore?.created;
      },
      async createRepairAudit(payload) {
        calls.create += 1;
        calls.payloads.push(payload);
        if (repairError) throw repairError;
        if (sharedStore?.created) {
          const error = new Error('duplicate repair event');
          error.code = 11000;
          throw error;
        }
        if (sharedStore) sharedStore.created = true;
      },
    }),
  };
}

process.stdout.write('\n1. confirmation gates:\n');
for (const env of [
  { ...BASE_ENV, STRIDETO_SUPERADMIN_AUDIT_REPAIR_CONFIRM: undefined },
  { ...BASE_ENV, STRIDETO_SUPERADMIN_AUDIT_REPAIR_PRODUCTION_CONFIRM: undefined },
]) {
  const rt = makeRuntime();
  const result = await runProductionSuperAdminBootstrapAuditRepair({ argv: ['--apply'], env, runtimeFactory: rt.factory, write: () => {} });
  check(!result.ok && rt.calls.create === 0, 'SA-REPAIR-01/02: missing confirmation performs zero writes');
}

for (const options of [
  { target: null },
  { target: { _id: TARGET_ID, role: 'Admin', accountStatus: 'active' } },
  { target: { _id: TARGET_ID, role: 'SuperAdmin', accountStatus: 'suspended' } },
  { superAdminCount: 0 },
  { superAdminCount: 2 },
  { claimExists: false },
]) {
  const rt = makeRuntime(options);
  const result = await runProductionSuperAdminBootstrapAuditRepair({ argv: ['--apply'], env: BASE_ENV, runtimeFactory: rt.factory, write: () => {} });
  check(!result.ok && rt.calls.create === 0, 'SA-REPAIR-03..07: invalid preflight performs zero writes');
}

process.stdout.write('\n2. valid repair:\n');
{
  const rt = makeRuntime();
  const result = await runProductionSuperAdminBootstrapAuditRepair({ argv: ['--apply'], env: BASE_ENV, runtimeFactory: rt.factory, write: () => {} });
  const payload = rt.calls.payloads[0];
  check(result.code === 'AUDIT_REPAIR_CREATED' && rt.calls.create === 1, 'SA-REPAIR-08: valid repair creates one audit event');
  check(payload.targetId === TARGET_ID, 'SA-REPAIR-08: target identity is bounded');
  check(payload.action === 'production.superadmin_bootstrap_audit_repair', 'SA-REPAIR-08: repair action is explicit');
  check(payload.auditId, 'SA-REPAIR-08: deterministic audit event ID is supplied');
  check(/throwOnError:\s*true/.test(repairScriptSource), 'SA-REPAIR-17: repair runtime requests strict persistence');
  check(/actor: \{ userId: null, role: 'system' \}/.test(repairScriptSource), 'SA-REPAIR-09: system actor uses null userId');
  check(/repairKey: REPAIR_KEY/.test(repairScriptSource), 'SA-REPAIR-10: repair key is deterministic');
  check(/fromRole: 'Admin'[\s\S]*toRole: 'SuperAdmin'/.test(repairScriptSource), 'SA-REPAIR-10: historical role transition preserved');
  check(/bootstrapClaimId: BOOTSTRAP_CLAIM_ID/.test(repairScriptSource), 'SA-REPAIR-10: bootstrap claim identity preserved');
  check(/originalBootstrapAuditPersistence: 'failed'/.test(repairScriptSource), 'SA-REPAIR-10: original audit failure recorded truthfully');
  check(!JSON.stringify(payload).includes('password') && !JSON.stringify(payload).includes('MONGO_URI'), 'SA-REPAIR-18: no sensitive fields in audit payload');
}

process.stdout.write('\n3. idempotency and failure:\n');
{
  const existing = makeRuntime({ existingRepair: true });
  const result = await runProductionSuperAdminBootstrapAuditRepair({ argv: ['--apply'], env: BASE_ENV, runtimeFactory: existing.factory, write: () => {} });
  check(result.code === 'AUDIT_REPAIR_ALREADY_EXISTS' && existing.calls.create === 0, 'SA-REPAIR-11: existing repair creates no duplicate');
}
{
  const shared = { created: false };
  const factory = makeRuntime({ sharedStore: shared }).factory;
  const results = await Promise.all([
    runProductionSuperAdminBootstrapAuditRepair({ argv: ['--apply'], env: BASE_ENV, runtimeFactory: factory, write: () => {} }),
    runProductionSuperAdminBootstrapAuditRepair({ argv: ['--apply'], env: BASE_ENV, runtimeFactory: factory, write: () => {} }),
  ]);
  check(results.filter((r) => r.code === 'AUDIT_REPAIR_CREATED').length === 1, 'SA-REPAIR-12: concurrent repair has one creator');
  check(results.every((r) => ['AUDIT_REPAIR_CREATED', 'AUDIT_REPAIR_ALREADY_EXISTS'].includes(r.code)), 'SA-REPAIR-12: concurrent loser is safe');
}
{
  const rt = makeRuntime({ repairError: Object.assign(new Error('audit unavailable'), { code: 'AUDIT_PERSIST_FAILED' }) });
  const result = await runProductionSuperAdminBootstrapAuditRepair({ argv: ['--apply'], env: BASE_ENV, runtimeFactory: rt.factory, write: () => {} });
  check(result.code === 'AUDIT_REPAIR_FAILED' && rt.calls.create === 1, 'SA-REPAIR-17: persistence failure is observable');
  check(!('changeRole' in rt.calls) && !('revokeSessions' in rt.calls) && !('mutateClaim' in rt.calls), 'SA-REPAIR-13..16: no role/session/capability/claim mutation path exists');
}

process.stdout.write(`\n${passed} checks passed.\n`);
