/**
 * Phase 4 — Employer Final Portal.
 * Run: node src/__tests__/phase4EmployerPortal.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const source = (rel) => readFileSync(path.join(root, rel), 'utf8');

const team = await import(pathToFileURL(path.join(root, 'shared/employer/team.js')).href);
const openings = await import(pathToFileURL(path.join(root, 'shared/employer/openingsCount.js')).href);
const quotaCalc = await import(
  pathToFileURL(path.join(root, 'server/src/services/publishing/PublishingQuotaUsageService.js')).href
);
const policy = await import(
  pathToFileURL(path.join(root, 'server/src/config/freeBetaPublishingPolicy.js')).href
);
const authority = await import(
  pathToFileURL(path.join(root, 'shared/career/applicationAuthority.js')).href
);
const skillTrust = await import(
  pathToFileURL(path.join(root, 'shared/career/skillVerification.js')).href
);
const verification = await import(
  pathToFileURL(path.join(root, 'shared/international/verification.js')).href
);
const authRealm = await import(pathToFileURL(path.join(root, 'client/src/auth/authRealm.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const employerCtrl = source('server/src/controllers/employerController.js');
const employerRoutes = source('server/src/routes/employer.js');
const intelRoutes = source('server/src/routes/employerIntelligence.js');
const jobModel = source('server/src/models/Job.js');
const orgVerifyCtrl = source('server/src/controllers/organization/organizationVerificationController.js');
const verifySvc = source('server/src/services/verificationService.js');
const layout = source('client/src/pages/Employer/EmployerLayout.jsx');
const nav = source('client/src/config/employerNavConfig.js');
const routes = source('client/src/routes/index.jsx');
const constants = source('client/src/constants/index.js');
const postJob = source('client/src/pages/Employer/EmployerPostJob.jsx');
const jobsPage = source('client/src/pages/Employer/EmployerJobs.jsx');
const guidelines = source('client/src/pages/Employer/EmployerGuidelines.jsx');
const plansPage = source('client/src/pages/Employer/EmployerPlansUsage.jsx');
const billingPage = source('client/src/pages/Employer/EmployerBilling.jsx');
const _teamPage = source('client/src/pages/Employer/EmployerTeam.jsx');
const verifyPage = source('client/src/pages/Employer/EmployerVerification.jsx');
const interviewsPage = source('client/src/pages/Employer/EmployerInterviews.jsx');
const skillPanel = source('client/src/components/skills/ApplicantSkillPanel.jsx');
const oaService = source('server/src/services/career/OpportunityApplicationService.js');
const appStatus = source('server/src/utils/applicationStatusTransition.js');
const usageCtrl = source('server/src/controllers/employerUsageController.js');
const teamSvc = source('server/src/services/employer/employerOrganizationService.js');
const quotaSvc = source('server/src/services/employer/employerPublishingQuota.js');
const payCtrl = source('server/src/controllers/paymentsController.js');
const _commerce = source('server/src/controllers/commerceController.js');
check(_commerce.includes('CommerceOrder') || _commerce.includes('purchaser'), 'commerce contracts exist');
check(_teamPage.includes('invite') || _teamPage.includes('Invite'), 'team page invite UI');

// AUTH / TENANT
check(authRealm.isEmployerPortalPath('/employer'), 'dashboard portal path');
check(authRealm.isEmployerPortalPath('/employer/jobs'), 'jobs portal path');
check(authRealm.isEmployerPortalPath('/employer/verification'), 'verification portal path');
check(authRealm.isEmployerPortalPath('/employer/plans'), 'plans portal path');
check(authRealm.isEmployerPortalPath('/employer/billing'), 'billing portal path');
check(authRealm.isEmployerPortalPath('/employer/team'), 'team portal path');
check(authRealm.isEmployerPortalPath('/employer/guidelines'), 'guidelines portal path');
check(authRealm.isEmployerPortalPath('/employer/interviews'), 'interviews portal path');
check(authRealm.isEmployerPublicAuthPath('/employer/accept-invitation'), 'accept invite is public auth');
check(!authRealm.isEmployerPortalPath('/employer/acme-corp'), 'public slug is not portal');
check(employerCtrl.includes('scopeEmployerId') && employerCtrl.includes('hiringOwnerIdFrom'), 'job queries use hiring owner scope');
check(employerCtrl.includes("Job.findOne({ _id: req.params.id, employerId })"), 'owned job lookup');
check(employerCtrl.includes("application.jobId?.employerId?.toString() !== String(employerId)"), 'foreign application denied');

// TEAM
check(team.isValidEmployerRole('owner') && team.isValidEmployerRole('recruiter'), 'roles exist');
check(!team.isValidEmployerRole('superadmin'), 'unknown role rejected');
check(team.employerRoleHasCapability('owner', team.EMPLOYER_CAPABILITIES.BILLING_READ), 'owner billing');
check(!team.employerRoleHasCapability('recruiter', team.EMPLOYER_CAPABILITIES.BILLING_READ), 'recruiter no billing');
check(!team.employerRoleHasCapability('recruiter', team.EMPLOYER_CAPABILITIES.VERIFICATION_SUBMIT), 'recruiter no verification');
check(!team.employerRoleHasCapability('viewer', team.EMPLOYER_CAPABILITIES.JOBS_WRITE), 'viewer read-only jobs');
check(team.employerRoleHasCapability('viewer', team.EMPLOYER_CAPABILITIES.JOBS_READ), 'viewer can read jobs');
check(team.isLastOwnerProtected({ targetRole: 'owner', activeOwnerCount: 1 }), 'last owner protected');
check(!team.isLastOwnerProtected({ targetRole: 'owner', activeOwnerCount: 2 }), 'two owners can demote one');
check(!team.canChangeMemberRole({ actorRole: 'admin', targetRole: 'owner', nextRole: 'admin' }), 'admin cannot change owner');
check(team.canChangeMemberRole({ actorRole: 'owner', targetRole: 'recruiter', nextRole: 'admin' }), 'owner can change recruiter');
check(!team.canRemoveMember({ actorRole: 'admin', targetRole: 'owner' }), 'admin cannot remove owner');
check(teamSvc.includes('DUPLICATE_INVITE'), 'duplicate invite');
check(teamSvc.includes('INVITE_EXPIRED') || teamSvc.includes('EXPIRED'), 'expired invite');
check(teamSvc.includes('LAST_OWNER_PROTECTED'), 'last owner server protection');
check(teamSvc.includes('requireObjectId'), 'invalid membership id does not 500');
check(teamSvc.includes('CROSS_ORGANIZATION_DENIED'), 'cross-org denial');
check(teamSvc.includes('tokenHash') && teamSvc.includes('hashResetToken'), 'invite token hashed');
check(employerRoutes.includes("'/employer/team/invites'"), 'invite route');
check(employerRoutes.includes('acceptInvite'), 'accept invite route');

// VERIFICATION
check(verifyPage.includes('cannotSelfApprove'), 'UI states no self-approval');
check(!orgVerifyCtrl.includes("status: 'approved'") || orgVerifyCtrl.includes('submitVerification'), 'org submit uses service');
check(verifySvc.includes('VS.VERIFICATION_PENDING'), 'submit goes pending');
check(!verifySvc.includes('profile.status'), 'client status not trusted on submit');
check(orgVerifyCtrl.includes('normalizeVerificationProfile'), 'object representative coerced to string');
check(orgVerifyCtrl.includes('STAFF_VERIFICATION_ROLES'), 'student tokens cannot read employer verification');
check(orgVerifyCtrl.includes('profile: record.profile'), 'employer can view submitted profile');
check(orgVerifyCtrl.includes('VERIFICATION_SUBMIT'), 'submit capability enforced');
check(verifySvc.includes('syncEmployerHiringEligibilityFromOrganization'), 'Admin outcomes mirror Employer hiring eligibility');
check(quotaSvc.includes('overlayOrganizationVerification'), 'quota reads org verification authority');
check(orgVerifyCtrl.includes('EmployerMembership'), 'membership ownership');
check(verification.isValidTransition('email_verified', 'verification_pending'), 'submit transition');
check(!verification.isValidTransition('draft', 'approved'), 'self-approve transition denied');
check(verification.EVIDENCE_TYPES.GOOGLE_MAPS === 'google_maps', 'maps evidence type');

// JOBS
check(jobModel.includes('openingsCount'), 'openingsCount field');
check(employerCtrl.includes("parseOpeningsCount(body.openingsCount, { required: true })"), 'create requires openings');
check(employerCtrl.includes('quotaConsumed: false'), 'draft does not consume quota');
{
  const createBody = employerCtrl.slice(
    employerCtrl.indexOf('export const createJob'),
    employerCtrl.indexOf('export const updateJob')
  );
  check(!createBody.includes('onJobSubmitted'), 'createJob does not fire submitted automation');
}
check(employerCtrl.includes('assertChargedSubmissionAllowed'), 'activate enforces quota');
check(employerCtrl.includes('recordChargedSubmission'), 'charged submission recorded');
check(policy.FREE_BETA_PUBLISHING_POLICY.drafts.consumesQuota === false, 'policy drafts free');
check(policy.FREE_BETA_PUBLISHING_POLICY.chargedSubmissions.rolling24Hours.limit === 1, '1/24h');
check(policy.FREE_BETA_PUBLISHING_POLICY.chargedSubmissions.rolling30Days.limit === 10, '10/30d');
check(policy.FREE_BETA_PUBLISHING_POLICY.maximumActiveFreeJobs === 5, 'max 5 active free');
check(openings.parseOpeningsCount(1).ok && openings.parseOpeningsCount(1).value === 1, 'openings 1');
check(!openings.parseOpeningsCount(0).ok, 'openings 0 denied');
check(!openings.parseOpeningsCount(-1).ok, 'openings negative denied');
check(!openings.parseOpeningsCount(1.5).ok, 'openings float denied');
check(!openings.parseOpeningsCount('abc').ok, 'openings string denied');
check(!openings.parseOpeningsCount(10001).ok, 'openings max denied');
check(openings.parseOpeningsCount(null).specified === false, 'legacy missing unspecified');
check(openings.formatOpeningsCount(null) === 'Not specified', 'legacy label');
check(postJob.includes('openingsCountLabel'), 'UI label Number of openings');
check(employerCtrl.includes("applyType !== 'internal'") && employerCtrl.includes("applyType !== 'external'"), 'applyType validated');

const usageNow = new Date('2026-08-11T12:00:00.000Z');
const emptyUsage = quotaCalc.calculatePublishingQuotaUsage({
  chargedAcceptedAt: [],
  activeFreeJobsUsed: 0,
  now: usageNow,
});
check(emptyUsage.canAcceptChargedSubmission, 'empty quota allows submit');
check(emptyUsage.daily.remaining === 1, 'daily remaining 1');
check(emptyUsage.rolling30Days.remaining === 10, 'rolling remaining 10');
const blocked = quotaCalc.calculatePublishingQuotaUsage({
  chargedAcceptedAt: [usageNow],
  activeFreeJobsUsed: 5,
  now: usageNow,
});
check(!blocked.canAcceptChargedSubmission, 'daily limit blocks');
check(blocked.activeFreeJobs.remaining === 0, 'active remaining 0');
check(quotaSvc.includes('draftsConsumeQuota'), 'usage snapshot explains drafts');

// APPLICATIONS
check(authority.EMPLOYER_AUTHORITATIVE_STAGES.includes('interview'), 'employer authoritative interview');
check(authority.STUDENT_WRITABLE_INTERNAL_STAGES.includes('withdrawn'), 'student withdrawal');
check(!authority.STUDENT_WRITABLE_INTERNAL_STAGES.includes('hired'), 'student cannot hire');
check(oaService.includes('STUDENT_CANNOT_SET_EMPLOYER_STATE') || oaService.includes('assertStudentMayTransition'), 'student authority fail-closed');
check(appStatus.includes("['shortlisted', 'rejected', 'interview', 'hired']") || appStatus.includes('LEGACY_EMPLOYER_STATUSES'), 'legacy employer statuses');
check(employerCtrl.includes('isSameStatusNoOp'), 'idempotent transition');

// SKILL TRUST
check(skillTrust.SKILL_CLAIM_STATUSES.CLAIMED !== skillTrust.SKILL_CLAIM_STATUSES.EVIDENCE_BACKED, 'claimed != evidence-backed');
check(skillTrust.SKILL_CLAIM_STATUSES.EVIDENCE_BACKED !== skillTrust.SKILL_CLAIM_STATUSES.VERIFIED, 'evidence-backed != verified');
check(skillPanel.includes('CLAIMED') && skillPanel.includes('VERIFIED'), 'skill panel present');
check(source('server/src/controllers/career/skillClaimController.js').includes('hiringOwnerId'), 'skill view scoped to hiring owner');
check(source('server/src/controllers/career/skillClaimController.js').includes('assertEmployerMayViewApplicant'), 'no arbitrary applicant skills');

// PIPELINE
check(intelRoutes.includes('PIPELINE_WRITE'), 'pipeline write capability');
check(intelRoutes.includes('transitionPipeline'), 'pipeline transition route');
check(nav.includes('EMPLOYER_INTELLIGENCE_PIPELINE'), 'pipeline is deep link not duplicate');

// INTERVIEWS
check(intelRoutes.includes('INTERVIEWS_WRITE'), 'interview write capability');
check(interviewsPage.includes('IANA') || interviewsPage.includes('timeZone') || interviewsPage.includes('scheduledAt'), 'interview time shown');
check(employerRoutes.includes("'/employer/interviews'"), 'interviews list route');
check(source('server/src/controllers/career/employerIntelligenceController.js').includes('hiringOwnerId'), 'intelligence scoped to hiring owner');

// ANALYTICS
check(employerCtrl.includes('applicationsTracked'), 'analytics tracked flag');
check(employerCtrl.includes("resolveJobApplyType(job) === 'external' ? null"), 'external apps not counted');
check(source('client/src/pages/Employer/EmployerAnalytics.jsx').includes('applicationsNotTracked'), 'UI not tracked');

// PLANS / USAGE / PAYMENT
check(employerRoutes.includes("'/employer/plans/usage'"), 'usage route');
check(employerRoutes.includes("'/employer/billing'"), 'billing route');
check(usageCtrl.includes("state: providerConfigured ? 'configured' : 'not_configured'"), 'truthful not_configured');
check(!usageCtrl.includes('STRIPE_SECRET') && !usageCtrl.includes('cvv'), 'no secrets in billing controller');
check(payCtrl.includes('isStripeConfigured'), 'stripe config gate');
check(!billingPage.includes('4242'), 'no PAN in billing UI');
check(plansPage.includes('draftsDoNotConsume'), 'plans page explains drafts');

// NOTIFICATIONS
check(employerCtrl.includes('unreadNotifications'), 'dashboard unread');
check(constants.includes('EMPLOYER_NOTIFICATIONS'), 'notifications route constant');
check(source('client/src/pages/Employer/EmployerNotifications.jsx').length > 0, 'notifications page exists');

// HTTP vocabulary
check(employerCtrl.includes('status(400)') && employerCtrl.includes('status(404)'), '400/404');
check(employerRoutes.includes('requireEmployerAuth'), '401 via auth');
check(teamSvc.includes('status = 403') || source('server/src/services/employer/employerOrganizationService.js').includes('403'), '403 capability');
check(teamSvc.includes('409'), '409 conflicts');
check(quotaSvc.includes('429'), '429 quota');
check(orgVerifyCtrl.includes('status: 422') || orgVerifyCtrl.includes('422'), '422 incomplete verification');
check(teamSvc.includes('410'), '410 expired invite');
check(verifySvc.includes('CONFLICT') && verifySvc.includes('409'), 'verification concurrency 409');
check(openings.parseOpeningsCount(10000).ok, 'openings max 10000 allowed');
check(!team.employerRoleHasCapability('admin', team.EMPLOYER_CAPABILITIES.BILLING_READ), 'admin no billing');
check(team.employerRoleHasCapability('admin', team.EMPLOYER_CAPABILITIES.VERIFICATION_SUBMIT), 'admin may submit verification');
check(skillPanel.includes('applicationSnapshot') || skillPanel.includes('snapshot'), 'application snapshot on skill panel');

// NAV / GUIDELINES / SETTINGS
check(nav.includes('navGuidelines') && nav.includes('navHelp'), 'guidelines and help nav');
check(guidelines.includes('guideSkillTrust') && guidelines.includes('guideQuota'), 'guidelines topics');
check(routes.includes('EmployerTeam') && routes.includes('EmployerBilling'), 'new routes wired');
check(layout.includes('employerNavItems'), 'layout uses final IA');
check(jobsPage.includes('pending'), 'pending filter');
check(jobsPage.includes('formatOpeningsCount'), 'openings displayed');

// SEARCH isolation
check(employerCtrl.includes('INVALID_SORT'), 'invalid sort 400');
check(employerCtrl.includes('escapeRegex'), 'search regex escaped');
check(employerCtrl.includes('.slice(0, 200)'), 'bounded query');

console.log(`phase4EmployerPortal: ${count} checks passed`);
