import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Phase 17D-3 provider workspace UI contract (no jsdom).
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(clientSrc, rel), 'utf8');
}

const files = {
  layout: read('pages/Agent/business-services/GbsWorkspaceLayout.jsx'),
  overview: read('pages/Agent/business-services/GbsOverview.jsx'),
  caps: read('pages/Agent/business-services/GbsCapabilities.jsx'),
  juris: read('pages/Agent/business-services/GbsJurisdictions.jsx'),
  listings: read('pages/Agent/business-services/GbsListings.jsx'),
  editor: read('pages/Agent/business-services/GbsListingEditor.jsx'),
  ctx: read('pages/Agent/business-services/GbsProviderContext.jsx'),
  ui: read('pages/Agent/business-services/gbsUi.jsx'),
  agentLayout: read('pages/Agent/AgentLayout.jsx'),
  nav: read('config/agentNavConfig.js'),
  routes: read('routes/index.jsx'),
};

check(files.agentLayout.includes('PortalBrand role="agent"'), 'Agent chrome remains');
check(!files.layout.includes('StudentPortalNav') && !files.overview.includes('StudentPortalNav'), 'no Student nav in GBS');
check(files.nav.includes("label: 'Education & Mobility Services'") && files.nav.includes("label: 'Service Listings'") && files.nav.includes("Identity & Organization / Trust Center"), 'Education services, Business listings, and Trust remain distinct');
check(files.ctx.includes("strideto-gbs-provider-subject"), 'subject preference is UX-only localStorage');
check(files.ctx.includes('getContext') && files.layout.includes('subjects.length <= 1'), 'switcher hidden for a single subject');
check(files.overview.includes('aria-busy') && files.caps.includes('aria-busy') && files.listings.includes('aria-busy'), 'loading states');
check(files.overview.includes('role="alert"') && files.caps.includes('role="alert"') && files.editor.includes('role="alert"'), 'error states');
check(files.overview.includes('emptyBox') || files.listings.includes('No service listings'), 'empty states');
check(files.ui.includes("from '../../../design-system/surfaceClasses'"), 'semantic surface classes reused');
check(!/bg-white text-black/.test(files.overview + files.caps + files.editor), 'no scattered bg-white text-black');
check(files.caps.includes('DateInput') && files.caps.includes('SearchableSelect'), 'canonical date + select');
check(!files.caps.includes('FormField') && !files.editor.includes('FormField'), 'does not edit or require FormField WIP');
check(files.caps.includes('additional verification support'), 'protected-title file gap is truthful');
check(files.caps.includes('Registered Agent capability') && !files.caps.includes('Licensed Registered Agent'), 'Delaware-safe RA language');
check(files.juris.includes('structural') && files.juris.includes('not current'), 'structural vs current distinguished');
check(files.listings.includes('lg:hidden') && files.listings.includes('<table'), 'mobile cards + desktop table');
check(!files.listings.includes('overflow-x-auto'), 'listings do not rely on overflow-x auto');
check(files.editor.includes('read-only') && files.editor.includes('Not catalogued'), 'government fees read-only / not_catalogued');
check(files.editor.includes('Provider-defined estimate') && !files.editor.includes('Government approval in 1 day'), 'turnaround is provider estimate');
check(files.editor.includes('not an IRS fee'), 'EIN provider fee stays separate');
check(files.editor.includes('Submit for review') && !files.editor.includes('Publish'), 'no provider self-publish control');
check(files.ui.includes('break-words'), 'long content wraps');
check(files.layout.includes('min-w-0') && (files.listings.includes('break-words') || files.listings.includes('${wrap}')), 'subject/title overflow guarded');
check(files.routes.includes("path: 'business-services'") && files.routes.includes('ProtectedAgentRoute'), 'GBS nested in Agent portal');
check(files.caps.includes('aria-label') && files.layout.includes('aria-label="Business Services provider subject"'), 'accessible names');

console.log(`phase17d3ProviderWorkspaceUi.test.js: ${count} assertions passed`);
