/**
 * OA sync failure must not throw; Application update remains authoritative (E.1F-E).
 * Run: node server/src/__tests__/employerOaSyncFailure.test.js
 */
import assert from 'assert';
import { syncOpportunityApplicationFromLegacyStatus } from '../services/employerOpportunityApplicationSync.js';

const original = console.warn;
let warned = false;
console.warn = (...args) => {
  warned = true;
  original(...args);
};

const result = await syncOpportunityApplicationFromLegacyStatus(
  { _id: '000000000000000000000000' },
  { employerId: '000000000000000000000001', previousStatus: 'submitted', newStatus: 'shortlisted' }
);

console.warn = original;

assert.strictEqual(result.ok, false);
assert.ok(warned || result.error);

console.log('employerOaSyncFailure tests passed.');
