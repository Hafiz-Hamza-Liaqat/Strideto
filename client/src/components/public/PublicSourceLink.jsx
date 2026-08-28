import { publicHttpUrlOrNull } from '@shared/publicDiscovery/safePublicUrl.js';

/**
 * Safe external link with an explicit caller-supplied label (SEO-P7).
 * URL safety does not imply official authority — label must match field truth.
 */
export function PublicSourceLink({
  url,
  label,
  className = 'text-primary dark:text-mint hover:underline break-words-safe',
  showArrow = true,
}) {
  const safeUrl = publicHttpUrlOrNull(url);
  const text = typeof label === 'string' ? label.trim() : '';
  if (!safeUrl || !text) return null;

  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {text}{showArrow ? ' ↗' : ''}
    </a>
  );
}
