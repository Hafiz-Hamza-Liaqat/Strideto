import { pathToFileURL } from 'node:url';

const CURRENT_ROLE = 'Admin';
const DESIRED_ROLE = 'SuperAdmin';
const HELP_TEXT =
  'Usage: provisionLocalSuperAdmin.js [--help|--verify|--apply] (default: --verify)';

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
  if (result.code === 'VERIFIED' || result.code === 'APPLIED') {
    return [
      `status=${result.code.toLowerCase()}`,
      `accountFound=${String(result.accountFound)}`,
      `currentRole=${result.currentRole}`,
      `desiredRole=${DESIRED_ROLE}`,
      `promotionRequired=${String(result.promotionRequired)}`,
      `bootstrapRequired=${String(result.bootstrapRequired)}`,
    ].join(' ');
  }
  return `status=failed code=${result.code} accountFound=${String(Boolean(result.accountFound))}`;
}

export async function runLocalSuperAdminProvisioning({
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
  if (env.NODE_ENV === 'production') {
    const result = safeResult('PRODUCTION_BLOCKED');
    write(safeLine(result));
    return result;
  }
  if (env.APP_ENV !== 'staging') {
    const result = safeResult('STAGING_ENV_REQUIRED');
    write(safeLine(result));
    return result;
  }
  if (mode === 'apply' && env.STRIDETO_SUPERADMIN_PROVISION_CONFIRM !== '1') {
    const result = safeResult('CONFIRMATION_REQUIRED');
    write(safeLine(result));
    return result;
  }
  const configuredEmail = String(env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  if (!configuredEmail) {
    const result = safeResult('CONFIGURED_ACCOUNT_REQUIRED');
    write(safeLine(result));
    return result;
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
    let account = await runtime.findConfiguredAccount(configuredEmail);
    if (!account) {
      if (mode === 'verify') {
        result = Object.freeze({
          ok: true,
          code: 'VERIFIED',
          accountFound: false,
          currentRole: 'Absent',
          promotionRequired: false,
          bootstrapRequired: true,
        });
      } else if (!env.ADMIN_PASSWORD) {
        result = safeResult('BOOTSTRAP_PASSWORD_REQUIRED', {
          accountFound: false,
        });
      } else {
        const bootstrap = await runtime.bootstrapConfiguredAdmin();
        if (bootstrap?.skipped) {
          result = safeResult('BOOTSTRAP_FAILED', { accountFound: false });
        } else {
          account = await runtime.findConfiguredAccount(configuredEmail);
          if (account?.role !== CURRENT_ROLE) {
            result = safeResult('BOOTSTRAP_ROLE_INVALID', {
              accountFound: Boolean(account),
            });
          }
        }
      }
    }
    if (!result && ![CURRENT_ROLE, DESIRED_ROLE].includes(account?.role)) {
      result = safeResult('UNEXPECTED_ROLE', { accountFound: true });
    } else if (!result && mode === 'verify') {
      result = Object.freeze({
        ok: true,
        code: 'VERIFIED',
        accountFound: true,
        currentRole: account.role,
        promotionRequired: account.role === CURRENT_ROLE,
        bootstrapRequired: false,
      });
    } else if (!result && account.role === DESIRED_ROLE) {
      result = Object.freeze({
        ok: true,
        code: 'APPLIED',
        accountFound: true,
        currentRole: DESIRED_ROLE,
        promotionRequired: false,
        bootstrapRequired: false,
        changed: false,
      });
    } else if (!result) {
      const mutation = await runtime.changeRole({
        subjectId: account._id.toString(),
        expectedPriorRole: CURRENT_ROLE,
        newRole: DESIRED_ROLE,
      });
      if (mutation?.code !== 'SUBJECT_STATE_UPDATED') {
        result = safeResult('SECURITY_MUTATION_FAILED', {
          accountFound: true,
        });
      } else {
        const finalAccount =
          await runtime.findConfiguredAccount(configuredEmail);
        if (finalAccount?.role !== DESIRED_ROLE) {
          result = safeResult('FINAL_VERIFICATION_FAILED', {
            accountFound: true,
          });
        } else {
          result = Object.freeze({
            ok: true,
            code: 'APPLIED',
            accountFound: true,
            currentRole: DESIRED_ROLE,
            promotionRequired: false,
            bootstrapRequired: false,
            changed: true,
          });
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
        if (result?.ok) result = safeResult('CLOSE_FAILED');
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
    bootstrap,
    redisConfig,
    loggerModule,
  ] = await Promise.all([
    import('../models/User.js'),
    import('../config/db.js'),
    import('../services/auth/userSecureAuthFlows.js'),
    import('../services/auth/accessDenylist.js'),
    import('../services/auth/secureAuthConfig.js'),
    import('../seed/ensureAdmin.js'),
    import('../config/redis.js'),
    import('../utils/logger.js'),
  ]);
  const originalInfoLogger = loggerModule.logger.info;
  let safeLoggingActive = false;
  const strictDenylist = denylistModule.createAccessDenylistService({
    requireSharedStore: true,
  });
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
    findConfiguredAccount(email) {
      return User.findOne({ email }).select('_id role tokenVersion').lean();
    },
    bootstrapConfiguredAdmin() {
      return bootstrap.ensureAdminOnBoot({ logIdentity: false });
    },
    changeRole: flows.changeUserRole,
  };
}

async function main() {
  const result = await runLocalSuperAdminProvisioning({
    argv: process.argv.slice(2),
    env: process.env,
    runtimeFactory: createRuntime,
    write: (line) => console.log(line),
  });
  if (!result.ok) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (invokedPath === import.meta.url) {
  main().catch(() => {
    console.error('status=failed code=UNEXPECTED_FAILURE accountFound=false');
    process.exitCode = 1;
  });
}
