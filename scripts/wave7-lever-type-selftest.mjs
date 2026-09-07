import assert from 'node:assert/strict';
import { mapExplicitLeverCommitment } from './wave7-lever-type.mjs';

assert.equal(mapExplicitLeverCommitment(undefined), null);
assert.equal(mapExplicitLeverCommitment(''), null);
assert.equal(mapExplicitLeverCommitment('Full-time'), 'full-time');
assert.equal(mapExplicitLeverCommitment('Part-time'), 'part-time');
assert.equal(mapExplicitLeverCommitment('Contract'), 'contract');
assert.equal(mapExplicitLeverCommitment('Internship'), 'internship');
assert.equal(mapExplicitLeverCommitment('Seasonal'), null);
console.log('wave7-lever-type self-test: PASS');
