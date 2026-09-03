/**
 * Focused audit contract tests for the first-SuperAdmin bootstrap.
 * Run: node server/src/__tests__/superadminBootstrapAuditService.test.js
 *
 * These tests stub AuditLog.create and never connect to MongoDB.
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { logAudit } from '../services/auditService.js';

assert.strictEqual(mongoose.connection.readyState, 0, 'test must remain DB-free');

let passed = 0;
function check(condition, label) {
  assert.ok(condition, label);
  passed += 1;
  process.stdout.write(`  [PASS] ${label}\n`);
}

const originalCreate = AuditLog.create;
const originalError = console.error;
let payload;

try {
  AuditLog.create = async (input) => {
    payload = input;
    return input;
  };

  const success = await logAudit({
    actor: { userId: null, role: 'system' },
    action: 'production.superadmin_bootstrap',
    targetType: 'user',
    targetId: '507f1f77bcf86cd799439022',
    metadata: { systemActor: 'system:production_bootstrap' },
    throwOnError: true,
  });
  check(success === undefined, 'AUD-COMPAT-05: strict success preserves void result');
  check(payload.actorId == null, 'SA-AUD-02: system actor has null-compatible actorId');
  check(payload.actorRole === 'system', 'SA-AUD-03: bounded system actor role persists');
  check(payload.metadata.systemActor === 'system:production_bootstrap', 'SA-AUD-03: bounded system provenance persists');
  await new AuditLog(payload).validate();
  passed += 1;
  process.stdout.write('  [PASS] SA-AUD-01: system audit payload satisfies AuditLog validation\n');

  const normalSuccess = await logAudit({
    actor: { userId: '507f1f77bcf86cd799439023', role: 'Admin' },
    action: 'test.audit',
  });
  check(normalSuccess === undefined, 'AUD-COMPAT-01: default success preserves void result');
  check(payload.actorId === '507f1f77bcf86cd799439023', 'SA-AUD-04: normal user actor remains supported');

  AuditLog.create = async () => {
    throw new Error('simulated persistence failure');
  };
  console.error = () => {};

  const legacyFailure = await logAudit({ action: 'legacy.audit' });
  check(legacyFailure === undefined, 'AUD-COMPAT-02: default failure preserves void result');
  check(!legacyFailure, 'AUD-COMPAT-03: default persistence failure does not throw');

  await assert.rejects(
    () => logAudit({ action: 'production.superadmin_bootstrap', throwOnError: true }),
    (error) => error?.code === 'AUDIT_PERSIST_FAILED' && !error.message.includes('simulated'),
  );
  passed += 1;
  process.stdout.write('  [PASS] SA-AUD-06: strict audit failure is observable without raw DB details\n');

  const actorPath = AuditLog.schema.path('actorId');
  check(actorPath.instance === 'ObjectId', 'SA-AUD-12: AuditLog actorId remains ObjectId');
  check(actorPath.options.required !== true, 'SA-AUD-02: actorId remains optional for system events');
  check(!Object.prototype.hasOwnProperty.call(payload || {}, 'password'), 'SA-AUD-11: audit payload has no password');
  check(!Object.prototype.hasOwnProperty.call(payload || {}, 'token'), 'SA-AUD-11: audit payload has no token');
  check(!Object.prototype.hasOwnProperty.call(payload || {}, 'MONGO_URI'), 'SA-AUD-11: audit payload has no MONGO_URI');
  check(!('userId' in (payload || {})), 'SA-AUD-13: no synthetic system User is created');
} finally {
  AuditLog.create = originalCreate;
  console.error = originalError;
}

process.stdout.write(`\n${passed} checks passed.\n`);
