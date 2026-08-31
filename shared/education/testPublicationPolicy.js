import { isValidAuthorityType } from '../trust/sourceVerification.js';

/** Public promotion policy for canonical tests. */
export function isTestPubliclyPromotable(test, provider = test?.providerId) {
  if (!test || test.status !== 'published' || !test.name?.trim() || !test.slug?.trim()) return false;
  const providerRecord = provider && typeof provider === 'object' ? provider : null;
  if (!providerRecord || providerRecord.status !== 'active' || !providerRecord.name?.trim()) return false;
  const officialUrl = test.officialWebsite || test.registrationUrl || providerRecord.officialWebsite;
  return isHttpUrl(officialUrl) && (test.sources || []).some(
    (source) => isValidAuthorityType(source?.sourceType) && isHttpUrl(source?.sourceUrl)
  );
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
