import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { isStudentPortalNavVisible, STUDENT_PORTAL_NAV } from '../../config/studentNavConfig';

export function StudentPortalNav() {
  const { t } = useTranslation(['student']);
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();

  if (!isStudentPortalNavVisible(pathname, isAuthenticated)) return null;

  return (
    <nav
      aria-label={t('student:portalNavLabel', { defaultValue: 'Student portal' })}
      className="border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 overflow-x-auto">
        <ul className="flex gap-1 py-1 min-h-[44px] items-center w-max min-w-full">
          {STUDENT_PORTAL_NAV.map((item) => {
            const pathOnly = item.path.split('#')[0];
            const current = item.end
              ? pathname === pathOnly
              : pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  aria-current={current ? 'page' : undefined}
                  className={`inline-flex items-center min-h-[44px] px-3 text-sm whitespace-nowrap rounded-lg ${
                    current
                      ? 'bg-primary/10 text-primary dark:text-mint font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {t(`student:nav.${item.labelKey}`, { defaultValue: item.labelKey })}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
