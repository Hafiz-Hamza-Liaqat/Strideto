/**
 * Production-only first-SuperAdmin bootstrap.
 *
 * Safety gates (all checked before any DB I/O):
 *   NODE_ENV === 'production'
 *   STRIDETO_SUPERADMIN_EMAIL          — exact account to promote
 *   STRIDETO_SUPERADMIN_PROVISION_CONFIRM === '1'       (apply only)
 *   STRIDETO_SUPERADMIN_PRODUCTION_CONFIRM === 'PROVISION_FIRST_SUPERADMIN' (apply only)
 *
 * Use:
 *   node provisionProductionSuperAdmin.js --verify   (safe, no mutation)
 *   node provisionProductionSuperAdmin.js --apply    (requires both confirmations)
 *
 * This script exists ONLY to create the FIRST SuperAdmin when production has
 * zero SuperAdmins. After the first SuperAdmin is created every future role
 * change must use the audited SuperAdmin role-management flow.
 */
import { pathToFileURL } from 'node:url';

const CURRENT_ROLE = 'Admin';
const DESIRED_ROLE = 'SuperAdmin';
const PRODUCTION_CONFIRM_TOKEN = 'PROVISION_FIRST_SUPERADMIN';
const HELP_TEXT =
  'Usage: provisionProductionSuperAdmin.js [--help|--verify|--apply] (default: --verify)';

function parseMode(argv) {
  if (argv.length === 0) return 'verify';
  if (argv.length !== 1) return null;
  const modes = { '--help': 'help', '--verify': 'verify', '--apply': 'apply' };
  return modes[argv[0]] || null;
}

function safeResult(code, extra = {}) {
  return Object.freeze({ ok: false, code, ...extra });
}

function safeLine(result) {
  if (result.code === 'HELP') return HELP_TEXT;
  if (result.code === 'VERIFIED') {
    return [
      'status=verified',
      `superAdminCount=${result.superAdminCount}`,
      `accountFound=${String(result.accountFound)}`,
      `currentRole=${result.currentRole ?? 'Absent'}`,
      `accountStatus=${result.accountStatus ?? 'unknown'}`,
      `promotionRequired=${String(result.promotionRequired)}`,
    ].join('\n');
  }
  if (result.code === 'SUPERADMIN_PROVISIONED') {
    const lines = ['status=success', 'code=SUPERADMIN_PROVISIONED', 'finalRole=SuperAdmin'];
    if (result.cleanupWarning) lines.push('cleanupWarning=true');
    return lines.join('\n');
  }
  if (result.code === 'ALREADY_SUPERADMIN') {
    return ['status=success', 'code=ALREADY_SUPERADMIN', 'finalRole=SuperAdmin'].join('\n');
  }
  if (result.code === 'SUPERADMIN_PROVISIONED_AUDIT_FAILED') {
    return [
      'status=partial',
      'code=SUPERADMIN_PROVISIONED_AUDIT_FAILED',
      'finalRole=SuperAdmin',
      'manualReviewRequired=true',
    ].join('\n');
  }
  return `status=failed code=${result.code}`;
}

export async function runProductionSuperAdminProvisioning({
  argv = [],
  env = {},
  runtimeFactory,
  write = () => {},
} = {}) {
  const mode = parseMode(argv);

  if (mode === 'help') {
    const result = Object.freeze({ ok: true, code: 'HELP' });
    write(safeLine(result));
    return result;
  }
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

  const targetEmail = String(env.STRIDETO_SUPERADMIN_EMAIL || '').trim().toLowerCase();
  if (!targetEmail) {
    const result = safeResult('TARGET_EMAIL_REQUIRED');
    write(safeLine(result));
    return result;
  }

  if (mode === 'apply') {
    if (env.STRIDETO_SUPERADMIN_PROVISION_CONFIRM !== '1') {
      const result = safeResult('PROVISION_CONFIRM_REQUIRED');
      write(safeLine(result));
      return result;
    }
    if (env.STRIDETO_SUPERADMIN_PRODUCTION_CONFIRM !== PRODUCTION_CONFIRM_TOKEN) {
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
  let provisioningConfirmed = false; // true once final re-read confirms SuperAdmin
  try {
    runtime = await runtimeFactory();
    await runtime.connect();

    const superAdminCount = await runtime.countSuperAdmins();

    if (mode === 'verify') {
      const account = await runtime.findTargetAccount(targetEmail);
      result = Object.freeze({
        ok: true,
        code: 'VERIFIED',
        superAdminCount,
        accountFound: Boolean(account),
        currentRole: account?.role ?? null,
        accountStatus: account?.accountStatus ?? null,
        promotionRequired: account?.role === CURRENT_ROLE && superAdminCount === 0,
      });
    } else {
      if (superAdminCount > 0) {
        result = safeResult('SUPERADMIN_ALREADY_EXISTS');
      } else {
        const account = await runtime.findTargetAccount(targetEmail);

        if (!account) {
          result = safeResult('ACCOUNT_NOT_FOUND');
        } else if (account.accountStatus !== 'active') {
          result = safeResult('ACCOUNT_NOT_ACTIVE');
        } else if (account.role === DESIRED_ROLE) {
          result = Object.freeze({ ok: true, code: 'ALREADY_SUPERADMIN' });
        } else if (account.role !== CURRENT_ROLE) {
          result = safeResult('ROLE_NOT_ADMIN');
        } else {
          const subjectId = account._id.toString();
          const mutation = await runtime.changeRole({
            subjectId,
            expectedPriorRole: CURRENT_ROLE,
            newRole: DESIRED_ROLE,
          });

          if (mutation?.code !== 'SUBJECT_STATE_UPDATED') {
            result = safeResult('SECURITY_MUTATION_FAILED');
          } else {
            // Step 1: re-read target account to confirm role before any audit write.
            const finalAccount = await runtime.findTargetAccount(targetEmail);
            if (finalAccount?.role !== DESIRED_ROLE) {
              result = safeResult('FINAL_VERIFICATION_FAILED');
            } else {
              // Step 2: count SuperAdmins to confirm DB consistency.
              const finalCount = await runtime.countSuperAdmins();
              if (finalCount < 1) {
                result = safeResult('FINAL_COUNT_VERIFICATION_FAILED');
              } else {
                // Step 3: role confirmed SuperAdmin — write success audit.
                provisioningConfirmed = true;
                try {
                  await runtime.audit({
                    action: 'production.superadmin_bootstrap',
                    targetId: subjectId,
                    previousRole: CURRENT_ROLE,
                    newRole: DESIRED_ROLE,
                    bootstrapMechanism: 'production_first_superadmin',
                  });
                  result = Object.freeze({ ok: true, code: 'SUPERADMIN_PROVISIONED' });
                } catch {
                  // Role IS SuperAdmin — audit persistence failed. Do not rollback.
                  result = Object.freeze({
                    ok: false,
                    code: 'SUPERADMIN_PROVISIONED_AUDIT_FAILED',
                    finalRole: DESIRED_ROLE,
                    manualReviewRequired: true,
                  });
                }
              }
            }
          }
        }
      }
    }
  } catch {
    result = safeResult('STORAGE_FAILURE');
  } finally {
    if (runtime) {
      try {
        await runtime.close();
      } catch {
        if (provisioningConfirmed) {
          // Role is confirmed SuperAdmin. Preserve the truthful outcome; attach a warning.
          if (result?.code === 'SUPERADMIN_PROVISIONED') {
            result = Object.freeze({ ...result, cleanupWarning: true });
          }
          // SUPERADMIN_PROVISIONED_AUDIT_FAILED stays as-is.
        } else if (result?.ok) {
          result = safeResult('CLOSE_FAILED');
        }
      }
    }
  }

  write(safeLine(result));
  return result;
}

async function createRuntime() {
  const [
    { User },
    db,
    authFlows,
    denylistModule,
    { secureAuthConfig },
    auditModule,
    redisConfig,
    loggerModule,
  ] = await Promise.all([
    import('../models/User.js'),
    import('../config/db.js'),
    import('../services/auth/userSecureAuthFlows.js'),
    import('../services/auth/accessDenylist.js'),
    import('../services/auth/secureAuthConfig.js'),
    import('../services/auditService.js'),
    import('../config/redis.js'),
    import('../utils/logger.js'),
  ]);
  const originalInfoLogger = loggerModule.logger.info;
  let safeLoggingActive = false;
  const strictDenylist = denylistModule.createAccessDenylistService({ requireSharedStore: true });
  const flows = authFlows.createUserSecureAuthFlows({
    jwtProvider: secureAuthConfig.userJwtProvider,
    originPolicy: secureAuthConfig.originPolicy,
    denylistService: strictDenylist,
  });
  return {
    async connect() {
      loggerModule.logger.info = () => {};
      safeLoggingActive = true;
      await db.connectDB();
    },
    async close() {
      try {
        const redis = await redisConfig.getRedisClient();
        if (redis && typeof redis.quit === 'function') await redis.quit();
      } finally {
        try {
          await db.disconnectDB();
        } finally {
          if (safeLoggingActive) loggerModule.logger.info = originalInfoLogger;
        }
      }
    },
    countSuperAdmins() {
      return User.countDocuments({ role: DESIRED_ROLE });
    },
    findTargetAccount(email) {
      return User.findOne({ email }).select('_id role accountStatus').lean();
    },
    changeRole: flows.changeUserRole,
    async audit({ action, targetId, previousRole, newRole, bootstrapMechanism }) {
      await auditModule.logAudit({
        action,
        actor: { userId: 'system:production_bootstrap', role: 'system' },
        targetType: 'user',
        targetId,
        status: 'success',
        metadata: {
          previousRole,
          newRole,
          bootstrapMechanism,
          timestamp: new Date().toISOString(),
        },
        reason: 'production_first_superadmin_bootstrap',
      });
    },
  };
}

async function main() {
  const result = await runProductionSuperAdminProvisioning({
    argv: process.argv.slice(2),
    env: process.env,
    runtimeFactory: createRuntime,
    write: (line) => process.stdout.write(line + '\n'),
  });
  if (!result.ok) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (invokedPath === import.meta.url) {
  main().catch(() => {
    process.stderr.write('status=failed code=UNEXPECTED_FAILURE\n');
    process.exitCode = 1;
  });
}
