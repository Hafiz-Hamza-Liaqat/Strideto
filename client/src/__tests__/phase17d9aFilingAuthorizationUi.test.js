import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(src, rel), 'utf8');
}

const customer = read('pages/BusinessClient/BusinessClientCaseDetail.jsx');
const panel = read('components/gbs/CaseFilingAuthorizationPanel.jsx');
const providerPage = read('pages/Agent/business-services/GbsCaseDetail.jsx');
const providerPanel = read('components/gbs/ProviderFilingAuthorizationPanel.jsx');
const buyerApi = read('services/gbsBuyerApi.js');
const providerApi = read('services/gbsProviderApi.js');
const routes = read('routes/index.jsx');
const fixture = read('pages/dev/GbsFilingAuthorizationVisualFixture.jsx');
const layout = read('pages/BusinessClient/BusinessClientLayout.jsx');
const providerLayout = read('pages/Agent/business-services/GbsWorkspaceLayout.jsx');

check(customer.includes('CaseFilingAuthorizationPanel'), 'customer wires authorization panel');
check(customer.includes('getFilingAuthorization'), 'customer loads authorization state');
check(customer.includes('aria-busy'), 'customer mutation busy');
check(panel.includes('<h3') && panel.includes('Filing authorization'), 'semantic heading');
check(panel.includes('htmlFor="filing-auth-affirm"'), 'affirmation labelled');
check(panel.includes('checked={affirmed}'), 'checkbox controlled');
check(panel.includes('open={grantOpen}') && panel.includes('open={revokeOpen}'), 'explicit dialog open');
check(panel.includes('role="alert"'), 'errors announced');
check(panel.includes('whitespace-pre-wrap break-words-safe'), 'legal text wraps');
check(panel.includes('min-w-0'), 'overflow containment');
check(!panel.includes('dangerouslySetInnerHTML'), 'no raw HTML');
check(!/Submit to Wyoming|government approved|I am the legal representative/i.test(panel), 'no forbidden copy');
check(panel.includes('Authorize Provider'), 'explicit grant control');
check(buyerApi.includes('filing-authorization/grant') && buyerApi.includes('filing-authorization/revoke'), 'customer APIs');

check(providerPage.includes('ProviderFilingAuthorizationPanel'), 'provider wires panel');
check(providerPanel.includes('Record external filing'), 'truthful record copy');
check(providerPanel.includes('outside STRIDETO'), 'external filing truth');
check(providerPanel.includes('open={open}'), 'provider dialog explicit open');
check(providerPanel.includes('htmlFor="ext-filing-confirm"'), 'provider confirmation labelled');
check(providerPanel.includes('checked={confirmed}'), 'provider checkbox controlled');
check(!/Submit to Wyoming|Government approved|Company registered|Formation successful/i.test(providerPanel), 'no government outcome copy');
check(providerPanel.includes('role="alert"'), 'provider errors announced');
check(providerApi.includes('external-filing/submit-attestation'), 'provider attest API');
check(providerApi.includes('filing-authorization'), 'provider read API');

check(routes.includes("import.meta.env.DEV"), 'DEV fixture gated');
check(routes.includes('gbs-filing-authorization-fixture'), 'DEV fixture path');
check(fixture.includes('TEST ONLY'), 'fixture marked test-only');
check(layout.includes('<Outlet'), 'customer shell outlet');
check(providerLayout.includes('<Outlet'), 'provider shell outlet');
check(!/FormField/.test(panel + providerPanel + customer + providerPage), 'does not touch protected FormField');
check(!/AdminDataTable|AdminTableFilters/.test(panel + providerPanel), 'does not touch protected admin table WIP');

console.log(`phase17d9aFilingAuthorizationUi.test.js: ${count} assertions passed`);
