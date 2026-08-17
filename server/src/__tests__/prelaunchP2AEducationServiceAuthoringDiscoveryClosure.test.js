import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AGENT_SERVICE_CATEGORIES } from '../../../shared/agent/constants.js';
import { AGENT_SERVICE_CATEGORY_OPTIONS, isAgentServiceCategory } from '../../../shared/agent/serviceTaxonomy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const serviceSource = readFileSync(path.resolve(here, '../services/agentProfileService.js'), 'utf8');

assert.equal(Object.values(AGENT_SERVICE_CATEGORIES).length, 9);
assert.deepEqual(AGENT_SERVICE_CATEGORY_OPTIONS.map((row) => row.value), Object.values(AGENT_SERVICE_CATEGORIES));
assert.equal(isAgentServiceCategory('test_guidance'), true);
assert.equal(isAgentServiceCategory('registered_agent'), false);
assert.ok((serviceSource.match(/education_service_category_invalid/g) || []).length >= 2, 'create and edit reject unknown/Business categories');
assert.ok((serviceSource.match(/EDUCATION_SERVICES_MANAGE/g) || []).length >= 2, 'create and edit require Education service authority');
assert.ok(serviceSource.includes(".select('title category description eligibilityNotes countriesServed destinationCountries deliveryMode pricingMode price durationEstimate')"), 'safe duration and limitation fields are publicly projected');
assert.ok(!serviceSource.includes('AgentMarketplacePost.update'), 'service editing does not rewrite Marketplace posts');

console.log('prelaunchP2AEducationServiceAuthoringDiscoveryClosure server: PASS');
