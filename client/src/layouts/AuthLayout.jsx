import { Link } from 'react-router-dom';
import { Logo } from '../components/brand/Logo';
import { ROUTES } from '../constants';

export function isAuthShellPath(pathname = '') {
  return (
    /^\/(login|register|forgot-password|reset-password|accept-invitation)(\/|$)/.test(pathname)
    || pathname.startsWith('/auth/')
    || /^\/(employer|agent|institution)\/(login|register|forgot-password|reset-password|accept-invitation)/.test(pathname)
  );
}

export function isAdminShellPath(pathname = '') {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function AuthLayout({ realmTitle, children, showLogo = false }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg-main dark:bg-secondary">
      {showLogo ? (
        <div className="px-4 pt-8 flex justify-center">
          <Logo height={32} />
        </div>
      ) : null}
      {realmTitle ? <p className="sr-only">{realmTitle}</p> : null}
      <div className="flex-1">{children}</div>
      <footer className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
        <Link className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" to={ROUTES.TERMS}>Terms</Link>
        <Link className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" to={ROUTES.PRIVACY_POLICY}>Privacy</Link>
        <Link className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" to={ROUTES.HOME}>Back to Strideto</Link>
      </footer>
    </div>
  );
}

export function withAuthLayout(element, realmTitle) {
  return <AuthLayout realmTitle={realmTitle}>{element}</AuthLayout>;
}
