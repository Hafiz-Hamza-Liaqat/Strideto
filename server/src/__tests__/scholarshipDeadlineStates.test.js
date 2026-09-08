import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeScholarshipDeadline,
  SCHOLARSHIP_DEADLINE_TYPES,
  isFixedScholarshipDeadline,
} from '../../../shared/scholarships/deadline.js';
import { mergeUnifiedScholarshipCards, projectCmsScholarshipDiscoveryCard } from '../../../shared/publicDiscovery/unifiedScholarshipDiscovery.js';

test('fixed deadlines require and preserve a valid date', () => {
  const result = normalizeScholarshipDeadline({ deadlineType: 'fixed', deadline: '2026-12-01' });
  assert.equal(result.ok, true);
  assert.equal(result.deadlineType, SCHOLARSHIP_DEADLINE_TYPES.FIXED);
  assert.equal(isFixedScholarshipDeadline(result), true);
});

test('non-fixed deadline states use text and never invent a date', () => {
  for (const deadlineType of ['course_specific', 'rolling', 'multiple', 'not_published']) {
    const result = normalizeScholarshipDeadline({ deadlineType, deadlineText: 'See official source' });
    assert.equal(result.ok, true);
    assert.equal(result.deadline, null);
    assert.equal(result.deadlineText, 'See official source');
  }
});

test('invalid fixed and missing non-fixed text are rejected', () => {
  assert.equal(normalizeScholarshipDeadline({ deadlineType: 'fixed' }).ok, false);
  assert.equal(normalizeScholarshipDeadline({ deadlineType: 'fixed', deadline: 'not-a-date' }).ok, false);
  assert.equal(normalizeScholarshipDeadline({ deadlineType: 'rolling' }).ok, false);
});

test('deadline sorting leaves non-fixed opportunities after dated opportunities', () => {
  const cards = mergeUnifiedScholarshipCards([
    { title: 'Rolling', deadline: null, deadlineType: 'rolling', createdAt: '2026-09-08' },
    { title: 'Fixed', deadline: '2026-12-01', deadlineType: 'fixed', createdAt: '2026-09-01' },
  ], [], 'deadline');
  assert.deepEqual(cards.map((card) => card.title), ['Fixed', 'Rolling']);
});

test('public CMS projection exposes truthful deadline text and source URL', () => {
  const card = projectCmsScholarshipDiscoveryCard({
    _id: '1', title: 'Rolling award', provider: 'Provider', country: 'Canada',
    deadlineType: 'rolling', deadlineText: 'Rolling / until places are filled',
    sourceUrl: 'https://provider.example/scholarship', status: 'active',
  });
  assert.equal(card.deadline, null);
  assert.equal(card.deadlineText, 'Rolling / until places are filled');
  assert.equal(card.sourceUrl, 'https://provider.example/scholarship');
});
