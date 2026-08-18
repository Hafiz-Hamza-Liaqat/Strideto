import assert from 'node:assert/strict';
import { mockResponse, providerHomeFixtureFor } from './lib/acceptanceFixtures.mjs';

const educationPersonas = ['education-independent', 'education-agency'];
const businessPersonas = ['business-independent', 'business-agency'];
for (const persona of [...educationPersonas, ...businessPersonas]) {
  const [status, body] = mockResponse('/api/agent/provider-domains/home', persona, { method: 'GET', routeId: `${persona}:/agent` });
  assert.equal(status, 200);
  assert.equal(body.needsOnboarding, false);
  assert.equal(body.workspaces.length, 1);
  assert.equal(body.cards.length, 1);
  assert.deepEqual(body.cards[0].counters, body.workspaces[0].counters);
  assert.ok(body.cards[0].domain.publicName);
  assert.ok(body.cards[0].path.startsWith('/agent/'));
  if (persona.startsWith('education')) {
    assert.equal(body.cards[0].domainId, 'education_mobility');
    assert.equal(body.businessServicesProviderEnabled, false);
  } else {
    assert.equal(body.cards[0].domainId, 'business_services');
    assert.equal(body.businessServicesProviderEnabled, true);
    assert.equal(body.publicMarketplaceEnabled, false);
  }
}
assert.equal(mockResponse('/api/agent/provider-domains/home', 'student')[0], 403);
assert.throws(() => mockResponse('/api/agent/provider-domains/home/unknown', 'education-independent', { method: 'GET', routeId: 'education-independent:/agent' }), (error) => error.code === 'UNHANDLED_ACCEPTANCE_API' && /pathname=\/api\/agent\/provider-domains\/home\/unknown/.test(error.message));
const independent = providerHomeFixtureFor('education-independent');
const agency = providerHomeFixtureFor('education-agency');
assert.notEqual(independent.cards[0].subjectType, agency.cards[0].subjectType);
assert.notEqual(independent.cards[0].subjectId, agency.cards[0].subjectId);
console.log(JSON.stringify({ educationIndependent: 'PASS', educationAgency: 'PASS', businessIndependent: 'PASS', businessAgency: 'PASS', wrongDomain: 'FAIL_CLOSED', unknownEndpoint: 'FAIL_CLOSED' }));
