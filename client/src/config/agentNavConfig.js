import { ROUTES } from '../constants';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';

const EDUCATION = [
  { path: ROUTES.AGENT_EDUCATION, label: 'Overview', end: true },
  { path: ROUTES.AGENT_EDUCATION_PROFILE, label: 'Education Profile' },
  { path: ROUTES.AGENT_EDUCATION_LEADS, label: 'Student Leads' },
  { path: ROUTES.AGENT_EDUCATION_CLIENTS, label: 'Clients' },
  { path: ROUTES.AGENT_EDUCATION_CONSULTATIONS, label: 'Consultations' },
  { path: ROUTES.AGENT_EDUCATION_CASES, label: 'Cases' },
  { path: ROUTES.AGENT_EDUCATION_SERVICES, label: 'My Education Services' },
  { path: ROUTES.AGENT_EDUCATION_MARKETPLACE, label: 'Marketplace' },
  { path: ROUTES.AGENT_EDUCATION_AVAILABILITY, label: 'Availability' },
  { path: ROUTES.AGENT_EDUCATION_VERIFICATION, label: 'Professional Verification' },
  { path: ROUTES.AGENT_EDUCATION_REVIEWS, label: 'Reviews' },
  { path: ROUTES.AGENT_EDUCATION_TEAM, label: 'Education Team' },
  { path: ROUTES.AGENT_EDUCATION_MESSAGES, label: 'Messages' },
  { path: ROUTES.AGENT_EDUCATION_NOTIFICATIONS, label: 'Notifications' },
  { path: ROUTES.AGENT_EDUCATION_HELP, label: 'Help' },
];

const BUSINESS = [
  { path: ROUTES.AGENT_BUSINESS_SERVICES, label: 'Overview', end: true },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_PROFILE, label: 'Business Profile' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS, label: 'Requests' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_QUOTES, label: 'Quotes' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_CASES, label: 'Cases' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES, label: 'Capabilities' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_JURISDICTIONS, label: 'Jurisdictions' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS, label: 'My Services' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_VERIFICATION, label: 'Business Verification' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_TEAM, label: 'Business Team' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_MESSAGES, label: 'Messages' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_NOTIFICATIONS, label: 'Notifications' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_HELP, label: 'Help' },
];

const EDUCATION_GROUPS = [
  {
    id: 'education-overview',
    label: 'Education & Mobility',
    items: EDUCATION.filter((item) => item.path === ROUTES.AGENT_EDUCATION),
  },
  {
    id: 'education-profile',
    label: 'Profile',
    items: EDUCATION.filter((item) => item.path === ROUTES.AGENT_EDUCATION_PROFILE),
  },
  {
    id: 'education-work',
    label: 'Work',
    items: EDUCATION.filter((item) => [
      ROUTES.AGENT_EDUCATION_LEADS,
      ROUTES.AGENT_EDUCATION_CLIENTS,
      ROUTES.AGENT_EDUCATION_CONSULTATIONS,
      ROUTES.AGENT_EDUCATION_CASES,
    ].includes(item.path)),
  },
  {
    id: 'education-services',
    label: 'Services',
    items: EDUCATION.filter((item) => [
      ROUTES.AGENT_EDUCATION_SERVICES,
      ROUTES.AGENT_EDUCATION_MARKETPLACE,
      ROUTES.AGENT_EDUCATION_AVAILABILITY,
    ].includes(item.path)),
  },
  {
    id: 'education-trust',
    label: 'Trust',
    items: EDUCATION.filter((item) => (
      item.path === ROUTES.AGENT_EDUCATION_VERIFICATION || item.path === ROUTES.AGENT_EDUCATION_REVIEWS
    )),
  },
  {
    id: 'education-team',
    label: 'Team & Communication',
    items: EDUCATION.filter((item) => [
      ROUTES.AGENT_EDUCATION_TEAM,
      ROUTES.AGENT_EDUCATION_MESSAGES,
      ROUTES.AGENT_EDUCATION_NOTIFICATIONS,
    ].includes(item.path)),
  },
  {
    id: 'education-support',
    label: 'Support',
    items: EDUCATION.filter((item) => item.path === ROUTES.AGENT_EDUCATION_HELP),
  },
];

const BUSINESS_GROUPS = [
  {
    id: 'business-overview',
    label: 'Business Services',
    items: BUSINESS.filter((item) => item.path === ROUTES.AGENT_BUSINESS_SERVICES),
  },
  {
    id: 'business-profile',
    label: 'Profile',
    items: BUSINESS.filter((item) => item.path === ROUTES.AGENT_BUSINESS_SERVICES_PROFILE),
  },
  {
    id: 'business-work',
    label: 'Work',
    items: BUSINESS.filter((item) => [
      ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS,
      ROUTES.AGENT_BUSINESS_SERVICES_QUOTES,
      ROUTES.AGENT_BUSINESS_SERVICES_CASES,
    ].includes(item.path)),
  },
  {
    id: 'business-setup',
    label: 'Service Setup',
    items: BUSINESS.filter((item) => [
      ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES,
      ROUTES.AGENT_BUSINESS_SERVICES_JURISDICTIONS,
      ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS,
    ].includes(item.path)),
  },
  {
    id: 'business-trust',
    label: 'Trust & Eligibility',
    items: BUSINESS.filter((item) => item.path === ROUTES.AGENT_BUSINESS_SERVICES_VERIFICATION),
  },
  {
    id: 'business-team',
    label: 'Team & Communication',
    items: BUSINESS.filter((item) => [
      ROUTES.AGENT_BUSINESS_SERVICES_TEAM,
      ROUTES.AGENT_BUSINESS_SERVICES_MESSAGES,
      ROUTES.AGENT_BUSINESS_SERVICES_NOTIFICATIONS,
    ].includes(item.path)),
  },
  {
    id: 'business-support',
    label: 'Support',
    items: BUSINESS.filter((item) => item.path === ROUTES.AGENT_BUSINESS_SERVICES_HELP),
  },
];

/**
 * Resolve which single nav leaf should be active across all visible items.
 * Longest path wins; Overview/home use end semantics.
 */
export function resolveActiveNavPath(location, items = []) {
  const pathname = String(location?.pathname || '').replace(/\/$/, '') || '/';
  const search = location?.search || '';
  let best = null;
  for (const item of items) {
    const itemPath = String(item.path || '').split('?')[0].replace(/\/$/, '') || '/';
    const isHome = item.home && isProviderDashboardPath(pathname, search);
    const isMatch = item.home
      ? isHome
      : item.end
        ? pathname === itemPath
        : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
    if (!isMatch) continue;
    if (!best || itemPath.length > (best.split('?')[0].replace(/\/$/, '') || '/').length) {
      best = item.path;
    }
  }
  return best;
}

export function resolveProviderNavDomain(pathname = '') {
  if (pathname.startsWith('/agent/business-services')) return PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES;
  if (pathname.startsWith('/agent/education')) return PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY;
  if (
    pathname.startsWith('/agent/services') ||
    pathname.startsWith('/agent/marketplace') ||
    pathname.startsWith('/agent/availability') ||
    pathname.startsWith('/agent/leads') ||
    pathname.startsWith('/agent/clients') ||
    pathname.startsWith('/agent/consultations') ||
    pathname.startsWith('/agent/cases') ||
    pathname.startsWith('/agent/verification') ||
    pathname.startsWith('/agent/reviews')
  ) {
    return PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY;
  }
  return null;
}

export function isProviderDashboardPath(pathname = '', search = '') {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path !== ROUTES.AGENT_DASHBOARD) return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get('home') === '1' || !resolveProviderNavDomain(pathname);
}

export function dashboardNavLabel(domainId) {
  if (domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) return 'Business Services';
  if (domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY) return 'Education & Mobility';
  return '';
}

export function overviewPathForDomain(domainId) {
  if (domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) return ROUTES.AGENT_BUSINESS_SERVICES;
  if (domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY) return ROUTES.AGENT_EDUCATION;
  return `${ROUTES.AGENT_DASHBOARD}?home=1`;
}

function settingsItemForDomain(domainId) {
  if (domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) {
    return { path: ROUTES.AGENT_BUSINESS_SERVICES_SETTINGS, label: 'Settings', end: true };
  }
  if (domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY) {
    return { path: ROUTES.AGENT_EDUCATION_SETTINGS, label: 'Settings', end: true };
  }
  return null;
}

export function agentNavGroups({
  gbsEnabled,
  providerDomainId,
  workspaces = [],
  subjectType,
  subjectId,
  isProviderHome = false,
} = {}) {
  const scopedWorkspaces = (subjectType && subjectId)
    ? workspaces.filter((w) => w.subjectType === subjectType && String(w.subjectId) === String(subjectId))
    : workspaces;
  const hasBusiness = gbsEnabled && scopedWorkspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);

  if (isProviderHome) {
    return {
      operationalDomainId: null,
      domainGroups: [],
      settingsItem: null,
      accountItems: [],
      accountGroup: null,
    };
  }

  const routeDomainId = providerDomainId || null;
  if (routeDomainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) {
    const domainNav = hasBusiness ? BUSINESS : [];
    return {
      operationalDomainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      domainGroups: domainNav === BUSINESS ? BUSINESS_GROUPS : [],
      settingsItem: settingsItemForDomain(PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES),
      accountItems: [],
      accountGroup: null,
    };
  }

  if (routeDomainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY) {
    return {
      operationalDomainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
      domainGroups: EDUCATION_GROUPS,
      settingsItem: settingsItemForDomain(PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY),
      accountItems: [],
      accountGroup: null,
    };
  }

  return {
    operationalDomainId: null,
    domainGroups: [],
    settingsItem: null,
    accountItems: [],
    accountGroup: null,
  };
}

export function agentNavItems(options = {}) {
  const { domainGroups, settingsItem } = agentNavGroups(options);
  return [
    ...domainGroups.flatMap((group) => group.items),
    settingsItem,
  ].filter(Boolean);
}

export { BUSINESS as BUSINESS_SERVICES_NAV, EDUCATION as EDUCATION_MOBILITY_NAV };
