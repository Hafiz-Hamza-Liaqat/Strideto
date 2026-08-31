import { UserIdentity } from '../../models/UserIdentity.js';
import {
  compareUserIdentityIndex,
  USER_IDENTITY_INDEXES,
} from '../../scripts/provisionUserIdentityIndexes.js';

/**
 * Physical index readiness gate for the Google flow.
 *
 * `config/db.js` sets `autoIndex` off unless `MONGO_AUTO_INDEX=1`, so a
 * Mongoose `unique: true` on the schema proves nothing about the running
 * database. Without the two physical unique indexes, concurrent callbacks can
 * fork accounts and one provider subject can be linked to two users — exactly
 * the failures the P1 resolution policy relies on the storage layer to prevent.
 *
 * So the flow refuses to run until they exist. Fail closed on a missing index,
 * a mismatched index, and on any error reading the index list.
 */

export const REQUIRED_USER_IDENTITY_INDEX_NAMES = Object.freeze([
  'user_identity_provider_subject_unique',
  'user_identity_user_provider_unique',
]);

export const INDEX_READINESS_RESULTS = Object.freeze({
  READY: 'index_ready',
  MISSING: 'index_missing',
  MISMATCHED: 'index_mismatched',
  UNAVAILABLE: 'index_unavailable',
});

const REQUIRED_SPECS = USER_IDENTITY_INDEXES.filter(({ name }) =>
  REQUIRED_USER_IDENTITY_INDEX_NAMES.includes(name)
);

export function evaluateUserIdentityIndexReadiness(indexes) {
  if (!Array.isArray(indexes)) {
    return Object.freeze({ code: INDEX_READINESS_RESULTS.UNAVAILABLE, missing: [], mismatched: [] });
  }
  const missing = [];
  const mismatched = [];
  for (const expected of REQUIRED_SPECS) {
    const comparison = compareUserIdentityIndex(indexes, expected);
    if (comparison.status === 'MISSING') missing.push(expected.name);
    else if (comparison.status === 'MISMATCH') mismatched.push(expected.name);
  }
  if (missing.length > 0) {
    return Object.freeze({ code: INDEX_READINESS_RESULTS.MISSING, missing, mismatched });
  }
  if (mismatched.length > 0) {
    return Object.freeze({ code: INDEX_READINESS_RESULTS.MISMATCHED, missing, mismatched });
  }
  return Object.freeze({ code: INDEX_READINESS_RESULTS.READY, missing: [], mismatched: [] });
}

/**
 * Readiness only ever improves within a process (indexes are provisioned, not
 * removed), so a READY verdict is cached. A not-ready verdict is never cached
 * — it is re-checked, rate-limited, so provisioning during a running process
 * takes effect without a restart while a failing database is not hammered.
 */
export function createUserIdentityIndexReadiness({
  readIndexes = () => UserIdentity.collection.indexes(),
  now = () => Date.now(),
  recheckIntervalMs = 30 * 1000,
} = {}) {
  let readyVerdict = null;
  let lastCheckedAt = 0;
  let lastVerdict = null;

  async function assertReady() {
    if (readyVerdict) return readyVerdict;
    if (lastVerdict && now() - lastCheckedAt < recheckIntervalMs) {
      return lastVerdict;
    }
    lastCheckedAt = now();

    let indexes;
    try {
      indexes = await readIndexes();
    } catch (error) {
      // A missing collection is simply a missing index, not an outage.
      if (Number(error?.code) === 26 || error?.codeName === 'NamespaceNotFound') {
        indexes = [];
      } else {
        lastVerdict = Object.freeze({
          code: INDEX_READINESS_RESULTS.UNAVAILABLE,
          missing: [],
          mismatched: [],
        });
        return lastVerdict;
      }
    }

    const verdict = evaluateUserIdentityIndexReadiness(indexes);
    lastVerdict = verdict;
    if (verdict.code === INDEX_READINESS_RESULTS.READY) readyVerdict = verdict;
    return verdict;
  }

  function reset() {
    readyVerdict = null;
    lastVerdict = null;
    lastCheckedAt = 0;
  }

  return Object.freeze({ assertReady, reset });
}

export const userIdentityIndexReadiness = createUserIdentityIndexReadiness();
