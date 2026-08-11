import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES, STAFF_ROLES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { talentApi } from '../../services/talentApi';
import { shouldUseTalentProfileApi } from '../../config/careerFeatureFlags';
import { useUserNavbarSession } from '../../hooks/useUserNavbarSession';
import { useTheme } from '../../context/ThemeContext';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { restartProductTour } from '../../onboarding';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';

const itemClass =
  'block w-[calc(100%-0.5rem)] mx-1 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]';

function MenuLink({ to, onClose, children, className = '' }) {
  return (
    <Link to={to} onClick={onClose} className={`${itemClass} ${className}`}>
      {children}
    </Link>
  );
}

function MenuButton({ onClick, children, className = '', ...rest }) {
  return (
    <button type="button" onClick={onClick} className={`${itemClass} text-start ${className}`} {...rest}>
      {children}
    </button>
  );
}

function MenuSeparator() {
  return <div className="my-1 border-t border-gray-200 dark:border-gray-700" role="separator" />;
}

function MenuSectionLabel({ children }) {
  return (
    <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </p>
  );
}

export function UserAccountMenu() {
  const { t } = useTranslation(['navbar', 'common']);
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { isAuthenticated: isEmployer, logout: employerLogout } = useEmployerAuth();
  const { enabled: userNavbarSession } = useUserNavbarSession();
  const showUserSession = userNavbarSession && isAuthenticated;
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const [careerHeadline, setCareerHeadline] = useState('');
  const ref = useRef(null);
  const panelRef = useRef(null);

  useOverlayA11y({
    open,
    onClose: () => setOpen(false),
    containerRef: panelRef,
    trapFocus: true,
  });

  useEffect(() => {
    if (!showUserSession || !shouldUseTalentProfileApi()) {
      setCareerHeadline('');
      return;
    }
    talentApi.getSummary()
      .then(({ data }) => setCareerHeadline(data?.career?.headline || ''))
      .catch(() => setCareerHeadline(''));
  }, [showUserSession]);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const close = () => setOpen(false);

  const handleLogout = async () => {
    await logout();
    close();
    navigate(ROUTES.HOME, { replace: true });
  };

  const handleEmployerLogout = async () => {
    await employerLogout();
    close();
  };

  return (
    <div className="relative" ref={ref} data-tour="user-profile">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={t('navbar:accountMenu')}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="account-menu-panel"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </button>

      {open && (
        <div
          id="account-menu-panel"
          ref={panelRef}
          role="dialog"
          aria-label={t('navbar:accountMenu')}
          className="fixed inset-x-2 top-14 z-[80] mt-0 flex w-auto max-h-[min(32rem,calc(100dvh-5rem))] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:absolute sm:inset-x-auto sm:end-0 sm:top-auto sm:mt-2 sm:w-80"
        >
          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {showUserSession ? (
              <>
                <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <p className="break-words font-semibold text-gray-900 dark:text-white">
                    {user?.name || t('navbar:profile')}
                  </p>
                  {careerHeadline ? (
                    <p className="mt-0.5 break-words text-xs text-gray-500 dark:text-gray-400">{careerHeadline}</p>
                  ) : null}
                  {user?.email ? (
                    <p className="mt-0.5 break-all text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                  ) : null}
                </div>
                <MenuSectionLabel>{t('navbar:workspace', { defaultValue: 'Workspace' })}</MenuSectionLabel>
                <MenuLink to={ROUTES.DASHBOARD} onClose={close}>
                  {t('navbar:myWorkspace', { defaultValue: 'My Workspace' })}
                </MenuLink>
                <MenuLink to={ROUTES.TALENT_PROFILE} onClose={close}>{t('navbar:talentProfile')}</MenuLink>
                <MenuLink to={ROUTES.APPLICATIONS} onClose={close}>{t('navbar:myApplications')}</MenuLink>
                {STAFF_ROLES.includes(user?.role) ? (
                  <MenuLink to={ROUTES.ADMIN} onClose={close}>{t('common:admin')}</MenuLink>
                ) : null}
                <MenuSectionLabel>{t('navbar:accountGroup', { defaultValue: 'Account' })}</MenuSectionLabel>
                <MenuLink to={ROUTES.PROFILE} onClose={close}>{t('navbar:profile')}</MenuLink>
                <MenuLink to={ROUTES.PRIVACY} onClose={close}>
                  {t('navbar:privacy', { defaultValue: 'Privacy' })}
                </MenuLink>
                <MenuLink to={`${ROUTES.PROFILE}#account-settings`} onClose={close}>
                  {t('navbar:accountSettings')}
                </MenuLink>
              </>
            ) : (
              <>
                <MenuLink to={ROUTES.LOGIN} onClose={close}>{t('navbar:login')}</MenuLink>
                <MenuLink to={ROUTES.REGISTER} onClose={close} className="font-medium">{t('navbar:register')}</MenuLink>
                <MenuLink to={ROUTES.FORGOT_PASSWORD} onClose={close}>{t('navbar:forgotPassword')}</MenuLink>
                <MenuLink to={ROUTES.EMPLOYER_LOGIN} onClose={close}>
                  {t('navbar:employerLogin', { defaultValue: 'Employer login' })}
                </MenuLink>
              </>
            )}

            {isEmployer ? (
              <>
                <MenuSeparator />
                <MenuSectionLabel>{t('navbar:employerPortal', { defaultValue: 'Employer' })}</MenuSectionLabel>
                <MenuLink to={ROUTES.EMPLOYER_DASHBOARD} onClose={close}>
                  {t('navbar:employerDashboard', { defaultValue: 'Employer dashboard' })}
                </MenuLink>
                <MenuButton onClick={handleEmployerLogout} className="text-red-600 dark:text-red-400">
                  {t('navbar:employerLogout', { defaultValue: 'Log out of employer' })}
                </MenuButton>
              </>
            ) : null}

            <MenuSeparator />
            <MenuSectionLabel>{t('navbar:preferences', { defaultValue: 'Preferences' })}</MenuSectionLabel>
            <MenuSectionLabel>{t('navbar:appearance')}</MenuSectionLabel>
            <div
              className="mx-3 mb-2 grid grid-cols-3 gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-700"
              role="group"
              aria-label={t('navbar:appearance')}
            >
              {['system', 'light', 'dark'].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={preference === value}
                  onClick={() => setPreference(value)}
                  className={`min-h-[44px] rounded-md px-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    preference === value
                      ? 'bg-primary/15 text-primary dark:text-mint'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {value === 'system'
                    ? t('navbar:appearanceSystem', { defaultValue: 'System' })
                    : value === 'light'
                      ? t('navbar:appearanceLight', { defaultValue: 'Light' })
                      : t('navbar:appearanceDark', { defaultValue: 'Dark' })}
                </button>
              ))}
            </div>
            <MenuSectionLabel>{t('navbar:languageSwitcher')}</MenuSectionLabel>
            <div className="px-3 pb-2">
              <LanguageSwitcher className="w-full" />
            </div>

            <MenuSeparator />
            <MenuSectionLabel>{t('navbar:help', { defaultValue: 'Help' })}</MenuSectionLabel>
            {showUserSession ? (
              <MenuLink to={ROUTES.STUDENT_HELP} onClose={close}>
                {t('navbar:studentHelp', { defaultValue: 'Student Help' })}
              </MenuLink>
            ) : null}
            <MenuButton
              onClick={() => {
                close();
                restartProductTour();
              }}
            >
              {t('navbar:productTour', { defaultValue: 'Product Tour' })}
            </MenuButton>
            <MenuLink to={ROUTES.HELP_CENTER} onClose={close}>
              {t('navbar:helpCenter', { defaultValue: 'Help Center' })}
            </MenuLink>
          </div>

          {showUserSession ? (
            <div className="shrink-0 border-t border-gray-200 bg-white py-1 dark:border-gray-700 dark:bg-gray-800">
              <MenuSectionLabel>{t('navbar:session', { defaultValue: 'Session' })}</MenuSectionLabel>
              <MenuButton
                onClick={handleLogout}
                className="text-red-600 dark:text-red-400"
                aria-label={t('common:logout')}
              >
                {t('common:logout')}
              </MenuButton>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
