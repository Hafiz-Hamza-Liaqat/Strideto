import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AGENT_SERVICE_CATEGORIES } from '../../../shared/agent/constants.js';
import { AGENT_SERVICE_CATEGORY_OPTIONS } from '../../../shared/agent/serviceTaxonomy.js';
import {
  educationServicePriceFromInput,
  educationServicePriceInput,
  educationServicePublicPriceLabel,
} from '../../../shared/agent/servicePricing.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const services = readFileSync(path.join(root, 'pages/Agent/AgentServices.jsx'), 'utf8');
const directory = readFileSync(path.join(root, 'pages/Public/AgentDirectory.jsx'), 'utf8');
const profile = readFileSync(path.join(root, 'pages/Public/AgentPublicProfile.jsx'), 'utf8');

assert.equal(AGENT_SERVICE_CATEGORY_OPTIONS.length, 9);
assert.deepEqual(AGENT_SERVICE_CATEGORY_OPTIONS.map((row) => row.value), Object.values(AGENT_SERVICE_CATEGORIES));
assert.equal(new Set(AGENT_SERVICE_CATEGORY_OPTIONS.map((row) => row.value)).size, 9);
for (const category of Object.values(AGENT_SERVICE_CATEGORIES)) {
  assert.ok(AGENT_SERVICE_CATEGORY_OPTIONS.some((row) => row.value === category && row.label), `${category} has one canonical label`);
}

assert.ok(services.includes('AGENT_SERVICE_CATEGORY_OPTIONS.map'), 'create and edit reuse canonical taxonomy options');
assert.ok(services.includes('<ServiceFields form={form}') && services.includes('<ServiceFields form={editForm}'), 'same canonical fields render create and edit');
assert.ok(services.includes("changeStatus(service, 'archived')"), 'archive lifecycle is exposed without deletion');
assert.ok(services.includes('visa guarantee') && services.includes('employment, work authorization'), 'sensitive guidance remains explicitly non-guaranteed');

const usd = educationServicePriceFromInput('150.25', 'usd');
assert.deepEqual(usd, { amountMinor: 15025, currency: 'USD' });
assert.equal(educationServicePriceInput(usd), '150.25');
const jpy = educationServicePriceFromInput('150', 'JPY');
assert.deepEqual(jpy, { amountMinor: 150, currency: 'JPY' });
assert.throws(() => educationServicePriceFromInput('1.001', 'USD'), /decimal places/);
assert.throws(() => educationServicePriceFromInput('-1', 'USD'), /non-negative/);
assert.match(educationServicePublicPriceLabel({ pricingMode: 'fixed_price', price: usd }), /150\.25.*USD/);
assert.match(educationServicePublicPriceLabel({ pricingMode: 'starting_from', price: usd }), /^Starting from .*150\.25.*USD/);
assert.equal(educationServicePublicPriceLabel({ pricingMode: 'free' }), 'Free');
assert.equal(educationServicePublicPriceLabel({ pricingMode: 'contact_for_details' }), 'Contact for details');

assert.ok(directory.includes('Find Education &amp; Mobility Providers'), 'directory h1 describes discovery');
assert.ok(directory.includes('AGENT_SERVICE_CATEGORY_OPTIONS.map'), 'directory filter consumes canonical options');
assert.ok(directory.includes('serviceCategory') && directory.includes('setSearchParams'), 'category composes into API and URL query state');
for (const key of ['agentType', 'countryCode', 'destinationCountry', 'serviceCategory']) assert.ok(directory.includes(key), `${key} filter remains composed`);
assert.ok(directory.includes('No providers match these filters.') && directory.includes('Clear filters'), 'empty state is truthful and recoverable');

for (const field of ['eligibilityNotes', 'durationEstimate', 'educationServicePublicPriceLabel', 'agentServiceCategoryLabel']) {
  assert.ok(profile.includes(field), `public service renders ${field}`);
}
assert.ok(profile.includes('payment has been processed or an outcome is guaranteed'), 'public service states price/outcome authority truthfully');
assert.ok(profile.match(/<h1/g)?.length >= 3, 'loaded, loading, and error profile states retain route identity');

console.log('prelaunchP2AEducationServiceAuthoringDiscoveryClosure client: PASS');
