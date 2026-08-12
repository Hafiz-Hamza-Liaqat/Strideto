/**
 * Application stage-write authority regression tests.
 *
 * Run: node src/__tests__/applicationAuthority.test.js
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const authority = await import(pathToFileURL(path.join(root, 'shared/career/applicationAuthority.js')).href);

const internalApplied = {
  source: 'platform',
  opportunityRef: { opportunityType: 'job', opportunityId: 'job1' },
  pipelineStage: 'applied',
  stageTemplateId: 'job_default',
};

const internalScreening = { ...internalApplied, pipelineStage: 'screening' };
const external = {
  source: 'external',
  opportunityRef: { opportunityType: 'job', opportunityId: null },
  pipelineStage: 'applied',
  stageTemplateId: 'job_default',
};

const institutionAdmission = {
  source: 'platform',
  opportunityRef: { opportunityType: 'admission', opportunityId: 'prog1' },
  pipelineStage: 'applied',
  stageTemplateId: 'admission_default',
};

assert.deepEqual(
  authority.getStudentAllowedTransitions(internalApplied),
  ['withdrawn'],
  'internal applied → only withdraw'
);
assert.ok(
  !authority.getStudentAllowedTransitions(internalApplied).includes('preparing'),
  'internal applied cannot revert to preparing'
);

assert.deepEqual(
  authority.getStudentAllowedTransitions(internalScreening),
  ['withdrawn'],
  'internal screening → only withdraw'
);

assert.ok(
  !authority.getStudentAllowedTransitions(external).includes('screening'),
  'external tracker excludes screening'
);
assert.ok(
  !authority.getStudentAllowedTransitions(external).includes('viewed'),
  'external tracker excludes viewed'
);
assert.ok(
  authority.getStudentAllowedTransitions({ ...external, pipelineStage: 'preparing' }).includes('applied'),
  'external tracker may mark applied from preparing'
);
assert.deepEqual(
  authority.getStudentAllowedTransitions(external),
  ['withdrawn'],
  'external applied → withdraw only'
);

assert.deepEqual(
  authority.getStudentAllowedTransitions(institutionAdmission),
  ['withdrawn'],
  'institution applied → only withdraw'
);

const preSubmit = { ...internalApplied, pipelineStage: 'preparing' };
assert.ok(authority.getStudentAllowedTransitions(preSubmit).includes('applied'));
assert.ok(authority.getStudentAllowedTransitions(preSubmit).includes('withdrawn'));

let blocked = false;
try {
  authority.assertStudentMayTransition(internalApplied, 'interview');
} catch (err) {
  blocked = err.status === 403;
}
assert.ok(blocked, 'assertStudentMayTransition blocks interview on internal application');

console.log('applicationAuthority: all checks passed');
