/**
 * Agent verification unsaved-draft storage.
 *
 * sessionStorage, tab-scoped, keyed by realm + account + provider subject.
 * Never stores secrets, tokens, files, HSI, or government credentials.
 */

export const VERIFICATION_DRAFT_FORM_VERSION = 'agent-verification-v1';
const PREFIX = 'strideto-verification-draft:';

/** Non-secret text/select/URL fields allowed in sessionStorage. */
export const SAFE_VERIFICATION_DRAFT_FIELDS = Object.freeze([
  'countryCode',
  'organizationCategory',
  'profession',
  'credentialType',
  'licenseIssuer',
  'licenseJurisdiction',
  'registrationCountry',
  'registrationAuthority',
  'officialWebsite',
  'googleBusinessUrl',
  'officialRegistryUrl',
  'governmentRegistryUrl',
  'professionalRegulatorUrl',
  'accreditationPageUrl',
  'googleMapsUrl',
]);

/** PII / business-confidential — memory + unsaved-navigation warning only. */
export const SENSITIVE_VERIFICATION_FIELDS = Object.freeze([
  'legalName',
  'displayName',
  'officialEmail',
  'phone',
  'registrationNumber',
  'taxIdentifier',
  'licenseNumber',
  'addressLine1',
  'city',
  'region',
  'representativeName',
  'representativeTitle',
  'representativeEmail',
]);

export function verificationDraftKey({
  realm,
  accountId,
  subjectType,
  subjectId,
  formVersion = VERIFICATION_DRAFT_FORM_VERSION,
}) {
  return [
    PREFIX,
    formVersion,
    String(realm || ''),
    String(accountId || ''),
    String(subjectType || ''),
    String(subjectId || ''),
  ].join(':');
}

function pickSafe(profile = {}, phoneValue, registeredAddress = {}) {
  const out = {};
  for (const key of SAFE_VERIFICATION_DRAFT_FIELDS) {
    if (key === 'googleMapsUrl') {
      const value = registeredAddress.googleMapsUrl;
      if (typeof value === 'string') out[key] = value;
      continue;
    }
    const value = profile[key];
    if (typeof value === 'string' || typeof value === 'boolean') out[key] = value;
  }
  return out;
}

export function extractSafeVerificationDraft(profile = {}, registeredAddress = {}) {
  return pickSafe(profile, undefined, registeredAddress);
}

export function extractSensitiveVerificationSnapshot(profile = {}, phoneValue, registeredAddress = {}, representative = {}) {
  return {
    legalName: String(profile.legalName || ''),
    displayName: String(profile.displayName || ''),
    officialEmail: String(profile.officialEmail || ''),
    phone: typeof phoneValue === 'string' ? phoneValue : String(phoneValue?.e164 || phoneValue || ''),
    registrationNumber: String(profile.registrationNumber || ''),
    taxIdentifier: String(profile.taxIdentifier || ''),
    licenseNumber: String(profile.licenseNumber || ''),
    addressLine1: String(registeredAddress.addressLine1 || ''),
    city: String(registeredAddress.city || ''),
    region: String(registeredAddress.region || ''),
    representativeName: String(representative.fullName || ''),
    representativeTitle: String(representative.title || ''),
    representativeEmail: String(representative.email || ''),
  };
}

export function readVerificationDraft(key) {
  if (!key || !key.startsWith(PREFIX)) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.formVersion !== VERIFICATION_DRAFT_FORM_VERSION) return null;
    if (!parsed?.fields || typeof parsed.fields !== 'object') return null;
    const fields = {};
    for (const name of SAFE_VERIFICATION_DRAFT_FIELDS) {
      const value = parsed.fields[name];
      if (typeof value === 'string' || typeof value === 'boolean') fields[name] = value;
    }
    return {
      formVersion: parsed.formVersion,
      verificationStatus: String(parsed.verificationStatus || ''),
      verificationVersion: Number(parsed.verificationVersion) || 0,
      fields,
    };
  } catch {
    return null;
  }
}

export function writeVerificationDraft(key, { verificationStatus, verificationVersion, fields }) {
  if (!key || !key.startsWith(PREFIX)) return;
  const safe = {};
  for (const name of SAFE_VERIFICATION_DRAFT_FIELDS) {
    const value = fields?.[name];
    if (typeof value === 'string' || typeof value === 'boolean') safe[name] = value;
  }
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        formVersion: VERIFICATION_DRAFT_FORM_VERSION,
        verificationStatus: String(verificationStatus || ''),
        verificationVersion: Number(verificationVersion) || 0,
        fields: safe,
      })
    );
  } catch {
    /* ignore */
  }
}

export function clearVerificationDraft(key) {
  if (!key || !key.startsWith(PREFIX)) return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearVerificationDraftsForAccount({ realm, accountId }) {
  const needle = `${PREFIX}${VERIFICATION_DRAFT_FORM_VERSION}:${realm}:${accountId}:`;
  try {
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(needle)) toRemove.push(key);
    }
    toRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

export function applySafeDraftToProfile(profile, draftFields = {}) {
  const next = { ...profile };
  const address = { ...(profile.registeredAddress || {}) };
  for (const name of SAFE_VERIFICATION_DRAFT_FIELDS) {
    if (!(name in draftFields)) continue;
    if (name === 'googleMapsUrl') {
      address.googleMapsUrl = draftFields[name];
      continue;
    }
    next[name] = draftFields[name];
  }
  next.registeredAddress = address;
  return next;
}
