import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PRIVATE_CLOUDINARY_PREFIX,
  PRIVATE_LOCAL_PREFIX,
  classifyResumeStorage,
  RESUME_STORAGE_KIND,
} from '../../../shared/application/resumeStorageDescriptor.js';
import { extensionFromMime, rejectDangerousFilename } from '../utils/fileValidation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Outside Express /uploads static — not web-addressable. */
export const PRIVATE_APPLICATION_RESUME_DIR = path.resolve(__dirname, '../../private-storage/applications');

let cloudinary = null;

/** @returns {boolean} All Cloudinary credentials required for private application resume storage. */
export function isApplicationResumeCloudinaryConfigured() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  return !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

/** Test-only: reset cached Cloudinary client after env changes. */
export function __resetApplicationResumeCloudinaryCacheForTests() {
  cloudinary = null;
}

async function getCloudinary() {
  if (cloudinary) return cloudinary;
  if (!isApplicationResumeCloudinaryConfigured()) return null;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  const mod = await import('cloudinary');
  const v2 = mod.v2 || mod.default?.v2;
  v2.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
  cloudinary = v2;
  return cloudinary;
}

/**
 * Resolve a storage key under PRIVATE_APPLICATION_RESUME_DIR (anti-traversal).
 * @param {string} key
 * @returns {string|null}
 */
export function resolvePrivateApplicationFile(key) {
  if (!key || key.includes('..') || key.includes('/') || key.includes('\\')) return null;
  const normalized = String(key).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('/')) return null;
  const filepath = path.resolve(PRIVATE_APPLICATION_RESUME_DIR, normalized);
  const root = path.resolve(PRIVATE_APPLICATION_RESUME_DIR);
  if (!filepath.startsWith(root + path.sep)) return null;
  return filepath;
}

/**
 * @param {string} resumeURL
 * @returns {string|null}
 */
export function parseLegacyPublicUploadKey(resumeURL) {
  const raw = String(resumeURL || '');
  const fromPath = raw.match(/\/uploads\/([^?#]+)/i);
  if (fromPath) return fromPath[1];
  const base = (process.env.SITE_URL || 'http://localhost:5000').replace(/\/$/, '');
  if (raw.startsWith(`${base}/uploads/`)) {
    return raw.slice(`${base}/uploads/`.length).split('?')[0];
  }
  return null;
}

function contentTypeFromExt(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

async function getCloudinarySignedDeliveryUrl(publicId) {
  const cld = await getCloudinary();
  if (!cld) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + 300;
  return cld.url(publicId, {
    resource_type: 'auto',
    type: 'authenticated',
    sign_url: true,
    expires_at: expiresAt,
  });
}

/**
 * Store a candidate application resume privately (not publicly addressable).
 * @returns {Promise<{ resumeURL: string, resumeSource: 'upload' }>}
 */
export async function uploadApplicationResumeFile({ buffer, originalname, mimetype }) {
  if (!buffer?.length) throw new Error('Empty file');
  rejectDangerousFilename(originalname);

  const cld = await getCloudinary();
  if (cld) {
    const b64 = buffer.toString('base64');
    const dataUri = `data:${mimetype};base64,${b64}`;
    const safeId = `applications/${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const result = await cld.uploader.upload(dataUri, {
      folder: 'applications',
      resource_type: 'auto',
      type: 'authenticated',
      public_id: safeId,
    });
    return {
      resumeURL: `${PRIVATE_CLOUDINARY_PREFIX}${result.public_id}`,
      resumeSource: 'upload',
    };
  }

  if (process.env.NODE_ENV === 'production') {
    const err = new Error(
      'Application resume storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in production.'
    );
    err.code = 'APPLICATION_RESUME_STORAGE_NOT_CONFIGURED';
    throw err;
  }

  await fs.mkdir(PRIVATE_APPLICATION_RESUME_DIR, { recursive: true });
  const ext = extensionFromMime(mimetype) || '.bin';
  const key = `${Date.now()}_${crypto.randomBytes(12).toString('hex')}${ext}`;
  const filepath = path.join(PRIVATE_APPLICATION_RESUME_DIR, key);
  await fs.writeFile(filepath, buffer);
  return {
    resumeURL: `${PRIVATE_LOCAL_PREFIX}${key}`,
    resumeSource: 'upload',
  };
}

/**
 * Resolve employer-authorized resume delivery (never returns a permanent public URL to clients).
 * @param {{ resumeURL?: string|null }} application
 */
export async function resolveEmployerApplicationResumeAccess(application) {
  const resumeURL = application?.resumeURL;
  const kind = classifyResumeStorage(resumeURL);
  const legacyPublicRisk = kind.startsWith('legacy_');

  if (kind === RESUME_STORAGE_KIND.MISSING) {
    return { ok: false, reason: 'no_resume', storageKind: kind };
  }

  if (kind === RESUME_STORAGE_KIND.PRIVATE_LOCAL) {
    const key = String(resumeURL).slice(PRIVATE_LOCAL_PREFIX.length);
    const filepath = resolvePrivateApplicationFile(key);
    if (!filepath) return { ok: false, reason: 'invalid_path', storageKind: kind };
    try {
      await fs.access(filepath);
    } catch {
      return { ok: false, reason: 'file_missing', storageKind: kind };
    }
    return {
      ok: true,
      mode: 'local_stream',
      filepath,
      contentType: contentTypeFromExt(filepath),
      storageKind: kind,
      legacyPublicRisk: false,
    };
  }

  if (kind === RESUME_STORAGE_KIND.PRIVATE_CLOUDINARY) {
    const publicId = String(resumeURL).slice(PRIVATE_CLOUDINARY_PREFIX.length);
    const signedUrl = await getCloudinarySignedDeliveryUrl(publicId);
    if (!signedUrl) return { ok: false, reason: 'cloudinary_unavailable', storageKind: kind };
    return {
      ok: true,
      mode: 'remote_stream',
      url: signedUrl,
      contentType: 'application/octet-stream',
      storageKind: kind,
      legacyPublicRisk: false,
    };
  }

  if (kind === RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC) {
    const legacyKey = parseLegacyPublicUploadKey(resumeURL);
    const legacyPublicRoot = path.resolve(__dirname, '../../uploads');
    const legacyPath = legacyKey
      ? (() => {
          if (legacyKey.includes('..')) return null;
          const fp = path.resolve(legacyPublicRoot, legacyKey.replace(/\\/g, '/'));
          if (!fp.startsWith(legacyPublicRoot + path.sep)) return null;
          return fp;
        })()
      : null;
    if (!legacyPath) return { ok: false, reason: 'invalid_path', storageKind: kind };
    try {
      await fs.access(legacyPath);
    } catch {
      return { ok: false, reason: 'file_missing', storageKind: kind };
    }
    return {
      ok: true,
      mode: 'local_stream',
      filepath: legacyPath,
      contentType: contentTypeFromExt(legacyPath),
      storageKind: kind,
      legacyPublicRisk: true,
    };
  }

  if (
    kind === RESUME_STORAGE_KIND.LEGACY_CLOUDINARY_PUBLIC
    || kind === RESUME_STORAGE_KIND.LEGACY_REMOTE_PUBLIC
  ) {
    return {
      ok: true,
      mode: 'remote_stream',
      url: String(resumeURL),
      contentType: 'application/octet-stream',
      storageKind: kind,
      legacyPublicRisk: true,
    };
  }

  return { ok: false, reason: 'unsupported_storage', storageKind: kind };
}

export { classifyResumeStorage, RESUME_STORAGE_KIND };
