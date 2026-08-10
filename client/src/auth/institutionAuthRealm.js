export const INSTITUTION_LOGIN_PATH = '/institution/login';
export const INSTITUTION_REGISTER_PATH = '/institution/register';

export function isInstitutionPublicAuthPath(pathname = '') {
  return pathname === INSTITUTION_LOGIN_PATH || pathname === INSTITUTION_REGISTER_PATH;
}

export function isInstitutionPortalPath(pathname = '') {
  return (pathname === '/institution' || pathname.startsWith('/institution/')) &&
    !isInstitutionPublicAuthPath(pathname);
}

export function isInstitutionRoutePrefix(pathname = '') {
  return pathname === '/institution' || pathname.startsWith('/institution/');
}
