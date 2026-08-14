import { ROUTES } from '../constants';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';

const SHARED = [
  { path: `${ROUTES.AGENT_DASHBOARD}?home=1`, label: 'Provider Home', end: true, home: true },
  { path: ROUTES.AGENT_PROFILE, label: 'Profile' },
  { path: ROUTES.AGENT_TRUST, label: 'Identity & Organization / Trust Center' },
  { path: ROUTES.AGENT_MESSAGES, label: 'Messages' },
  { path: ROUTES.AGENT_NOTIFICATIONS, label: 'Notifications' },
  { path: ROUTES.AGENT_SETTINGS, label: 'Account Settings' },
  { path: ROUTES.AGENT_HELP, label: 'Help' },
];

const EDUCATION = [
  { path: ROUTES.AGENT_EDUCATION, label: 'Overview' },
  { path: ROUTES.AGENT_VERIFICATION, label: 'Professional Verification' },
  { path: ROUTES.AGENT_SERVICES, label: 'Education & Mobility Services' },
  { path: ROUTES.AGENT_MARKETPLACE, label: 'Marketplace' },
  { path: ROUTES.AGENT_AVAILABILITY, label: 'Availability' },
  { path: ROUTES.AGENT_LEADS, label: 'Student Leads' },
  { path: ROUTES.AGENT_CLIENTS, label: 'Clients' },
  { path: ROUTES.AGENT_CONSULTATIONS, label: 'Consultations' },
  { path: ROUTES.AGENT_CASES, label: 'Cases' },
  { path: ROUTES.AGENT_TRUST, label: 'Reviews' },
];

const BUSINESS = [
  { path: ROUTES.AGENT_BUSINESS_SERVICES, label: 'Overview' },
  { path: ROUTES.AGENT_VERIFICATION, label: 'Business Verification' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES, label: 'Capabilities' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_JURISDICTIONS, label: 'Jurisdictions' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS, label: 'Service Listings' },
];

export function resolveProviderNavDomain(pathname = '') {
  if (pathname.startsWith('/agent/business-services')) return PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES;
  if (
    pathname.startsWith('/agent/education') ||
    pathname.startsWith('/agent/services') ||
    pathname.startsWith('/agent/marketplace') ||
    pathname.startsWith('/agent/availability') ||
    pathname.startsWith('/agent/leads') ||
    pathname.startsWith('/agent/clients') ||
    pathname.startsWith('/agent/consultations') ||
    pathname.startsWith('/agent/cases')
  ) {
    return PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY;
  }
  return null;
}

export function agentNavItems({
  agentType,
  gbsEnabled,
  providerDomainId,
  workspaces = [],
  subjectType,
  subjectId,
} = {}) {
  const domainId = providerDomainId || null;
  const scopedWorkspaces = (subjectType && subjectId)
    ? workspaces.filter((w) => w.subjectType === subjectType && String(w.subjectId) === String(subjectId))
    : workspaces;
  const hasEducation = scopedWorkspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY)
    || (!scopedWorkspaces.length && !subjectType && domainId !== PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);
  const hasBusiness = gbsEnabled && scopedWorkspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);

  // URL path is not authority. Business operational nav is only for an authorized
  // business_services workspace on an exact subject.
  let domainNav = [];
  if (domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) {
    domainNav = hasBusiness ? BUSINESS : [];
  } else if (domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY) {
    domainNav = EDUCATION;
  } else if (hasEducation && !hasBusiness) {
    domainNav = EDUCATION;
  }

  const items = [
    ...SHARED,
    agentType === 'agency' ? { path: ROUTES.AGENT_TEAM, label: 'Team' } : null,
    ...domainNav,
  ];
  return items.filter(Boolean);
}

export { BUSINESS as BUSINESS_SERVICES_NAV, EDUCATION as EDUCATION_MOBILITY_NAV };
