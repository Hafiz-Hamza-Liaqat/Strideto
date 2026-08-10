export const INSTITUTION_LOGIN_PATH = '/institution/login';

export function isInstitutionPublicAuthPath(pathname = '') {
  return pathname === INSTITUTION_LOGIN_PATH;
}

export function isInstitutionPortalPath(pathname = '') {
  return (pathname === '/institution' || pathname.startsWith('/institution/')) &&
    !isInstitutionPublicAuthPath(pathname);
}

export function isInstitutionRoutePrefix(pathname = '') {
  return pathname === '/institution' || pathname.startsWith('/institution/');
}
