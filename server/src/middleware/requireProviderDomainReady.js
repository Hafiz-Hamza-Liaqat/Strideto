/**
 * Required Provider Domain onboarding cannot be bypassed via operational URLs.
 * Legacy agents (missing initialization) continue. Pending new agents are denied.
 */
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { needsRequiredProviderDomainOnboarding } from '../../../shared/provider/providerDomainSelection.js';

const ALLOWED_WHEN_PENDING = [
  '/api/auth/agent/me',
  '/api/auth/agent/logout',
  '/api/auth/agent/logout-all',
  '/api/auth/agent/refresh-token',
  '/api/agent/provider-domains',
  '/api/agent/profile',
];

function isAllowedPendingPath(url = '') {
  const path = url.split('?')[0];
  return ALLOWED_WHEN_PENDING.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function requireProviderDomainReady(req, res, next) {
  return (async () => {
    const id = req.agent?.agentAccountId;
    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    if (isAllowedPendingPath(req.originalUrl || req.path || '')) return next();
    const profile = await AgentProfile.findOne({ agentAccountId: id })
      .select('providerDomainInitializationState')
      .lean();
    if (needsRequiredProviderDomainOnboarding(profile?.providerDomainInitializationState)) {
      return res.status(403).json({
        error: 'Complete required provider-domain onboarding before using the workspace',
        code: 'provider_domain_onboarding_required',
      });
    }
    return next();
  })().catch(next);
}
