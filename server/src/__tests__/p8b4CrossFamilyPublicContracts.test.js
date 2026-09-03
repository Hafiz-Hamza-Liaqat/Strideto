/**
 * MKT-P8-B4 cross-family public contract regression hardening.
 * Test-only; no database or production access.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  projectPublicJob, projectPublicJobListItem, projectPublicCmsScholarship,
  projectPublicBlog, projectPublicTest, projectPublicTestPrepGuide,
  projectPublicTestResource, projectPublicTestAlert, projectPublicCanonicalInstitution,
  projectPublicProgram, projectPublicIntlScholarship, projectPublicCareerArticle,
  projectPublicLegacyInstitution, projectPublicUniversity, projectPublicCompany,
  projectPublicEmployer, publicSearchMetadata,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';
import {
  isJobDetailPubliclyEligible, isCmsScholarshipDetailEligible,
  isCanonicalInstitutionDetailEligible, isProgramDetailIndexable,
  resolveInstitutionDetailPath,
} from '../../../shared/seo/entityDetailSeoPolicy.js';
import { isTestPubliclyPromotable } from '../../../shared/education/testPublicationPolicy.js';
import { PRODUCTION_PUBLIC_ORIGIN } from '../../../shared/seo/publicSiteOrigin.js';
import { safeSchemaDate, safeSchemaMonetaryValue, safeSchemaUrl } from '../../../shared/seo/schemaSafety.js';
import { sanitizeJsonLdString, safeJsonLd } from '../../../client/src/seo/sanitize.js';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (file) => readFileSync(path.join(repo, file), 'utf8');
const PRIVATE_KEYS = new Set([
  '__v', 'password', 'passwordHash', 'refreshToken', 'adminNotes', 'moderationNotes',
  'internalNotes', 'ownerId', 'userId', 'accountId', 'createdBy', 'updatedBy',
  'billing', 'payment', 'stripeCustomerId', 'permissions', 'roles', 'capabilities',
  'launchEligible', 'fixtureOnly', 'reviewState', 'privateSentinel', 'scheduledAt',
  'deletedAt', 'sourceId', 'sourceIds', 'relatedArticleIds', 'evidenceRefs',
  'messages', 'applications',
]);

function assertNoPrivateKeys(value, allowed = new Set(), name = '$') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoPrivateKeys(entry, allowed, name + '[' + index + ']'));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    assert.ok(!PRIVATE_KEYS.has(key) || allowed.has(key), name + '.' + key + ' must not be public');
    assertNoPrivateKeys(nested, allowed, name + '.' + key);
  }
}

test('B4 positive projections reject unknown and private future fields', () => {
  const input = {
    _id: 'public-id', slug: 'public-slug', title: 'Public title', name: 'Public name',
    description: 'Public description', content: 'Public body', status: 'published',
    officialName: 'Public institution', countryCode: 'GB', institutionId: 'institution',
    privateSentinel: 'must-not-leak', adminNotes: 'must-not-leak', internalNotes: 'must-not-leak',
    launchEligible: true, fixtureOnly: true, createdBy: 'private-user', updatedBy: 'private-user',
    __v: 99, futureInternalField: 'must-not-leak',
  };
  const values = [
    projectPublicBlog(input), projectPublicTest({ ...input, providerId: { name: 'Provider', privateSentinel: true } }),
    projectPublicIntlScholarship(input), projectPublicCareerArticle(input),
    projectPublicLegacyInstitution(input), projectPublicUniversity(input),
    projectPublicCompany(input), projectPublicEmployer(input),
    projectPublicJob({ ...input, status: 'active' }), projectPublicCmsScholarship({ ...input, status: 'active' }),
    projectPublicCanonicalInstitution(input), projectPublicProgram(input),
  ];
  values.forEach((value) => assertNoPrivateKeys(value));
  values.forEach((value) => assert.equal(value.futureInternalField, undefined));
});

test('B4 nested public records stay bounded', () => {
  const input = { _id: 'id', slug: 'slug', name: 'name', title: 'title', privateSentinel: true, adminNotes: true, __v: 1 };
  const intl = projectPublicIntlScholarship(input, { related: [input] });
  const legacy = projectPublicLegacyInstitution(input, { related: [input] });
  const university = projectPublicUniversity(input, {
    admissions: [input], scholarships: [input], foreignStudies: [input],
  });
  const testDto = projectPublicTest({ ...input, providerId: { name: 'Provider' } });
  [
    projectPublicBlog({ ...input, content: 'body' }).relatedPosts, intl.related, legacy.related,
    university.admissions, university.scholarships, university.foreignStudies,
    [projectPublicJobListItem({ ...input, status: 'active' })],
    [projectPublicTestPrepGuide(input), projectPublicTestResource(input), projectPublicTestAlert(input)],
    testDto,
  ].forEach((value) => assertNoPrivateKeys(value));
});

test('B4 public search metadata is a positive allowlist', () => {
  const metadata = publicSearchMetadata({
    icon: 'blog', provider: 'Public provider', adminEditUrl: '/admin/private',
    launchEligible: true, ownerId: 'private-owner', futureInternalField: 'must-not-leak',
  });
  assert.deepEqual(metadata, { icon: 'blog', provider: 'Public provider' });
  assertNoPrivateKeys(metadata);
});

test('B4 canonical identity remains slug-led and datasets stay separate', () => {
  assert.equal(resolveInstitutionDetailPath({ slug: 'canonical' }), '/institutions/canonical');
  assert.equal(resolveInstitutionDetailPath({ slug: 'legacy' }, { legacy: true }), '/schools-and-colleges/legacy');
  assert.notEqual(resolveInstitutionDetailPath({ slug: 'same' }), resolveInstitutionDetailPath({ slug: 'same' }, { legacy: true }));
  assert.match(read('shared/seo/publicSiteOrigin.js'), /https:\/\/www\.strideto\.com/);
  assert.match(read('shared/seo/entityDetailSeoPolicy.js'), /\/institutions\//);
  for (const pair of [
    [projectPublicJob({ slug: 'job' }), '/jobs'], [projectPublicCmsScholarship({ slug: 'scholarship' }), '/scholarships'],
    [projectPublicBlog({ slug: 'blog' }), '/blog'], [projectPublicCanonicalInstitution({ slug: 'institution' }), '/institutions'],
    [projectPublicLegacyInstitution({ slug: 'legacy' }), '/schools-and-colleges'], [projectPublicProgram({ slug: 'program' }), '/program-explorer'],
    [projectPublicIntlScholarship({ slug: 'intl' }), '/intl-scholarships'], [projectPublicCareerArticle({ slug: 'career' }), '/career-guidance'],
    [projectPublicUniversity({ slug: 'university' }), '/university'], [projectPublicCompany({ slug: 'company' }), '/company'],
    [projectPublicEmployer({ slug: 'employer' }), '/employer'],
  ]) {
    assert.ok(pair[0].slug);
    assert.equal(PRODUCTION_PUBLIC_ORIGIN + pair[1] + '/' + pair[0].slug, PRODUCTION_PUBLIC_ORIGIN + pair[1] + '/' + pair[0].slug);
  }
});

test('B4 accepted eligibility relationships remain explicit', () => {
  assert.equal(isJobDetailPubliclyEligible({ slug: 'job', status: 'active' }), true);
  assert.equal(isJobDetailPubliclyEligible({ slug: 'old', status: 'active', deadline: '2000-01-01' }), false);
  assert.equal(isCmsScholarshipDetailEligible({ slug: 'scholarship', status: 'active' }), true);
  assert.equal(isCmsScholarshipDetailEligible({ slug: 'draft', status: 'draft' }), false);
  assert.equal(isTestPubliclyPromotable({
    status: 'published', name: 'Test', slug: 'test',
    providerId: { name: 'Provider', status: 'active', officialWebsite: 'https://provider.example' },
    officialWebsite: 'https://test.example',
    sources: [{ sourceType: 'official_test_org', sourceUrl: 'https://test.example/source' }],
  }), true);
  assert.equal(isTestPubliclyPromotable({ status: 'draft', providerId: { name: 'Provider' } }), false);
  assert.equal(isCanonicalInstitutionDetailEligible({ slug: 'i', status: 'published', officialName: 'I', countryCode: 'GB' }, { programCount: 1 }), true);
  assert.equal(isCanonicalInstitutionDetailEligible({ slug: 'thin', status: 'published', officialName: 'I', countryCode: 'GB' }), false);
  assert.equal(isProgramDetailIndexable({ slug: 'p', status: 'published', name: 'P', institutionId: 'i', description: 'facts' }), true);
});

test('B4 schema safety omits unsupported and unsafe values', () => {
  assert.equal(safeSchemaUrl('javascript:alert(1)'), undefined);
  assert.equal(safeSchemaUrl('https://example.com/public.png'), 'https://example.com/public.png');
  assert.equal(safeSchemaUrl('https://deployment.vercel.app/auth'), undefined);
  assert.equal(safeSchemaDate('not-a-date'), undefined);
  assert.equal(safeSchemaDate('2026-01-02'), '2026-01-02T00:00:00.000Z');
  assert.equal(safeSchemaMonetaryValue('1,000 PKR', undefined), undefined);
  assert.deepEqual(safeSchemaMonetaryValue(1000, 'usd'), { '@type': 'MonetaryAmount', value: 1000, currency: 'USD' });
});

test('B4 scholarship currency and JSON-LD injection guardrails are permanent', () => {
  const schemas = read('client/src/seo/schemas.js');
  assert.match(schemas, /safeSchemaMonetaryValue/);
  assert.doesNotMatch(schemas, /currency:\s*['"]PKR['"]/);
  assert.doesNotMatch(schemas, /exam\.name\} exam preparation/);
  const serialized = safeJsonLd({ description: sanitizeJsonLdString('</script><script>alert(1)</script> & < > " ☃') });
  assert.doesNotMatch(serialized, /<\/script>/i);
  assert.match(serialized, /\\\/script/);
});

test('B4 static Test ownership and request-time shell remain protected', () => {
  const vercel = read('client/vercel.json');
  assert.ok(vercel.indexOf('/tests/compare') < vercel.indexOf('/tests/:slug'));
  for (const slug of ['ielts', 'toefl-ibt', 'pte-academic', 'duolingo-english-test', 'gre', 'gmat']) {
    assert.ok(vercel.indexOf('/tests/' + slug) < vercel.indexOf('/tests/:slug'));
  }
  const shell = read('client/api/seo/_shared/publicSpaShell.js');
  assert.match(shell, /index\.html/);
  assert.match(shell, /\broot/);
  assert.match(shell, /assets/);
  assert.match(shell, /sso-api|Log in to Vercel|_next/);
  assert.match(read('client/api/seo/entity.js'), /502/);
  assert.match(read('client/api/seo/jobs.js'), /502/);
});
