import { Helmet } from 'react-helmet-async';

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

/**
 * Public auth content wrapper. Navbar/footer come from MainLayout so
 * auth ↔ Terms/Privacy does not remount public chrome.
 */
export function AuthLayout({ realmTitle, children }) {
  return (
    <div className="w-full">
      <Helmet>
        <meta name="referrer" content="same-origin" />
      </Helmet>
      {realmTitle ? <p className="sr-only">{realmTitle}</p> : null}
      {children}
    </div>
  );
}

export function withAuthLayout(element, realmTitle) {
  return <AuthLayout realmTitle={realmTitle}>{element}</AuthLayout>;
}

export function AuthCard({ title, subtitle, children }) {
  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-8 shadow-sm">
        {title ? <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1> : null}
        {subtitle ? <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p> : null}
        <div className={title ? 'mt-6' : ''}>{children}</div>
      </div>
    </div>
  );
}
