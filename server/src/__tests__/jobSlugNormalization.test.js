import assert from 'node:assert/strict';
import test from 'node:test';
import { jobSlug, slugify } from '../utils/slugify.js';

test('PwC candidate generates a strict canonical slug without changing its title', () => {
  const title = 'IN_Senior Associate_Microsoft Azure_Digital Integration_Advisory_Kolkata';
  assert.equal(
    jobSlug(title, 'West Bengal'),
    'in-senior-associate-microsoft-azure-digital-integration-advisory-kolkata-west-bengal',
  );
  assert.equal(title, 'IN_Senior Associate_Microsoft Azure_Digital Integration_Advisory_Kolkata');
});

test('slug normalization converts separators and punctuation to hyphens', () => {
  assert.equal(slugify('Senior  Engineer & Data/AI'), 'senior-engineer-data-ai');
  assert.equal(slugify('  Product — Manager: EMEA  '), 'product-manager-emea');
  assert.equal(slugify('Café — Zürich'), 'cafe-zurich');
});

test('slug normalization remains deterministic and strict-format compatible', () => {
  const values = [
    'in-senior-associate-microsoft-azure-digital-integration-advisory-kolkata-west-bengal',
    'senior-engineer-data-ai',
    'product-manager-emea',
    'cafe-zurich',
  ];
  for (const value of values) {
    assert.match(value, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(slugify(value), value);
  }
});
