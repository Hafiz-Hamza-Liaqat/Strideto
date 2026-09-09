import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const runnerPath = 'scripts/migrate-real-jobs-to-production.ps1';
const batchPath = 'qa-artifacts/jobs-real-wave02-batch01.json';
const runner = fs.readFileSync(runnerPath, 'utf8');
const controller = fs.readFileSync('server/src/controllers/admin/adminJobsController.js', 'utf8');
const model = fs.readFileSync('server/src/models/Job.js', 'utf8');
const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8').replace(/^\uFEFF/, ''));
const vanguard = batch.find(candidate => candidate.externalId === 'vanguard:179074');

test('Vanguard regression fixture has the expected raw candidate state', () => {
  assert.ok(vanguard);
  assert.equal(vanguard.workMode, 'unspecified');
  assert.deepEqual(vanguard.responsibilities, [
    'Develop and support application capabilities for Vanguard technology teams.',
    'Work with engineering stakeholders to deliver reliable technology solutions.',
    'Contribute to cloud, mobile, and AI-enabled initiatives.',
    'Investigate issues and improve application quality and maintainability.',
  ]);
  assert.equal(vanguard.deadline, '2026-09-30');
  assert.equal(vanguard.applicationsCloseAt, '2026-09-30T23:59:59+05:30');
  assert.equal(vanguard.status, undefined);
  assert.equal(vanguard.approvalStatus, undefined);
  assert.equal(vanguard.launchEligible, undefined);
});

test('migration round-trip compares normalized payload target state, not raw candidate defaults', () => {
  assert.match(runner, /Get-PropertyValue \$payload \$_/);
  assert.match(runner, /\$payload\.status = 'draft'/);
  assert.match(runner, /\$payload\.approvalStatus = 'pending'/);
  assert.match(runner, /\$payload\.launchEligible = \$false/);
  assert.match(runner, /\$payload\.Remove\('workMode'\)/);
});

test('migration keeps substantive Vanguard fields in the round-trip field set', () => {
  for (const field of ['description', 'responsibilities', 'requirements', 'skillsRequired', 'deadline', 'applicationsCloseAt']) {
    assert.match(runner, new RegExp("'" + field + "'"));
  }
});

test('applicationsCloseAt is supported by the model and admin controller', () => {
  assert.match(model, /applicationsCloseAt:\s*\{/);
  assert.match(model, /applicationsCloseAt cannot be later than visibleUntil/);
  assert.match(controller, /body\.applicationsCloseAt !== undefined/);
  assert.match(controller, /doc\.applicationsCloseAt = body\.applicationsCloseAt \? new Date\(body\.applicationsCloseAt\) : undefined/);
});
