import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveEditorialFreshness,
  editorialFreshnessLabel,
  latestSourceVerifiedAt,
} from '../../../shared/education/editorialFreshness.js';

const NOW = new Date('2026-09-01T00:00:00.000Z');

test('derives last verification from the latest valid source evidence', () => {
  const latest = latestSourceVerifiedAt([
    { verifiedAt: '2026-01-01T00:00:00.000Z' },
    { verifiedAt: '2026-08-15T00:00:00.000Z' },
  ]);
  assert.equal(latest.toISOString(), '2026-08-15T00:00:00.000Z');
});

test('valid future review date produces fresh scheduled state', () => {
  const result = deriveEditorialFreshness({
    sources: [{ verifiedAt: '2026-08-01T00:00:00.000Z' }],
    nextReviewAt: '2026-10-01T00:00:00.000Z',
    now: NOW,
  });
  assert.equal(result.verificationStatus, 'verified');
  assert.equal(result.freshnessState, 'fresh');
});

test('passed review date produces review_due state', () => {
  const result = deriveEditorialFreshness({
    sources: [{ verifiedAt: '2026-08-01T00:00:00.000Z' }],
    nextReviewAt: '2026-08-31T00:00:00.000Z',
    now: NOW,
  });
  assert.equal(result.freshnessState, 'review_due');
});

test('missing review date is verified but explicitly unscheduled', () => {
  const result = deriveEditorialFreshness({
    sources: [{ verifiedAt: '2026-08-01T00:00:00.000Z' }],
  });
  assert.equal(result.verificationStatus, 'verified');
  assert.equal(result.freshnessState, 'unknown');
  assert.equal(editorialFreshnessLabel(result), 'Verified — review not scheduled');
});

test('missing source verification is unverified and legacy metadata remains safe', () => {
  const result = deriveEditorialFreshness({ sources: [{ sourceUrl: 'https://example.org' }] });
  assert.equal(result.verificationStatus, 'unverified');
  assert.equal(result.freshnessState, 'unknown');
  assert.deepEqual(deriveEditorialFreshness({}), result);
});

test('freshness is derived from server inputs and does not accept a client state', () => {
  const result = deriveEditorialFreshness({
    sources: [{ verifiedAt: '2026-08-01T00:00:00.000Z' }],
    freshnessState: 'fresh',
    verificationStatus: 'verified',
    now: NOW,
  });
  assert.equal(result.freshnessState, 'unknown');
  assert.equal(result.verificationStatus, 'verified');
});

test('alert review state remains separate from its effective period', () => {
  const result = deriveEditorialFreshness({
    sources: [{ verifiedAt: '2026-08-01T00:00:00.000Z' }],
    nextReviewAt: '2026-10-01T00:00:00.000Z',
    now: NOW,
  });
  assert.equal(result.freshnessState, 'fresh');
  assert.equal(result.nextReviewAt, undefined);
});
