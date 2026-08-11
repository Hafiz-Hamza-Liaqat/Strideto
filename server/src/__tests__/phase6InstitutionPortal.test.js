/**
 * Phase 6 — Institution Final Portal.
 * Run: node src/__tests__/phase6InstitutionPortal.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const source = (rel) => readFileSync(path.join(root, rel), 'utf8');

const portal = await import(pathToFileURL(path.join(root, 'shared/institution/institutionPortal.js')).href);
const verification = await import(pathToFileURL(path.join(root, 'shared/international/verification.js')).href);
const geo = await import(pathToFileURL(path.join(root, 'shared/international/geo.js')).href);
const scholarship = await import(pathToFileURL(path.join(root, 'shared/education/scholarshipIntelligence.js')).href);
const acceptance = await import(pathToFileURL(path.join(root, 'shared/education/acceptanceExplorer.js')).href);
const realm = await import(pathToFileURL(path.join(root, 'client/src/auth/institutionAuthRealm.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const routes = source('client/src/routes/index.jsx');
const constantsSrc = source('client/src/constants/index.js');
const navSrc = source('client/src/config/institutionNavConfig.js');
const layout = source('client/src/pages/Institution/InstitutionLayout.jsx');
const login = source('client/src/pages/Institution/InstitutionLogin.jsx');
const register = source('client/src/pages/Institution/InstitutionRegister.jsx');
const dash = source('client/src/pages/Institution/InstitutionDashboard.jsx');
const profilePage = source('client/src/pages/Institution/InstitutionProfile.jsx');
const verifyPage = source('client/src/pages/Institution/InstitutionVerification.jsx');
const claimPage = source('client/src/pages/Institution/InstitutionClaim.jsx');
const programsPage = source('client/src/pages/Institution/InstitutionPrograms.jsx');
const editor = source('client/src/pages/Institution/InstitutionProgramEditor.jsx');
const intakesPage = source('client/src/pages/Institution/InstitutionIntakes.jsx');
const appsPage = source('client/src/pages/Institution/InstitutionApplications.jsx');
const taPage = source('client/src/pages/Institution/InstitutionTestAcceptance.jsx');
const schPage = source('client/src/pages/Institution/InstitutionScholarships.jsx');
const dqPage = source('client/src/pages/Institution/InstitutionDataQuality.jsx');
const teamPage = source('client/src/pages/Institution/InstitutionTeam.jsx');
const notifPage = source('client/src/pages/Institution/InstitutionNotifications.jsx');
const usagePage = source('client/src/pages/Institution/InstitutionUsage.jsx');
const billingPage = source('client/src/pages/Institution/InstitutionBilling.jsx');
const settings = source('client/src/pages/Institution/InstitutionSettings.jsx');
const guidelines = source('client/src/pages/Institution/InstitutionGuidelines.jsx');
const invitePage = source('client/src/pages/Institution/InstitutionAcceptInvitation.jsx');
const studentApply = source('client/src/pages/Student/StudentInstitutionApply.jsx');
const studentAdmissions = source('client/src/pages/Student/StudentInstitutionAdmissions.jsx');
const ui = source('client/src/pages/Institution/InstitutionUi.jsx');
const clientApi = source('client/src/services/institutionPortalService.js');
const studentApi = source('client/src/services/applicationsApi.js');
const portalRoutes = source('server/src/routes/institutionPortal.js');
const portalCtrl = source('server/src/controllers/institutionPortalController.js');
const portalSvc = source('server/src/services/institutionPortalService.js');
const teamSvc = source('server/src/services/institutionTeamService.js');
const admissionSvc = source('server/src/services/institutionAdmissionService.js');
const inboxBridge = source('server/src/services/institutionInboxNotificationBridge.js');
const orgBridge = source('server/src/services/orgVerificationNotificationBridge.js');
const notifCtrl = source('server/src/controllers/userNotificationsController.js');
const notifModel = source('server/src/models/UserNotification.js');
const notifSvc = source('server/src/services/notificationService.js');
const verifyCtrl = source('server/src/controllers/organization/organizationVerificationController.js');
const verifySvc = source('server/src/services/verificationService.js');
const orgVerifyModel = source('server/src/models/OrganizationVerification.js');
const inviteModel = source('server/src/models/institution/InstitutionInvitation.js');
const admissionModel = source('server/src/models/institution/InstitutionAdmissionApplication.js');
const programModel = source('server/src/models/education/Program.js');
const scholarshipModel = source('server/src/models/education/CanonicalScholarship.js');
const authCtrl = source('server/src/controllers/institutionAuthController.js');
const authFlows = source('server/src/services/auth/institutionSecureAuthFlows.js');

// AUTH / TENANT
check(realm.isInstitutionPortalPath('/institution'), 'dashboard portal path');
check(realm.isInstitutionPortalPath('/institution/verification'), 'verification portal path');
check(realm.isInstitutionPortalPath('/institution/claim'), 'claim portal path');
check(realm.isInstitutionPortalPath('/institution/applications'), 'applications portal path');
check(realm.isInstitutionPublicAuthPath('/institution/login'), 'login public');
check(realm.isInstitutionPublicAuthPath('/institution/register'), 'register public');
check(realm.isInstitutionPublicAuthPath('/institution/accept-invitation'), 'accept invite public');
check(!realm.isInstitutionPortalPath('/institution/login'), 'login is not protected portal');
check(portalRoutes.includes('requireInstitutionAuth'), 'portal requires institution auth');
check(portalRoutes.includes('requireUserAuth'), 'student admissions require user auth');
check(authCtrl.includes('institutionChangePassword') && authFlows.includes('changePassword'), 'change password');

// NAV IA
[
  'Dashboard', 'Organization Profile', 'Verification', 'Canonical Claim', 'Programs',
  'Intakes / Admissions', 'Admission Applications', 'Test Acceptance', 'Scholarships & Funding',
  'Data Quality', 'Team', 'Notifications', 'Analytics / Usage', 'Billing',
  'Settings / Security', 'Help / Guidelines',
].forEach((label) => {
  check(navSrc.includes(`label: '${label}'`), `nav has ${label}`);
});
check(constantsSrc.includes("INSTITUTION_VERIFICATION: '/institution/verification'"), 'verification route constant');
check(constantsSrc.includes("INSTITUTION_CLAIM: '/institution/claim'"), 'claim route constant');
check(constantsSrc.includes("INSTITUTION_ACCEPT_INVITATION: '/institution/accept-invitation'"), 'invite route constant');
check(routes.includes('InstitutionVerification') && routes.includes('InstitutionClaim'), 'verification and claim routed');
check(routes.includes('InstitutionIntakes') && routes.includes('InstitutionApplications'), 'intakes and applications routed');
check(routes.includes('InstitutionTestAcceptance') && routes.includes('InstitutionScholarships'), 'TA and scholarships routed');
check(routes.includes('InstitutionNotifications') && routes.includes('InstitutionBilling'), 'notifications and billing routed');
check(routes.includes('InstitutionSettings') && routes.includes('InstitutionGuidelines'), 'settings and guidelines routed');
check(routes.includes('InstitutionAcceptInvitation'), 'accept invitation routed');
check(routes.includes('StudentInstitutionApply') && routes.includes('StudentInstitutionAdmissions'), 'student admission pages routed');
check(routes.includes("path: 'help'"), 'help routed');
check(!navSrc.includes('Verified Institution Portal'), 'nav does not claim verified');

// THEME / BRANDING
check(layout.includes('Logo') && layout.includes('bg-bg-main dark:bg-secondary'), 'layout tokens and logo');
check(layout.includes('dark:bg-gray-900') && layout.includes('InstitutionNotificationBell'), 'dark sidebar and bell');
check(login.includes('Logo') && login.includes('dark:bg-secondary'), 'login branded');
check(ui.includes('placeholder:text-gray-400'), 'placeholders readable');
check(ui.includes('placeholder:text-gray-400') && ui.includes('focus:ring-primary'), 'readable placeholders and focus');
check(ui.includes('text-emerald-800') && ui.includes('text-amber-900') && ui.includes('text-red-800'), 'badge contrast');
check(login.includes('Institution Account') || login.includes('Institution sign in'), 'login wording not verified');
check(!login.includes('Verified Institution Portal'), 'login never says Verified Institution Portal');
check(!register.includes('Verified Institution Portal'), 'register never says Verified Institution Portal');
check(dash.includes('dark:text-white') && dash.includes('Completeness is not verification'), 'dashboard themed and truthful');
check(portal.portalIdentityLabel('draft') === 'Institution Portal', 'draft chrome is Institution Portal');
check(portal.portalIdentityLabel('approved') === 'Verified Institution', 'approved chrome is Verified Institution');
check(portal.isVerifiedWordingAllowed('verification_pending') === false, 'pending cannot use verified wording');
check(ui.includes("verificationStatus === 'approved' ? 'Verified Institution' : 'Institution Portal'"), 'chrome uses approved-only verified wording');

// PROFILE
check(profilePage.includes('legalName') && profilePage.includes('officialDisplayName'), 'identity fields');
check(profilePage.includes('addressLine1') && profilePage.includes('officialDomain'), 'address and domain');
check(profilePage.includes('representativeName') && profilePage.includes('representativeEmail'), 'representative');
check(profilePage.includes('Save Institution profile'), 'profile save');
check(portalSvc.includes("'representativeName'") && portalSvc.includes('computeInstitutionCompleteness'), 'profile persistence fields');
check(profilePage.includes('Legacy records remain compatible') || profilePage.includes('legacy'), 'legacy compatibility copy');

// VERIFICATION
check(verifyPage.includes('officialRegistryUrl') && verifyPage.includes('googleBusinessUrl'), 'dossier source URLs');
check(verifyPage.includes('googleMapsUrl') && verifyPage.includes('supporting evidence only'), 'maps supporting-only');
check(verifyPage.includes('Self-approval is denied'), 'self-approval denied');
check(verifyPage.includes('identityEvidenceUrl') && verifyPage.includes('authorityEvidenceUrl'), 'representative evidence');
check(verifyPage.includes('campusEvidenceUrl') && verifyPage.includes('licenseIssuedAt'), 'location and issue/expiry');
check(verifyPage.includes('credentialPolicy'), 'credential policy');
check(orgVerifyModel.includes('officialRegistryUrl') && orgVerifyModel.includes('googleBusinessUrl'), 'profile schema stores source URLs');
check(orgVerifyModel.includes('identityEvidenceUrl') && orgVerifyModel.includes('campusEvidenceUrl'), 'evidence URL fields');
check(verifySvc.includes('recordSupportingEvidenceFromProfile') && verifySvc.includes('GOOGLE_MAPS'), 'submit records maps evidence');
check(verifyCtrl.includes('req.institution?.institutionAccountId') && verifyCtrl.includes('markEmailVerified'), 'institution submit integrates org verification');
check(orgBridge.includes('isInstitutionOrgType') && orgBridge.includes("'/institution/verification'"), 'admin outcome notifies institution');
check(verification.mapsCannotAloneVerify() === true, 'mapsCannotAloneVerify');
check(!verifyPage.includes('Verified Institution Portal'), 'verification page not mislabelled');

// CANONICAL CLAIM
check(claimPage.includes('does not establish legitimacy') && claimPage.includes('Organization verification remains separate'), 'claim independence copy');
check(claimPage.includes('canonicalInstitutionId') && claimPage.includes('officialName'), 'candidate fields');
check(claimPage.includes('Competing claim') && claimPage.includes('No silent overwrite'), 'competing claim UI');
check(portalCtrl.includes('independentFromVerification: true') && portalCtrl.includes('competingClaims'), 'claim API independence');
check(portalRoutes.includes("adminInstitution.patch('/claims/:claimId'") && portalRoutes.includes("Organization verification must be approved before canonical claim approval"), 'claim approval requires verification');
check(portalRoutes.includes('A competing approved claim already exists'), 'competing approved claim 409');
check(portal.isValidClaimTransition('draft', 'approved') === false, 'claim cannot self-approve draft to approved');
check(portal.claimGrantsAuthority('submitted') === false, 'submitted claim grants no authority');
check(portal.claimGrantsAuthority('approved') === true, 'approved claim grants authority');
check(portal.splitAuthorityEvidence(['https://p6-disp.example.edu/authority']).urls.length === 1, 'claim evidence URL is stored as URL');
check(portal.splitAuthorityEvidence(['https://p6-disp.example.edu/authority']).objectIds.length === 0, 'claim evidence URL is not cast to ObjectId');
check(portalSvc.includes('splitAuthorityEvidence') && portalSvc.includes('authorityEvidenceUrls'), 'startClaim sanitizes mixed evidence refs');
check(dqPage.includes('break-all') && dqPage.includes('Existing:'), 'data-quality conflict values wrap');

// TEAM
check(portal.INSTITUTION_ROLE_LABELS.editor === 'Admissions / Program Manager', 'editor mapped not duplicated');
check(portal.isInvitableInstitutionRole('admin') && portal.isInvitableInstitutionRole('viewer') && !portal.isInvitableInstitutionRole('owner'), 'owner not invitable');
check(inviteModel.includes('PENDING') || inviteModel.includes('pending'), 'invite model');
check(teamPage.includes('Send invite') && teamPage.includes('Revoke') && teamPage.includes('Last owner'), 'team invite UI');
check(teamSvc.includes('DUPLICATE_INVITE') && teamSvc.includes('LAST_OWNER') && teamSvc.includes('CROSS_ORGANIZATION_DENIED'), 'invite + last owner + isolation');
check(teamSvc.includes('INVITE_EMAIL_MISMATCH') && teamSvc.includes('INVITE_EXPIRED'), 'invite mismatch and expiry');
check(teamSvc.includes('emailDelivery: \'not_configured\'') || teamSvc.includes("emailDelivery: 'not_configured'"), 'no real email');

// PROGRAMS
check(programsPage.includes('Search programs') && programsPage.includes('Reset'), 'program search/reset');
check(editor.includes('tuitionAmountMinor') && editor.includes('instructionLanguage'), 'tuition money and language');
check(portalSvc.includes('detectAndStoreConflict') && portalSvc.includes('PUB_STATUSES.PUBLISHED'), 'published high-impact conflicts');
check(portalCtrl.includes('Program does not belong to this institution'), 'ownership 403');
check(programModel.includes('applicationMode') && programModel.includes('deadlineDate'), 'intake date-only fields');

// INTAKES / ADMISSIONS
check(portal.isDateOnly('2027-09-01') === true, 'valid date-only');
check(portal.isDateOnly('2027-09-01T00:00:00Z') === false, 'datetime rejected');
check(portal.isValidApplicationMode('internal') && portal.isValidApplicationMode('external') && portal.isValidApplicationMode('both'), 'application modes');
check(intakesPage.includes('YYYY-MM-DD') && intakesPage.includes('No timezone'), 'date-only copy');
check(intakesPage.includes('official website') && intakesPage.includes('Internal Strideto'), 'internal vs external labels');
check(portalSvc.includes('normalizeIntake') && portalSvc.includes('no timezone'), 'intake normalizer');
check(appsPage.includes('consented snapshot') && appsPage.includes('not a whole Student profile'), 'inbox privacy');
check(admissionSvc.includes('CONSENT_REQUIRED') && admissionSvc.includes('EXTERNAL_ONLY'), 'consent and external-only');
check(admissionSvc.includes('isValidInstitutionAdmissionTransition') && admissionSvc.includes('VERSION_CONFLICT'), 'state authority and concurrency');
check(portal.isValidInstitutionAdmissionTransition('received', 'admitted') === false, 'cannot jump received to admitted');
check(portal.isValidInstitutionAdmissionTransition('under_review', 'offer') === true, 'institution may offer from review');
check(studentAdmissions.includes('cannot self-admit'), 'student cannot self-admit');
check(studentApply.includes('consent') && studentApply.includes('Vault'), 'student consent and vault copy');
check(studentApi.includes('/student/institution-admissions'), 'student admissions API on user client');
check(admissionModel.includes('snapshot') && admissionModel.includes('consentScope'), 'snapshot model');
check(portalCtrl.includes('VAULT_DENIED') && portalRoutes.includes('denyVault'), 'vault deny endpoints');
check(admissionSvc.includes("link: '/applications/institution'"), 'student deep link');

// TEST ACCEPTANCE
check(taPage.includes('Country-wide policy') && !taPage.includes("ACCEPTANCE_SCOPES.COUNTRY"), 'UI omits country scope');
check(portalSvc.includes('Institution cannot modify country-level') && portalSvc.includes("ACCEPTANCE_SCOPES.COUNTRY"), 'country protection');
check(portalSvc.includes('supersededById') && taPage.includes('Superseded'), 'history/supersession');
check(portalSvc.includes("select('-adminNotes')"), 'TA list strips admin notes');
check(acceptance.ACCEPTANCE_SCOPES.COUNTRY === 'country', 'country scope exists in catalog');

// SCHOLARSHIPS
check(schPage.includes('Institution-owned') && schPage.includes('No award is guaranteed') || schPage.includes('guarantee'), 'no guarantee wording');
check(portalSvc.includes('containsForbiddenGuarantee') && portalSvc.includes('EXTERNAL_AUTHORITY'), 'guarantee and external authority');
check(scholarship.containsForbiddenGuarantee('guaranteed scholarship') === true, 'guarantee detector');
check(scholarshipModel.includes('organizationId') && scholarshipModel.includes('nationalityScope'), 'owned scholarship fields');
check(schPage.includes('Eligibility criteria'), 'criteria UI');

// DATA QUALITY
check(dqPage.includes('Opening this page never marks data fresh'), 'no freshness mutation on read');
check(dqPage.includes('Existing:') && dqPage.includes('Proposed:'), 'conflict existing vs proposed');
check(portalSvc.includes('PROVENANCE_RECONFIRMATION') && portalSvc.includes('institution_freshness_reconfirmed'), 'explicit reconfirm');
check(dqPage.includes('Record reconfirmation'), 'reconfirm UI');

// NOTIFICATIONS
check(notifModel.includes("'institution'") && notifModel.includes('institutionAccountId'), 'institution recipientType');
check(notifCtrl.includes('req.institution?.institutionAccountId'), 'inbox institution context');
check(notifSvc.includes('notifyInstitution'), 'notifyInstitution helper');
check(inboxBridge.includes("recipientType: 'institution'"), 'institution inbox bridge');
check(clientApi.includes('institutionInboxApi') && clientApi.includes('/inbox/notifications'), 'institution inbox client');
check(orgBridge.includes("'/institution/verification'"), 'verification deep link');
check(admissionSvc.includes('institution_admission.received'), 'admission notification');
check(teamSvc.includes('institution_team.invitation'), 'team invitation notification');
check(notifPage.includes('institutionInboxApi'), 'notifications page uses inbox');
check(inboxBridge.includes('dedupeKey'), 'dedupe keys');

// ANALYTICS / BILLING
check(portalSvc.includes("externalApplicationTraffic: 'not_tracked'"), 'external not tracked');
check(usagePage.includes('not_tracked') && usagePage.includes('Internal applications'), 'usage truthful');
check(portal.INSTITUTION_LAUNCH_BILLING.planLabel === 'Free', 'launch plan Free');
check(portal.INSTITUTION_LAUNCH_BILLING.providerState === 'not_configured', 'provider not_configured');
check(billingPage.includes('Free') && billingPage.includes('Not configured') && billingPage.includes('No live Stripe'), 'billing copy');
check(portalSvc.includes('liveStripeCalled: false') && portalSvc.includes("wallet: 'not_configured'"), 'no wallet / no live stripe');
check(!billingPage.includes('STRIPE_SECRET'), 'no secrets in billing UI');

// SETTINGS / GUIDELINES
check(settings.includes('logoutAll') && settings.includes('HttpOnly'), 'session controls');
check(settings.includes('changePassword') || settings.includes('Change password'), 'password change');
check(guidelines.includes('Canonical claim') && guidelines.includes('Vault') && guidelines.includes('Maps'), 'guidelines cover normal use');
check(guidelines.includes('Launch pricing') || guidelines.includes('free'), 'guidelines pricing');
check(invitePage.includes('Accept Institution invitation') && invitePage.includes('Logo'), 'invite accept branded');

// SEARCH / HTTP / ISOLATION
check(portal.boundedInstitutionQuery('x'.repeat(200)).length === portal.INSTITUTION_QUERY_MAX, 'query bound');
check(portal.escapeRegex('a+b') === 'a\\+b', 'regex escape');
check(portalRoutes.includes('/applications') && portalRoutes.includes('/scholarships') && portalRoutes.includes('/team/invites'), 'new routes mounted');
check(portalCtrl.includes('resolveMembershipOrFail') && portalCtrl.includes('organizationId'), 'membership scoped by organizationId');
check(admissionSvc.includes('organizationId, applicationId') || admissionSvc.includes('organizationId'), 'application isolation');

// HTTP status vocabulary present
check(teamSvc.includes('domainError(409') && teamSvc.includes('domainError(403') && teamSvc.includes('domainError(400'), 'team 409/403/400');
check(admissionSvc.includes('domainError(422') && admissionSvc.includes('domainError(404') && admissionSvc.includes('domainError(409'), 'admissions 422/404/409');
check(portalSvc.includes('status: 403') && portalSvc.includes('status: 422'), 'portal 403/422');
check(portalRoutes.includes('return res.status(404)') || portalCtrl.includes('status(404)'), '404');
check(authCtrl.includes('status(400)') || authCtrl.includes('status(401)'), 'auth errors');

check(login.includes('htmlFor') || login.includes('institution-email'), 'login labels');
check(verifyPage.includes('role="alert"') || verifyPage.includes('setError'), 'verification errors exposed');
check(dash.includes('role="alert"') || dash.includes('unavailable'), 'dashboard error state');
check(layout.includes('min-h-[44px]') && ui.includes('min-h-[44px]'), 'touch targets');
check(layout.includes('lg:hidden') && layout.includes('hidden lg:flex'), 'responsive sidebar');
check(geo.isGoogleMapsUrl('https://maps.google.com/maps?q=test') === true, 'maps URL helper');
check(geo.isGoogleMapsUrl('http://evil.example/maps') === false, 'non-https maps rejected');

console.log(`phase6InstitutionPortal ${count} checks passed`);
