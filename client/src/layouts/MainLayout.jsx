import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { GlobalSeo } from '../components/seo';
import { CookieConsent } from '../components/consent/CookieConsent';
import { SiteContentProvider } from '../context/SiteContentContext';
import { AdSlotsProvider } from '../context/AdSlotsContext';
import { SkipLink } from '../components/a11y/SkipLink';
import { FeedbackWidget } from '../components/feedback/FeedbackWidget';
import { StudentPortalNav } from '../components/student/StudentPortalNav';
import { isAdminShellPath, isAuthShellPath } from './AuthLayout';

export function MainLayout({ children }) {
  const { pathname } = useLocation();
  const hidePublicChrome = isAdminShellPath(pathname) || isAuthShellPath(pathname);
  return (
    <SiteContentProvider>
      <AdSlotsProvider>
        <div className="min-h-screen flex flex-col bg-bg-main dark:bg-secondary min-w-0 overflow-x-hidden">
          <SkipLink />
          <GlobalSeo />
          {hidePublicChrome ? null : <Navbar />}
          {hidePublicChrome ? null : <StudentPortalNav />}
          <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 w-full max-w-full outline-none">
            {children || <Outlet />}
          </main>
          {hidePublicChrome ? null : <Footer />}
          {hidePublicChrome ? null : <CookieConsent />}
          {hidePublicChrome ? null : <FeedbackWidget />}
        </div>
      </AdSlotsProvider>
    </SiteContentProvider>
  );
}

export function MainLayoutWrapper() {
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
}
