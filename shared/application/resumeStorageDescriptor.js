/** Private application resume descriptors stored in Application.resumeURL. */
export const PRIVATE_LOCAL_PREFIX = 'strideto-private:application/';
export const PRIVATE_CLOUDINARY_PREFIX = 'strideto-cloudinary:application/';

export const RESUME_STORAGE_KIND = {
  MISSING: 'missing',
  PRIVATE_LOCAL: 'private_local',
  PRIVATE_CLOUDINARY: 'private_cloudinary',
  LEGACY_LOCAL_PUBLIC: 'legacy_local_public',
  LEGACY_CLOUDINARY_PUBLIC: 'legacy_cloudinary_public',
  LEGACY_REMOTE_PUBLIC: 'legacy_remote_public',
  UNKNOWN: 'unknown',
};

/**
 * @param {string|null|undefined} resumeURL
 * @returns {string} RESUME_STORAGE_KIND value
 */
export function classifyResumeStorage(resumeURL) {
  if (!resumeURL || !String(resumeURL).trim()) return RESUME_STORAGE_KIND.MISSING;
  const raw = String(resumeURL);
  if (raw.startsWith(PRIVATE_LOCAL_PREFIX)) return RESUME_STORAGE_KIND.PRIVATE_LOCAL;
  if (raw.startsWith(PRIVATE_CLOUDINARY_PREFIX)) return RESUME_STORAGE_KIND.PRIVATE_CLOUDINARY;
  if (/^https?:\/\/.+\/uploads\//i.test(raw)) return RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC;
  if (/^https?:\/\/res\.cloudinary\.com\//i.test(raw)) return RESUME_STORAGE_KIND.LEGACY_CLOUDINARY_PUBLIC;
  if (/^https?:\/\//i.test(raw)) return RESUME_STORAGE_KIND.LEGACY_REMOTE_PUBLIC;
  return RESUME_STORAGE_KIND.UNKNOWN;
}

/** @param {string} kind */
export function resumeStorageIsLegacyPublicRisk(kind) {
  return (
    kind === RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC
    || kind === RESUME_STORAGE_KIND.LEGACY_CLOUDINARY_PUBLIC
    || kind === RESUME_STORAGE_KIND.LEGACY_REMOTE_PUBLIC
  );
}
