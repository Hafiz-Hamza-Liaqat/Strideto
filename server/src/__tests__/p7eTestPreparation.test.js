import assert from 'node:assert/strict';
import { providerPacks } from '../seed/internationalTests.js';

assert.equal(providerPacks.length, 6);
for (const pack of providerPacks) {
  assert.equal(pack.resource.trustLevel, undefined, 'trust level is applied by the existing seed, not duplicated in source data');
  assert.match(pack.resource.url, /^https:\/\//);
  assert.match(pack.resource.url, new RegExp(`^https://${pack.provider.officialWebsite.replace(/^https:\/\//, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${pack.test.name} resource remains on its provider domain`);
}
assert.ok(providerPacks.every((pack) => pack.test.purposes?.length));
assert.ok(providerPacks.every((pack) => pack.test.sections?.length));
assert.ok(providerPacks.every((pack) => pack.test.sources?.every((source) => source.sourceUrl.startsWith('https://'))));

console.log('p7eTestPreparation: six canonical tests retain source-backed preparation/resource contracts');
