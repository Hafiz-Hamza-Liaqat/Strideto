import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';

const CONSENT_KEY = 'edurozgaar-cookie-consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);
  const { t } = useTranslation(['seo', 'common']);

  useEffect(() => {
    if (!getAdSenseClientId()) return;
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) setVisible(true);
  }, []);

  const accept = (level) => {
    localStorage.setItem(CONSENT_KEY, level);
    setVisible(false);
    window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: { level } }));
  };

  // ESC accepts essential-only (least privilege dismiss) without trapping page forever
  useOverlayA11y({
    open: visible,
    onClose: () => accept('essential'),
    containerRef: panelRef,
    trapFocus: false,
  });

  if (!visible) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
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
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => accept('essential')}
            className="px-4 py-2 min-h-[44px] text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {t('common:essentialOnly')}
          </button>
          <button
            type="button"
            onClick={() => accept('all')}
            className="px-4 py-2 min-h-[44px] text-sm rounded-lg bg-primary text-white hover:bg-primary-hover btn-theme"
          >
            {t('common:acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function hasAdConsent() {
  const level = localStorage.getItem(CONSENT_KEY);
  return level === 'all';
}

export function getAdSenseClientId() {
  return import.meta.env.VITE_ADSENSE_CLIENT_ID || '';
}
