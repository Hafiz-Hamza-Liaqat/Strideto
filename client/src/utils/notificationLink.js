/**
 * Only same-app internal routes are safe click targets for a notification.
 * Rejects javascript:/data: schemes, protocol-relative (`//host`) and
 * backslash-based (`/\host`) open-redirect-style values.
 */
export function isSafeInternalLink(link) {
  if (typeof link !== 'string') return false;
  const trimmed = link.trim();
  if (!trimmed) return false;
  if (!/^\/[^/\\]/.test(trimmed)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
  if (trimmed.includes('://')) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(trimmed)) return false;
  return true;
}
