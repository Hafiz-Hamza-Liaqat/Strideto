/**
 * Audit-only repair for the already-completed first SuperAdmin bootstrap.
 *
 * This script never changes User, session, capability, or bootstrap-claim
 * state. It only creates one deterministic AuditLog record after read-only
 * preflight succeeds.
 *
 * Use:
 *   node repairProductionSuperAdminBootstrapAudit.js --verify
 *   node repairProductionSuperAdminBootstrapAudit.js --apply
 */
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';

const DESIRED_ROLE = 'SuperAdmin';
const BOOTSTRAP_CLAIM_ID = 'production-first-superadmin-v1';
const REPAIR_KEY = 'production-first-superadmin-audit-repair-v1';
const REPAIR_EVENT_ID = '507f1f77bcf86cd799439099';
const REPAIR_ACTION = 'production.superadmin_bootstrap_audit_repair';
const PRODUCTION_CONFIRM_TOKEN = 'REPAIR_FIRST_SUPERADMIN_AUDIT';

function safeResult(code, extra = {}) {
  return Object.freeze({ ok: false, code, ...extra });
}

function parseMode(argv) {
  if (argv.length !== 1) return null;
  return { '--verify': 'verify', '--apply': 'apply' }[argv[0]] || null;
}

function safeLine(result) {
  if (result.code === 'AUDIT_REPAIR_READY') return 'status=ready code=AUDIT_REPAIR_READY';
  if (result.code === 'AUDIT_REPAIR_CREATED') return 'status=success code=AUDIT_REPAIR_CREATED';
  if (result.code === 'AUDIT_REPAIR_ALREADY_EXISTS') return 'status=already_repaired code=AUDIT_REPAIR_ALREADY_EXISTS';
  return `status=failed code=${result.code}`;
}

function validTargetId(value) {
  return mongoose.Types.ObjectId.isValid(value) ? String(value) : '';
}

export async function runProductionSuperAdminBootstrapAuditRepair({
  argv = [],
  env = {},
  runtimeFactory,
  write = () => {},
} = {}) {
  const mode = parseMode(argv);
  if (!mode) {
    const result = safeResult('INVALID_ARGUMENTS');
    write(safeLine(result));
    return result;
  }
  if (env.NODE_ENV !== 'production') {
    const result = safeResult('PRODUCTION_ENV_REQUIRED');
    write(safeLine(result));
    return result;
  }

  const targetId = validTargetId(env.STRIDETO_SUPERADMIN_AUDIT_REPAIR_USER_ID);
  if (!targetId) {
    const result = safeResult('TARGET_ID_REQUIRED');
    write(safeLine(result));
    return result;
  }
  if (mode === 'apply') {
    if (env.STRIDETO_SUPERADMIN_AUDIT_REPAIR_CONFIRM !== '1') {
      const result = safeResult('REPAIR_CONFIRM_REQUIRED');
      write(safeLine(result));
      return result;
    }
    if (env.STRIDETO_SUPERADMIN_AUDIT_REPAIR_PRODUCTION_CONFIRM !== PRODUCTION_CONFIRM_TOKEN) {
      const result = safeResult('PRODUCTION_CONFIRM_REQUIRED');
      write(safeLine(result));
      return result;
    }
  }
  if (typeof runtimeFactory !== 'function') {
    const result = safeResult('RUNTIME_UNAVAILABLE');
    write(safeLine(result));
    return result;
  }

  let runtime;
  let result;
  try {
    runtime = await runtimeFactory();
    await runtime.connect();

    const target = await runtime.findTarget(targetId);
    if (!target) {
      result = safeResult('TARGET_INVALID');
    } else if (target.role !== DESIRED_ROLE || target.accountStatus !== 'active') {
      result = safeResult('TARGET_INVALID');
    } else {
      const superAdminCount = await runtime.countSuperAdmins();
      if (superAdminCount !== 1) {
        result = safeResult('SUPERADMIN_CENSUS_INVALID');
      } else if (!(await runtime.bootstrapClaimExists(BOOTSTRAP_CLAIM_ID))) {
        result = safeResult('BOOTSTRAP_CLAIM_MISSING');
      } else if (await runtime.repairExists(REPAIR_KEY, REPAIR_EVENT_ID)) {
        result = Object.freeze({ ok: true, code: 'AUDIT_REPAIR_ALREADY_EXISTS' });
      } else if (mode === 'verify') {
        result = Object.freeze({ ok: true, code: 'AUDIT_REPAIR_READY' });
      } else {
        try {
          await runtime.createRepairAudit({
            auditId: REPAIR_EVENT_ID,
            action: REPAIR_ACTION,
            targetId,
            repairKey: REPAIR_KEY,
            bootstrapClaimId: BOOTSTRAP_CLAIM_ID,
          });
          result = Object.freeze({ ok: true, code: 'AUDIT_REPAIR_CREATED' });
        } catch (error) {
          if (error?.code === 11000 || error?.code === 'AUDIT_REPAIR_ALREADY_EXISTS') {
            result = Object.freeze({ ok: true, code: 'AUDIT_REPAIR_ALREADY_EXISTS' });
          } else {
            result = safeResult('AUDIT_REPAIR_FAILED');
          }
        }
      }
    }
  } catch {
    result = safeResult('AUDIT_REPAIR_FAILED');
  } finally {
    if (runtime) {
      try {
        await runtime.close();
      } catch {
        if (result?.ok && result.code === 'AUDIT_REPAIR_CREATED') {
          result = safeResult('AUDIT_REPAIR_FAILED');
        }
      }
    }
  }

  write(safeLine(result));
  return result;
}

async function createRuntime() {
  const [{ User }, { AuditLog }, db, auditModule] = await Promise.all([
    import('../models/User.js'),
    import('../models/AuditLog.js'),
    import('../config/db.js'),
    import('../services/auditService.js'),
  ]);
  return {
    connect: db.connectDB,
    close: db.disconnectDB,
    findTarget(targetId) {
      return User.findById(targetId).select('_id role accountStatus').lean();
    },
    countSuperAdmins() {
      return User.countDocuments({ role: DESIRED_ROLE });
    },
    bootstrapClaimExists(claimId) {
      return mongoose.connection.db
        .collection('superadmin_bootstrap_claims')
        .findOne({ _id: claimId }, { projection: { _id: 1 } })
        .then(Boolean);
    },
    repairExists(repairKey, auditId) {
      return AuditLog.exists({
        $or: [{ _id: auditId }, { 'metadata.repairKey': repairKey }],
      }).then(Boolean);
    },
    createRepairAudit({ auditId, action, targetId, repairKey, bootstrapClaimId }) {
      return auditModule.logAudit({
        auditId,
        actor: { userId: null, role: 'system' },
        action,
        targetType: 'user',
        targetId,
        status: 'success',
        metadata: {
          systemActor: 'system:production_bootstrap_audit_repair',
          repairKey,
          bootstrapClaimId,
          fromRole: 'Admin',
          toRole: 'SuperAdmin',
          originalBootstrapAuditPersistence: 'failed',
          repairReason: 'record_historical_bootstrap_audit_evidence',
          targetUserId: targetId,
          repairedAt: new Date().toISOString(),
        },
        reason: 'historical_superadmin_bootstrap_audit_repair',
        throwOnError: true,
      });
    },
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (invokedPath === import.meta.url) {
  runProductionSuperAdminBootstrapAuditRepair({
    argv: process.argv.slice(2),
    env: process.env,
    runtimeFactory: createRuntime,
    write: (line) => process.stdout.write(line + '\n'),
  }).then((result) => {
    if (!result.ok && result.code !== 'AUDIT_REPAIR_ALREADY_EXISTS') process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('status=failed code=AUDIT_REPAIR_FAILED\n');
    process.exitCode = 1;
  });
}
