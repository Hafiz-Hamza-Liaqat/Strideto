/**
 * Employer dashboard metric contracts (E.1F-E).
 * Run: node server/src/__tests__/employerDashboardMetrics.test.js
 */
import assert from 'assert';
import { computeConversionRate } from '../services/employerDashboardMetrics.js';
import { resolveJobApplyType } from '../services/employerApplicationCounts.js';

assert.strictEqual(computeConversionRate(2, 100), 2);
assert.strictEqual(computeConversionRate(0, 0), null);
assert.strictEqual(computeConversionRate(1, 0), null);
assert.strictEqual(computeConversionRate(1, 3), 33.33);

assert.strictEqual(resolveJobApplyType({ applyType: 'external' }), 'external');
assert.strictEqual(resolveJobApplyType({ applicationLink: 'https://x.com' }), 'external');
assert.strictEqual(resolveJobApplyType({}), 'internal');

console.log('employerDashboardMetrics tests passed.');
