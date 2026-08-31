import assert from 'node:assert/strict';
import { providerPacks, seedInternationalTests } from '../seed/internationalTests.js';

class MemoryModel {
  constructor(seed = []) {
    this.rows = seed.map((row) => ({ ...row }));
    this.nextId = this.rows.length + 1;
  }

  matches(row, filter) {
    return Object.entries(filter).every(([key, value]) => String(row[key]) === String(value));
  }

  async findOne(filter) { return this.rows.find((row) => this.matches(row, filter)) || null; }
  async findById(id) { return this.rows.find((row) => String(row._id) === String(id)) || null; }

  async findOneAndUpdate(filter, update, options = {}) {
    const existing = await this.findOne(filter);
    if (existing) return existing;
    if (!options.upsert) return null;
    const inserted = { ...update.$setOnInsert, _id: `memory-${this.nextId++}` };
    this.rows.push(inserted);
    return inserted;
  }
}

const modelsFor = (seed = {}) => ({
  TestProvider: new MemoryModel(seed.providers),
  Test: new MemoryModel(seed.tests),
  TestPrepGuide: new MemoryModel(),
  ExternalTestResource: new MemoryModel(),
});

const base = providerPacks[0];

{
  const models = modelsFor();
  const first = await seedInternationalTests({ models });
  const second = await seedInternationalTests({ models });
  assert.equal(first.tests.filter((test) => test.status === 'inserted').length, 6);
  assert.equal(second.tests.filter((test) => test.status === 'existing-eligible').length, 6);
  assert.equal(models.Test.rows.length, 6, 'rerunning the seed does not duplicate Tests');
  assert.equal(models.TestProvider.rows.length, 5, 'shared ETS provider is not duplicated');
}

{
  const provider = { ...base.provider, _id: 'reviewed-provider', status: 'active' };
  const reviewed = { ...base.test, _id: 'reviewed-test', providerId: provider._id, status: 'published' };
  const models = modelsFor({ providers: [provider], tests: [reviewed] });
  const result = await seedInternationalTests({ models });
  assert.equal(result.tests.find((test) => test.stableId === base.test.stableId).status, 'existing-eligible');
  assert.equal(models.Test.rows.find((test) => test._id === 'reviewed-test').description, reviewed.description);
}

{
  const provider = { ...base.provider, _id: 'draft-provider', status: 'active' };
  const draft = { _id: 'draft-test', stableId: base.test.stableId, slug: base.test.slug, name: base.test.name, providerId: provider._id, status: 'draft' };
  const models = modelsFor({ providers: [provider], tests: [draft] });
  const result = await seedInternationalTests({ models });
  assert.equal(result.tests.find((test) => test.stableId === base.test.stableId).status, 'existing-ineligible');
  assert.equal(models.Test.rows.length, 6, 'draft collision is preserved and not overwritten');
}

{
  const provider = { ...base.provider, _id: 'expected-provider', status: 'active' };
  const conflicting = { ...base.test, _id: 'conflicting-test', providerId: 'other-provider', status: 'published' };
  const models = modelsFor({ providers: [provider], tests: [conflicting] });
  const result = await seedInternationalTests({ models });
  assert.equal(result.tests.find((test) => test.stableId === base.test.stableId).status, 'conflict');
  assert.equal(models.Test.rows.find((test) => test._id === 'conflicting-test').providerId, 'other-provider');
}

console.log('p7bSeedSafety: insert, reviewed collision, draft collision, provider conflict, and rerun cases passed');
