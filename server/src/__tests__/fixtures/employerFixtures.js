/**
 * Employer-domain test/acceptance fixtures (Mission 0 — fixture strategy).
 *
 * WHY THIS EXISTS
 * ---------------
 * Prior acceptance passes leaned on real-looking records ("Usama121", "Dani",
 * "Global Identity") that were indistinguishable from genuine user data. That
 * makes it unsafe to reason about, clean up, or delete acceptance debris. This
 * module is the single, documented source of clearly-SYNTHETIC fixtures so
 * future acceptance never again depends on real-looking records.
 *
 * STRATEGY
 * --------
 *   1. Every synthetic record is tagged with the `SYNTHETIC_MARKER` — in the
 *      name/email/slug — so it is trivially greppable and safely removable.
 *   2. Fixtures are plain objects (factories), NOT database writes. Tests that
 *      need persistence insert them explicitly; nothing here touches a DB or is
 *      auto-run. This keeps the module usable both by pure unit tests and by a
 *      future, operator-run, bounded seed for a staging acceptance window.
 *   3. Deliberately tiny. This is not a seed dataset — build only the few
 *      records a given test needs from these factories.
 *   4. International by contract: fixtures carry ISO country / IANA-timezone
 *      friendly fields and avoid hard-coded local-only formats.
 */

/** Marker embedded in every synthetic fixture so it can be found and purged. */
export const SYNTHETIC_MARKER = 'strideto-fixture';

let seq = 0;
function nextId() {
  seq += 1;
  return `${SYNTHETIC_MARKER}-${seq}`;
}

/** A clearly-synthetic employer record (unpersisted). */
export function makeEmployerFixture(overrides = {}) {
  const id = nextId();
  return {
    companyName: `${SYNTHETIC_MARKER} Employer ${seq}`,
    slug: id,
    email: `${id}@example.test`,
    isPublicProfile: true,
    verified: false,
    verificationLevel: 'basic',
    country: 'PK', // ISO 3166 — configurable per test
    ...overrides,
  };
}

/** A clearly-synthetic job record (unpersisted). */
export function makeJobFixture(overrides = {}) {
  const id = nextId();
  return {
    _id: id,
    title: `${SYNTHETIC_MARKER} Role ${seq}`,
    status: 'active',
    approvalStatus: 'approved',
    applyType: 'internal',
    ...overrides,
  };
}

/** A clearly-synthetic candidate/application record (unpersisted). */
export function makeApplicationFixture(overrides = {}) {
  const id = nextId();
  return {
    _id: id,
    status: 'shortlisted',
    pipelineStage: 'screening',
    candidateName: `${SYNTHETIC_MARKER} Candidate ${seq}`,
    ...overrides,
  };
}

/** True when a record was produced by these factories (safe to remove). */
export function isSyntheticFixture(record) {
  return Boolean(
    record &&
      [record.companyName, record.email, record.slug, record.title, record.candidateName]
        .filter(Boolean)
        .some((v) => String(v).includes(SYNTHETIC_MARKER))
  );
}
