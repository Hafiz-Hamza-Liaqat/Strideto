import { ROUTES } from '../constants';

/**
 * Final Agent / Agency IA (Phase 5).
 * Team is shown only for agency accounts. No dead entries.
 */
export function agentNavItems({ agentType, gbsEnabled } = {}) {
  const items = [
    { path: ROUTES.AGENT_DASHBOARD, label: 'Dashboard', end: true },
    { path: ROUTES.AGENT_PROFILE, label: 'Profile' },
    { path: ROUTES.AGENT_VERIFICATION, label: 'Verification' },
    { path: ROUTES.AGENT_SERVICES, label: 'Services' },
    gbsEnabled ? { path: ROUTES.AGENT_BUSINESS_SERVICES, label: 'Business Services' } : null,
    { path: ROUTES.AGENT_MARKETPLACE, label: 'Marketplace' },
    { path: ROUTES.AGENT_AVAILABILITY, label: 'Availability' },
    { path: ROUTES.AGENT_LEADS, label: 'Leads' },
    { path: ROUTES.AGENT_CLIENTS, label: 'Clients' },
    { path: ROUTES.AGENT_CONSULTATIONS, label: 'Consultations' },
    { path: ROUTES.AGENT_CASES, label: 'Cases' },
    { path: ROUTES.AGENT_MESSAGES, label: 'Messages' },
    { path: ROUTES.AGENT_TRUST, label: 'Trust / Reviews' },
    agentType === 'agency' ? { path: ROUTES.AGENT_TEAM, label: 'Team' } : null,
    { path: ROUTES.AGENT_NOTIFICATIONS, label: 'Notifications' },
    { path: ROUTES.AGENT_USAGE_BILLING, label: 'Usage & Billing' },
    { path: ROUTES.AGENT_COMMERCE, label: 'Commerce / Payouts' },
    { path: ROUTES.AGENT_SETTINGS, label: 'Settings' },
    { path: ROUTES.AGENT_GUIDELINES, label: 'Help / Guidelines' },
  ];
  return items.filter(Boolean);
}
