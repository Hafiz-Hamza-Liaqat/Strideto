/**
 * Phase 17D-3R — source-contract: provider domains, onboarding, team duties.
 * Run: node src/__tests__/phase17d3rSourceContract.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  PROVIDER_DOMAIN_IDS,
  isKnownProviderDomainId,
  getProviderDomain,
} from '../../../shared/provider/providerDomains.js';
import {
  validateRequiredProviderDomainSelection,
  resolveProviderDomainInitializationState,
  needsRequiredProviderDomainOnboarding,
} from '../../../shared/provider/providerDomainSelection.js';
import { normalizeDomainAccessList } from '../../../shared/provider/providerDomainPermissions.js';
import {
  isBusinessServicesProviderEnabled,
  isBusinessServicesPublicMarketplaceEnabled,
} from '../../../shared/gbs/constants.js';
import { GBS_AUDIT_EVENTS } from '../../../shared/security/gbsAuditEvents.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

check(PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY === 'education_mobility', 'education domain id');
check(PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES === 'business_services', 'business domain id');
check(isKnownProviderDomainId('education_mobility'), 'known education');
check(isKnownProviderDomainId('business_services'), 'known business');
check(!isKnownProviderDomainId('registered_agent'), 'RA is not a provider domain');
check(!isKnownProviderDomainId('acsp'), 'ACSP is not a provider domain');
check(getProviderDomain('unknown') === null, 'unknown domain deny');

const zero = validateRequiredProviderDomainSelection([]);
check(zero.ok === false && zero.error === 'provider_domain_selection_required', 'zero domains rejected');
const unknown = validateRequiredProviderDomainSelection(['not_a_domain']);
check(unknown.ok === false && unknown.error === 'unknown_provider_domain', 'unknown domain rejected');
const both = validateRequiredProviderDomainSelection(['education_mobility', 'business_services', 'education_mobility']);
check(both.ok && both.domainIds.length === 2, 'duplicate domain collapsed; both enrolled');
const bizOff = validateRequiredProviderDomainSelection(['business_services'], { allowBusinessServices: false });
check(bizOff.ok === false, 'business hidden when provider flag off');

check(resolveProviderDomainInitializationState(undefined) === 'legacy', 'missing = legacy');
check(resolveProviderDomainInitializationState('pending') === 'pending', 'pending preserved');
check(needsRequiredProviderDomainOnboarding('pending') === true, 'pending needs onboarding');
check(needsRequiredProviderDomainOnboarding(undefined) === false, 'legacy does not need new onboarding');

check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'public marketplace default OFF');
check(isBusinessServicesProviderEnabled({}) === false, 'provider workspace default OFF');
check(isBusinessServicesProviderEnabled({ BUSINESS_SERVICES_ENABLED: '1' }) === true, 'compat flag enables provider workspace');

const events = [
  'PROVIDER_DOMAIN_SELECTED',
  'PROVIDER_DOMAIN_ADDED',
  'PROVIDER_DOMAIN_ONBOARDING_COMPLETED',
  'PROVIDER_DOMAIN_ACCESS_DENIED',
  'AGENCY_PROVIDER_DOMAIN_ACTIVATED',
  'TEAM_DOMAIN_ACCESS_GRANTED',
  'TEAM_DOMAIN_ACCESS_UPDATED',
  'TEAM_DOMAIN_ACCESS_REMOVED',
  'PROVIDER_WORKSPACE_CONTEXT_DENIED',
];
for (const ev of events) {
  check(Boolean(GBS_AUDIT_EVENTS[ev]), `audit catalog includes ${ev}`);
}

const register = read('server/src/controllers/agentAuthController.js');
check(register.includes('validateRequiredProviderDomainSelection'), 'register validates domains');
check(register.includes('PROVIDER_DOMAIN_INITIALIZATION_STATES.PENDING'), 'new accounts start pending');
check(register.includes('PROVIDER_DOMAIN_INITIALIZATION_STATES.READY'), 'success marks ready');
check(!/undefined → education_mobility|default.*education_mobility/.test(register), 'no silent education default');

const invite = read('server/src/services/agentProfileService.js');
check(invite.includes('provider_domain_selection_required'), 'invite requires domains');
check(invite.includes('listAgencyActivatedDomains'), 'invite limited to agency-activated domains');
check(invite.includes('acceptedDomainIds'), 'invitee must confirm domains');
check(invite.includes('education_service_rejects_gbs_capability'), 'education posting rejects GBS capabilityId');

const listing = read('server/src/services/gbs/serviceListingService.js');
check(listing.includes('gbs_listing_rejects_education_category'), 'GBS listing rejects education categories');

const gbs = read('server/src/controllers/gbsProviderController.js');
check(gbs.includes('assertProviderDomainAccess'), 'GBS ops require domain access');
check(gbs.includes("publicMarketplaceEnabled: false"), 'enabled probe does not advertise public marketplace');

const clientReg = read('client/src/pages/Agent/AgentRegister.jsx');
check(clientReg.includes('What services do you want to provide') || clientReg.includes('ProviderDomainCards'), 'registration domain question');
check(clientReg.includes('disabled={submitting || !canContinue}'), 'continue disabled without selection');
check(!/value="both"|Both</.test(clientReg), 'no contradictory Both radio');

const home = read('client/src/pages/Agent/ProviderHome.jsx');
check(home.includes('Add another provider category'), 'add domain CTA');
check(home.includes('PREF_KEY') || home.includes('strideto-provider-workspace'), 'workspace preference UX only');

const nav = read('client/src/config/agentNavConfig.js');
check(nav.includes('Education & Mobility Services'), 'education services labeled');
check(nav.includes('Service Listings'), 'business listings labeled');
check(nav.includes('hasBusiness ? BUSINESS : []'), 'business operational nav requires authorized workspace');
check(!/Requests|Quotes|Mailroom|Formation Case/.test(nav), 'no fake future modules');

const gbsLayout = read('client/src/pages/Agent/business-services/GbsWorkspaceLayout.jsx');
check(gbsLayout.includes('authorized && subjects.length') || gbsLayout.includes('enabled && subjects.length'), 'GBS chrome requires authorized subjects');
check(gbsLayout.includes('This provider category has not been added'), 'unauthorized URL is setup/add, not empty operational');
check(gbsLayout.includes('{authorized ?'), 'operational subnav/outlet gated on authorization');
check(!/useEffect\([\s\S]{0,400}addProviderDomain/.test(gbsLayout), 'URL visit does not enroll a domain');

const trust = read('client/src/pages/Agent/AgentTrust.jsx');
check(trust.includes('hasBusinessWorkspace'), 'trust gates business verification on authorized domain');
check(trust.includes('+ Add Business Formation & Corporate Services'), 'education-only trust shows add-domain discoverability');
check(/hasBusinessWorkspace \?[\s\S]*Manage Business Verification/.test(trust), 'manage business verification only when authorized');

const guard = read('client/src/components/agent/ProtectedAgentRoute.jsx');
check(guard.includes('needsOnboarding'), 'route guard redirects incomplete onboarding');

const routes = read('client/src/routes/index.jsx');
check(routes.includes("path: 'education'"), 'education overview alias');
check(routes.includes("path: 'business-services'"), 'business routes preserved');
check(!/path: '\/business-services'|path: '\/business'/.test(routes), 'no public marketplace or business client');

const access = normalizeDomainAccessList([
  { domainId: 'business_services', permissions: ['business_services.view'] },
  { domainId: 'not_real', permissions: ['x'] },
]);
check(access.length === 1 && access[0].domainId === 'business_services', 'unknown domain access dropped');

console.log(`phase17d3rSourceContract.test.js: ${count} assertions passed`);
