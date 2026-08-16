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
const panel = read('components/gbs/CaseRequirementPackPanel.jsx');
const providerPage = read('pages/Agent/business-services/GbsCaseDetail.jsx');
const providerPanel = read('components/gbs/ProviderRequirementPackPanel.jsx');
const buyerApi = read('services/gbsBuyerApi.js');
const providerApi = read('services/gbsProviderApi.js');
const layout = read('pages/BusinessClient/BusinessClientLayout.jsx');
const providerLayout = read('pages/Agent/business-services/GbsWorkspaceLayout.jsx');

check(customer.includes('CaseRequirementPackPanel'), 'customer wires pack panel');
check(customer.includes('item.requirementPack?.attached'), 'customer UI only when snapshot attached');
check(panel.includes('Formation requirements') && panel.includes('Company information') && panel.includes('Registered agent information'), 'customer sections');
check(panel.includes('Required') && panel.includes('Optional'), 'required markers textual');
check(panel.includes('htmlFor') && panel.includes('<label'), 'labels associated');
check(panel.includes('role="alert"'), 'errors announced');
check(panel.includes('<h3') && panel.includes('<h4'), 'semantic headings');
check(!/type="file"|signature|Submit to Wyoming|Guaranteed Wyoming LLC/i.test(panel), 'no upload/signature/government submit');
check(panel.includes('min-w-0'), 'narrow overflow containment');
check(buyerApi.includes('requirement-facts'), 'customer fact API');

check(providerPage.includes('ProviderRequirementPackPanel'), 'provider wires pack panel');
check(providerPage.includes('item.requirementPack?.attached'), 'provider UI only when snapshot attached');
check(providerPanel.includes('Provider checks') && providerPanel.includes('Registered agent written consent'), 'provider checks and RA');
check(providerPanel.includes('open={raOpen}') && providerPanel.includes('open={Boolean(checkOpen)}'), 'deliberate attestations');
check(providerPanel.includes('htmlFor="gbs-filing-method"'), 'filing method labelled');
check(!/Submit to Wyoming|Mark filed|Authority reference|Company registered/i.test(providerPanel), 'no government submission action');
check(providerApi.includes('ra-consent/attest') && providerApi.includes('requirement-checks'), 'provider pack APIs');

check(layout.includes('<Outlet'), 'customer shell outlet');
check(providerLayout.includes('<Outlet'), 'provider shell outlet');
check(!/FormField/.test(panel + providerPanel), 'does not touch protected FormField');

console.log(`phase17d8b2bRequirementUi.test.js: ${count} assertions passed`);
