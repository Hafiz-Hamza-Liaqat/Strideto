/**
 * Official GBS source URL safety (Phase 17D-2).
 *
 * Manifest-known HTTPS official URLs only. No arbitrary fetch / SSRF helper.
 * Education `isValidSourceUrl` remains unchanged — this is stricter and GBS-only.
 */
const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

function ipv4Octets(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map((n) => Number(n));
  if (parts.some((n) => n > 255)) return null;
  return parts;
}

function isPrivateOrLocalHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  const ipv4 = ipv4Octets(host);
  if (ipv4) {
    const [a, b] = ipv4;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  if (host.startsWith('fd') || host.startsWith('fe80:') || host.startsWith('fc')) return true;
  return false;
}

export function normalizeOfficialSourceUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const protocol = u.protocol.toLowerCase();
  if (protocol === 'javascript:' || protocol === 'data:' || protocol === 'file:') return null;
  if (protocol !== 'https:' && protocol !== 'http:') return null;
  if (isPrivateOrLocalHost(u.hostname)) return null;
  u.hash = '';
  if (
    (u.protocol === 'http:' && u.port === '80') ||
    (u.protocol === 'https:' && u.port === '443')
  ) {
    u.port = '';
  }
  return u.toString();
}

/**
 * @param {string} raw
 * @param {{ requireHttps?: boolean }} [opts]
 */
export function validateOfficialSourceUrl(raw, { requireHttps = true } = {}) {
  const normalized = normalizeOfficialSourceUrl(raw);
  if (!normalized) {
    return { ok: false, error: 'official_source_url_rejected' };
  }
  const u = new URL(normalized);
  if (requireHttps && u.protocol !== 'https:') {
    return { ok: false, error: 'official_source_url_https_required' };
  }
  return { ok: true, value: normalized };
}

export function isBlockedOfficialSourceUrl(raw) {
  return !validateOfficialSourceUrl(raw, { requireHttps: false }).ok;
}
