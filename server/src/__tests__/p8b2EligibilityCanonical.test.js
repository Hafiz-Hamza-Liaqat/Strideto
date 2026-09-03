import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  isCanonicalInstitutionDetailEligible,
  isIntlScholarshipDetailEligible,
  isJobDetailPubliclyEligible,
  isProgramDetailIndexable,
  resolveInstitutionDetailPath,
} from '../../../shared/seo/entityDetailSeoPolicy.js';
import { isSeoEntityIndexable } from '../../../shared/seo/freshnessPolicy.js';
import { isTestPubliclyPromotable } from '../../../shared/education/testPublicationPolicy.js';
import { PRODUCTION_PUBLIC_ORIGIN, resolvePublicSiteOrigin } from '../../../shared/seo/publicSiteOrigin.js';
import { isSitemapEligiblePath } from '../../../shared/seo/sitemapPolicy.js';

const root = path.resolve(process.cwd());
const seoController = fs.readFileSync(path.join(root, 'server/src/controllers/seoController.js'), 'utf8');
const testController = fs.readFileSync(path.join(root, 'server/src/controllers/education/testController.js'), 'utf8');
const scholarshipController = fs.readFileSync(path.join(root, 'server/src/controllers/scholarshipsController.js'), 'utf8');
const admissionsController = fs.readFileSync(path.join(root, 'server/src/controllers/admissionsController.js'), 'utf8');
const internshipController = fs.readFileSync(path.join(root, 'server/src/controllers/internshipsController.js'), 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'client/vercel.json'), 'utf8'));

const institution = {
  slug: 'example-university',
  status: 'published',
  officialName: 'Example University',
  countryCode: 'GB',
};

const promotableTest = {
  slug: 'example-test',
  name: 'Example Test',
  status: 'published',
  officialWebsite: 'https://example.test',
  providerId: {
    name: 'Example Provider',
    status: 'active',
    officialWebsite: 'https://provider.example.test',
  },
  sources: [{ sourceType: 'official_test_org', sourceUrl: 'https://example.test/about' }],
};

test('B2 uses one canonical-institution derived-context builder for SEO and sitemap', () => {
  assert.match(seoController, /getCanonicalInstitutionEligibilityContext/);
  assert.match(seoController, /canonicalInstitutionEligibilityFacts/);
  assert.match(seoController, /programCountByInstitutionId/);
  assert.match(seoController, /acceptedTestCountByInstitutionId/);
  assert.match(seoController, /currentAcceptanceMongoFilter/);
});

test('B2 Blog policy is published-only across public SEO surfaces', () => {
  assert.match(seoController, /status: 'published'/);
  assert.equal(isSeoEntityIndexable('blog', { slug: 'x', status: 'published' }), true);
  assert.equal(isSeoEntityIndexable('blog', { slug: 'x', status: 'draft' }), false);
});

test('B2 Test policy remains published plus publicly promotable', () => {
  assert.equal(isTestPubliclyPromotable(promotableTest), true);
  assert.equal(isTestPubliclyPromotable({ ...promotableTest, status: 'draft' }), false);
  assert.equal(isTestPubliclyPromotable({ ...promotableTest, sources: [] }), false);
  assert.match(testController, /isTestPubliclyPromotable/);
  assert.match(seoController, /isTestPubliclyPromotable/);
  assert.match(seoController, /`\/tests\/\$\{t\.slug\}`/);
});

test('B2 canonical-institution indexability is a meaningful-profile subset of detail access', () => {
  assert.equal(isCanonicalInstitutionDetailEligible(institution), false);
  assert.equal(isCanonicalInstitutionDetailEligible(institution, { acceptedTestCount: 1 }), true);
  assert.equal(isCanonicalInstitutionDetailEligible(institution, { programCount: 1 }), true);
  assert.equal(isCanonicalInstitutionDetailEligible({ ...institution, status: 'draft' }, { programCount: 1 }), false);
});

test('B2 program and CMS scholarship policies remain explicit and fixture-aware at query sites', () => {
  assert.equal(isProgramDetailIndexable({
    slug: 'program', status: 'published', name: 'Program', institutionId: 'i', description: 'Fact',
  }), true);
  assert.equal(isProgramDetailIndexable({
    slug: 'program', status: 'draft', name: 'Program', institutionId: 'i', description: 'Fact',
  }), false);
  assert.equal(isIntlScholarshipDetailEligible({ slug: 'award', status: 'active' }), true);
  assert.equal(isIntlScholarshipDetailEligible({ slug: 'award', status: 'draft' }), false);
  assert.match(scholarshipController, /withFixtureExclusion/);
  assert.match(admissionsController, /withFixtureExclusion/);
  assert.match(internshipController, /withFixtureExclusion/);
});

test('B2 jobs preserve historical detail versus active indexability distinction', () => {
  assert.equal(isJobDetailPubliclyEligible({ slug: 'open', status: 'active' }), true);
  assert.equal(isJobDetailPubliclyEligible({ slug: 'closed', status: 'active', deadline: '2020-01-01' }), false);
});

test('B2 canonical URLs use fixed public origin and exclude query-string sitemap paths', () => {
  assert.equal(resolvePublicSiteOrigin(''), PRODUCTION_PUBLIC_ORIGIN);
  assert.match(seoController, /resolvePublicSiteOrigin/);
  assert.match(seoController, /return PRODUCTION_PUBLIC_ORIGIN|resolvePublicSiteOrigin/);
  assert.equal(resolveInstitutionDetailPath({ slug: 'legacy-school' }, { legacy: true }), '/schools-and-colleges/legacy-school');
  assert.equal(resolveInstitutionDetailPath({ slug: 'canonical-school' }), '/institutions/canonical-school');
  assert.equal(isSitemapEligiblePath('/institutions/example?utm_source=test'), false);
  assert.equal(isSitemapEligiblePath('/institutions/example'), true);
});

test('B2 keeps static Test route precedence and legacy/canonical route ownership separate', () => {
  const rewrites = vercelConfig.rewrites;
  const compareIndex = rewrites.findIndex((entry) => entry.source === '/tests/compare');
  const dynamicIndex = rewrites.findIndex((entry) => entry.source === '/tests/:slug');
  assert.ok(compareIndex >= 0 && dynamicIndex >= 0 && compareIndex < dynamicIndex);
  assert.ok(rewrites.some((entry) => entry.source === '/tests/ielts' && entry.destination === '/tests/ielts/index.html'));
  assert.equal(resolveInstitutionDetailPath({ slug: 'same-name' }, { legacy: true }), '/schools-and-colleges/same-name');
  assert.equal(resolveInstitutionDetailPath({ slug: 'same-name' }), '/institutions/same-name');
});

console.log('p8b2EligibilityCanonical: policy and canonical contract checks passed');
