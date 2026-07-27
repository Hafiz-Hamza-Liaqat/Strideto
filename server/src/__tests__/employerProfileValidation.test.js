/**
 * Employer profile PATCH validation (E.1F-E).
 * Run: node server/src/__tests__/employerProfileValidation.test.js
 */
import assert from 'assert';
import { buildEmployerProfileUpdates } from '../utils/employerProfileValidation.js';

assert.strictEqual(buildEmployerProfileUpdates({}).ok, false);
assert.strictEqual(buildEmployerProfileUpdates({ companyName: '' }).ok, false);

const ok = buildEmployerProfileUpdates({
  companyName: 'Acme',
  website: 'https://acme.example',
  logoUrl: '',
});
assert.strictEqual(ok.ok, true);
assert.strictEqual(ok.updates.companyName, 'Acme');

const badWeb = buildEmployerProfileUpdates({ companyName: 'Acme', website: 'not-a-url' });
assert.strictEqual(badWeb.ok, false);

console.log('employerProfileValidation tests passed.');
