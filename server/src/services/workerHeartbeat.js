import { cacheGet, cacheSet } from '../config/redis.js';

const HEARTBEAT_KEY = 'strideto:worker:heartbeat';
const HEARTBEAT_TTL_SEC = 90;

export async function touchWorkerHeartbeat() {
  await cacheSet(HEARTBEAT_KEY, Date.now(), HEARTBEAT_TTL_SEC);
  return true;
}

export async function isWorkerHeartbeatFresh() {
  try {
    const value = await cacheGet(HEARTBEAT_KEY);
    return Boolean(value);
  } catch {
    return false;
  }
}
