import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';
import {
  acceptAllConsent,
  hasStoredConsent,
  isMarketingTechnologyConfigured,
  OPEN_COOKIE_SETTINGS_EVENT,
  readStoredConsent,
  rejectNonEssentialConsent,
  writeConsent,
} from '../../consent/cookieConsentStorage';

function PreferenceToggle({ id, label, description, checked, disabled, onChange }) {
  return (
    <div className="flex gap-3 items-start py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{description}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}

function CookiePreferencesPanel({ draft, setDraft, adsConfigured, onSave, onCancel }) {
  const { t } = useTranslation(['seo', 'common']);

  return (
    <div className="mt-4 space-y-1">
      <PreferenceToggle
        id="cookie-necessary"
        label={t('seo:cookieCatNecessary')}
        description={t('seo:cookieCatNecessaryDesc')}
        checked
        disabled
        onChange={() => {}}
      />
      <PreferenceToggle
        id="cookie-functional"
        label={t('seo:cookieCatFunctional')}
        description={t('seo:cookieCatFunctionalDesc')}
        checked={draft.functional}
        onChange={(functional) => setDraft((d) => ({ ...d, functional }))}
      />
      <PreferenceToggle
        id="cookie-analytics"
        label={t('seo:cookieCatAnalytics')}
        description={t('seo:cookieCatAnalyticsDesc')}
        checked={draft.analytics}
        onChange={(analytics) => setDraft((d) => ({ ...d, analytics }))}
      />
      {adsConfigured ? (
        <PreferenceToggle
          id="cookie-marketing"
          label={t('seo:cookieCatMarketing')}
          description={t('seo:cookieCatMarketingDesc')}
          checked={draft.marketing}
          onChange={(marketing) => setDraft((d) => ({ ...d, marketing }))}
        />
      ) : null}
      <div className="pt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 min-h-[44px] text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {t('common:cancel')}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="px-4 py-2 min-h-[44px] text-sm rounded-lg bg-primary text-white hover:bg-primary-hover btn-theme"
        >
          {t('seo:cookieSavePreferences')}
        </button>
      </div>
    </div>
  );
}

export function CookieConsent() {
  const [bannerVisible, setBannerVisible] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState({
    functional: true,
    analytics: false,
    marketing: false,
  });
  const panelRef = useRef(null);
  const { t } = useTranslation(['seo', 'common']);
  const adsConfigured = isMarketingTechnologyConfigured();

  const closeAll = useCallback(() => {
    setBannerVisible(false);
    setPrefsOpen(false);
  }, []);

  const openPreferences = useCallback(() => {
    const stored = readStoredConsent();
    setDraft({
      functional: stored ? stored.functional !== false : true,
      analytics: stored?.analytics === true,
      marketing: adsConfigured && stored?.marketing === true,
    });
    setPrefsOpen(true);
    setBannerVisible(true);
  }, [adsConfigured]);

  useEffect(() => {
    if (!hasStoredConsent()) setBannerVisible(true);
  }, []);

  useEffect(() => {
    const onOpen = () => openPreferences();
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen);
  }, [openPreferences]);

  useOverlayA11y({
    open: bannerVisible,
    onClose: () => {
      if (prefsOpen) {
        setPrefsOpen(false);
        if (hasStoredConsent()) closeAll();
        return;
      }
      rejectNonEssentialConsent();
      closeAll();
    },
    containerRef: panelRef,
    trapFocus: prefsOpen,
  });

  if (!bannerVisible) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={prefsOpen ? 'true' : 'false'}
      aria-label={t('seo:cookieConsent')}
      className="fixed bottom-0 inset-x-0 z-[100] p-4 safe-area-inset-bottom"
    >
      <div className="max-w-3xl mx-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-4 sm:p-5">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('seo:cookieMessage')}{' '}
          <Link to={ROUTES.COOKIES} className="text-primary dark:text-mint underline">
            {t('common:cookiePolicy')}
          </Link>{' '}
          {t('common:and')}{' '}
          <Link to={ROUTES.PRIVACY_POLICY} className="text-primary dark:text-mint underline">
            {t('common:privacyPolicy')}
          </Link>
          .
        </p>

        {prefsOpen ? (
          <CookiePreferencesPanel
            draft={draft}
            setDraft={setDraft}
            adsConfigured={adsConfigured}
            onCancel={() => {
              setPrefsOpen(false);
              if (hasStoredConsent()) closeAll();
            }}
            onSave={() => {
              writeConsent(draft);
              closeAll();
            }}
          />
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                rejectNonEssentialConsent();
                closeAll();
              }}
              className="px-4 py-2 min-h-[44px] text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {t('seo:cookieRejectNonEssential')}
            </button>
            <button
              type="button"
              onClick={() => openPreferences()}
              className="px-4 py-2 min-h-[44px] text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {t('seo:cookieManagePreferences')}
            </button>
            <button
              type="button"
              onClick={() => {
                acceptAllConsent();
                closeAll();
              }}
              className="px-4 py-2 min-h-[44px] text-sm rounded-lg bg-primary text-white hover:bg-primary-hover btn-theme"
            >
              {t('common:acceptAll')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
