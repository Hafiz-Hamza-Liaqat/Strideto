import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { resolveSearchIntent } from '../../../shared/search/queryIntent.js';
import { entityTypeLabel } from '../../../shared/search/entityTypes.js';

const read = (path) => fs.readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('C3-01 through C3-06: exact entity aliases resolve deterministically', () => {
  assert.deepEqual(resolveSearchIntent('job').entityTypes, ['job']);
  assert.deepEqual(resolveSearchIntent('jobs').entityTypes, ['job']);
  assert.deepEqual(resolveSearchIntent(' blog ').entityTypes, ['blog']);
  assert.deepEqual(resolveSearchIntent('admissions').entityTypes, ['admission']);
  assert.deepEqual(resolveSearchIntent('programs').entityTypes, ['program']);
  assert.deepEqual(resolveSearchIntent('international scholarships').entityTypes, ['intl-scholarship']);
  assert.deepEqual(resolveSearchIntent('scholarships').entityTypes, ['scholarship', 'intl-scholarship']);
});

test('C3-07 and C3-10: exact titles and ordinary queries retain lexical scoring', () => {
  const scoring = read('shared/search/scoring.js');
  assert.match(scoring, /title === q/);
  assert.match(scoring, /W\.exactTitle/);
  assert.equal(resolveSearchIntent('software engineering program').entityTypes, null);
  assert.equal(resolveSearchIntent('zzqxv987xyz').entityTypes, null);
});

test('C3-08: explicit type filters are represented separately from inferred intent', () => {
  const service = read('server/src/services/search/SearchIndexService.js');
  assert.match(service, /!params\.types\?\.length \? resolveSearchIntent/);
  assert.match(service, /params\.types\?\.length \? params\.types/);
  assert.match(service, /if \(!intent\?\.entityTypes\)/);
});

test('C3-09 through C3-11: approved labels/types stay bounded', () => {
  assert.equal(entityTypeLabel('intl-scholarship'), 'International Scholarships');
  assert.equal(entityTypeLabel('legacy-institution'), 'Legacy Institutions');
  assert.equal(entityTypeLabel('company'), 'Companies');
  const policy = read('shared/platform/searchPrivacyPolicy.js');
  assert.match(policy, /clampPublicSearchTypes/);
  assert.doesNotMatch(policy, /talent-profile.*PUBLIC_SEARCH_ENTITY_TYPES/);
});

test('C3-12 through C3-15: public DTO and canonical URL contracts remain in force', () => {
  const service = read('server/src/services/search/SearchIndexService.js');
  const mappers = read('server/src/services/search/documentMappers.js');
  assert.match(service, /publicSearchMetadata\(doc\.metadata\)/);
  assert.match(service, /url: doc\.url/);
  for (const route of ['/program-explorer', '/intl-scholarships', '/schools-and-colleges', '/company']) {
    assert.ok(mappers.includes(route), `mapper preserves canonical route ${route}`);
  }
  assert.match(service, /slice\(params\.skip, params\.skip \+ params\.limit\)/);
  assert.match(service, /rankSearchResults/);
});

test('public navigation aliases are separate quick links, never SearchDocuments', () => {
  const intent = resolveSearchIntent('/jobs', { includeNavigation: true });
  assert.deepEqual(intent.navigation, { label: 'Jobs', url: '/jobs', entityType: 'navigation', id: 'jobs' });
  assert.equal(resolveSearchIntent('/jobs').navigation, null);
  const service = read('server/src/services/search/SearchIndexService.js');
  assert.match(service, /quickLinks/);
  assert.match(service, /intent\.navigation/);
});
