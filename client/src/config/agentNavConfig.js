import { ROUTES } from '../constants';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';
import { authorizedDomainIdsForSubject } from './providerWorkspacePref.js';

const PROVIDER_DASHBOARD = {
  path: `${ROUTES.AGENT_DASHBOARD}?home=1`,
  label: 'Provider Dashboard',
  end: true,
  home: true,
};

const SHARED = [
  { path: `${ROUTES.AGENT_DASHBOARD}?home=1`, label: 'Provider Dashboard', end: true, home: true },
  { path: ROUTES.AGENT_PROFILE, label: 'Profile' },
  { path: ROUTES.AGENT_TRUST, label: 'Trust Center' },
  { path: ROUTES.AGENT_MESSAGES, label: 'Messages' },
  { path: ROUTES.AGENT_NOTIFICATIONS, label: 'Notifications' },
  { path: ROUTES.AGENT_SETTINGS, label: 'Account Settings' },
  { path: ROUTES.AGENT_HELP, label: 'Help' },
];

const EDUCATION = [
  { path: ROUTES.AGENT_EDUCATION, label: 'Overview' },
  { path: ROUTES.AGENT_LEADS, label: 'Student Leads' },
  { path: ROUTES.AGENT_CLIENTS, label: 'Clients' },
  { path: ROUTES.AGENT_CONSULTATIONS, label: 'Consultations' },
  { path: ROUTES.AGENT_CASES, label: 'Cases' },
  { path: ROUTES.AGENT_SERVICES, label: 'Education & Mobility Services' },
  { path: ROUTES.AGENT_MARKETPLACE, label: 'Marketplace' },
  { path: ROUTES.AGENT_AVAILABILITY, label: 'Availability' },
  { path: ROUTES.AGENT_VERIFICATION, label: 'Professional Verification' },
  { path: ROUTES.AGENT_TRUST, label: 'Reviews' },
];

const BUSINESS = [
  { path: ROUTES.AGENT_BUSINESS_SERVICES, label: 'Overview' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS, label: 'Requests' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_QUOTES, label: 'Quotes' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_CASES, label: 'Cases' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES, label: 'Capabilities' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_JURISDICTIONS, label: 'Jurisdictions' },
  { path: ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS, label: 'My Services' },
  { path: ROUTES.AGENT_VERIFICATION, label: 'Business Verification' },
];

const EDUCATION_GROUPS = [
  {
    id: 'education-overview',
    label: 'Education & Mobility',
    items: EDUCATION.filter((item) => item.path === ROUTES.AGENT_EDUCATION),
  },
  {
    id: 'education-work',
    label: 'Work',
    items: EDUCATION.filter((item) => [
      ROUTES.AGENT_LEADS,
      ROUTES.AGENT_CLIENTS,
      ROUTES.AGENT_CONSULTATIONS,
      ROUTES.AGENT_CASES,
    ].includes(item.path)),
  },
  {
    id: 'education-services',
    label: 'Services',
    items: EDUCATION.filter((item) => [
      ROUTES.AGENT_SERVICES,
      ROUTES.AGENT_MARKETPLACE,
      ROUTES.AGENT_AVAILABILITY,
    ].includes(item.path)),
  },
  {
    id: 'education-trust',
    label: 'Trust',
    items: EDUCATION.filter((item) => item.path === ROUTES.AGENT_VERIFICATION || item.label === 'Reviews'),
  },
];

const BUSINESS_GROUPS = [
  {
    id: 'business-overview',
    label: 'Business Services',
    items: BUSINESS.filter((item) => item.path === ROUTES.AGENT_BUSINESS_SERVICES),
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
    items: BUSINESS.filter((item) => item.path === ROUTES.AGENT_VERIFICATION),
  },
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
  return ROUTES.AGENT_DASHBOARD;
}

function resolveOperationalDomainId({
  providerDomainId,
  workspaces = [],
  subjectType,
  subjectId,
  isProviderHome = false,
  preferredDomainId = null,
}) {
  if (isProviderHome) return null;
  const scopedWorkspaces = (subjectType && subjectId)
    ? workspaces.filter((w) => w.subjectType === subjectType && String(w.subjectId) === String(subjectId))
    : workspaces;
  const authorized = new Set(
    authorizedDomainIdsForSubject(workspaces, subjectType && subjectId ? { subjectType, subjectId } : null)
  );
  if (providerDomainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) {
    return scopedWorkspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES)
      ? PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES
      : null;
  }
  if (providerDomainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY) {
    return PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY;
  }
  if (preferredDomainId && (authorized.size === 0 || authorized.has(preferredDomainId))) {
    if (preferredDomainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) {
      return scopedWorkspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES)
        ? PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES
        : null;
    }
    if (preferredDomainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY) {
      const hasEducation = scopedWorkspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY)
        || (!scopedWorkspaces.length && !subjectType);
      return hasEducation ? PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY : null;
    }
  }
  const hasEducation = scopedWorkspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY)
    || (!scopedWorkspaces.length && !subjectType && providerDomainId !== PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);
  const hasBusiness = scopedWorkspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);
  if (hasEducation && !hasBusiness) return PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY;
  if (hasBusiness && !hasEducation) return PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES;
  return null;
}

export function agentNavGroups({
  agentType,
  gbsEnabled,
  providerDomainId,
  workspaces = [],
  subjectType,
  subjectId,
  isProviderHome = false,
  preferredDomainId = null,
} = {}) {
  const domainId = providerDomainId || null;
  const scopedWorkspaces = (subjectType && subjectId)
    ? workspaces.filter((w) => w.subjectType === subjectType && String(w.subjectId) === String(subjectId))
    : workspaces;
  const hasEducation = scopedWorkspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY)
    || (!scopedWorkspaces.length && !subjectType && domainId !== PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);
  const hasBusiness = gbsEnabled && scopedWorkspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES);

  const operationalDomainId = resolveOperationalDomainId({
    providerDomainId: domainId,
    workspaces,
    subjectType,
    subjectId,
    isProviderHome,
    preferredDomainId,
  });

  // URL path is not authority. Business operational nav is only for an authorized
  // business_services workspace on an exact subject.
  let domainNav = [];
  if (operationalDomainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) {
    domainNav = hasBusiness ? BUSINESS : [];
  } else if (operationalDomainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY) {
    domainNav = EDUCATION;
  } else if (domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES) {
    domainNav = hasBusiness ? BUSINESS : [];
  } else if (domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY) {
    domainNav = EDUCATION;
  } else if (!isProviderHome && hasEducation && !hasBusiness) {
    domainNav = EDUCATION;
  }

  const domainGroups = domainNav === BUSINESS
    ? BUSINESS_GROUPS
    : domainNav === EDUCATION
      ? EDUCATION_GROUPS
      : [];

  const subjectKind = scopedWorkspaces[0]?.kind;
  const showTeam = agentType === 'agency'
    || subjectKind === 'agency'
    || subjectType === 'organization';

  const accountItems = [
    PROVIDER_DASHBOARD,
    { path: ROUTES.AGENT_PROFILE, label: 'Profile' },
    { path: ROUTES.AGENT_TRUST, label: 'Trust Center' },
    showTeam ? { path: ROUTES.AGENT_TEAM, label: 'Team' } : null,
    { path: ROUTES.AGENT_MESSAGES, label: 'Messages' },
    { path: ROUTES.AGENT_NOTIFICATIONS, label: 'Notifications' },
    { path: ROUTES.AGENT_SETTINGS, label: 'Account Settings' },
    { path: ROUTES.AGENT_HELP, label: 'Help' },
  ].filter(Boolean);

  return {
    operationalDomainId,
    domainGroups,
    accountItems,
    accountGroup: { id: 'account', label: 'Account & Support', items: accountItems },
  };
}

export function agentNavItems(options = {}) {
  const { domainGroups } = agentNavGroups(options);
  const domainNav = domainGroups.flatMap((group) => group.items);
  const items = [
    ...SHARED,
    options.agentType === 'agency' ? { path: ROUTES.AGENT_TEAM, label: 'Team' } : null,
    ...domainNav,
  ];
  return items.filter(Boolean);
}

export { BUSINESS as BUSINESS_SERVICES_NAV, EDUCATION as EDUCATION_MOBILITY_NAV };
