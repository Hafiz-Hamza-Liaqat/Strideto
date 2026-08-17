import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  filterNotificationsForWorkspace,
  notificationWorkspace,
  rewriteNotificationLinkForWorkspace,
} from '../config/providerNotificationFilter.js';

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

const nav = read('config/agentNavConfig.js');
const layout = read('pages/Agent/AgentLayout.jsx');
const routes = read('routes/index.jsx');
const settings = read('pages/Agent/AgentSettings.jsx');
const eduHelp = read('pages/Agent/EducationHelp.jsx');
const bizHelp = read('pages/Agent/business-services/GbsHelp.jsx');
const eduProfile = read('pages/Agent/EducationProfile.jsx');
const bizProfile = read('pages/Agent/business-services/GbsProfile.jsx');
const eduTeam = read('pages/Agent/EducationTeam.jsx');
const bizTeam = read('pages/Agent/business-services/GbsTeam.jsx');
const bizMessages = read('pages/Agent/business-services/GbsMessages.jsx');
const eduMessages = read('pages/Agent/EducationMessages.jsx');
const redirect = read('components/agent/LegacyAgentRedirect.jsx');
const controls = read('components/agent/ProviderWorkspaceControls.jsx');

check(layout.includes('isProviderHome={isProviderHome}'), 'gateway hides professional backlink via home flag');
check(layout.includes('hideBacklink={isProviderHome}'), 'home has no Provider Dashboard backlink');
check(!layout.includes('ActiveDashboardControl'), 'no Active Dashboard switcher');
check(layout.includes('SidebarFooter'), 'Settings/Logout footer exists');
check(/settingsItem[\s\S]*Log out/.test(layout), 'Settings rendered above Logout');

check(routes.includes("path: 'education/profile'"), 'education profile route');
check(routes.includes("path: 'business-services'") && routes.includes("path: 'profile'"), 'business profile nested');
check(routes.includes("path: 'education/team'") && routes.includes('EducationTeam'), 'education team route');
check(routes.includes("path: 'education/messages'") && routes.includes("path: 'education/notifications'"), 'education comms routes');
check(routes.includes("path: 'education/help'") && routes.includes("path: 'education/settings'"), 'education help/settings');
check(routes.includes('GbsTeam') && routes.includes('GbsMessages') && routes.includes('GbsNotifications'), 'business team/messages/notifications');
check(routes.includes('GbsHelp') && routes.includes('GbsSettings') && routes.includes('GbsProfile'), 'business profile/help/settings');

check(redirect.includes('location.hash') && redirect.includes('location.search'), 'legacy redirects preserve query and hash');
check(redirect.includes('LegacySharedAgentRedirect'), 'ambiguous shared routes do not default to Education');
check(redirect.includes("home.set('home', '1')"), 'ambiguous legacy routes go to Provider Dashboard');
check(routes.includes("path: 'verification'") && routes.includes('AGENT_EDUCATION_VERIFICATION'), 'legacy verification redirects to education');

check(eduProfile.includes('Education &amp; Mobility Profile') || eduProfile.includes('Education & Mobility Profile'), 'education profile heading');
check(eduProfile.includes('EducationProfessionalProfileSection'), 'education professional fields on education profile');
check(bizProfile.includes('Business Services Profile'), 'business profile heading');
check(bizProfile.includes('GbsVerification') && bizProfile.includes('AgentProfile'), 'business profile reuses identity + GBS summary');
check(!bizProfile.includes('AGENT_SERVICE_CATEGORIES'), 'business profile has no Education taxonomy');

check(eduTeam.includes('EDUCATION_MOBILITY'), 'education team focuses education domain');
check(bizTeam.includes('BUSINESS_SERVICES'), 'business team focuses business domain');
check(eduMessages.includes('AgentMessages'), 'education messages reuse Education threads');
check(bizMessages.includes('not configured for this workflow yet'), 'business messages are truthful NOT_CONFIGURED');
check(!bizMessages.includes('getMessages'), 'business messages do not load Education threads');

check(!eduHelp.includes('Registered Agent'), 'education help has no Registered Agent SOP');
check(!/Quote acceptance|GbsCase/.test(eduHelp), 'education help has no Business quote/case SOP');
check(!bizHelp.includes('Student Leads') && !bizHelp.includes('Education Availability'), 'business help has no Education lead/availability SOP');
check(!bizHelp.includes('ProfessionalCase'), 'business help has no ProfessionalCase SOP');
check(eduHelp.includes('DOMAIN-SPECIFIC TERMS — FUTURE PRODUCT/LEGAL WORK'), 'education terms not invented');
check(bizHelp.includes('public Business marketplace is off'), 'business help does not claim live marketplace');
check(bizHelp.includes('does not file with a government'), 'business help stays truthful on filing');

check(!settings.includes('Availability') && !settings.includes('Marketplace') && !settings.includes('Capabilities'), 'settings has no operational shortcuts');
check(!settings.includes('AGENT_USAGE_BILLING') && !settings.includes('Referral'), 'settings has no billing/referral');
check(settings.includes('ChangePasswordForm') && settings.includes('Log out all other sessions'), 'settings is account/security only');

check(!nav.includes("label: 'Trust Center'"), 'Trust Center absent from primary nav');
check(!controls.includes('Active dashboard'), 'Active dashboard control deleted');
check(!nav.includes('addProviderDomain'), 'nav switch does not enroll');

check(notificationWorkspace({ link: '/agent/education/consultations/1' }) === 'education', 'education consultation classified');
check(notificationWorkspace({ link: '/agent/business-services/quotes/Q1' }) === 'business', 'business quote classified');
check(notificationWorkspace({ link: '/agent/cases/1' }) === 'education', 'legacy professional case classified education');
check(notificationWorkspace({ category: 'system' }) === 'shared', 'system events are shared');
check(filterNotificationsForWorkspace([
  { link: '/agent/consultations/1' },
  { link: '/agent/business-services/requests/R1' },
], 'education').length === 1, 'education filter drops business requests');
check(filterNotificationsForWorkspace([
  { link: '/agent/consultations/1' },
  { link: '/agent/business-services/requests/R1' },
], 'business').length === 1, 'business filter drops education consultations');
check(
  rewriteNotificationLinkForWorkspace('/agent/verification#professional-credentials', 'education')
    === '/agent/education/verification#professional-credentials',
  'education verification hash rewrite'
);

console.log(`providerWorkspaceFullSeparation.test.js: ${count} assertions passed`);
