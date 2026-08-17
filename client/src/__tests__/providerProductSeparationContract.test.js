import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Education & Business provider product separation — source contracts.
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const root = path.resolve(clientSrc, '../..');
function read(rel) {
  return readFileSync(path.join(clientSrc, rel), 'utf8');
}
function readRoot(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

const constants = read('constants/index.js');
const routes = read('routes/index.jsx');
const footer = read('components/layout/Footer.jsx');
const footerEn = read('i18n/locales/en/footer.json');
const sitemap = read('pages/Static/HumanSitemap.jsx');
const bizProfile = read('pages/Agent/business-services/GbsProfile.jsx');
const eduProfile = read('pages/Agent/EducationProfile.jsx');
const gbsSection = read('components/agent/GbsProfessionalProfileSection.jsx');
const gbsApi = read('services/gbsProviderApi.js');
const agentRoutes = readRoot('server/src/routes/agent.js');
const model = readRoot('server/src/models/gbs/GbsProviderProfessionalProfile.js');
const service = readRoot('server/src/services/gbs/gbsProviderProfessionalProfileService.js');
const team = read('pages/Agent/AgentTeam.jsx');
const teamService = readRoot('server/src/services/agentProfileService.js');

check(constants.includes("PROVIDERS_EDUCATION_MOBILITY: '/providers/education-mobility'"), 'education public entry route');
check(constants.includes("PROVIDERS_BUSINESS_FORMATION: '/providers/business-formation'"), 'business public entry route');
check(constants.includes("PROVIDERS: '/providers'"), 'legacy chooser route');
check(routes.includes('EducationProviderEntry') && routes.includes('BusinessProviderEntry'), 'public entry pages registered');
check(routes.includes('LegacyProviderPortalLanding'), 'legacy provider chooser registered');

check(footer.includes('educationProviderPortal') && footer.includes('businessProviderPortal'), 'footer has both provider entries');
check(footer.includes('employerPortal') && footer.includes('institutionPortal'), 'employer and institution footer preserved');
check(!/agentPortal.*AGENT_LOGIN/.test(footer.replace(/\s+/g, ' ')), 'footer no longer primary-links generic Provider Portal login');
check(footerEn.includes('Education & Mobility Providers') && footerEn.includes('Business Formation Providers'), 'footer English labels');
check(sitemap.includes('PROVIDERS_EDUCATION_MOBILITY') && sitemap.includes('PROVIDERS_BUSINESS_FORMATION'), 'sitemap split');
check(!sitemap.includes('ROUTES.AGENT_LOGIN, label: t(\'footer:agentPortal\')'), 'sitemap no generic agentPortal primary entry');

check(!bizProfile.includes('AgentProfile'), 'Business Profile does not mount AgentProfile');
check(bizProfile.includes('GbsProfessionalProfileSection'), 'Business Profile uses dedicated section');
check(eduProfile.includes('AgentProfile') && eduProfile.includes('product="education"'), 'Education keeps AgentProfile ownership');
check(gbsSection.includes('gbsProviderApi.updateProfessionalProfile'), 'Business writes dedicated API');
check(!gbsSection.includes('agentApi.updateProfile'), 'Business does not call Education AgentProfile API');
check(gbsApi.includes('professional-profile'), 'client API path present');
check(agentRoutes.includes('/agent/business-services/professional-profile'), 'server route present');
check(model.includes('autoIndex: false'), 'Business profile model autoIndex false');
check(service.includes("domainId: 'business_services'"), 'Business profile audit scoped');
check(service.includes('education_fields_rejected'), 'Education fields rejected on Business write');
check(!service.includes('AgentProfile'), 'Business profile service does not touch AgentProfile');

check(team.includes('Remove Education access') && team.includes('Remove Business access'), 'team domain removal actions');
check(team.includes('updateMemberDomainAccess'), 'team uses domainAccess patch not membership delete');
check(teamService.includes('Empty domainAccess is allowed'), 'server allows empty domainAccess after domain removal');

console.log(`providerProductSeparationContract.test.js: ${count} assertions passed`);
