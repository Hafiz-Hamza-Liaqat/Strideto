import { useState, useEffect } from 'react';
import { publicHttpUrlOrNull } from '@shared/publicDiscovery/safePublicUrl.js';

export function listingLogoInitial(label) {
  const text = String(label || '').trim();
  return text ? text.charAt(0).toUpperCase() : '?';
}

/**
 * Public list/detail logo with optional URL and company/provider initial fallback.
 * Hides broken images via onError — no broken-image icon.
 */
export function PublicListingLogo({
  logoUrl,
  label,
  className = 'h-10 w-10 rounded-lg',
  imgClassName = 'h-full w-full rounded-lg object-contain p-0.5',
  fallbackClassName = 'bg-primary/10 dark:bg-mint/10 text-primary dark:text-mint font-bold text-sm',
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);
  const src = publicHttpUrlOrNull(logoUrl);
  const showImg = Boolean(src) && !failed;
  const initial = listingLogoInitial(label);
  const alt = label ? `${label} logo` : '';

  return (
    <div
      className={`${className} shrink-0 overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 ${!showImg ? fallbackClassName : ''}`}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          className={imgClassName}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </div>
  );
}
