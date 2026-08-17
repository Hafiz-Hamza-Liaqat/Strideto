import { Navigate, useLocation, useParams } from 'react-router-dom';
import { ROUTES } from '../../constants';

function withLocationSuffix(pathname, location) {
  return `${pathname}${location.search || ''}${location.hash || ''}`;
}

export function LegacyAgentRedirect({ to }) {
  const location = useLocation();
  return <Navigate to={withLocationSuffix(to, location)} replace />;
}

export function LegacyEducationParamRedirect({ build }) {
  const location = useLocation();
  const params = useParams();
  return <Navigate to={withLocationSuffix(build(params), location)} replace />;
}

const SHARED_EDUCATION = {
  profile: ROUTES.AGENT_EDUCATION_PROFILE,
  team: ROUTES.AGENT_EDUCATION_TEAM,
  messages: ROUTES.AGENT_EDUCATION_MESSAGES,
  notifications: ROUTES.AGENT_EDUCATION_NOTIFICATIONS,
  help: ROUTES.AGENT_EDUCATION_HELP,
  settings: ROUTES.AGENT_EDUCATION_SETTINGS,
};

const SHARED_BUSINESS = {
  profile: ROUTES.AGENT_BUSINESS_SERVICES_PROFILE,
  team: ROUTES.AGENT_BUSINESS_SERVICES_TEAM,
  messages: ROUTES.AGENT_BUSINESS_SERVICES_MESSAGES,
  notifications: ROUTES.AGENT_BUSINESS_SERVICES_NOTIFICATIONS,
  help: ROUTES.AGENT_BUSINESS_SERVICES_HELP,
  settings: ROUTES.AGENT_BUSINESS_SERVICES_SETTINGS,
};

function explicitWorkspace(params) {
  const raw = String(params.get('workspace') || params.get('domain') || '').trim();
  if (raw === 'education' || raw === 'education_mobility') return 'education';
  if (raw === 'business' || raw === 'business_services') return 'business';
  return null;
}

export function LegacySharedAgentRedirect({ resource }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const workspace = explicitWorkspace(params);
  const next = new URLSearchParams(location.search);
  next.delete('workspace');
  next.delete('domain');
  const suffix = `${next.toString() ? `?${next.toString()}` : ''}${location.hash || ''}`;

  if (workspace === 'education' && SHARED_EDUCATION[resource]) {
    return <Navigate to={`${SHARED_EDUCATION[resource]}${suffix}`} replace />;
  }
  if (workspace === 'business' && SHARED_BUSINESS[resource]) {
    return <Navigate to={`${SHARED_BUSINESS[resource]}${suffix}`} replace />;
  }

  const home = new URLSearchParams();
  home.set('home', '1');
  const subjectType = params.get('subjectType');
  const subjectId = params.get('subjectId');
  if (subjectType) home.set('subjectType', subjectType);
  if (subjectId) home.set('subjectId', subjectId);
  return <Navigate to={`${ROUTES.AGENT_DASHBOARD}?${home.toString()}${location.hash || ''}`} replace />;
}
