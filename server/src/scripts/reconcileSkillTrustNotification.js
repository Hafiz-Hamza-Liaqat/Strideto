/**
 * Bounded Skill Trust notification recovery.
 *
 * This command accepts exactly one immutable history id and only ensures the
 * corresponding canonical UserNotification rows. It never scans, replays a
 * trust transition, appends history, or creates a SkillVerification.
 * Execution requires an explicit operator confirmation.
 */
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import mongoose from 'mongoose';
import {
  reconcileSkillTrustNotifications,
  SKILL_TRUST_IN_APP_DELIVERY,
} from '../services/career/skillTrustNotificationBridge.js';

export class SkillTrustReconciliationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SkillTrustReconciliationError';
    this.code = code;
  }
}

export function parseReconciliationArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { mode: 'help' };
  if (args.length !== 2 || args[0] !== '--history-id') {
    throw new SkillTrustReconciliationError('INVALID_ARGUMENTS');
  }
  if (!mongoose.Types.ObjectId.isValid(args[1])) {
    throw new SkillTrustReconciliationError('INVALID_HISTORY_ID');
  }
  return { mode: 'reconcile', historyId: args[1] };
}

export function assertReconciliationConfirmation(environment = process.env) {
  if (environment.STRIDETO_NOTIFICATION_RECONCILE_CONFIRM !== '1') {
    throw new SkillTrustReconciliationError('RECONCILIATION_CONFIRMATION_REQUIRED');
  }
}

export function reconciliationHelpText() {
  return [
    'Skill Trust notification reconciliation (one immutable transition)',
    'Usage:',
    '  STRIDETO_NOTIFICATION_RECONCILE_CONFIRM=1 npm run trust:notifications:reconcile -- --history-id <ObjectId>',
    'No default scan is available.',
  ].join('\n');
}

export function reconciliationOutput(result) {
  return [
    `STATUS ${result.status}`,
    `TRANSITION ${result.transitionId ?? 'NONE'}`,
    `CREATED ${Number(result.created) || 0}`,
    `SKIPPED ${Number(result.skipped) || 0}`,
    `FAILED ${Number(result.failed) || 0}`,
  ].join('\n');
}

export function isSuccessfulReconciliationStatus(status) {
  return status === SKILL_TRUST_IN_APP_DELIVERY.ENSURED
    || status === SKILL_TRUST_IN_APP_DELIVERY.NOT_APPLICABLE;
}

export async function executeReconciliation({ historyId, reconcile }) {
  const result = await reconcile({ historyId });
  return {
    result,
    exitCode: isSuccessfulReconciliationStatus(result.status) ? 0 : 1,
  };
}

export async function runCli({
  args = process.argv.slice(2),
  environment = process.env,
  output = console.log,
  errorOutput = console.error,
  connect = (uri) => mongoose.connect(uri),
  disconnect = () => mongoose.disconnect(),
  reconcile = reconcileSkillTrustNotifications,
} = {}) {
  let connected = false;
  try {
    const parsed = parseReconciliationArgs(args);
    if (parsed.mode === 'help') {
      output(reconciliationHelpText());
      return 0;
    }
    assertReconciliationConfirmation(environment);
    if (!environment.MONGO_URI) {
      throw new SkillTrustReconciliationError('MONGO_URI_REQUIRED');
    }

    await connect(environment.MONGO_URI);
    connected = true;
    const execution = await executeReconciliation({
      historyId: parsed.historyId,
      reconcile,
    });
    output(reconciliationOutput(execution.result));
    return execution.exitCode;
  } catch (error) {
    const code = error instanceof SkillTrustReconciliationError
      ? error.code
      : 'RECONCILIATION_OPERATION_FAILED';
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
