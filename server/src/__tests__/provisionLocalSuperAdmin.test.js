import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { runLocalSuperAdminProvisioning } from '../scripts/provisionLocalSuperAdmin.js';

assert.strictEqual(
  mongoose.connection.readyState,
  0,
  'test must remain DB-free'
);

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

const ACCOUNT_ID = '507f1f77bcf86cd799439011';
const SAFE_ENV = Object.freeze({
  NODE_ENV: 'staging',
  APP_ENV: 'staging',
  ADMIN_EMAIL: 'configured-operator@example.test',
});

function fakeRuntime({
  roles = ['Admin'],
  mutation = { code: 'SUBJECT_STATE_UPDATED' },
  connectError = false,
  findError = false,
  closeError = false,
  bootstrap = { skipped: false, action: 'created' },
} = {}) {
  const calls = {
    connect: 0,
    close: 0,
    find: [],
    bootstrap: 0,
    changeRole: [],
  };
  let roleIndex = 0;
  return {
    calls,
    factory: async () => ({
      async connect() {
        calls.connect += 1;
        if (connectError) throw new Error('private mongo failure');
      },
      async close() {
        calls.close += 1;
        if (closeError) throw new Error('private close failure');
      },
      async findConfiguredAccount(email) {
        calls.find.push(email);
        if (findError) throw new Error('private lookup failure');
        const role = roles[Math.min(roleIndex, roles.length - 1)];
        roleIndex += 1;
        return role ? { _id: ACCOUNT_ID, role, tokenVersion: 2 } : null;
      },
      async changeRole(args) {
        calls.changeRole.push(args);
        return mutation;
      },
      async bootstrapConfiguredAdmin() {
        calls.bootstrap += 1;
        return bootstrap;
      },
    }),
  };
}

async function run({ argv = ['--verify'], env = SAFE_ENV, runtime } = {}) {
  const lines = [];
  const selected = runtime || fakeRuntime();
  const result = await runLocalSuperAdminProvisioning({
    argv,
    env,
    runtimeFactory: selected.factory,
    write: (line) => lines.push(line),
  });
  return { result, lines, runtime: selected };
}

{
  let factoryCalls = 0;
  const lines = [];
  const result = await runLocalSuperAdminProvisioning({
    argv: ['--help'],
    env: {},
    runtimeFactory: async () => {
      factoryCalls += 1;
    },
    write: (line) => lines.push(line),
  });
  check(result.code === 'HELP' && result.ok, '--help succeeds');
  check(factoryCalls === 0, '--help is DB-free');
  check(
    lines[0].includes('--verify') && lines[0].includes('--apply'),
    '--help lists fixed modes'
  );
}

{
  const outcome = await run();
  check(outcome.result.code === 'VERIFIED', 'verify succeeds for Admin');
  check(outcome.result.promotionRequired === true, 'Admin requires promotion');
  check(
    outcome.runtime.calls.changeRole.length === 0,
    'verify performs no mutation'
  );
  check(outcome.runtime.calls.close === 1, 'verify closes database in finally');
}

{
  const outcome = await run({
    runtime: fakeRuntime({ roles: ['SuperAdmin'] }),
  });
  check(outcome.result.code === 'VERIFIED', 'verify accepts SuperAdmin');
  check(
    outcome.result.promotionRequired === false,
    'SuperAdmin is already final'
  );
}

{
  const outcome = await run({ runtime: fakeRuntime({ roles: [null] }) });
  check(
    outcome.result.code === 'VERIFIED' && outcome.result.ok,
    'verify safely reports absent account'
  );
  check(
    outcome.result.bootstrapRequired === true,
    'absent account requires bootstrap'
  );
  check(
    outcome.runtime.calls.bootstrap === 0,
    'absent verify remains read-only'
  );
}

{
  const outcome = await run({ runtime: fakeRuntime({ roles: ['User'] }) });
  check(outcome.result.code === 'UNEXPECTED_ROLE', 'unexpected role fails');
}

{
  const outcome = await run({ argv: ['--apply'] });
  check(
    outcome.result.code === 'CONFIRMATION_REQUIRED',
    'apply requires confirmation'
  );
  check(
    outcome.runtime.calls.connect === 0,
    'missing confirmation performs no I/O'
  );
}

{
  const runtime = fakeRuntime({ roles: [null] });
  const outcome = await run({
    argv: ['--apply'],
    env: { ...SAFE_ENV, STRIDETO_SUPERADMIN_PROVISION_CONFIRM: '1' },
    runtime,
  });
  check(
    outcome.result.code === 'BOOTSTRAP_PASSWORD_REQUIRED',
    'password is required only for bootstrap'
  );
  check(runtime.calls.bootstrap === 0, 'missing password creates no account');
}

{
  const runtime = fakeRuntime({ roles: [null, 'Admin', 'SuperAdmin'] });
  const outcome = await run({
    argv: ['--apply'],
    env: {
      ...SAFE_ENV,
      ADMIN_PASSWORD: 'in-memory-only',
      STRIDETO_SUPERADMIN_PROVISION_CONFIRM: '1',
    },
    runtime,
  });
  check(
    outcome.result.code === 'APPLIED' && outcome.result.changed,
    'absent account bootstraps then promotes'
  );
  check(runtime.calls.bootstrap === 1, 'bootstrap service is invoked once');
  check(
    runtime.calls.find.every((email) => email === SAFE_ENV.ADMIN_EMAIL),
    'bootstrap flow uses only configured identity'
  );
  check(
    runtime.calls.changeRole[0]?.expectedPriorRole === 'Admin',
    'bootstrap must yield Admin before promotion'
  );
}

{
  const runtime = fakeRuntime({
    roles: [null],
    bootstrap: { skipped: true },
  });
  const outcome = await run({
    argv: ['--apply'],
    env: {
      ...SAFE_ENV,
      ADMIN_PASSWORD: 'in-memory-only',
      STRIDETO_SUPERADMIN_PROVISION_CONFIRM: '1',
    },
    runtime,
  });
  check(
    outcome.result.code === 'BOOTSTRAP_FAILED',
    'bootstrap failure is safe'
  );
  check(
    runtime.calls.changeRole.length === 0,
    'bootstrap failure prevents promotion'
  );
}

{
  const outcome = await run({ env: { ...SAFE_ENV, NODE_ENV: 'production' } });
  check(
    outcome.result.code === 'PRODUCTION_BLOCKED',
    'production execution is blocked'
  );
  check(
    outcome.runtime.calls.connect === 0,
    'production refusal occurs before DB access'
  );
}

for (const appEnv of [
  undefined,
  'development',
  'test',
  'preview',
  'production',
]) {
  const outcome = await run({ env: { ...SAFE_ENV, APP_ENV: appEnv } });
  check(
    outcome.result.code === 'STAGING_ENV_REQUIRED',
    `APP_ENV ${String(appEnv)} rejected`
  );
}

{
  const runtime = fakeRuntime({ roles: ['Admin', 'SuperAdmin'] });
  const outcome = await run({
    argv: ['--apply'],
    env: { ...SAFE_ENV, STRIDETO_SUPERADMIN_PROVISION_CONFIRM: '1' },
    runtime,
  });
  check(
    outcome.result.code === 'APPLIED' && outcome.result.changed,
    'Admin promotion succeeds'
  );
  check(
    runtime.calls.changeRole.length === 1,
    'account-security mutation service is used once'
  );
  check(runtime.calls.bootstrap === 0, 'existing Admin is never recreated');
  check(
    runtime.calls.changeRole[0].expectedPriorRole === 'Admin',
    'prior role is fixed'
  );
  check(
    runtime.calls.changeRole[0].newRole === 'SuperAdmin',
    'desired role is fixed'
  );
  check(
    runtime.calls.changeRole[0].subjectId === ACCOUNT_ID,
    'configured account is the only target'
  );
  check(runtime.calls.find.length === 2, 'final role is re-read and verified');
  check(runtime.calls.close === 1, 'apply closes database in finally');
}

{
  const runtime = fakeRuntime({ roles: ['SuperAdmin'] });
  const outcome = await run({
    argv: ['--apply'],
    env: { ...SAFE_ENV, STRIDETO_SUPERADMIN_PROVISION_CONFIRM: '1' },
    runtime,
  });
  check(
    outcome.result.code === 'APPLIED' && !outcome.result.changed,
    'SuperAdmin apply is idempotent'
  );
  check(
    runtime.calls.changeRole.length === 0,
    'idempotent apply performs no mutation'
  );
}

{
  const runtime = fakeRuntime({ mutation: { code: 'STORAGE_FAILURE' } });
  const outcome = await run({
    argv: ['--apply'],
    env: { ...SAFE_ENV, STRIDETO_SUPERADMIN_PROVISION_CONFIRM: '1' },
    runtime,
  });
  check(
    outcome.result.code === 'SECURITY_MUTATION_FAILED',
    'Redis/security failure is not success'
  );
  check(
    !outcome.lines.join(' ').includes('private'),
    'raw dependency errors are never printed'
  );
}

for (const runtime of [
  fakeRuntime({ connectError: true }),
  fakeRuntime({ findError: true }),
]) {
  const outcome = await run({ runtime });
  check(outcome.result.code === 'STORAGE_FAILURE', 'MongoDB failure is safe');
  check(runtime.calls.close === 1, 'database close runs after failure');
}

{
  const outcome = await run({ argv: ['--apply', ACCOUNT_ID] });
  check(
    outcome.result.code === 'INVALID_ARGUMENTS',
    'arbitrary account argument is rejected'
  );
  check(outcome.runtime.calls.connect === 0, 'arbitrary target causes no I/O');
}

{
  const outcome = await run({ argv: ['--apply', 'Editor'] });
  check(
    outcome.result.code === 'INVALID_ARGUMENTS',
    'arbitrary role argument is rejected'
  );
}

{
  const outcome = await run({ env: SAFE_ENV });
  const output = outcome.lines.join(' ');
  check(outcome.result.ok, 'Admin password is not required');
  check(
    !output.includes(SAFE_ENV.ADMIN_EMAIL),
    'full configured email is not printed'
  );
  check(
    !/password|mongodb|redis|environment/i.test(output),
    'secret-bearing values are absent from output'
  );
}

{
  const source = readFileSync(
    new URL('../scripts/provisionLocalSuperAdmin.js', import.meta.url),
    'utf8'
  );
  check(
    !/User\.(?:create|findOneAndUpdate|updateOne)/.test(source),
    'utility performs no direct User mutation'
  );
  check(
    !/collection\.(?:updateOne|findOneAndUpdate|bulkWrite)/.test(source),
    'utility performs no raw collection mutation'
  );
  check(
    source.includes('bootstrapConfiguredAdmin'),
    'utility delegates account creation to bootstrap service'
  );
  check(
    source.includes('newRole: DESIRED_ROLE'),
    'utility role target is fixed by code'
  );
}

console.log(
  `provisionLocalSuperAdmin.test.js: ${assertions} assertions passed`
);
