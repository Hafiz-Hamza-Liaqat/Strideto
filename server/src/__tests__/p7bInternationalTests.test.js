import assert from 'node:assert/strict';
import { providerPacks, INTERNATIONAL_TEST_VERIFIED_AT } from '../seed/internationalTests.js';
import { isTestPubliclyPromotable } from '../../../shared/education/testPublicationPolicy.js';

const requiredSlugs = ['ielts', 'toefl-ibt', 'pte-academic', 'duolingo-english-test', 'gre', 'gmat'];
assert.equal(providerPacks.length, 6, 'P7B initial catalog has six tests');
assert.equal(new Set(providerPacks.map((pack) => pack.test.slug)).size, 6, 'test slugs are unique');
assert.equal(new Set(providerPacks.map((pack) => pack.provider.slug)).size, 5, 'provider slugs are normalized by organization');
assert.ok(INTERNATIONAL_TEST_VERIFIED_AT, 'all launch evidence has a verification date');

for (const pack of providerPacks) {
  assert.ok(requiredSlugs.includes(pack.test.slug), `${pack.test.name} is in the initial catalog`);
  const test = { ...pack.test, providerId: { ...pack.provider, status: 'active' }, status: 'published' };
  assert.equal(isTestPubliclyPromotable(test), true, `${pack.test.name} satisfies publication policy`);
  assert.ok(pack.test.sources.every((source) => source.sourceType === 'official_test_org' && /^https?:\/\//.test(source.sourceUrl) && source.verifiedAt), `${pack.test.name} has official provenance`);
  assert.ok(pack.resource.url.startsWith('https://'), `${pack.test.name} resource is HTTPS`);
  assert.ok(pack.resource.provider, `${pack.test.name} resource identifies its provider`);
  assert.ok(!/\b(?:PPSC|FPSC|NTS|CSS)\b/i.test(JSON.stringify(pack)), `${pack.test.name} has no legacy exam taxonomy`);
  assert.notEqual(pack.resource.resourceType, 'mock_exam', `${pack.test.name} does not use an internal mock-test resource`);
}

console.log('p7bInternationalTests: 6 tests eligible; provenance and legacy-isolation checks passed');
