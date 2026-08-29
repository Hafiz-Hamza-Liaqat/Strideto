/**
 * SSRF-safe validation for legacy public Cloudinary application resume URLs.
 * Migration-only — does not broaden employer resume delivery fetch scope.
 */

const TRUSTED_CLOUDINARY_HOST = 'res.cloudinary.com';

const BLOCKED_HOSTS = new Set([
  'localhost',
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
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  if (host.startsWith('fd') || host.startsWith('fe80:') || host.startsWith('fc')) return true;
  return false;
}

/**
 * @param {string} raw
 * @param {{ expectedCloudName?: string|null }} [opts]
 * @returns {{ ok: true, url: URL, cloudName: string, publicId: string|null } | { ok: false, error: string }}
 */
export function validateTrustedLegacyCloudinaryResumeUrl(raw, { expectedCloudName = null } = {}) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'empty_url' };
  }
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
  if (u.protocol !== 'https:') {
    return { ok: false, error: 'https_required' };
  }
  if (isPrivateOrLocalHost(u.hostname)) {
    return { ok: false, error: 'private_host' };
  }
  if (u.hostname.toLowerCase() !== TRUSTED_CLOUDINARY_HOST) {
    return { ok: false, error: 'untrusted_host' };
  }

  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 4) {
    return { ok: false, error: 'invalid_cloudinary_path' };
  }
  const cloudName = parts[0];
  const uploadIdx = parts.findIndex((p, i) => i > 0 && p === 'upload');
  if (uploadIdx < 0) {
    return { ok: false, error: 'invalid_cloudinary_path' };
  }
  if (expectedCloudName && cloudName !== expectedCloudName) {
    return { ok: false, error: 'cloud_name_mismatch' };
  }

  let startIdx = uploadIdx + 1;
  if (parts[startIdx] && /^v\d+$/i.test(parts[startIdx])) startIdx += 1;
  const publicIdWithExt = parts.slice(startIdx).join('/');
  if (!publicIdWithExt) {
    return { ok: false, error: 'missing_public_id' };
  }
  const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');

  return { ok: true, url: u, cloudName, publicId };
}

/**
 * Fetch bytes from a trusted legacy public Cloudinary resume URL.
 * Rejects redirects to non-trusted hosts.
 * @param {string} rawUrl
 * @param {{ expectedCloudName?: string|null, fetchImpl?: typeof fetch, maxBytes?: number }} [opts]
 */
export async function fetchTrustedLegacyCloudinaryResume(
  rawUrl,
  { expectedCloudName = null, fetchImpl = globalThis.fetch, maxBytes = 5 * 1024 * 1024 } = {}
) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch_unavailable');
  }

  const first = validateTrustedLegacyCloudinaryResumeUrl(rawUrl, { expectedCloudName });
  if (!first.ok) {
    const err = new Error(first.error);
    err.code = first.error;
    throw err;
  }

  let response = await fetchImpl(first.url.toString(), { redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) {
      const err = new Error('redirect_missing_location');
      err.code = 'redirect_missing_location';
      throw err;
    }
    const redirect = validateTrustedLegacyCloudinaryResumeUrl(location, { expectedCloudName });
    if (!redirect.ok) {
      const err = new Error('redirect_to_untrusted');
      err.code = 'redirect_to_untrusted';
      throw err;
    }
    response = await fetchImpl(redirect.url.toString(), { redirect: 'manual' });
  }

  if (!response.ok) {
    const err = new Error('fetch_failed');
    err.code = 'fetch_failed';
    throw err;
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxBytes) {
    const err = new Error('file_too_large');
    err.code = 'file_too_large';
    throw err;
  }

  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length > maxBytes) {
    const err = new Error('file_too_large');
    err.code = 'file_too_large';
    throw err;
  }
  return { buffer: buf, publicId: first.publicId, cloudName: first.cloudName };
}
