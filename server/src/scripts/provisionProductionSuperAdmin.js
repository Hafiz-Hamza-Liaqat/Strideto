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
import mongoose from 'mongoose';

const CURRENT_ROLE = 'Admin';
const DESIRED_ROLE = 'SuperAdmin';
const PRODUCTION_CONFIRM_TOKEN = 'PROVISION_FIRST_SUPERADMIN';
const BOOTSTRAP_GUARD_ID = 'production-first-superadmin-v1';
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
      `targetMatchCount=${result.targetMatchCount}`,
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

    const accounts = await runtime.findTargetAccounts(targetEmail);
    const targetMatchCount = Array.isArray(accounts) ? accounts.length : 0;

    if (targetMatchCount !== 1) {
      result = safeResult(
        targetMatchCount === 0 ? 'ACCOUNT_NOT_FOUND' : 'TARGET_ACCOUNT_AMBIGUOUS',
        { targetMatchCount }
      );
    } else if (mode === 'verify') {
      const superAdminCount = await runtime.countSuperAdmins();
      const account = accounts[0];
      result = Object.freeze({
        ok: true,
        code: 'VERIFIED',
        superAdminCount,
        accountFound: true,
        currentRole: account?.role ?? null,
        accountStatus: account?.accountStatus ?? null,
        promotionRequired: account?.role === CURRENT_ROLE && superAdminCount === 0,
        targetMatchCount,
      });
    } else {
      const superAdminCount = await runtime.countSuperAdmins();
      if (superAdminCount > 0) {
        result = safeResult('SUPERADMIN_ALREADY_EXISTS');
      } else {
        const account = accounts[0];
        if (account.accountStatus !== 'active') {
          result = safeResult('ACCOUNT_NOT_ACTIVE');
        } else if (account.role === DESIRED_ROLE) {
          result = Object.freeze({ ok: true, code: 'ALREADY_SUPERADMIN' });
        } else if (account.role !== CURRENT_ROLE) {
          result = safeResult('ROLE_NOT_ADMIN');
        } else {
          const subjectId = account._id.toString();
          const claim = await runtime.acquireBootstrapClaim({
            guardId: BOOTSTRAP_GUARD_ID,
            targetId: subjectId,
          });
          if (!claim?.acquired) {
            result = safeResult('BOOTSTRAP_CLAIM_EXISTS');
          } else {
            const claimedSuperAdminCount = await runtime.countSuperAdmins();
            if (claimedSuperAdminCount > 0) {
              result = safeResult('SUPERADMIN_ALREADY_EXISTS_AFTER_CLAIM');
            } else {
              const claimedAccounts = await runtime.findTargetAccounts(targetEmail);
              const claimedAccount = claimedAccounts.length === 1 ? claimedAccounts[0] : null;
              if (
                !claimedAccount ||
                String(claimedAccount._id) !== subjectId ||
                claimedAccount.accountStatus !== 'active' ||
                claimedAccount.role !== CURRENT_ROLE
              ) {
                result = safeResult('TARGET_STATE_CHANGED_AFTER_CLAIM');
              } else {
                const mutation = await runtime.changeRole({
                  subjectId,
                  expectedPriorRole: CURRENT_ROLE,
                  newRole: DESIRED_ROLE,
                });
                if (mutation?.code !== 'SUBJECT_STATE_UPDATED') {
                  result = safeResult('SECURITY_MUTATION_FAILED');
                } else {
                  // Step 1: re-read target account to confirm role before any audit write.
                  const finalAccounts = await runtime.findTargetAccounts(targetEmail);
                  const finalAccount = finalAccounts.length === 1 ? finalAccounts[0] : null;
                  if (finalAccount?.role !== DESIRED_ROLE) {
                    result = safeResult('FINAL_VERIFICATION_FAILED');
                  } else {
                    // Step 2: count SuperAdmins to confirm DB consistency.
                    const finalCount = await runtime.countSuperAdmins();
                    if (finalCount !== 1) {
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
                          guardId: BOOTSTRAP_GUARD_ID,
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
    findTargetAccounts(email) {
      return User.find({ email }).select('_id role accountStatus').limit(2).lean();
    },
    async acquireBootstrapClaim({ guardId, targetId }) {
      try {
        await mongoose.connection.db.collection('superadmin_bootstrap_claims').insertOne({
          _id: guardId,
          status: 'claimed',
          targetId,
          claimedAt: new Date(),
        });
        return { acquired: true };
      } catch (error) {
        if (error?.code === 11000) {
          return { acquired: false, code: 'BOOTSTRAP_CLAIM_EXISTS' };
        }
        throw error;
      }
    },
    changeRole: flows.changeUserRole,
    async audit({ action, targetId, previousRole, newRole, bootstrapMechanism, guardId }) {
      await auditModule.logAudit({
        action,
        actor: { userId: null, role: 'system' },
        targetType: 'user',
        targetId,
        status: 'success',
        metadata: {
          systemActor: 'system:production_bootstrap',
          previousRole,
          newRole,
          bootstrapMechanism,
          guardId,
          timestamp: new Date().toISOString(),
        },
        reason: 'production_first_superadmin_bootstrap',
        throwOnError: true,
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
