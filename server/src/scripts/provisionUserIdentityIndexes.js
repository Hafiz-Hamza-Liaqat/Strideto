/**
 * UserIdentity index readiness utility.
 *
 * `config/db.js` sets `autoIndex` off unless `MONGO_AUTO_INDEX=1`, so index
 * rollout is an explicit operational action. Both `UserIdentity` uniqueness
 * constraints are load-bearing — they are what makes concurrent social
 * callbacks converge instead of forking accounts — so they must be
 * provisioned, not assumed.
 *
 * Verification is the default. Creation requires both --apply and the shared
 * STRIDETO_INDEX_PROVISION_CONFIRM=1 operator confirmation. The command never
 * drops or replaces an index and never modifies documents.
 */
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import mongoose from 'mongoose';
import { UserIdentity } from '../models/UserIdentity.js';

export const USER_IDENTITY_INDEXES = Object.freeze([
  Object.freeze({
    name: 'user_identity_provider_subject_unique',
    key: Object.freeze({ provider: 1, subject: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'user_identity_user_provider_unique',
    key: Object.freeze({ userId: 1, provider: 1 }),
    unique: true,
  }),
  Object.freeze({
    name: 'user_identity_user',
    key: Object.freeze({ userId: 1 }),
    unique: false,
  }),
]);

export class UserIdentityIndexReadinessError extends Error {
  constructor(code) {
    super(code);
    this.name = 'UserIdentityIndexReadinessError';
    this.code = code;
  }
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function compareUserIdentityIndex(indexes, expected) {
  const actual = indexes.find(({ name }) => name === expected.name);
  if (!actual) return { name: expected.name, status: 'MISSING', ready: false, differences: [] };

  const differences = [];
  if (!sameValue(actual.key, expected.key)) differences.push('key');
  if (Boolean(actual.unique) !== expected.unique) differences.push('unique');

  return differences.length === 0
    ? { name: expected.name, status: 'MATCH', ready: true, differences: [] }
    : { name: expected.name, status: 'MISMATCH', ready: false, differences };
}

export function compareUserIdentityIndexes(indexes) {
  return USER_IDENTITY_INDEXES.map((expected) =>
    compareUserIdentityIndex(indexes, expected)
  );
}

export function parseIndexArgs(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--verify')) return 'verify';
  if (args.length === 1 && args[0] === '--apply') return 'apply';
  if (args.length === 1 && args[0] === '--help') return 'help';
  throw new UserIdentityIndexReadinessError('INVALID_ARGUMENTS');
}

export function assertIndexApplyConfirmation(mode, environment = process.env) {
  if (mode === 'apply' && environment.STRIDETO_INDEX_PROVISION_CONFIRM !== '1') {
    throw new UserIdentityIndexReadinessError('APPLY_CONFIRMATION_REQUIRED');
  }
}

export function userIdentityIndexHelpText() {
  return [
    'UserIdentity index readiness',
    'Usage:',
    '  npm run identities:indexes:verify',
    '  STRIDETO_INDEX_PROVISION_CONFIRM=1 npm run identities:indexes:apply',
    'Default mode: --verify',
  ].join('\n');
}

export async function inspectUserIdentityIndexes(readIndexes) {
  try {
    return await readIndexes();
  } catch (error) {
    if (Number(error?.code) === 26 || error?.codeName === 'NamespaceNotFound') return [];
    throw error;
  }
}

export async function executeUserIdentityIndexReadiness({
  mode,
  inspectIndexes,
  createIndex,
  output,
}) {
  let comparisons = compareUserIdentityIndexes(await inspectIndexes());
  for (const comparison of comparisons) {
    output(`${comparison.status} ${comparison.name}`);
  }

  if (mode === 'apply') {
    if (comparisons.some(({ status }) => status === 'MISMATCH')) {
      throw new UserIdentityIndexReadinessError('MISMATCHED_INDEX_REQUIRES_OPERATOR_REVIEW');
    }
    for (const expected of USER_IDENTITY_INDEXES) {
      const current = comparisons.find(({ name }) => name === expected.name);
      if (current?.status !== 'MISSING') continue;
      output(`CREATE ${expected.name}`);
      await createIndex(expected.key, {
        name: expected.name,
        ...(expected.unique ? { unique: true } : {}),
      });
    }
    comparisons = compareUserIdentityIndexes(await inspectIndexes());
    for (const comparison of comparisons) {
      output(`${comparison.status} ${comparison.name}`);
    }
  }

  const ready = comparisons.every((comparison) => comparison.ready);
  output(ready ? 'STATUS READY' : 'STATUS NOT_READY');
  return { exitCode: ready ? 0 : 1, comparisons };
}

export async function runCli({
  args = process.argv.slice(2),
  environment = process.env,
  output = console.log,
  errorOutput = console.error,
  connect = (uri) => mongoose.connect(uri),
  disconnect = () => mongoose.disconnect(),
  inspectIndexes = () => inspectUserIdentityIndexes(() => UserIdentity.collection.indexes()),
  createIndex = (key, options) => UserIdentity.collection.createIndex(key, options),
} = {}) {
  let connected = false;
  try {
    const mode = parseIndexArgs(args);
    if (mode === 'help') {
      output(userIdentityIndexHelpText());
      return 0;
    }
    assertIndexApplyConfirmation(mode, environment);
    if (!environment.MONGO_URI) {
      throw new UserIdentityIndexReadinessError('MONGO_URI_REQUIRED');
    }

    await connect(environment.MONGO_URI);
    connected = true;
    const result = await executeUserIdentityIndexReadiness({
      mode,
      inspectIndexes,
      createIndex,
      output,
    });
    return result.exitCode;
  } catch (error) {
    const code = error instanceof UserIdentityIndexReadinessError
      ? error.code
      : 'INDEX_READINESS_OPERATION_FAILED';
    errorOutput(`ERROR ${code}`);
    return 1;
  } finally {
    if (connected) await disconnect().catch(() => undefined);
  }
}

const isDirectExecution =
  Boolean(process.argv[1])
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  const exitCode = await runCli();
  process.exitCode = exitCode;
}
