/**
 * Deterministic catalog revision fingerprint (Phase 17D-2).
 *
 * Proves revision identity over normalized non-secret catalog data.
 * Does NOT prove legal validity. Does not hash HTML bodies.
 */
function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function canonicalizeCatalogValue(value) {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeCatalogValue(item));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (key.startsWith('_')) continue;
      out[key] = canonicalizeCatalogValue(value[key]);
    }
    return out;
  }
  return String(value);
}

const FINGERPRINT_OMIT = new Set([
  'recordVersion',
  'reviewedBy',
  'notes',
  'adminNotes',
  'createdAt',
  'updatedAt',
]);

export function catalogFingerprintPayload(record = {}) {
  const src = { ...record };
  for (const key of FINGERPRINT_OMIT) delete src[key];
  return canonicalizeCatalogValue(src);
}

export function catalogFingerprintCanonical(record = {}) {
  return JSON.stringify(catalogFingerprintPayload(record));
}
