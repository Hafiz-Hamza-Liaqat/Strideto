import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES, STAFF_ROLES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { talentApi } from '../../services/talentApi';
import { shouldUseTalentProfileApi } from '../../config/careerFeatureFlags';
import { useTheme } from '../../context/ThemeContext';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { restartProductTour } from '../../onboarding';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';
import { useActiveWorkspace } from '../../context/ActiveWorkspaceContext';

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

function AccountSkeleton() {
  return (
    <div className="hidden sm:flex items-center gap-2 min-h-[44px] px-2" aria-hidden="true">
      <span className="h-8 w-8 rounded-full bg-white/15 animate-pulse" />
      <span className="flex flex-col gap-1">
        <span className="h-3 w-20 rounded bg-white/15 animate-pulse" />
        <span className="h-2 w-14 rounded bg-white/10 animate-pulse" />
      </span>
    </div>
  );
}

function RoleBadge({ label, verifiedLabel }) {
  const text = verifiedLabel || label;
  if (!text) return null;
  return (
    <p className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-300">
      <span className="inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-600">
        {text}
      </span>
    </p>
  );
}

export function UserAccountMenu() {
  const { t } = useTranslation(['navbar', 'common']);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    identity,
    isAuthenticated,
    isHydrating,
    logoutActive,
    discoverOtherRealms,
    discovered,
    activateRealm,
  } = useActiveWorkspace();
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const [careerHeadline, setCareerHeadline] = useState('');
  const [switchOpen, setSwitchOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const ref = useRef(null);
  const panelRef = useRef(null);

  const showUserSession = isAuthenticated && identity.realm === 'student';
  const showB2bSession = isAuthenticated && identity.realm !== 'student' && identity.realm !== 'guest';

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

  const close = () => {
    setOpen(false);
    setSwitchOpen(false);
  };

  const handleLogout = async () => {
    if (identity.realm === 'student') {
      await logout();
      close();
      navigate(ROUTES.HOME, { replace: true });
      return;
    }
    await logoutActive();
    close();
  };

  const handleSwitchWorkspace = async () => {
    setDiscovering(true);
    try {
      await discoverOtherRealms();
      setSwitchOpen(true);
    } finally {
      setDiscovering(false);
    }
  };

  const triggerLabel = isAuthenticated
    ? t('navbar:accountMenuNamed', {
        name: identity.displayName,
        role: identity.roleLabel,
        defaultValue: `Account menu, ${identity.displayName}, ${identity.roleLabel}`,
      })
    : t('navbar:accountMenu');

  if (isHydrating && !isAuthenticated) {
    return (
      <div className="relative min-w-[44px] min-h-[44px] flex items-center" data-tour="user-profile">
        <AccountSkeleton />
        <span className="sm:hidden inline-block h-8 w-8 rounded-full bg-white/15 animate-pulse" aria-hidden="true" />
        <span className="sr-only">{t('navbar:accountHydrating', { defaultValue: 'Checking signed-in workspace' })}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref} data-tour="user-profile">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative min-h-[44px] min-w-[44px] flex items-center gap-2 rounded-lg px-1.5 text-slate-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="account-menu-panel"
      >
        {identity.avatarUrl ? (
          <img
            src={identity.avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full object-cover bg-white/10"
          />
        ) : (
          <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        )}
        {isAuthenticated ? (
          <span className="hidden min-[768px]:flex flex-col items-start min-w-0 max-w-[9.5rem]">
            <span className="w-full truncate text-start text-sm font-medium text-white leading-tight">
              {identity.displayName}
            </span>
            <span className="w-full truncate text-start text-xs text-slate-300 leading-tight">
              {identity.roleLabel}
            </span>
          </span>
        ) : null}
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('navbar:signedInAs', { defaultValue: 'Signed in as' })}
                  </p>
                  <p className="break-words font-semibold text-gray-900 dark:text-white">
                    {user?.name || identity.displayName || t('navbar:profile')}
                  </p>
                  <RoleBadge label={identity.roleLabel} verifiedLabel={identity.verifiedLabel} />
                  {careerHeadline ? (
                    <p className="mt-0.5 break-words text-xs text-gray-500 dark:text-gray-400">{careerHeadline}</p>
                  ) : null}
                  {user?.email ? (
                    <p className="mt-0.5 break-all text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                  ) : null}
                </div>
                <MenuSectionLabel>{t('navbar:openWorkspace', { defaultValue: 'Open workspace' })}</MenuSectionLabel>
                <MenuLink to={ROUTES.DASHBOARD} onClose={close}>
                  {t('navbar:myWorkspace', { defaultValue: 'My Workspace' })}
                </MenuLink>
                <MenuLink to={ROUTES.TALENT_PROFILE} onClose={close}>{t('navbar:talentProfile')}</MenuLink>
                <MenuLink to={ROUTES.APPLICATIONS} onClose={close}>{t('navbar:myApplications')}</MenuLink>
                {!STAFF_ROLES.includes(user?.role) ? (
                  <MenuLink to={ROUTES.BUSINESS} onClose={close}>Business</MenuLink>
                ) : null}
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
                <MenuLink to={identity.notificationsHref || ROUTES.NOTIFICATIONS} onClose={close}>
                  {t('navbar:notifications', { defaultValue: 'Notifications' })}
                </MenuLink>
              </>
            ) : showB2bSession ? (
              <>
                <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('navbar:signedInAs', { defaultValue: 'Signed in as' })}
                  </p>
                  <p className="break-words font-semibold text-gray-900 dark:text-white">
                    {identity.displayName}
                  </p>
                  {identity.organizationName && identity.organizationName !== identity.displayName ? (
                    <p className="mt-0.5 break-words text-sm text-gray-600 dark:text-gray-300">
                      {identity.organizationName}
                    </p>
                  ) : null}
                  <RoleBadge label={identity.roleLabel} verifiedLabel={identity.verifiedLabel} />
                </div>
                <MenuSectionLabel>{t('navbar:openWorkspace', { defaultValue: 'Open workspace' })}</MenuSectionLabel>
                <MenuLink to={identity.workspaceHref} onClose={close}>
                  {identity.realm === 'employer'
                    ? t('navbar:employerWorkspace', { defaultValue: 'Employer Workspace' })
                    : identity.realm === 'agent'
                      ? t('navbar:agentWorkspace', { defaultValue: 'Agent Workspace' })
                      : t('navbar:institutionWorkspace', { defaultValue: 'Institution Workspace' })}
                </MenuLink>
                <MenuSectionLabel>{t('navbar:accountSecurity', { defaultValue: 'Account / Security' })}</MenuSectionLabel>
                <MenuLink to={identity.settingsHref} onClose={close}>
                  {t('navbar:accountSettings')}
                </MenuLink>
                {identity.notificationsHref ? (
                  <MenuLink to={identity.notificationsHref} onClose={close}>
                    {t('navbar:notifications', { defaultValue: 'Notifications' })}
                  </MenuLink>
                ) : null}
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

            {isAuthenticated ? (
              <>
                <MenuSeparator />
                <MenuButton
                  onClick={handleSwitchWorkspace}
                  aria-expanded={switchOpen}
                  disabled={discovering}
                >
                  {discovering
                    ? t('navbar:checkingWorkspaces', { defaultValue: 'Checking workspaces…' })
                    : t('navbar:switchWorkspace', { defaultValue: 'Switch workspace' })}
                </MenuButton>
                {switchOpen ? (
                  discovered.length > 0 ? (
                    discovered.map((item) => (
                      <MenuButton
                        key={item.realm}
                        onClick={() => {
                          close();
                          activateRealm(item.realm);
                        }}
                      >
                        <span className="flex flex-col min-w-0">
                          <span className="font-medium text-gray-900 dark:text-white">{item.roleLabel}</span>
                          {item.organizationName || item.displayName ? (
                            <span className="break-words text-xs text-gray-500 dark:text-gray-400">
                              {item.organizationName || item.displayName}
                            </span>
                          ) : null}
                        </span>
                      </MenuButton>
                    ))
                  ) : (
                    <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {t('navbar:noOtherWorkspaces', { defaultValue: 'No other signed-in workspaces.' })}
                    </p>
                  )
                ) : null}
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
            {showB2bSession && identity.helpHref ? (
              <MenuLink to={identity.helpHref} onClose={close}>
                {t('navbar:help', { defaultValue: 'Help' })}
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

          {isAuthenticated ? (
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
