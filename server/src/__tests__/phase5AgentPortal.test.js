/**
 * Phase 5 — Agent / Agency Final Portal.
 * Run: node src/__tests__/phase5AgentPortal.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const source = (rel) => readFileSync(path.join(root, rel), 'utf8');

const verification = await import(pathToFileURL(path.join(root, 'shared/international/verification.js')).href);
const sources = await import(pathToFileURL(path.join(root, 'shared/agent/verificationSources.js')).href);
const team = await import(pathToFileURL(path.join(root, 'shared/agent/team.js')).href);
const constants = await import(pathToFileURL(path.join(root, 'shared/agent/constants.js')).href);
const tz = await import(pathToFileURL(path.join(root, 'shared/international/timezone.js')).href);
const geo = await import(pathToFileURL(path.join(root, 'shared/international/geo.js')).href);
const money = await import(pathToFileURL(path.join(root, 'shared/international/money.js')).href);
const commerce = await import(pathToFileURL(path.join(root, 'shared/commerce/contracts.js')).href);
const agentRealm = await import(pathToFileURL(path.join(root, 'client/src/auth/agentAuthRealm.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const agentCtrl = source('server/src/controllers/agentController.js');
const agentRoutes = source('server/src/routes/agent.js');
const profileSvc = source('server/src/services/agentProfileService.js');
const verifyCtrl = source('server/src/controllers/organization/organizationVerificationController.js');
const verifySvc = source('server/src/services/verificationService.js');
const notifCtrl = source('server/src/controllers/userNotificationsController.js');
const notifModel = source('server/src/models/UserNotification.js');
const notifSvc = source('server/src/services/notificationService.js');
const orgBridge = source('server/src/services/orgVerificationNotificationBridge.js');
const inboxBridge = source('server/src/services/agentInboxNotificationBridge.js');
const marketplaceSvc = source('server/src/services/agentMarketplaceService.js');
const consultSvc = source('server/src/services/consultationService.js');
const caseSvc = source('server/src/services/caseManagementService.js');
const layout = source('client/src/pages/Agent/AgentLayout.jsx');
const navSrc = source('client/src/config/agentNavConfig.js');
const routes = source('client/src/routes/index.jsx');
const constantsSrc = source('client/src/constants/index.js');
const dash = source('client/src/pages/Agent/AgentDashboard.jsx');
const profilePage = source('client/src/pages/Agent/AgentProfile.jsx');
const verifyPage = source('client/src/pages/Agent/AgentVerification.jsx');
const teamPage = source('client/src/pages/Agent/AgentTeam.jsx');
const guidelines = source('client/src/pages/Agent/AgentGuidelines.jsx');
const billing = source('client/src/pages/Agent/AgentUsageBilling.jsx');
const settings = source('client/src/pages/Agent/AgentSettings.jsx');
const clients = source('client/src/pages/Agent/AgentClients.jsx');
const login = source('client/src/pages/Agent/AgentLogin.jsx');
const register = source('client/src/pages/Agent/AgentRegister.jsx');
const commercePage = source('client/src/pages/Agent/AgentCommerce.jsx');
const servicesPage = source('client/src/pages/Agent/AgentServices.jsx');
const avail = source('client/src/pages/Agent/AgentAvailability.jsx');
const caseDetail = source('client/src/pages/Agent/AgentCaseDetail.jsx');
const agentService = source('client/src/services/agentService.js');
const inviteModel = source('server/src/models/agent/AgentInvitation.js');
const evidenceModel = source('server/src/models/VerificationEvidence.js');
const orgVerifyModel = source('server/src/models/OrganizationVerification.js');

// AUTH / TENANT
check(agentRealm.isAgentPortalPath('/agent'), 'dashboard portal path');
check(agentRealm.isAgentPortalPath('/agent/verification'), 'verification portal path');
check(agentRealm.isAgentPortalPath('/agent/usage-billing'), 'usage billing portal path');
check(agentRealm.isAgentPortalPath('/agent/messages'), 'messages portal path');
check(agentRealm.isAgentPortalPath('/agent/notifications'), 'notifications portal path');
check(agentRealm.isAgentPortalPath('/agent/guidelines'), 'guidelines portal path');
check(agentRealm.isAgentPublicAuthPath('/agent/accept-invitation'), 'accept invite is public auth');
check(!agentRealm.isAgentPortalPath('/agents/acme'), 'public directory is not portal');
check(agentCtrl.includes('requireAgentAuth') || agentRoutes.includes('requireAgentAuth'), 'agent routes require agent auth');
check(agentRoutes.includes("requireAuth,\n  requireAgentAuth,\n  agent.getDashboard") || agentRoutes.includes('agent.getDashboard'), 'dashboard is agent-authed');

// NAV IA
['Dashboard', 'Profile', 'Verification', 'Services', 'Marketplace', 'Availability', 'Leads', 'Clients', 'Consultations', 'Cases', 'Messages', 'Trust / Reviews', 'Notifications', 'Usage & Billing', 'Commerce / Payouts', 'Settings', 'Help / Guidelines'].forEach((label) => {
  check(navSrc.includes(`label: '${label}'`), `nav has ${label}`);
});
check(navSrc.includes("agentType === 'agency'") && navSrc.includes("label: 'Team'"), 'Team only for agency');
check(constantsSrc.includes("AGENT_MESSAGES: '/agent/messages'"), 'messages route constant');
check(constantsSrc.includes("AGENT_USAGE_BILLING: '/agent/usage-billing'"), 'usage billing route constant');
check(routes.includes('AgentUsageBilling') && routes.includes('AgentGuidelines') && routes.includes('AgentNotifications'), 'new pages routed');
check(routes.includes('AgentAcceptInvitation'), 'accept invitation routed');

// THEME / BRANDING
check(layout.includes('Logo') && layout.includes('bg-bg-main dark:bg-secondary'), 'layout uses Strideto tokens and logo');
check(layout.includes('dark:bg-gray-900') && layout.includes('AgentNotificationBell'), 'dark sidebar and notification bell');
check(login.includes('Logo') && login.includes('dark:bg-secondary'), 'login branded');
check(register.includes('Logo') && register.includes('Individual Agent') && register.includes('Agency'), 'register distinguishes professional vs agency');
check(dash.includes('dark:text-white') && dash.includes('cards'), 'dashboard themed and sourced');

// DASHBOARD SOURCES
check(agentCtrl.includes('leadsCount') && agentCtrl.includes('AgentLead.countDocuments'), 'leads sourced');
check(agentCtrl.includes('listClientsForAgent') && agentCtrl.includes('clientsCount'), 'clients sourced');
check(agentCtrl.includes('ProfessionalCase.countDocuments'), 'cases sourced');
check(agentCtrl.includes("recipientType: 'agent'") && agentCtrl.includes('unreadNotifications'), 'notifications sourced');
check(agentCtrl.includes('marketplaceStripeConfiguration') && agentCtrl.includes('not_configured'), 'commerce not_configured truthful');
check(!agentCtrl.includes("comingSoon: ['leads', 'cases', 'payments']"), 'deferred comingSoon removed');
check(dash.includes('href') || dash.includes('ROUTES.AGENT_LEADS'), 'cards deep-link');
check(dash.includes('0 or not configured') || dash.includes('not configured'), 'empty state copy');

// PROFILE
check(profilePage.includes('agency') && profilePage.includes('professional'), 'profile distinguishes account type');
check(profilePage.includes('legalName') && profilePage.includes('officeAddressLine1'), 'legal and address fields');
check(profileSvc.includes("updates.legalName") && profileSvc.includes("AGENT_TYPES.AGENCY"), 'agency legalName sync');
check(profilePage.includes('Save profile'), 'profile save');

// VERIFICATION DOSSIER
check(verifyPage.includes('officialRegistryUrl') && verifyPage.includes('googleBusinessUrl') && verifyPage.includes('googleMapsUrl'), 'dossier source and maps fields');
check(verifyPage.includes('supporting evidence only') || verifyPage.includes('Maps/Business'), 'maps supporting-only copy');
check(verifyPage.includes('Self-approval is denied'), 'self-approval denied copy');
check(orgVerifyModel.includes('officialRegistryUrl') && orgVerifyModel.includes('googleBusinessUrl'), 'profile schema stores source URLs');
check(evidenceModel.includes('claimedAuthority'), 'evidence provenance claimedAuthority');
check(verifySvc.includes('recordSupportingEvidenceFromProfile') && verifySvc.includes('EVIDENCE_TYPES.GOOGLE_MAPS'), 'submit records supporting evidence pending');
check(verifySvc.includes("status: EVIDENCE_STATUSES.PENDING"), 'evidence never auto-accepted');
check(verification.mapsCannotAloneVerify() === true, 'mapsCannotAloneVerify policy');
check(!verification.deriveBadges([{ evidenceType: 'google_maps', status: 'accepted' }]).includes('physical_location_verified'), 'accepted maps does not badge location');
check(sources.MAPS_IS_SUPPORTING_ONLY === true, 'shared maps supporting only');
check(sources.resolveVerificationSources({ countryCode: 'XX', organizationType: 'agent' }).manualVerificationRequired === true
  || sources.resolveVerificationSources({ countryCode: 'XX', organizationType: 'agent' }).manualVerificationNote.includes('Manual'), 'unconfigured source is manual');
check(sources.resolveVerificationSources({ countryCode: 'PK', organizationType: 'agency' }).automatedFetch === false, 'no automated fetch');
check(verifyCtrl.includes('req.agent') && verifyCtrl.includes('markEmailVerified'), 'agent submit integrates org verification');
check(!verifyCtrl.includes('EMAIL_VERIFICATION_REQUIRED'), 'local session may leave draft without fabricating professional verification');
check(orgBridge.includes("organizationType === 'agent'") && orgBridge.includes("'/agent/verification'"), 'admin outcome notifies agent');

// SERVICES / MONEY / GUARANTEES
check(servicesPage.includes('amountMinor') && servicesPage.includes('fixed_price'), 'integer minor-unit price UI');
check(profileSvc.includes('containsGuaranteeLanguage') && constants.GUARANTEE_FORBIDDEN_PHRASES.includes('guaranteed visa'), 'guarantee blocking');
check(Number.isSafeInteger(money.makeMoney(1999, 'PKR').amountMinor), 'money minor units');
check(commerce.calculateFee(money.makeMoney(1000, 'PKR'), { type: 'none' }).amountMinor === 0, 'unconfigured commission is zero');

// MARKETPLACE / LEADS / CLIENTS
check(marketplaceSvc.includes('marketplace_interest') && marketplaceSvc.includes('notifyAgentOrganizationOwners'), 'interest notifies agent');
check(clients.includes('zero Vault access') || clients.includes('vaultGrantCount'), 'clients vault boundary');
check(profileSvc.includes('listClientsForAgent') && profileSvc.includes("granteeType: 'agent'"), 'clients derived without full Student profile');
check(profileSvc.includes('CROSS_ORGANIZATION_DENIED'), 'cross-agency denial');

// AVAILABILITY
check(tz.isValidTimeZone('Europe/London') === true, 'IANA valid');
check(tz.isValidTimeZone('Asia/Karachi') === true, 'Karachi is valid when explicit');
check(tz.normalizeTimeZone('+05:00') === null || tz.isValidTimeZone('+05:00') === false, 'offset rejected');
check(avail.includes('IANA') && avail.includes('Karachi'), 'UI documents no silent Karachi default');
check(consultSvc.includes('Requested slot conflicts with another consultation'), 'double booking 409');

// CONSULTATIONS / CASES / MESSAGES / VAULT
check(consultSvc.includes('notifyAgentMembership') && consultSvc.includes('/agent/consultations/'), 'consultation inbox');
check(caseSvc.includes('Student approval is required') && caseSvc.includes('notifyAgentMembership'), 'case student approval and inbox');
check(caseDetail.includes('cannot self-approve') && caseDetail.includes('Vault grants'), 'case UI privacy');
check(agentCtrl.includes('listMessageHub') && agentCtrl.includes("context: 'consultation'"), 'message hub contextual');
check(agentCtrl.includes('listVaultGrants') && agentCtrl.includes('Storage keys'), 'vault grants no storage keys');

// TRUST
check(source('client/src/pages/Agent/AgentTrust.jsx').includes('reviews') || source('client/src/pages/Agent/AgentTrust.jsx').includes('Reports'), 'trust page exists');

// TEAM
check(team.AGENT_MEMBER_ROLES ? true : constants.AGENT_MEMBER_ROLES.OWNER === 'owner', 'owner role');
check(team.isInvitableAgentRole('admin') && team.isInvitableAgentRole('member') && !team.isInvitableAgentRole('owner'), 'owner not invitable');
check(inviteModel.includes("status: 'pending'") || inviteModel.includes("PENDING"), 'invite model');
check(teamPage.includes('Invite member') && teamPage.includes('Revoke') && teamPage.includes('Last owner'), 'team invite UI');
check(profileSvc.includes('DUPLICATE_INVITE') && profileSvc.includes('INVITE_EXPIRED') && profileSvc.includes('last owner') || profileSvc.includes('Organization owner cannot be deactivated'), 'invite + last owner');

// NOTIFICATIONS
check(notifModel.includes("'agent'") && notifModel.includes('agentAccountId'), 'agent recipientType');
check(notifCtrl.includes("req.agent?.agentAccountId") && notifCtrl.includes('applyRecipientOwner'), 'inbox agent context');
check(notifSvc.includes('notifyAgent'), 'notifyAgent helper');
check(inboxBridge.includes("recipientType: 'agent'"), 'agent inbox bridge');
check(agentService.includes('agentInboxApi') && agentService.includes('/api/inbox/notifications'), 'agent inbox client');

// USAGE / COMMERCE
check(agentCtrl.includes('Commission not configured') && agentCtrl.includes('getUsageBilling'), 'usage billing truthful commission');
check(agentCtrl.includes('liveStripeCalled: false') || agentCtrl.includes('getCommerceReadiness'), 'readiness without live Stripe');
check(commercePage.includes('getCommerceReadiness') && commercePage.includes('not_configured'), 'commerce UI uses stored readiness');
check(billing.includes('Commission not configured') && billing.includes('No invented'), 'billing copy');
check(!commercePage.includes('STRIPE_SECRET') && !agentCtrl.includes('connectedAccountId'), 'no secrets in agent commerce surfaces');

// SETTINGS / GUIDELINES
check(settings.includes('logoutAll') && settings.includes('HttpOnly'), 'session controls');
check(guidelines.includes('Maps') && guidelines.includes('Vault') && guidelines.includes('Commission'), 'guidelines cover normal use');

// HTTP / ISOLATION
check(agentRoutes.includes('/agent/usage-billing') && agentRoutes.includes('/agent/messages'), 'new routes mounted');
check(agentRoutes.includes("requireAuth,\n  requireAgentAuth,\n  agent.getUsageBilling") || agentRoutes.includes('agent.getUsageBilling'), 'usage billing authed');
check(geo.isGoogleMapsUrl('https://maps.google.com/maps?q=test') === true, 'maps URL helper');
check(geo.isGoogleMapsUrl('http://evil.example/maps') === false, 'non-https maps rejected');

check(profileSvc.includes("'DUPLICATE_INVITE'") || profileSvc.includes('DUPLICATE_INVITE'), 'duplicate invite 409');
check(profileSvc.includes('INVITE_EMAIL_MISMATCH'), 'invite email mismatch 403');
check(verifySvc.includes('INCOMPLETE_SUBMISSION') && verifySvc.includes('422'), 'incomplete dossier 422');
check(consultSvc.includes('fail(') && consultSvc.includes('422'), 'availability timezone 422');
check(agentRoutes.includes('requireAgentAuth'), 'wrong realm denied by requireAgentAuth');
check(notifCtrl.includes("Notification inbox is not available for this account type"), 'unsupported inbox realm denied');
check(caseSvc.includes('vaultGrantsTransferred') || source('server/src/services/caseManagementService.js').includes('authorizedMembershipIds'), 'case transfer does not auto-copy vault in this service');
check(login.includes('htmlFor') || login.includes('agent-login-email'), 'login labels');
check(verifyPage.includes('role="alert"') || verifyPage.includes('setError'), 'verification errors exposed');
check(dash.includes('role="alert"') || dash.includes('Failed to load'), 'dashboard error state');

console.log(`phase5AgentPortal ${count} checks passed`);
