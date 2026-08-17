import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  authorizedDomainIdsForSubject,
  kindLabel,
  uniqueProviderSubjects,
  withProviderSubject,
  PROVIDER_WORKSPACE_PREF_KEY,
} from '../config/providerWorkspacePref.js';

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
const controls = read('components/agent/ProviderWorkspaceControls.jsx');
const home = read('pages/Agent/ProviderHome.jsx');
const settings = read('pages/Agent/AgentSettings.jsx');
const eduSettings = read('pages/Agent/EducationSettings.jsx');
const gbsSettings = read('pages/Agent/business-services/GbsSettings.jsx');
const gbsLayout = read('pages/Agent/business-services/GbsWorkspaceLayout.jsx');
const verify = read('pages/Agent/AgentVerification.jsx');
const verifyDraft = read('auth/verificationDraft.js');
const tabIdentity = read('auth/tabIdentity.js');
const refreshFlight = read('auth/refreshFlight.js');
const profile = read('pages/Agent/AgentProfile.jsx');
const adminSidebar = read('components/admin/AdminSidebar.jsx');
const routes = read('routes/index.jsx');
const constants = read('constants/index.js');
const eduDash = read('pages/Agent/AgentDashboard.jsx');

const independentEduBiz = [
  { subjectType: 'agent', subjectId: 'ameer', kind: 'independent', label: 'Ameer QA Provider', domainId: 'education_mobility' },
  { subjectType: 'agent', subjectId: 'ameer', kind: 'independent', label: 'Ameer QA Provider', domainId: 'business_services' },
];
const agencyBiz = [
  { subjectType: 'organization', subjectId: 'frontier', kind: 'agency', label: 'Frontier Professional Services QA', domainId: 'business_services' },
];

check(uniqueProviderSubjects([...independentEduBiz, ...agencyBiz]).length === 2, 'subjects stay Independent vs Agency, not four identities');
check(kindLabel('independent') === 'Independent' && kindLabel('agency') === 'Agency', 'kind labels are user-facing');
check(
  authorizedDomainIdsForSubject(agencyBiz, { subjectType: 'organization', subjectId: 'frontier' }).join() === 'business_services',
  'Agency Business-only subject does not inherit Independent Education'
);
check(
  !authorizedDomainIdsForSubject(agencyBiz, { subjectType: 'organization', subjectId: 'frontier' }).includes('education_mobility'),
  'stale Education preference cannot grant Agency Education'
);
check(
  withProviderSubject('/agent/education', { subjectType: 'agent', subjectId: 'ameer' }).includes('subjectType=agent'),
  'subject query is appended for navigation context only'
);

check(nav.includes("id: 'education-work'") && nav.includes("label: 'Work'"), 'education Work group');
check(nav.includes("id: 'education-services'") && nav.includes("label: 'Services'"), 'education Services group');
check(nav.includes("id: 'education-trust'"), 'education Trust group');
check(nav.includes("id: 'education-team'") && nav.includes("'Team & Communication'"), 'education team group');
check(nav.includes("id: 'education-support'"), 'education support group');
check(nav.includes("id: 'business-work'") && nav.includes("label: 'Requests'"), 'business Work group');
check(nav.includes("id: 'business-setup'") && nav.includes("'Service Setup'"), 'business Service Setup group');
check(nav.includes("id: 'business-trust'") && nav.includes("'Trust & Eligibility'"), 'business Trust group');
check(!nav.includes("'Account & Support'"), 'shared Account & Support group removed');
check(!nav.includes("label: 'Trust Center'"), 'global Trust Center is not primary nav');
check(!nav.includes("label: 'Provider Dashboard'") || nav.includes('hideBacklink'), 'Provider Dashboard is backlink not a leaf');

check(nav.includes("label: 'My Education Services'") && nav.includes("label: 'Marketplace'") && nav.includes("label: 'Availability'"), 'education services links');
check(nav.includes("label: 'Education Profile'") && nav.includes("label: 'Education Team'"), 'education profile and team');
check(nav.includes("label: 'My Services'") && nav.includes("label: 'Business Verification'"), 'business compact labels');
check(nav.includes("label: 'Business Profile'") && nav.includes("label: 'Business Team'"), 'business profile and team');
check(nav.includes('AGENT_BUSINESS_SERVICES_VERIFICATION'), 'Business Verification has dedicated path');
check(nav.includes('AGENT_EDUCATION_VERIFICATION'), 'Education verification is namespaced');
check(!/AGENT_BUSINESS_SERVICES_CAPABILITIES,\s*label: 'Business Verification'/.test(nav), 'Business Verification is not aliased to Capabilities');
check(nav.includes("label: 'Reviews'") && nav.includes('AGENT_EDUCATION_REVIEWS'), 'Education Reviews has dedicated route');
check(nav.includes("label: 'Professional Verification'"), 'education professional verification label');
check(nav.includes("label: 'Student Leads'") && nav.includes("label: 'Consultations'"), 'education work links remain');
check(nav.includes("label: 'Quotes'") && nav.includes("label: 'Capabilities'") && nav.includes("label: 'Jurisdictions'"), 'business setup/work links remain');
check(nav.includes('hasBusiness ? BUSINESS : []'), 'business operational nav still requires authorized workspace');
check(nav.includes('scopedWorkspaces'), 'nav remains subject-scoped');
check(nav.includes('isProviderHome'), 'Provider Dashboard suppresses operational domain nav');
check(nav.includes('AGENT_EDUCATION_CASES') && nav.includes('AGENT_BUSINESS_SERVICES_CASES'), 'education and business Cases stay on distinct routes');

const eduSlice = nav.split('const EDUCATION')[1].split('const BUSINESS')[0];
const bizSlice = nav.split('const BUSINESS')[1].split('const EDUCATION_GROUPS')[0];
check(!eduSlice.includes('business-services'), 'education nav has no business routes');
check(!bizSlice.includes('AGENT_EDUCATION_LEADS') && !bizSlice.includes('AGENT_CONSULTATIONS'), 'business nav has no education work routes');
check(!eduSlice.includes('Capabilities') && !eduSlice.includes('Jurisdictions'), 'education nav has no GBS setup');
check(eduSlice.includes('My Education Services'), 'education services label');
check(bizSlice.includes('Business Verification') && bizSlice.includes('VERIFICATION'), 'business verification dedicated');

check(nav.includes('if (isProviderHome)'), 'Provider Dashboard suppresses operational domain nav');
check(nav.includes('domainGroups: []'), 'home menu is empty');
check(nav.includes('settingsItem: null'), 'home has no domain Settings');
check(nav.includes("startsWith('/agent/education')"), 'education namespace resolves education');
check(nav.includes("startsWith('/agent/business-services')"), 'business namespace resolves business');
check(nav.includes('AGENT_EDUCATION_SETTINGS') && nav.includes('AGENT_BUSINESS_SERVICES_SETTINGS'), 'domain settings footer paths exist');

check(layout.includes("resolveProviderNavDomain(location.pathname)"), 'layout derives dashboard from route');
check(layout.includes('ActingAsControl') && controls.includes('Acting as'), 'Acting as control');
check(!layout.includes('ActiveDashboardControl') && !controls.includes('Active dashboard'), 'Active dashboard switcher removed');
check(controls.includes('aria-label="Acting as"') || controls.includes('Acting as'), 'acting as is labelled');
check(!controls.includes('addProviderDomain') && !layout.includes('addProviderDomain'), 'workspace/subject display switch does not enroll');
check(layout.includes('AgentNavSection') && controls.includes('uppercase tracking-wide'), 'section labels reuse Admin typography tokens');
check(!/onClick=\{onToggle\}/.test(controls), 'agent section labels are not interactive fake buttons');
check(controls.includes('role="group" aria-labelledby'), 'semantic nav grouping');
check(controls.includes('break-words'), 'long agency names wrap');
check(layout.includes('w-72 max-w-[85vw]'), 'mobile drawer preserved');
check(layout.includes('subjectType: params.get(\'subjectType\')'), 'sidebar scopes operational chrome to the URL subject');
check(layout.includes('resolveActiveNavPath'), 'global one-leaf active path resolver');
check(!layout.includes('Agent Portal'), 'duplicate Agent Portal subtitle removed');
check(layout.includes('SidebarFooter') && layout.includes('settingsItem'), 'Settings live in sidebar footer');
check(layout.includes('Log out'), 'Logout remains');
check(controls.includes('← Provider Dashboard') && controls.includes('hideBacklink'), 'workspace backlink hidden on gateway');

check(home.includes('Provider Dashboard') && home.includes('Your professional workspaces'), 'Provider Dashboard copy');
check(home.includes('Acting as'), 'dashboard shows acting-as');
check(home.includes('Add another provider category'), 'add category preserved');
check(home.includes('writeProviderWorkspacePref') && home.includes('strideto-provider-workspace'), 'workspace preference UX only');
check(home.includes('subjectType: group.subjectType'), 'Add Domain still sends exact group subject');
check(!/addDomain\(domain\.domainId, independent\)/.test(home), 'Add Domain does not default to Independent');
check(!home.includes('navigate(cards[0]'), 'one-domain no longer silently skips Provider Dashboard');
check(home.includes('AGENT_EDUCATION_VERIFICATION'), 'add Education goes to namespaced verification');

check(eduDash.includes('← Provider Dashboard') && eduDash.includes('Education & Mobility'), 'education overview back link');
check(eduDash.includes('ROUTES.AGENT_EDUCATION_LEADS') && eduDash.includes('ROUTES.AGENT_EDUCATION_CASES'), 'education overview uses namespaced education routes');
check(!eduDash.includes('AGENT_BUSINESS_SERVICES_REQUESTS'), 'education overview has no GBS requests');
check(eduDash.includes('cards.hasAvailability'), 'availability checklist is data-driven');

check(settings.includes('ChangePasswordForm') && settings.includes('logoutAll'), 'password and logout-all preserved');
check(settings.includes('ConnectedAccountsPanel'), 'connected accounts remain');
check(!settings.includes('Availability') && !settings.includes('AGENT_SERVICES') && !settings.includes('Capabilities'), 'settings has no operational shortcuts');
check(!settings.includes('Usage & Billing') && !settings.includes('Referral'), 'settings has no billing or referral');
check(eduSettings.includes('Education & Mobility — Account Settings'), 'education settings heading');
check(gbsSettings.includes('Business Services — Account Settings'), 'business settings heading');
check(gbsLayout.includes("label: 'Requests'") || gbsLayout.includes('Business Formation'), 'GBS workspace header preserved');
check(!gbsLayout.includes('SUBNAV'), 'redundant Business top-tab SUBNAV removed');
check(gbsLayout.includes('setParams') && gbsLayout.includes('selectSubject'), 'GBS subject switch stays canonical context');
check(gbsLayout.includes('{authorized ?'), 'unauthorized business URL remains setup, not operational');

check(constants.includes("AGENT_EDUCATION_CASES: '/agent/education/cases'"), 'education cases namespaced');
check(constants.includes("AGENT_CASES: '/agent/cases'"), 'legacy education cases constant preserved for redirects');
check(constants.includes("AGENT_BUSINESS_SERVICES_CASES: '/agent/business-services/cases'"), 'business cases route preserved');
check(constants.includes("AGENT_BUSINESS_SERVICES_VERIFICATION: '/agent/business-services/verification'"), 'business verification route');
check(constants.includes("AGENT_EDUCATION_REVIEWS: '/agent/education/reviews'"), 'reviews namespaced');
check(constants.includes("AGENT_DASHBOARD: '/agent'"), '/agent gateway preserved');
check(routes.includes("path: 'business-services'") && routes.includes("path: 'education'"), 'education and business routes remain');
check(routes.includes("path: 'education/reviews'") && routes.includes('AgentReviews'), 'reviews route registered under education');
check(routes.includes("path: 'verification'") && routes.includes('GbsVerification'), 'business verification route registered');
check(routes.includes('ProviderHome'), 'Provider Dashboard route remains');
check(routes.includes('LegacyAgentRedirect') && routes.includes('LegacySharedAgentRedirect'), 'legacy redirects registered');
check(routes.includes("path: 'education/profile'") && routes.includes("path: 'profile'"), 'education profile plus legacy profile redirect');

check(verify.includes('verificationDraftKey'), 'verification draft wiring untouched');
check(verify.includes("id=\"professional-credentials\"") || verify.includes("id='professional-credentials'"), 'professional-credentials hash target exists');
check(verify.includes('scrollIntoView'), 'hash scroll implemented');
check(verifyDraft.includes('strideto-verification-draft:'), 'draft key prefix unchanged');
check(tabIdentity.includes('strideto-tab-identity:'), 'tab identity key unchanged');
check(PROVIDER_WORKSPACE_PREF_KEY === 'strideto-provider-workspace', 'workspace pref is not the tab-identity key');
check(!PROVIDER_WORKSPACE_PREF_KEY.includes('tab-identity'), 'workspace pref does not collide with session guard');
check(refreshFlight.includes('createRefreshFlight'), 'single-flight refresh remains');
check(profile.includes('Save profile') && profile.includes('role="alert"'), 'profile save UX remains');
check(!profile.includes('AGENT_SERVICE_CATEGORIES'), 'shared Profile does not own Education specialty taxonomy');
check(!profile.includes('Destination / country expertise'), 'shared Profile has no Education destination expertise');
check(!/accessToken|refreshToken|JWT/.test(controls + nav + layout), 'switchers store no tokens');
check(adminSidebar.includes('uppercase tracking-wide'), 'Admin divider pattern still exists for reference');

console.log(`agentDashboardUxSimplification.test.js: ${count} assertions passed`);
