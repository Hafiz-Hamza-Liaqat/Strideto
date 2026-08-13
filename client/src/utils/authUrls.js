import { ROUTES } from '../constants';

export function pendingVerifyPath(realm = 'user') {
  const params = new URLSearchParams({ pending: '1' });
  if (realm && realm !== 'user') params.set('realm', realm);
  return `${ROUTES.VERIFY_EMAIL}?${params.toString()}`;
}

export function realmLoginPath(realm = 'user') {
  if (realm === 'employer') return ROUTES.EMPLOYER_LOGIN;
  if (realm === 'agent') return ROUTES.AGENT_LOGIN;
  if (realm === 'institution') return ROUTES.INSTITUTION_LOGIN;
  return ROUTES.LOGIN;
}

export function realmDashboardPath(realm = 'user') {
  if (realm === 'employer') return ROUTES.EMPLOYER_DASHBOARD;
  if (realm === 'agent') return ROUTES.AGENT_DASHBOARD;
  if (realm === 'institution') return ROUTES.INSTITUTION_DASHBOARD;
  return ROUTES.DASHBOARD;
}
