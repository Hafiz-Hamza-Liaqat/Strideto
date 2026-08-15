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
  providerDomainWriteLimiter,
  agentTeamInviteLimiter,
} from '../middleware/rateLimit.js';
import { requireBusinessServicesEnabled } from '../middleware/requireBusinessServices.js';
import { requireProviderDomainReady } from '../middleware/requireProviderDomainReady.js';
import * as gbsProvider from '../controllers/gbsProviderController.js';
import * as gbsProviderRequests from '../controllers/gbsProviderRequestController.js';
import * as gbsProviderQuotes from '../controllers/gbsProviderQuoteController.js';
import * as gbsProviderCases from '../controllers/gbsProviderCaseController.js';
import * as providerDomain from '../controllers/providerDomainController.js';
import { requireTurnstileWhenEnabled } from '../middleware/turnstile.js';
import { requireAgentEmailVerified } from '../middleware/requireEmailVerified.js';
import * as agentAuth from '../controllers/agentAuthController.js';
import * as agent from '../controllers/agentController.js';
import * as marketplace from '../controllers/agentMarketplaceController.js';

export const agentRouter = Router();

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

agentRouter.post(
  '/auth/agent/register',
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
  requireAuth,
  requireAgentAuth,
  agent.getDashboard
);

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

agentRouter.get(
  '/agent/profile',
  requireAuth,
  requireAgentAuth,
  agent.getProfile
);
agentRouter.patch(
  '/agent/profile',
  requireAuth,
  requireAgentAuth,
  agent.patchProfile
);
agentRouter.get(
  '/agent/profile/completeness',
  requireAuth,
  requireAgentAuth,
  agent.getCompleteness
);

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

agentRouter.post(
  '/agent/onboarding/step',
  requireAuth,
  requireAgentAuth,
  agent.submitOnboardingStep
);

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

agentRouter.get(
  '/agent/verification',
  requireAuth,
  requireAgentAuth,
  agent.getVerification
);

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

agentRouter.get(
  '/agent/services',
  requireAuth,
  requireAgentAuth,
  agent.listServices
);
agentRouter.post(
  '/agent/services',
  requireAuth,
  requireAgentAuth,
  requireProviderDomainReady,
  agent.addService
);
agentRouter.patch(
  '/agent/services/:serviceId',
  requireAuth,
  requireAgentAuth,
  requireProviderDomainReady,
  agent.editService
);

// ---------------------------------------------------------------------------
// Team (Agency)
// ---------------------------------------------------------------------------

agentRouter.get(
  '/agent/team',
  requireAuth,
  requireAgentAuth,
  agent.listTeamMembers
);
agentRouter.patch(
  '/agent/team/member',
  requireAuth,
  requireAgentAuth,
  agent.changeMemberRole
);
agentRouter.patch(
  '/agent/team/member/status',
  requireAuth,
  requireAgentAuth,
  agent.changeMemberStatus
);
agentRouter.get(
  '/agent/team/invites',
  requireAuth,
  requireAgentAuth,
  agent.listInvites
);
agentRouter.post(
  '/agent/team/invites',
  requireAuth,
  requireAgentAuth,
  agentTeamInviteLimiter,
  agent.createInvite
);
agentRouter.patch(
  '/agent/team/member/domain-access',
  requireAuth,
  requireAgentAuth,
  agentTeamInviteLimiter,
  agent.changeMemberDomainAccess
);
agentRouter.post(
  '/agent/team/invites/:invitationId/revoke',
  requireAuth,
  requireAgentAuth,
  agent.revokeInvite
);
agentRouter.get(
  '/auth/agent/invitations/preview',
  agent.previewInvite
);
agentRouter.post(
  '/auth/agent/invitations/accept',
  requireAuth,
  requireAgentAuth,
  agent.acceptInvite
);

// ---------------------------------------------------------------------------
// Leads / Clients (foundation)
// ---------------------------------------------------------------------------

agentRouter.get(
  '/agent/leads',
  requireAuth,
  requireAgentAuth,
  agent.listLeads
);
agentRouter.patch(
  '/agent/leads/:leadId',
  requireAuth,
  requireAgentAuth,
  agent.patchLeadStatus
);
agentRouter.get(
  '/agent/clients',
  requireAuth,
  requireAgentAuth,
  agent.listClients
);
agentRouter.get(
  '/agent/verification/sources',
  requireAuth,
  requireAgentAuth,
  agent.getVerificationSources
);
agentRouter.get(
  '/agent/usage-billing',
  requireAuth,
  requireAgentAuth,
  agent.getUsageBilling
);
agentRouter.get(
  '/agent/commerce/readiness',
  requireAuth,
  requireAgentAuth,
  agent.getCommerceReadiness
);
agentRouter.get(
  '/agent/messages',
  requireAuth,
  requireAgentAuth,
  agent.listMessageHub
);
agentRouter.get(
  '/agent/vault/grants',
  requireAuth,
  requireAgentAuth,
  agent.listVaultGrants
);

// Structured Agent marketplace authoring
agentRouter.get('/agent/marketplace/counts', requireAuth, requireAgentAuth, marketplace.counts);
agentRouter.get('/agent/marketplace', requireAuth, requireAgentAuth, marketplace.listOwn);
agentRouter.post('/agent/marketplace', requireAuth, requireAgentAuth, requireAgentEmailVerified(), requireProviderDomainReady, marketplace.create);
agentRouter.get('/agent/marketplace/:postId', requireAuth, requireAgentAuth, marketplace.getOwn);
agentRouter.patch('/agent/marketplace/:postId', requireAuth, requireAgentAuth, marketplace.update);
agentRouter.post('/agent/marketplace/:postId/submit', requireAuth, requireAgentAuth, requireAgentEmailVerified(), marketplace.submit);
agentRouter.post('/agent/marketplace/:postId/archive', requireAuth, requireAgentAuth, marketplace.archive);

const gbsEnabled = [requireAuth, requireAgentAuth, requireProviderDomainReady, requireBusinessServicesEnabled];

agentRouter.get('/agent/provider-domains/catalog', requireAuth, requireAgentAuth, providerDomain.getCatalog);
agentRouter.get('/agent/provider-domains/home', requireAuth, requireAgentAuth, providerDomain.getHome);
agentRouter.get('/agent/provider-domains/context', requireAuth, requireAgentAuth, providerDomain.getContext);
agentRouter.post(
  '/agent/provider-domains/onboarding',
  requireAuth,
  requireAgentAuth,
  providerDomainWriteLimiter,
  providerDomain.completeOnboarding
);
agentRouter.post(
  '/agent/provider-domains',
  requireAuth,
  requireAgentAuth,
  requireProviderDomainReady,
  providerDomainWriteLimiter,
  providerDomain.addDomain
);

agentRouter.get('/agent/business-services/enabled', requireAuth, requireAgentAuth, gbsProvider.getEnabled);
agentRouter.get('/agent/business-services/context', ...gbsEnabled, gbsProviderReadLimiter, gbsProvider.getContext);
agentRouter.get('/agent/business-services/overview', ...gbsEnabled, gbsProviderReadLimiter, gbsProvider.getOverview);
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
agentRouter.get('/agent/business-services/requests', ...gbsEnabled, gbsProviderReadLimiter, gbsProviderRequests.listRequests);
agentRouter.get('/agent/business-services/requests/:requestRef', ...gbsEnabled, gbsProviderReadLimiter, gbsProviderRequests.getRequest);
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

// ---------------------------------------------------------------------------
// Public — no auth required
// ---------------------------------------------------------------------------

agentRouter.get('/agents/marketplace/posts', marketplace.listPublic);
agentRouter.get('/agents/marketplace/posts/:slug', marketplace.getPublic);
agentRouter.post('/agents/marketplace/posts/:slug/interest', ...studentProductAuth, marketplace.interest);
agentRouter.delete('/agents/marketplace/posts/:slug/interest', ...studentProductAuth, marketplace.withdraw);
agentRouter.get('/agents', agent.listPublicAgents);
agentRouter.get('/agents/:slug', agent.getPublicProfile);
