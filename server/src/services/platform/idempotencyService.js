import { createHash } from 'node:crypto';
import { createIdempotencyStore } from '../../../../shared/platform/idempotency.js';

export function fingerprintRequest(parts) {
  const payload = typeof parts === 'string' ? parts : JSON.stringify(parts);
  return createHash('sha256').update(payload).digest('hex');
}

const defaultStore = createIdempotencyStore();

export function getIdempotencyStore() {
  return defaultStore;
}

export async function executeIdempotentCommand(input) {
  const fingerprint = input.fingerprint || fingerprintRequest(input.safeParts || {});
  return defaultStore.execute({ ...input, fingerprint });
}
