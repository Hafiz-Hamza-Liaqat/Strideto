/**
 * Optimistic concurrency foundation (Phase 17D-1).
 *
 * Client/command supplies expectedVersion. Server verifies
 * expectedVersion == currentVersion then increments.
 * Stale write → 409 CONFLICT. No silent overwrite.
 */
export const OPTIMISTIC_CONCURRENCY_CODE = 'optimistic_concurrency_conflict';

export function createConcurrencyConflict(currentVersion, expectedVersion) {
  return Object.assign(new Error('Conflict'), {
    status: 409,
    code: OPTIMISTIC_CONCURRENCY_CODE,
    currentVersion,
    expectedVersion,
  });
}

export function assertExpectedVersion(currentVersion, expectedVersion) {
  const current = Number(currentVersion);
  const expected = Number(expectedVersion);
  if (!Number.isInteger(current) || current < 0) {
    throw Object.assign(new Error('Invalid record version'), {
      status: 400,
      code: 'invalid_record_version',
    });
  }
  if (!Number.isInteger(expected) || expected < 0) {
    throw Object.assign(new Error('expectedVersion is required'), {
      status: 400,
      code: 'expected_version_required',
    });
  }
  if (current !== expected) {
    throw createConcurrencyConflict(current, expected);
  }
  return current + 1;
}

/**
 * Apply a mutation only when the expected version matches.
 * `mutate` receives the next version and must not have run side effects yet.
 */
export function applyOptimisticMutation({ currentVersion, expectedVersion, mutate }) {
  const nextVersion = assertExpectedVersion(currentVersion, expectedVersion);
  const result = mutate(nextVersion);
  return { nextVersion, result };
}
