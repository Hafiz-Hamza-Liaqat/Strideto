/**
 * Public-safe http(s) URL gate (Phase 7).
 * Client- and server-safe. Rejects javascript/data/ftp, credentials, control chars.
 */

export const UNSAFE_PUBLIC_URL_REASON = 'UNSAFE_PUBLIC_URL';

function hasControlCharacters(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: string|null } | { ok: false, reason: string }}
 */
export function sanitizePublicHttpUrl(raw) {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, reason: UNSAFE_PUBLIC_URL_REASON };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (hasControlCharacters(trimmed)) return { ok: false, reason: UNSAFE_PUBLIC_URL_REASON };
  if (/^(javascript|data|vbscript|file|ftp):/i.test(trimmed)) {
    return { ok: false, reason: UNSAFE_PUBLIC_URL_REASON };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: UNSAFE_PUBLIC_URL_REASON };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: UNSAFE_PUBLIC_URL_REASON };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: UNSAFE_PUBLIC_URL_REASON };
  }
  return { ok: true, value: parsed.href };
}

/** @param {unknown} raw */
export function publicHttpUrlOrNull(raw) {
  const result = sanitizePublicHttpUrl(raw);
  return result.ok ? result.value : null;
}

/**
 * Same-app return path only. Rejects protocol-relative and scheme URLs.
 * @param {unknown} path
 */
export function isSafeInternalReturnPath(path) {
  if (typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (!trimmed) return false;
  if (!/^\/[^/\\]/.test(trimmed)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
  if (trimmed.includes('://')) return false;
  if (/[\x00-\x1f]/.test(trimmed)) return false;
  return true;
}
