/**
 * Public navbar hierarchy (Phase 10).
 * Run: node src/__tests__/navbarHierarchy.test.js
 */
import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const navConfigUrl = pathToFileURL(
  path.resolve(__dirname, '../../../client/src/components/layout/navConfig.js')
).href;
const authRealmUrl = pathToFileURL(
  path.resolve(__dirname, '../../../client/src/auth/authRealm.js')
).href;

const {
  PRIMARY_NAV_ITEMS,
  SECONDARY_NAV_ITEMS,
  DRAWER_NAV_ITEMS,
  FINAL_NAV_LABELS,
  splitNavForDesktop,
} = await import(navConfigUrl);

const { shouldEnableUserNavbarSession, isEmployerPortalPath } = await import(authRealmUrl);

assert.strictEqual(PRIMARY_NAV_ITEMS.length, 8);
assert.strictEqual(FINAL_NAV_LABELS.length, 8);
assert.deepStrictEqual(FINAL_NAV_LABELS, [
  'Home',
  'Jobs',
  'Scholarships & Funding',
  'Admissions & Intakes',
  'Internships',
  'Study & Institutions',
  'Tests & Prep',
  'Services',
]);

const primaryPaths = PRIMARY_NAV_ITEMS.map((i) => i.path).filter(Boolean);
assert.ok(primaryPaths.includes('/'));
assert.ok(primaryPaths.includes('/jobs'));
assert.ok(primaryPaths.includes('/scholarships'));
assert.ok(primaryPaths.includes('/admissions'));
assert.ok(primaryPaths.includes('/internships'));
assert.ok(primaryPaths.includes('/program-explorer'));
assert.ok(primaryPaths.includes('/tests'));
assert.ok(primaryPaths.includes('/services'));
assert.ok(PRIMARY_NAV_ITEMS.every((i) => i.path), 'every top-level item has a real path');
assert.ok(!PRIMARY_NAV_ITEMS.some((i) => i.path === '/exam-prep'));
assert.ok(PRIMARY_NAV_ITEMS.some((i) => i.mega?.some((m) => m.path === '/exam-prep')));
assert.ok(PRIMARY_NAV_ITEMS.some((i) => i.mega?.some((m) => m.path === '/agents')));
assert.ok(!PRIMARY_NAV_ITEMS.some((i) => /admin|dashboard|github/i.test(i.path || '')));

assert.strictEqual(SECONDARY_NAV_ITEMS.length, 0);
assert.strictEqual(DRAWER_NAV_ITEMS.length, PRIMARY_NAV_ITEMS.length);

const split = splitNavForDesktop(PRIMARY_NAV_ITEMS.map((i) => ({ ...i, label: i.labelKey })));
assert.strictEqual(split.primary.length, 8);
assert.strictEqual(split.fromCmsSecondary.length, 0);

assert.strictEqual(shouldEnableUserNavbarSession('/employer/jobs', { isUserAuthenticated: true }), false);
assert.strictEqual(shouldEnableUserNavbarSession('/employer/login', { isUserAuthenticated: true }), false);
assert.strictEqual(shouldEnableUserNavbarSession('/jobs', { isUserAuthenticated: true }), true);
assert.strictEqual(isEmployerPortalPath('/employer'), true);
assert.strictEqual(isEmployerPortalPath('/employer/dashboard'), false);

assert.ok(!DRAWER_NAV_ITEMS.some((i) => i.path === '/employer/dashboard'));
assert.ok(!PRIMARY_NAV_ITEMS.some((i) => i.path === '/employer/dashboard'));
assert.ok(!PRIMARY_NAV_ITEMS.some((i) => i.path === '/license'));

console.log('navbarHierarchy.test.js: all assertions passed');
