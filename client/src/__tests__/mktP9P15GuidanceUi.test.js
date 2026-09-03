import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const hub = fs.readFileSync(new URL('../pages/Personalization/PersonalizationHub.jsx', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../services/personalizationApi.js', import.meta.url), 'utf8');

test('guidance overview has responsive bounded layout and honest states', () => {
  assert.match(hub, /sm:grid-cols-2/);
  assert.match(hub, /line-clamp-2/);
  assert.match(hub, /Loading your guidance overview/);
  assert.match(hub, /Could not load your guidance overview/);
  assert.match(hub, /No recommendations can be calculated/);
  assert.doesNotMatch(hub, /min-w-\[|w-\[\d+px\]/);
});

test('guidance overview uses the authenticated bounded API contract', () => {
  assert.match(api, /guidance:\s*\(\)\s*=>\s*axiosInstance\.get\('\/personalization\/guidance'\)/);
  assert.match(hub, /personalizationApi\.guidance\(\)/);
  assert.match(hub, /Preference alignment/);
  assert.match(hub, /does not guarantee admission, scholarship awards, or visa outcomes/);
});
