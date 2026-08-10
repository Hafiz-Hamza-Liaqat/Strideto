/**
 * UserNotification dedupe-index readiness utility.
 *
 * Verification is the default. Creation requires both --apply and the shared
 * STRIDETO_INDEX_PROVISION_CONFIRM=1 operator confirmation. The command never
 * drops or replaces an index and never modifies notification documents.
 */
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import mongoose from 'mongoose';
import { UserNotification } from '../models/UserNotification.js';

export const USER_NOTIFICATION_DEDUPE_INDEX = Object.freeze({
  name: 'user_notification_dedupe_unique',
  key: Object.freeze({ dedupeKey: 1 }),
  unique: true,
  partialFilterExpression: Object.freeze({ dedupeKey: Object.freeze({ $type: 'string' }) }),
});

export class NotificationIndexReadinessError extends Error {
  constructor(code) {
    super(code);
    this.name = 'NotificationIndexReadinessError';
    this.code = code;
  }
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function compareNotificationDedupeIndex(indexes) {
  const actual = indexes.find(({ name }) => name === USER_NOTIFICATION_DEDUPE_INDEX.name);
  if (!actual) return { status: 'MISSING', ready: false };

  const differences = [];
  if (!sameValue(actual.key, USER_NOTIFICATION_DEDUPE_INDEX.key)) differences.push('key');
  if (actual.unique !== true) differences.push('unique');
  if (!sameValue(
    actual.partialFilterExpression,
    USER_NOTIFICATION_DEDUPE_INDEX.partialFilterExpression
  )) differences.push('partialFilterExpression');

  return differences.length === 0
    ? { status: 'MATCH', ready: true, differences: [] }
    : { status: 'MISMATCH', ready: false, differences };
}

export function parseIndexArgs(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--verify')) return 'verify';
  if (args.length === 1 && args[0] === '--apply') return 'apply';
  if (args.length === 1 && args[0] === '--help') return 'help';
  throw new NotificationIndexReadinessError('INVALID_ARGUMENTS');
}

export function assertIndexApplyConfirmation(mode, environment = process.env) {
  if (mode === 'apply' && environment.STRIDETO_INDEX_PROVISION_CONFIRM !== '1') {
    throw new NotificationIndexReadinessError('APPLY_CONFIRMATION_REQUIRED');
  }
}

export function notificationIndexHelpText() {
  return [
    'UserNotification dedupe-index readiness',
    'Usage:',
    '  npm run notifications:indexes:verify',
    '  STRIDETO_INDEX_PROVISION_CONFIRM=1 npm run notifications:indexes:apply',
    'Default mode: --verify',
  ].join('\n');
}

export async function inspectNotificationIndexes(readIndexes) {
  try {
    return await readIndexes();
  } catch (error) {
    if (Number(error?.code) === 26 || error?.codeName === 'NamespaceNotFound') return [];
    throw error;
  }
}

export async function executeNotificationIndexReadiness({
  mode,
  inspectIndexes,
  createIndex,
  output,
}) {
  let comparison = compareNotificationDedupeIndex(await inspectIndexes());
  output(`${comparison.status} ${USER_NOTIFICATION_DEDUPE_INDEX.name}`);

  if (mode === 'apply' && comparison.status === 'MISSING') {
    output(`CREATE ${USER_NOTIFICATION_DEDUPE_INDEX.name}`);
    await createIndex(USER_NOTIFICATION_DEDUPE_INDEX.key, {
      name: USER_NOTIFICATION_DEDUPE_INDEX.name,
      unique: true,
      partialFilterExpression: USER_NOTIFICATION_DEDUPE_INDEX.partialFilterExpression,
    });
    comparison = compareNotificationDedupeIndex(await inspectIndexes());
    output(`${comparison.status} ${USER_NOTIFICATION_DEDUPE_INDEX.name}`);
  } else if (mode === 'apply' && comparison.status === 'MISMATCH') {
    throw new NotificationIndexReadinessError('MISMATCHED_INDEX_REQUIRES_OPERATOR_REVIEW');
  }

  output(comparison.ready ? 'STATUS READY' : 'STATUS NOT_READY');
  return { exitCode: comparison.ready ? 0 : 1, comparison };
}

export async function runCli({
  args = process.argv.slice(2),
  environment = process.env,
  output = console.log,
  errorOutput = console.error,
  connect = (uri) => mongoose.connect(uri),
  disconnect = () => mongoose.disconnect(),
  inspectIndexes = () => inspectNotificationIndexes(() => UserNotification.collection.indexes()),
  createIndex = (key, options) => UserNotification.collection.createIndex(key, options),
} = {}) {
  let connected = false;
  try {
    const mode = parseIndexArgs(args);
    if (mode === 'help') {
      output(notificationIndexHelpText());
      return 0;
    }
    assertIndexApplyConfirmation(mode, environment);
    if (!environment.MONGO_URI) {
      throw new NotificationIndexReadinessError('MONGO_URI_REQUIRED');
    }

    await connect(environment.MONGO_URI);
    connected = true;
    const result = await executeNotificationIndexReadiness({
      mode,
      inspectIndexes,
      createIndex,
      output,
    });
    return result.exitCode;
  } catch (error) {
    const code = error instanceof NotificationIndexReadinessError
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
