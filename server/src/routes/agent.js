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
import { secureTrustedOrigin } from '../middleware/secureTrustedOrigin.js';
import {
  employerAuthLimiter,
  refreshLimiter,
} from '../middleware/rateLimit.js';
import * as agentAuth from '../controllers/agentAuthController.js';
import * as agent from '../controllers/agentController.js';

export const agentRouter = Router();

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

agentRouter.post(
  '/auth/agent/register',
  employerAuthLimiter,
  secureTrustedOrigin,
  agentAuth.agentRegister
);
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
  agent.addService
);
agentRouter.patch(
  '/agent/services/:serviceId',
  requireAuth,
  requireAgentAuth,
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

// ---------------------------------------------------------------------------
// Public — no auth required
// ---------------------------------------------------------------------------

agentRouter.get('/agents', agent.listPublicAgents);
agentRouter.get('/agents/:slug', agent.getPublicProfile);
