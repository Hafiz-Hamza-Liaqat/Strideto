/**
 * Employer application resume access — re-exports private storage resolver.
 * @deprecated import from applicationResumeStorage.js directly in new code.
 */
export {
  resolveEmployerApplicationResumeAccess,
  resolvePrivateApplicationFile,
  parseLegacyPublicUploadKey as parseLocalUploadKeyFromResumeUrl,
  classifyResumeStorage,
  RESUME_STORAGE_KIND,
  PRIVATE_APPLICATION_RESUME_DIR,
} from './applicationResumeStorage.js';
