/**
 * Detect profile/webpage URLs that are unlikely to work as direct image sources.
 */
export function isLikelyWebpageNotDirectImage(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const u = new URL(trimmed);
    const path = u.pathname.toLowerCase();
    if (/\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i.test(path)) return false;
    const host = u.hostname.toLowerCase();
    if (host === 'github.com' || host.endsWith('.github.com')) {
      if (!path.includes('/raw/') && !path.includes('/blob/')) return true;
      if (path.includes('/blob/') && !path.includes('/raw/')) return true;
    }
    if (host.includes('linkedin.com') || host === 'x.com' || host === 'twitter.com') return true;
    if (host.includes('facebook.com') || host.includes('instagram.com')) return true;
    const segments = path.split('/').filter(Boolean);
    if (segments.length <= 2 && !path.includes('.')) return true;
  } catch {
    return false;
  }
  return false;
}
