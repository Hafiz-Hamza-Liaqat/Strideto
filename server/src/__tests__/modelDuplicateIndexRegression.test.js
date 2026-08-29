import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(rel) {
  return fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
}

const testProvider = read('../models/education/TestProvider.js');
assert.doesNotMatch(
  testProvider,
  /status:[\s\S]*?index:\s*true/,
  'TestProvider status must not use inline index when schema.index({ status: 1 }) exists'
);
assert.match(testProvider, /testProviderSchema\.index\(\{\s*status:\s*1\s*\}\)/);

const countryEducation = read('../models/education/CountryEducation.js');
assert.doesNotMatch(
  countryEducation,
  /status:[\s\S]*?index:\s*true/,
  'CountryEducation status must not use inline index when schema.index({ status: 1 }) exists'
);
assert.match(countryEducation, /countryEducationSchema\.index\(\{\s*status:\s*1\s*\}\)/);

const alertPreference = read('../models/action/AlertPreference.js');
assert.match(alertPreference, /userId:[\s\S]*?unique:\s*true/);
assert.doesNotMatch(
  alertPreference,
  /alertPreferenceSchema\.index\(\{\s*userId:\s*1\s*\}\)/,
  'AlertPreference userId unique constraint already creates { userId: 1 }'
);

const warnings = [];
const origWarn = console.warn;
console.warn = (...args) => {
  const msg = args.join(' ');
  if (msg.includes('Duplicate schema index')) warnings.push(msg);
  origWarn(...args);
};

const { TestProvider } = await import('../models/education/TestProvider.js');
const { CountryEducation } = await import('../models/education/CountryEducation.js');
const { AlertPreference } = await import('../models/action/AlertPreference.js');

assert.equal(warnings.length, 0, `unexpected duplicate index warnings: ${warnings.join('; ')}`);
assert.ok(TestProvider.schema.indexes().some(([spec]) => spec.status === 1));
assert.ok(CountryEducation.schema.indexes().some(([spec]) => spec.status === 1));
assert.ok(
  AlertPreference.schema.indexes().some(([spec, opts]) => spec.userId === 1 && opts?.unique === true)
);

console.log('modelDuplicateIndexRegression.test.js: 8/8 checks passed');
