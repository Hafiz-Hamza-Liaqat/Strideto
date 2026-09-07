import test from 'node:test';
import assert from 'node:assert/strict';
import { validateJobType, normalizeJobType } from './strideto-jobtype.mjs';

for (const value of ['Government', 'Private', 'Internship', undefined, null, '']) test(`allowed jobType ${String(value)}`, () => assert.equal(validateJobType(value), true));
for (const value of ['full-time', 'part-time', 'contract', 'private', 'government', 'Permanent', 'Temporary', 'Corporate', 'Company', 'random']) test(`reject unsupported jobType ${value}`, () => assert.equal(validateJobType(value), false));
test('employment type remains independent from optional jobType', () => { assert.equal(normalizeJobType('contract'), undefined); assert.equal(validateJobType('full-time'), false); });
