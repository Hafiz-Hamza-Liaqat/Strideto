import { useEffect, useRef, useState } from 'react';
import { hasAdConsent, getAdSenseClientId } from '../../consent/cookieConsentStorage';

/**
 * Responsive ad slot — loads Google AdSense when client ID + consent are set.
 */
export function AdBanner({ slotId = 'banner-top', className = '' }) {
  const ref = useRef(null);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const clientId = getAdSenseClientId();

  useEffect(() => {
    const onConsent = () => loadAd();
    window.addEventListener('cookie-consent-updated', onConsent);
    loadAd();
    return () => window.removeEventListener('cookie-consent-updated', onConsent);

    function loadAd() {
      if (!clientId || !hasAdConsent() || !ref.current) {
        setShowPlaceholder(true);
        return;
      }
      setShowPlaceholder(false);
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        setShowPlaceholder(true);
      }
    }
  }, [clientId, slotId]);

  if (showPlaceholder || !clientId || !hasAdConsent()) {
    if (import.meta.env.PROD) return null;
    return (
      <div
        className={`w-full min-h-[90px] flex items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 ${className}`}
        data-ad-slot={slotId}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className={`w-full min-h-[90px] ${className}`} ref={ref}>
      <ins
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
