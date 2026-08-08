/**
 * Mission 0 — Employer stabilization focused tests.
 * Pure logic only, no live MongoDB connection.
 * Run: node src/__tests__/employerStabilization.test.js
 */
import assert from 'node:assert/strict';
import {
  employerSlugBase,
  employerSlugCandidate,
  ensureUniqueEmployerSlug,
  RESERVED_EMPLOYER_SLUGS,
} from '../utils/employerSlug.js';
import { isSameStatusNoOp, LEGACY_EMPLOYER_STATUSES } from '../utils/applicationStatusTransition.js';
import { isPubliclyApproved } from '../controllers/publicProfileController.js';
import {
  makeEmployerFixture,
  makeJobFixture,
  isSyntheticFixture,
  SYNTHETIC_MARKER,
} from './fixtures/employerFixtures.js';

let assertions = 0;
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}
function check(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

async function run() {
  // --- Slug: deterministic base, reserved-avoidance ---------------------------
  equal(employerSlugBase('Acme Corp'), 'acme-corp', 'base slug from company name');
  equal(employerSlugBase(''), 'employer', 'empty name falls back to "employer"');
  check(RESERVED_EMPLOYER_SLUGS.has('jobs'), 'reserved list guards portal routes');
  equal(employerSlugBase('Jobs'), 'jobs-org', 'reserved base is suffixed to stay reachable');

  // --- Slug: deterministic numbered candidates --------------------------------
  equal(employerSlugCandidate('Acme Corp', 0), 'acme-corp', 'attempt 0 is the bare base');
  equal(employerSlugCandidate('Acme Corp', 1), 'acme-corp-2', 'attempt 1 → -2');
  equal(employerSlugCandidate('Acme Corp', 2), 'acme-corp-3', 'attempt 2 → -3');

  // --- Slug: collision resolution ---------------------------------------------
  const taken = new Set(['acme-corp', 'acme-corp-2']);
  const resolved = await ensureUniqueEmployerSlug('Acme Corp', (s) => taken.has(s));
  equal(resolved, 'acme-corp-3', 'first free candidate wins');
  const firstFree = await ensureUniqueEmployerSlug('Fresh Co', () => false);
  equal(firstFree, 'fresh-co', 'no collision → bare base');

  // --- Same-status idempotency contract ---------------------------------------
  equal(isSameStatusNoOp('hired', 'hired'), true, 'same status is a no-op');
  equal(isSameStatusNoOp('shortlisted', 'interview'), false, 'different status is not a no-op');
  check(LEGACY_EMPLOYER_STATUSES.includes('hired'), 'legacy status set is exposed');

  // --- Public profile truthfulness: approved-only -----------------------------
  equal(isPubliclyApproved({ approvalStatus: 'approved' }), true, 'approved job is public');
  equal(isPubliclyApproved({ approvalStatus: 'pending' }), false, 'pending job is NOT public');
  equal(isPubliclyApproved({ approvalStatus: 'rejected' }), false, 'rejected job is NOT public');
  equal(isPubliclyApproved({}), true, 'legacy job without approvalStatus is treated as approved');

  // --- Fixtures are clearly synthetic and greppable ---------------------------
  const emp = makeEmployerFixture();
  const job = makeJobFixture();
  check(emp.slug.includes(SYNTHETIC_MARKER), 'employer fixture is marked synthetic');
  check(isSyntheticFixture(emp), 'isSyntheticFixture detects synthetic employer');
  check(isSyntheticFixture(job), 'isSyntheticFixture detects synthetic job');
  equal(isSyntheticFixture({ companyName: 'Real Company' }), false, 'real records are not flagged synthetic');

  console.log(`employerStabilization.test.js — ${assertions} assertions passed`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
