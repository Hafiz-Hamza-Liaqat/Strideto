import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { useLanguage } from '../../context/LanguageContext';
import { DrawerMenu } from './DrawerMenu';
import { useHeaderNavItems } from '../../hooks/useHeaderNavItems';
import { NotificationBell } from '../notifications/NotificationBell';
import { UserAccountMenu } from './UserAccountMenu';
import { Logo } from '../brand/Logo';
import { TourAnchors } from '../../onboarding/TourAnchors';
import { registerOverlayEscape } from '../../a11y/overlayStack';

const navItems = [
  { labelKey: 'navbar:home', path: ROUTES.HOME },
  { labelKey: 'navbar:jobs', path: ROUTES.JOBS },
  { labelKey: 'navbar:scholarships', path: ROUTES.SCHOLARSHIPS },
  { labelKey: 'navbar:admissions', path: ROUTES.ADMISSIONS },
  { labelKey: 'navbar:internships', path: ROUTES.INTERNSHIPS },
  {
    labelKey: 'navbar:education',
    mega: [
      { labelKey: 'navbar:schoolsAndColleges', path: ROUTES.SCHOOLS_AND_COLLEGES },
      { labelKey: 'navbar:universities', path: ROUTES.INTL_SCHOLARSHIPS },
      { labelKey: 'navbar:foreign', path: ROUTES.FOREIGN_STUDIES },
    ],
  },
  { labelKey: 'navbar:examPrep', path: ROUTES.EXAM_PREP },
  { labelKey: 'navbar:blog', path: ROUTES.BLOG },
  { labelKey: 'navbar:contact', path: ROUTES.CONTACT },
];

export function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(null);
  const megaRef = useRef(null);
  const { t: legacyT } = useLanguage();
  const { t } = useTranslation(['navbar', 'common']);

  const label = (key) => (key.includes(':') ? t(key.split(':')[1], { ns: key.split(':')[0] }) : legacyT(key));
  const resolvedNavItems = useHeaderNavItems(navItems, label);

  useEffect(() => {
    if (!megaOpen) return undefined;
    return registerOverlayEscape(() => setMegaOpen(null));
  }, [megaOpen]);

  const renderNavLink = (item, key) => {
    if (item.external) {
      return (
        <a key={key} href={item.path} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-mint rounded-lg link-hover">
          {item.label}{item.icon ? ` ${item.icon}` : ''}
        </a>
      );
    }
    return (
      <Link key={key} to={item.path} className="px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-mint rounded-lg link-hover">
        {item.label}{item.icon ? ` ${item.icon}` : ''}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-surface/98 dark:bg-surface-dark/98 backdrop-blur safe-area-inset-top">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 md:h-16 gap-2 min-h-[56px] min-w-0" data-tour="nav">
          <Link to={ROUTES.HOME} className="flex items-center gap-2 shrink-0 link-hover" aria-label={t('common:appName')}>
            <span className="inline-flex sm:hidden shrink-0">
              <Logo variant="symbol" height={36} className="shrink-0" />
            </span>
            <span className="hidden sm:inline-flex dark:hidden shrink-0">
              <Logo variant="full" height={36} className="shrink-0" />
            </span>
            <span className="hidden sm:dark:inline-flex shrink-0">
              <Logo variant="full" tone="dark" height={36} className="shrink-0" />
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label={t('navbar:mainNav')}>
            {!resolvedNavItems ? (
              <div className="flex items-center gap-2 animate-pulse" aria-busy="true" aria-label={t('common:loading')}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 w-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
                ))}
              </div>
            ) : (
              resolvedNavItems.map((item) =>
                item.mega ? (
                  <div
                    key={item.label}
                    className="relative"
                    ref={megaOpen === item.label ? megaRef : undefined}
                    onMouseEnter={() => setMegaOpen(item.label)}
                    onMouseLeave={() => setMegaOpen(null)}
                  >
                    <button
                      type="button"
                      className="px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-mint rounded-lg link-hover"
                      aria-expanded={megaOpen === item.label}
                      aria-haspopup="true"
                      onClick={() => setMegaOpen((cur) => (cur === item.label ? null : item.label))}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setMegaOpen(item.label);
                        }
                      }}
                    >
                      {item.label} ▾
                    </button>
                    {megaOpen === item.label && (
                      <div className="absolute left-0 top-full pt-1 w-56 animate-dropdown-enter">
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-2" role="menu">
                          {item.mega.map((sub) =>
                            sub.external ? (
                              <a key={sub.path} role="menuitem" href={sub.path} target="_blank" rel="noopener noreferrer" className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 link-hover rounded-lg" onClick={() => setMegaOpen(null)}>
                                {sub.label}
                              </a>
                            ) : (
                              <Link key={sub.path} role="menuitem" to={sub.path} className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 link-hover rounded-lg" onClick={() => setMegaOpen(null)}>
                                {sub.label}
                              </Link>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  renderNavLink(item, item.path || item.label)
                )
              )
            )}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <TourAnchors />
            <NotificationBell />
            <UserAccountMenu />
            <button
              type="button"
              className="lg:hidden min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 cursor-pointer"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDrawerOpen(true); }}
              aria-label={t('common:openMenu')}
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
            >
              <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  );
}
