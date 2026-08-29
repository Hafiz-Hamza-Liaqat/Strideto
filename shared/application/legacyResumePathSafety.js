/**
 * Safe resolution of legacy public /uploads application resume paths.
 * Migration-only helper — anti-traversal, root-confined.
 */
import path from 'path';

/**
 * Extract the uploads-relative key from a legacy resume reference.
 * Supports full SITE_URL URLs and bare /uploads/... paths.
 * @param {string} resumeURL
 * @param {string} [siteUrl]
 * @returns {string|null}
 */
export function extractLegacyPublicUploadKey(resumeURL, siteUrl = process.env.SITE_URL || 'http://localhost:5000') {
  const raw = String(resumeURL || '').trim();
  if (!raw) return null;

  const fromHttp = raw.match(/\/uploads\/([^?#]+)/i);
  if (fromHttp) return fromHttp[1];

  const base = String(siteUrl).replace(/\/$/, '');
  if (raw.startsWith(`${base}/uploads/`)) {
    return raw.slice(`${base}/uploads/`.length).split('?')[0];
  }
  if (raw.startsWith('/uploads/')) {
    return raw.slice('/uploads/'.length).split('?')[0];
  }
  if (/^uploads\//i.test(raw)) {
    return raw.slice('uploads/'.length).split('?')[0];
  }
  return null;
}

/**
 * Resolve a legacy public upload key to an absolute filepath under uploadsRoot.
 * @param {string} resumeURL
 * @param {string} uploadsRoot absolute path to server/uploads
 * @param {string} [siteUrl]
 * @returns {{ ok: true, filepath: string, key: string } | { ok: false, error: string }}
 */
export function resolveLegacyPublicUploadFile(resumeURL, uploadsRoot, siteUrl) {
  const key = extractLegacyPublicUploadKey(resumeURL, siteUrl);
  if (!key) return { ok: false, error: 'invalid_legacy_path' };

  const normalizedKey = key.replace(/\\/g, '/');
  if (
    !normalizedKey
    || normalizedKey.includes('..')
    || normalizedKey.startsWith('/')
    || normalizedKey.includes('\0')
    || /%2e%2e/i.test(normalizedKey)
  ) {
    return { ok: false, error: 'path_traversal' };
  }

  const root = path.resolve(uploadsRoot);
  const filepath = path.resolve(root, normalizedKey);
  if (!filepath.startsWith(root + path.sep)) {
    return { ok: false, error: 'path_escape' };
  }
  return { ok: true, filepath, key: normalizedKey };
}
