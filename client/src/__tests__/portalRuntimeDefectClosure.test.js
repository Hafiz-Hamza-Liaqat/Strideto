import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getAgentRegistrationError, getInstitutionRegistrationError } from '../utils/portalRegistrationErrors.js';
import { isAgentPortalPath, isAgentPublicAuthPath } from '../auth/agentAuthRealm.js';
import { isInstitutionPortalPath, isInstitutionPublicAuthPath } from '../auth/institutionAuthRealm.js';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

test('Agent registration displays safe actionable API errors', () => {
  assert.equal(
    getAgentRegistrationError({ response: { status: 422, data: { error: 'countryCode must be a valid ISO code' } } }),
    'countryCode must be a valid ISO code'
  );
  assert.match(getAgentRegistrationError({ response: { status: 409, data: {} } }), /Agent account.*already exists/);
  assert.equal(getAgentRegistrationError({ response: { status: 500, data: '<html>' } }), 'Registration failed. Please try again.');
});

test('Agent route contract classifies only login/register as public auth', () => {
  assert.equal(isAgentPublicAuthPath('/agent/login'), true);
  assert.equal(isAgentPublicAuthPath('/agent/register'), true);
  for (const path of [
    '/agent', '/agent/onboarding', '/agent/profile', '/agent/services', '/agent/marketplace',
    '/agent/marketplace/new', '/agent/consultations', '/agent/cases', '/agent/trust',
    '/agent/commerce', '/agent/availability', '/agent/verification', '/agent/team',
    '/agent/leads', '/agent/clients', '/agent/settings',
  ]) assert.equal(isAgentPortalPath(path), true, `${path} must be Agent-protected`);
});

test('Agent API client removes the duplicated API prefix while retaining canonical routes', () => {
  const source = read('../services/agentService.js');
  assert.match(source, /API_BASE_URL\.replace\(\/\\\/api\\\/\?\$\//);
  assert.match(source, /post\('\/api\/auth\/agent\/register'/);
  assert.doesNotMatch(source, /baseURL:\s*API_BASE_URL,\s*\n/);
});

test('Mission 18 proves self-registration and the client makes onboarding reachable', () => {
  const contract = read('../../../docs/STRIDETO_MISSION_18_INSTITUTION_PORTAL.md');
  const routes = read('../routes/index.jsx');
  const register = read('../pages/Institution/InstitutionRegister.jsx');
  assert.match(contract, /POST \/api\/auth\/institution\/register/);
  assert.match(contract, /Account \/ representative \(`institutionRegister`\)/);
  assert.match(contract, /Pre-approval institution may:/);
  assert.match(routes, /ROUTES\.INSTITUTION_REGISTER/);
  assert.match(register, /INSTITUTION_ONBOARDING/);
  assert.match(register, /grants no Student or Vault access/);
});

test('Institution acquisition errors and realm paths are truthful', () => {
  assert.equal(
    getInstitutionRegistrationError({ response: { status: 422, data: { error: 'Invalid email format' } } }),
    'Invalid email format'
  );
  assert.match(getInstitutionRegistrationError({ response: { status: 409, data: {} } }), /Institution account.*already exists/);
  assert.equal(isInstitutionPublicAuthPath('/institution/login'), true);
  assert.equal(isInstitutionPublicAuthPath('/institution/register'), true);
  for (const path of [
    '/institution', '/institution/onboarding', '/institution/profile',
    '/institution/programs', '/institution/programs/new',
    '/institution/data-quality', '/institution/team',
  ]) assert.equal(isInstitutionPortalPath(path), true, `${path} must be Institution-protected`);
});
