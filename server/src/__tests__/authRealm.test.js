/**
 * Auth realm path rules (E.1F-B).
 * Run: node src/__tests__/authRealm.test.js
 */
import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authRealmPath = pathToFileURL(
  path.resolve(__dirname, '../../../client/src/auth/authRealm.js')
).href;

const {
  isEmployerPortalPath,
  isEmployerPublicAuthPath,
  shouldSkipUserAuthBootstrap,
  shouldEnableUserNavbarSession,
} = await import(authRealmPath);

// Route truth: dashboard is /employer index, not /employer/dashboard
assert.strictEqual(isEmployerPortalPath('/employer'), true);
assert.strictEqual(isEmployerPortalPath('/employer/'), true);
assert.strictEqual(isEmployerPortalPath('/employer/jobs'), true);
assert.strictEqual(isEmployerPortalPath('/employer/jobs/new'), true);
assert.strictEqual(isEmployerPortalPath('/employer/intelligence/candidates'), true);
assert.strictEqual(isEmployerPortalPath('/employer/dashboard'), false);
assert.strictEqual(isEmployerPortalPath('/employer/acme-corp'), false);
assert.strictEqual(isEmployerPublicAuthPath('/employer/login'), true);
assert.strictEqual(isEmployerPublicAuthPath('/employer/register'), true);

assert.strictEqual(shouldSkipUserAuthBootstrap('/employer/jobs'), true);
assert.strictEqual(shouldSkipUserAuthBootstrap('/employer/login'), true);
assert.strictEqual(shouldSkipUserAuthBootstrap('/'), false);
assert.strictEqual(shouldSkipUserAuthBootstrap('/jobs'), false);

assert.strictEqual(shouldEnableUserNavbarSession('/employer/login', { isUserAuthenticated: true }), false);
assert.strictEqual(shouldEnableUserNavbarSession('/employer/jobs', { isUserAuthenticated: true }), false);
assert.strictEqual(shouldEnableUserNavbarSession('/jobs', { isUserAuthenticated: true }), true);
assert.strictEqual(shouldEnableUserNavbarSession('/jobs', { isUserAuthenticated: false }), false);

console.log('authRealm.test.js: all assertions passed');
