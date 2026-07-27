/**
 * Public navbar hierarchy (E.1F-A).
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
  splitNavForDesktop,
} = await import(navConfigUrl);

const { shouldEnableUserNavbarSession, isEmployerPortalPath } = await import(authRealmUrl);

const primaryPaths = PRIMARY_NAV_ITEMS.map((i) => i.path).filter(Boolean);
const secondaryPaths = SECONDARY_NAV_ITEMS.map((i) => i.path);

assert.ok(primaryPaths.includes('/'));
assert.ok(primaryPaths.includes('/jobs'));
assert.ok(primaryPaths.includes('/scholarships'));
assert.ok(primaryPaths.includes('/admissions'));
assert.ok(primaryPaths.includes('/internships'));
assert.ok(primaryPaths.includes('/exam-prep') || PRIMARY_NAV_ITEMS.some((i) => i.labelKey?.includes('examPrep')));
assert.ok(PRIMARY_NAV_ITEMS.some((i) => i.mega?.length));

assert.ok(secondaryPaths.includes('/blog'));
assert.ok(secondaryPaths.includes('/contact'));
assert.ok(SECONDARY_NAV_ITEMS.some((i) => i.tour === 'resume-builder'));
assert.ok(SECONDARY_NAV_ITEMS.some((i) => i.tour === 'career-guidance'));

assert.strictEqual(DRAWER_NAV_ITEMS.length, PRIMARY_NAV_ITEMS.length + SECONDARY_NAV_ITEMS.length);

// Blog/Contact move to More when present in resolved CMS-like list
const fakeResolved = [
  { label: 'Home', path: '/' },
  { label: 'Jobs', path: '/jobs' },
  { label: 'Blog', path: '/blog' },
  { label: 'Contact', path: '/contact' },
];
const split = splitNavForDesktop(fakeResolved);
assert.strictEqual(split.primary.length, 2);
assert.strictEqual(split.fromCmsSecondary.length, 2);

// E.1F-B gating still holds for employer routes
assert.strictEqual(shouldEnableUserNavbarSession('/employer/jobs', { isUserAuthenticated: true }), false);
assert.strictEqual(shouldEnableUserNavbarSession('/employer/login', { isUserAuthenticated: true }), false);
assert.strictEqual(shouldEnableUserNavbarSession('/jobs', { isUserAuthenticated: true }), true);
assert.strictEqual(isEmployerPortalPath('/employer'), true);
assert.strictEqual(isEmployerPortalPath('/employer/dashboard'), false);

// No /employer/dashboard route invented
assert.ok(!DRAWER_NAV_ITEMS.some((i) => i.path === '/employer/dashboard'));
assert.ok(!PRIMARY_NAV_ITEMS.some((i) => i.path === '/employer/dashboard'));

console.log('navbarHierarchy.test.js: all assertions passed');
