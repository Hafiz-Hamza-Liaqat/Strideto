import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES, STAFF_ROLES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { talentApi } from '../../services/talentApi';
import { shouldUseTalentProfileApi } from '../../config/careerFeatureFlags';
import { useTheme } from '../../context/ThemeContext';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { restartProductTour } from '../../onboarding';
import { registerOverlayEscape } from '../../a11y/overlayStack';

function truncateId(id) {
  if (!id) return '';
  const s = String(id);
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function MenuLink({ to, onClose, children, className = '' }) {
  return (
    <Link
      to={to}
      onClick={onClose}
      className={`block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg mx-1 ${className}`}
    >
      {children}
    </Link>
  );
}

function MenuButton({ onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg mx-1 ${className}`}
    >
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
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [careerHeadline, setCareerHeadline] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !shouldUseTalentProfileApi()) return;
    talentApi.getSummary()
      .then(({ data }) => setCareerHeadline(data?.career?.headline || ''))
      .catch(() => setCareerHeadline(''));
  }, [isAuthenticated]);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    return registerOverlayEscape(() => setOpen(false));
  }, [open]);

  const close = () => setOpen(false);

  const handleLogout = () => {
    logout();
    close();
  };

  const copyUserId = async () => {
    if (!user?._id) return;
    try {
      await navigator.clipboard.writeText(String(user._id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const userId = user?._id ? String(user._id) : '';

  return (
    <div className="relative" ref={ref} data-tour="user-profile">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label={t('navbar:accountMenu')}
        aria-expanded={open}
        aria-haspopup="true"
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
        <div id="account-menu-panel" role="menu" className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50 py-2">
          {isAuthenticated ? (
            <>
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-white truncate">{user?.name || t('navbar:profile')}</p>
                {careerHeadline && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{careerHeadline}</p>
                )}
                {user?.email && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{user.email}</p>
                )}
                {userId && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t('navbar:userId')}: <span className="font-mono text-gray-700 dark:text-gray-300">{truncateId(userId)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={copyUserId}
                      className="text-xs text-primary dark:text-mint hover:underline shrink-0"
                      title={userId}
                    >
                      {copied ? t('navbar:idCopied') : t('navbar:copyId')}
                    </button>
                  </div>
                )}
              </div>
              <MenuLink to={ROUTES.DASHBOARD} onClose={close}>{t('navbar:dashboard')}</MenuLink>
              <MenuLink to={ROUTES.TALENT_PROFILE} onClose={close}>{t('navbar:talentProfile')}</MenuLink>
              <MenuLink to={ROUTES.APPLICATIONS} onClose={close}>{t('navbar:myApplications')}</MenuLink>
              <MenuLink to={ROUTES.PROFILE} onClose={close}>{t('navbar:profile')}</MenuLink>
              <MenuLink to={ROUTES.RESUME_BUILDER} onClose={close}>{t('navbar:resume')}</MenuLink>
              <MenuLink to={`${ROUTES.PROFILE}#account-settings`} onClose={close}>{t('navbar:accountSettings')}</MenuLink>
              {STAFF_ROLES.includes(user?.role) && (
                <MenuLink to={ROUTES.ADMIN} onClose={close}>{t('common:admin')}</MenuLink>
              )}
              <MenuSeparator />
            </>
          ) : (
            <>
              <MenuLink to={ROUTES.LOGIN} onClose={close}>{t('navbar:login')}</MenuLink>
              <MenuLink to={ROUTES.REGISTER} onClose={close} className="font-medium">{t('navbar:register')}</MenuLink>
              <MenuLink to={ROUTES.FORGOT_PASSWORD} onClose={close}>{t('navbar:forgotPassword')}</MenuLink>
              <MenuSeparator />
            </>
          )}

          <MenuSectionLabel>{t('navbar:languageSwitcher')}</MenuSectionLabel>
          <div className="px-3 pb-2">
            <LanguageSwitcher className="w-full" compact />
          </div>

          <MenuSectionLabel>{t('navbar:appearance')}</MenuSectionLabel>
          <MenuButton onClick={() => { toggleTheme(); }}>
            {theme === 'dark' ? `☀️ ${t('common:lightMode')}` : `🌙 ${t('common:darkMode')}`}
          </MenuButton>

          <MenuSeparator />
          <MenuSectionLabel>{t('navbar:help', { defaultValue: 'Help' })}</MenuSectionLabel>
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

          {isAuthenticated && (
            <>
              <MenuSeparator />
              <MenuButton onClick={handleLogout} className="text-red-600 dark:text-red-400">
                {t('common:logout')}
              </MenuButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}
