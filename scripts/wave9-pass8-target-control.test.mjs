import test from 'node:test';
import assert from 'node:assert/strict';
import { TARGET_MIN, TARGET_MAX, additionalBounds, shouldStopAccepting, canAccept, parseTargetValue, noFallbackTarget } from './wave9-pass8-target-control.mjs';

test('explicit numeric target remains 48..50', () => { assert.equal(TARGET_MIN, 48); assert.equal(TARGET_MAX, 50); });
test('pool 43 requires five minimum and permits seven maximum additions', () => { assert.deepEqual(additionalBounds(43), { minAdditional: 5, maxAdditional: 7 }); });
test('candidate seven reaches the hard maximum', () => { assert.equal(shouldStopAccepting(43, 7), true); assert.equal(canAccept(43, 6), true); });
test('candidate eight cannot append after target maximum', () => { assert.equal(canAccept(43, 7), false); });
test('prose range is never parsed as 4850', () => { assert.throws(() => parseTargetValue('4850'), TypeError); assert.throws(() => parseTargetValue('48-50'), TypeError); });
test('no fallback silently changes target to 100', () => { assert.deepEqual(noFallbackTarget(), { targetMin: 48, targetMax: 50, fallbackApplied: false }); });
