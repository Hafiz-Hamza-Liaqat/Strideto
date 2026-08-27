/**
 * Agent portal routes (Mission 11).
 *
 * Security boundaries:
 * - Agent auth routes require trusted origin (secureTrustedOrigin).
 * - Agent dashboard/profile/service routes require Agent realm (requireAgentAuth).
 * - User realm CANNOT invoke Agent mutations — requireAgentAuth rejects req.user.
 * - Employer realm CANNOT invoke Agent mutations — requireAgentAuth rejects req.employer.
 * - Public profile/directory routes require no auth.
 *
 * VAULT: Agent auth alone grants zero Vault access.
 */
import { Router } from 'express';
import { requireAuth, requireAgentAuth } from '../middleware/auth.js';
import { studentProductAuth } from '../middleware/requireUserCapability.js';
import { secureTrustedOrigin } from '../middleware/secureTrustedOrigin.js';
import {
  employerAuthLimiter,
  refreshLimiter,
  forgotPasswordLimiter,
  authLimiter,
  gbsCapabilityWriteLimiter,
  gbsListingWriteLimiter,
  gbsProviderReadLimiter,
  gbsRequestWriteLimiter,
  gbsQuoteWriteLimiter,
  gbsCaseWriteLimiter,
  gbsCaseDocumentWriteLimiter,
  gbsCaseDocumentAccessLimiter,
  providerDomainWriteLimiter,
  agentTeamInviteLimiter,
} from '../middleware/rateLimit.js';
import { requireBusinessServicesEnabled } from '../middleware/requireBusinessServices.js';
import { requireProviderDomainReady } from '../middleware/requireProviderDomainReady.js';
import * as gbsProvider from '../controllers/gbsProviderController.js';
import * as gbsProviderRequests from '../controllers/gbsProviderRequestController.js';
import * as gbsProviderQuotes from '../controllers/gbsProviderQuoteController.js';
import * as gbsProviderCases from '../controllers/gbsProviderCaseController.js';
import * as gbsProviderCaseDocs from '../controllers/gbsProviderCaseDocumentController.js';
import * as gbsMessages from '../controllers/gbsContextMessagingController.js';
import * as providerDomain from '../controllers/providerDomainController.js';
import { requireTurnstileWhenEnabled } from '../middleware/turnstile.js';
import { requireAgentEmailVerified } from '../middleware/requireEmailVerified.js';
import * as agentAuth from '../controllers/agentAuthController.js';
import * as agent from '../controllers/agentController.js';
import * as marketplace from '../controllers/agentMarketplaceController.js';
import {
  requireEducationMobilityWorkspaceLaunched,
  requireBusinessServicesWorkspaceLaunched,
  requireAnyProviderWorkspaceLaunched,
  assertAgentRegistrationDomainsLaunched,
} from '../middleware/requireWorkspaceLaunched.js';
import {
  WORKSPACE_LAUNCH_IDS,
  isWorkspaceLaunched,
  workspaceComingSoonBody,
} from '../../../shared/launch/workspaceLaunchGates.js';

export const agentRouter = Router();

/**
 * Route launch classes (auth/domain permissions still apply afterward):
 * A. educationPrivate  — Education & Mobility specific
 * B. businessPrivate   — Business Formation / GBS specific (plus legacy GBS flag)
 * C. providerPrivate   — shared provider (team, messages, billing, domains, …)
 */
const educationPrivate = [requireAuth, requireAgentAuth, requireEducationMobilityWorkspaceLaunched];
const providerPrivate = [requireAuth, requireAgentAuth, requireAnyProviderWorkspaceLaunched];
const businessPrivate = [
  requireAuth,
  requireAgentAuth,
  requireBusinessServicesWorkspaceLaunched,
  requireProviderDomainReady,
  requireBusinessServicesEnabled,
];

/**
 * Coarse pre-check only. Invite/empty-domain authority is enforced in
 * createAgentRegisterHandler after server resolves invite domainAccess.
 * Body domains alone cannot unlock a gated workspace.
 */
function requireAgentRegisterWorkspaceLaunched(req, res, next) {
  const domainIds = req.body?.domainIds || req.body?.providerDomainIds || [];
  const ids = Array.isArray(domainIds) ? domainIds : [];
  const eduOk = isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY, process.env);
  const bizOk = isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES, process.env);

  if (!eduOk && !bizOk) {
    return res.status(403).json(workspaceComingSoonBody(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY));
  }
  if (ids.length > 0) {
    const gate = assertAgentRegistrationDomainsLaunched(ids);
    if (!gate.ok) {
      return res.status(403).json(workspaceComingSoonBody(gate.workspace));
    }
  }
  return next();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

agentRouter.post(
  '/auth/agent/register',
  requireAgentRegisterWorkspaceLaunched,
  employerAuthLimiter,
  secureTrustedOrigin,
  requireTurnstileWhenEnabled('register'),
  agentAuth.agentRegister
);
agentRouter.get('/auth/agent/provider-domains', providerDomain.getCatalog);
agentRouter.post(
  '/auth/agent/login',
  employerAuthLimiter,
  secureTrustedOrigin,
  agentAuth.agentLogin
);
agentRouter.post(
  '/auth/agent/refresh-token',
  refreshLimiter,
  secureTrustedOrigin,
  agentAuth.agentRefreshToken
);
agentRouter.post(
  '/auth/agent/logout',
  secureTrustedOrigin,
  requireAuth,
  requireAgentAuth,
  agentAuth.agentLogout
);
agentRouter.post(
  '/auth/agent/logout-all',
  secureTrustedOrigin,
  requireAuth,
  requireAgentAuth,
  agentAuth.agentLogoutAll
);
agentRouter.post(
  '/auth/agent/change-password',
  secureTrustedOrigin,
  requireAuth,
  requireAgentAuth,
  agentAuth.agentChangePassword
);
agentRouter.post(
  '/auth/agent/forgot-password',
  secureTrustedOrigin,
  forgotPasswordLimiter,
  requireTurnstileWhenEnabled('password_recovery'),
  agentAuth.agentForgotPassword
);
agentRouter.post(
  '/auth/agent/reset-password',
  secureTrustedOrigin,
  authLimiter,
  agentAuth.agentResetPassword
);

// Authenticated self
agentRouter.get(
  '/auth/agent/me',
  requireAuth,
  requireAgentAuth,
  agentAuth.agentMe
);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

agentRouter.get(
  '/agent/dashboard',
  ...educationPrivate,
  agent.getDashboard
);

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

agentRouter.get(
  '/agent/profile',
  ...educationPrivate,
  agent.getProfile
);
agentRouter.patch(
  '/agent/profile',
  ...educationPrivate,
  agent.patchProfile
);
agentRouter.get(
  '/agent/profile/completeness',
  ...educationPrivate,
  agent.getCompleteness
);

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

agentRouter.post(
  '/agent/onboarding/step',
  ...educationPrivate,
  agent.submitOnboardingStep
);

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

agentRouter.get(
  '/agent/verification',
  ...educationPrivate,
  agent.getVerification
);

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

agentRouter.get(
  '/agent/services',
  ...educationPrivate,
  agent.listServices
);
agentRouter.post(
  '/agent/services',
  ...educationPrivate,
  requireProviderDomainReady,
  agent.addService
);
agentRouter.patch(
  '/agent/services/:serviceId',
  ...educationPrivate,
  requireProviderDomainReady,
  agent.editService
);

// ---------------------------------------------------------------------------
// Team (Agency) — shared provider
// ---------------------------------------------------------------------------

agentRouter.get(
  '/agent/team',
  ...providerPrivate,
  agent.listTeamMembers
);
agentRouter.patch(
  '/agent/team/member',
  ...providerPrivate,
  agent.changeMemberRole
);
agentRouter.patch(
  '/agent/team/member/status',
  ...providerPrivate,
  agent.changeMemberStatus
);
agentRouter.get(
  '/agent/team/invites',
  ...providerPrivate,
  agent.listInvites
);
agentRouter.post(
  '/agent/team/invites',
  ...providerPrivate,
  agentTeamInviteLimiter,
  agent.createInvite
);
agentRouter.patch(
  '/agent/team/member/domain-access',
  ...providerPrivate,
  agentTeamInviteLimiter,
  agent.changeMemberDomainAccess
);
agentRouter.post(
  '/agent/team/invites/:invitationId/revoke',
  ...providerPrivate,
  agent.revokeInvite
);
agentRouter.get(
  '/auth/agent/invitations/preview',
  agent.previewInvite
);
agentRouter.post(
  '/auth/agent/invitations/accept',
  ...providerPrivate,
  agent.acceptInvite
);

// ---------------------------------------------------------------------------
// Leads / Clients (foundation)
// ---------------------------------------------------------------------------

agentRouter.get(
  '/agent/leads',
  ...educationPrivate,
  agent.listLeads
);
agentRouter.patch(
  '/agent/leads/:leadId',
  ...educationPrivate,
  agent.patchLeadStatus
);
agentRouter.get(
  '/agent/clients',
  ...educationPrivate,
  agent.listClients
);
agentRouter.get(
  '/agent/verification/sources',
  ...educationPrivate,
  agent.getVerificationSources
);
agentRouter.get(
  '/agent/usage-billing',
  ...providerPrivate,
  agent.getUsageBilling
);
agentRouter.get(
  '/agent/commerce/readiness',
  ...providerPrivate,
  agent.getCommerceReadiness
);
agentRouter.get(
  '/agent/messages',
  ...providerPrivate,
  agent.listMessageHub
);
agentRouter.get(
  '/agent/vault/grants',
  ...providerPrivate,
  agent.listVaultGrants
);

// Structured Agent marketplace authoring
agentRouter.get('/agent/marketplace/counts', ...educationPrivate, marketplace.counts);
agentRouter.get('/agent/marketplace', ...educationPrivate, marketplace.listOwn);
agentRouter.post('/agent/marketplace', ...educationPrivate, requireAgentEmailVerified(), requireProviderDomainReady, marketplace.create);
agentRouter.get('/agent/marketplace/:postId', ...educationPrivate, marketplace.getOwn);
agentRouter.patch('/agent/marketplace/:postId', ...educationPrivate, marketplace.update);
agentRouter.post('/agent/marketplace/:postId/submit', ...educationPrivate, requireAgentEmailVerified(), marketplace.submit);
agentRouter.post('/agent/marketplace/:postId/archive', ...educationPrivate, marketplace.archive);

const gbsEnabled = businessPrivate;

agentRouter.get('/agent/provider-domains/catalog', ...providerPrivate, providerDomain.getCatalog);
agentRouter.get('/agent/provider-domains/home', ...providerPrivate, providerDomain.getHome);
agentRouter.get('/agent/provider-domains/context', ...providerPrivate, providerDomain.getContext);
agentRouter.post(
  '/agent/provider-domains/onboarding',
  ...providerPrivate,
  providerDomainWriteLimiter,
  providerDomain.completeOnboarding
);
agentRouter.post(
  '/agent/provider-domains',
  ...providerPrivate,
  requireProviderDomainReady,
  providerDomainWriteLimiter,
  providerDomain.addDomain
);

agentRouter.get('/agent/business-services/enabled', requireAuth, requireAgentAuth, gbsProvider.getEnabled);
agentRouter.get('/agent/business-services/context', ...gbsEnabled, gbsProviderReadLimiter, gbsProvider.getContext);
agentRouter.get('/agent/business-services/overview', ...gbsEnabled, gbsProviderReadLimiter, gbsProvider.getOverview);
agentRouter.get('/agent/business-services/professional-profile', ...gbsEnabled, gbsProviderReadLimiter, gbsProvider.getProfessionalProfile);
agentRouter.patch('/agent/business-services/professional-profile', ...gbsEnabled, gbsCapabilityWriteLimiter, gbsProvider.patchProfessionalProfile);
agentRouter.get('/agent/business-services/catalog', ...gbsEnabled, gbsProviderReadLimiter, gbsProvider.getCatalog);
agentRouter.get('/agent/business-services/capabilities', ...gbsEnabled, gbsProviderReadLimiter, gbsProvider.listCapabilities);
agentRouter.post('/agent/business-services/capabilities', ...gbsEnabled, gbsCapabilityWriteLimiter, gbsProvider.claimCapability);
agentRouter.patch('/agent/business-services/capabilities/:id', ...gbsEnabled, gbsCapabilityWriteLimiter, gbsProvider.patchCapabilityScope);
agentRouter.post('/agent/business-services/capabilities/:id/evidence', ...gbsEnabled, gbsCapabilityWriteLimiter, gbsProvider.postCapabilityEvidence);
agentRouter.get('/agent/business-services/listings', ...gbsEnabled, gbsProviderReadLimiter, gbsProvider.listListings);
agentRouter.post('/agent/business-services/listings', ...gbsEnabled, gbsListingWriteLimiter, gbsProvider.createListing);
agentRouter.get('/agent/business-services/listings/:listingId', ...gbsEnabled, gbsProviderReadLimiter, gbsProvider.getListing);
agentRouter.patch('/agent/business-services/listings/:listingId', ...gbsEnabled, gbsListingWriteLimiter, gbsProvider.patchListing);
agentRouter.post('/agent/business-services/listings/:listingId/submit', ...gbsEnabled, gbsListingWriteLimiter, gbsProvider.submitListing);
agentRouter.post('/agent/business-services/listings/:listingId/archive', ...gbsEnabled, gbsListingWriteLimiter, gbsProvider.archiveListing);
agentRouter.post('/agent/business-services/listings/:listingId/appeal', ...gbsEnabled, gbsListingWriteLimiter, gbsProvider.submitListingAppeal);
agentRouter.get('/agent/business-services/requests', ...gbsEnabled, gbsProviderReadLimiter, gbsProviderRequests.listRequests);
agentRouter.get('/agent/business-services/requests/:requestRef', ...gbsEnabled, gbsProviderReadLimiter, gbsProviderRequests.getRequest);
agentRouter.get('/agent/business-services/messages', ...gbsEnabled, gbsProviderReadLimiter, gbsMessages.providerThreads);
agentRouter.get('/agent/business-services/requests/:contextRef/messages', ...gbsEnabled, gbsProviderReadLimiter, gbsMessages.providerList(gbsMessages.TYPES.REQUEST));
agentRouter.post('/agent/business-services/requests/:contextRef/messages', ...gbsEnabled, gbsRequestWriteLimiter, gbsMessages.providerSend(gbsMessages.TYPES.REQUEST));
agentRouter.post('/agent/business-services/requests/:requestRef/review', ...gbsEnabled, gbsRequestWriteLimiter, gbsProviderRequests.reviewRequest);
agentRouter.post('/agent/business-services/requests/:requestRef/ready-for-quote', ...gbsEnabled, gbsRequestWriteLimiter, gbsProviderRequests.readyForQuote);
agentRouter.post('/agent/business-services/requests/:requestRef/decline', ...gbsEnabled, gbsRequestWriteLimiter, gbsProviderRequests.declineRequest);
agentRouter.post(
  '/agent/business-services/requests/:requestRef/quote',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsQuoteWriteLimiter,
  gbsProviderQuotes.createQuote
);
agentRouter.get('/agent/business-services/quotes', ...gbsEnabled, gbsProviderReadLimiter, gbsProviderQuotes.listQuotes);
agentRouter.get('/agent/business-services/quotes/:quoteRef', ...gbsEnabled, gbsProviderReadLimiter, gbsProviderQuotes.getQuote);
agentRouter.get('/agent/business-services/quotes/:contextRef/messages', ...gbsEnabled, gbsProviderReadLimiter, gbsMessages.providerList(gbsMessages.TYPES.QUOTE));
agentRouter.post('/agent/business-services/quotes/:contextRef/messages', ...gbsEnabled, gbsQuoteWriteLimiter, gbsMessages.providerSend(gbsMessages.TYPES.QUOTE));
agentRouter.patch(
  '/agent/business-services/quotes/:quoteRef',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsQuoteWriteLimiter,
  gbsProviderQuotes.patchQuote
);
agentRouter.post(
  '/agent/business-services/quotes/:quoteRef/send',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsQuoteWriteLimiter,
  gbsProviderQuotes.sendQuote
);
agentRouter.post(
  '/agent/business-services/quotes/:quoteRef/withdraw',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsQuoteWriteLimiter,
  gbsProviderQuotes.withdrawQuote
);
agentRouter.post(
  '/agent/business-services/quotes/:quoteRef/case',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseWriteLimiter,
  gbsProviderCases.ensureCase
);
agentRouter.get('/agent/business-services/cases', ...gbsEnabled, gbsProviderReadLimiter, gbsProviderCases.listCases);
agentRouter.get('/agent/business-services/cases/:caseRef', ...gbsEnabled, gbsProviderReadLimiter, gbsProviderCases.getCase);
agentRouter.get('/agent/business-services/cases/:contextRef/messages', ...gbsEnabled, gbsProviderReadLimiter, gbsMessages.providerList(gbsMessages.TYPES.CASE));
agentRouter.post('/agent/business-services/cases/:contextRef/messages', ...gbsEnabled, gbsCaseWriteLimiter, gbsMessages.providerSend(gbsMessages.TYPES.CASE));
agentRouter.post(
  '/agent/business-services/cases/:caseRef/start-preparation',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseWriteLimiter,
  gbsProviderCases.startPrep
);
agentRouter.post(
  '/agent/business-services/cases/:caseRef/request-customer-action',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseWriteLimiter,
  gbsProviderCases.requestAction
);
agentRouter.post(
  '/agent/business-services/cases/:caseRef/ready-for-submission',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseWriteLimiter,
  gbsProviderCases.readyForSubmission
);
agentRouter.post(
  '/agent/business-services/cases/:caseRef/unable-to-proceed',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseWriteLimiter,
  gbsProviderCases.unableToProceed
);
agentRouter.post(
  '/agent/business-services/cases/:caseRef/complete-service',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseWriteLimiter,
  gbsProviderCases.completeService
);
agentRouter.patch(
  '/agent/business-services/cases/:caseRef/requirement-facts',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseWriteLimiter,
  gbsProviderCases.updateRequirementFact
);
agentRouter.post(
  '/agent/business-services/cases/:caseRef/requirement-checks',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseWriteLimiter,
  gbsProviderCases.updateRequirementCheck
);
agentRouter.post(
  '/agent/business-services/cases/:caseRef/ra-consent/attest',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseWriteLimiter,
  gbsProviderCases.attestRaConsent
);
agentRouter.get(
  '/agent/business-services/cases/:caseRef/document-requirements',
  ...gbsEnabled,
  gbsProviderReadLimiter,
  gbsProviderCaseDocs.listCaseDocumentRequirements
);
agentRouter.get(
  '/agent/business-services/cases/:caseRef/document-requirements/:requirementRef/file',
  ...gbsEnabled,
  gbsCaseDocumentAccessLimiter,
  gbsProviderCaseDocs.downloadDocument
);
agentRouter.post(
  '/agent/business-services/cases/:caseRef/document-requirements/:requirementRef/review',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseDocumentWriteLimiter,
  gbsProviderCaseDocs.reviewDocument
);
agentRouter.post(
  '/agent/business-services/cases/:caseRef/document-requirements/:requirementRef/reject',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseDocumentWriteLimiter,
  gbsProviderCaseDocs.rejectDocument
);
agentRouter.post(
  '/agent/business-services/cases/:caseRef/document-requirements/:requirementRef/waive',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseDocumentWriteLimiter,
  gbsProviderCaseDocs.waiveDocument
);
agentRouter.get(
  '/agent/business-services/cases/:caseRef/filing-authorization',
  ...gbsEnabled,
  gbsProviderReadLimiter,
  gbsProviderCases.getFilingAuthorization
);
agentRouter.post(
  '/agent/business-services/cases/:caseRef/external-filing/submit-attestation',
  ...gbsEnabled,
  secureTrustedOrigin,
  gbsCaseWriteLimiter,
  gbsProviderCases.attestExternalFiling
);

// ---------------------------------------------------------------------------
// Public — no auth required
// ---------------------------------------------------------------------------

agentRouter.get('/agents/marketplace/posts', marketplace.listPublic);
agentRouter.get('/agents/marketplace/posts/:slug', marketplace.getPublic);
agentRouter.post('/agents/marketplace/posts/:slug/interest', ...studentProductAuth, marketplace.interest);
agentRouter.delete('/agents/marketplace/posts/:slug/interest', ...studentProductAuth, marketplace.withdraw);
agentRouter.get('/agents', agent.listPublicAgents);
agentRouter.get('/agents/:slug', agent.getPublicProfile);
