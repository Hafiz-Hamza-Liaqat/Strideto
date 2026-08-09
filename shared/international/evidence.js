/**
 * Source / evidence primitive (Mission 1 — International Foundation).
 *
 * Mission 5 owns full Source Verification + Freshness. Mission 1 establishes
 * ONLY the base contract so later schemas do not fragment: what a cited source
 * looks like and how provenance timestamps are recorded. It builds NO scraping,
 * ingestion or freshness automation, and populates NO university/test data.
 *
 * Client- and server-safe: pure JS.
 */

/** Coarse source classification. Extended by later missions, never renamed. */
export const SOURCE_TYPES = Object.freeze({
  OFFICIAL: 'official', // primary authority (gov / institution / employer)
  DOCUMENT: 'document', // an uploaded/attached document
  THIRD_PARTY: 'third_party', // aggregator / press / directory
  USER_SUBMITTED: 'user_submitted',
  OTHER: 'other',
});

const TYPE_SET = new Set(Object.values(SOURCE_TYPES));

/** True for a known source type. */
export function isValidSourceType(value) {
  return typeof value === 'string' && TYPE_SET.has(value);
}

/** True for an HTTP(S) URL. Other schemes are rejected for a web source. */
export function isValidSourceUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function normalizeInstant(value, label, errors) {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    errors.push(`${label} is not a valid date`);
    return undefined;
  }
  return d.toISOString();
}

/**
 * Validate + normalize a source/evidence reference.
 *
 * @param {object} input
 * @param {string} [input.sourceUrl] http(s) URL (required unless a document ref)
 * @param {string} input.sourceType one of SOURCE_TYPES
 * @param {string} [input.publisher] authority/publisher name
 * @param {Date|string} [input.retrievedAt]
 * @param {Date|string} [input.verifiedAt]
 * @param {string} [input.evidenceRef] opaque reference to stored evidence
 * @param {object} [input.provenance] structured provenance metadata
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateSource(input = {}) {
  const errors = [];
  const out = {};

  if (!isValidSourceType(input.sourceType)) errors.push('sourceType is invalid');
  else out.sourceType = input.sourceType;

  const hasUrl = input.sourceUrl !== undefined && input.sourceUrl !== null && str(input.sourceUrl);
  const evidenceRef = str(input.evidenceRef);
  if (hasUrl) {
    if (!isValidSourceUrl(input.sourceUrl)) errors.push('sourceUrl must be an http(s) URL');
    else out.sourceUrl = str(input.sourceUrl);
  } else if (!evidenceRef && out.sourceType !== SOURCE_TYPES.DOCUMENT) {
    errors.push('a sourceUrl or evidenceRef is required');
  }
  if (evidenceRef) out.evidenceRef = evidenceRef;

  out.publisher = str(input.publisher);

  const retrievedAt = normalizeInstant(input.retrievedAt, 'retrievedAt', errors);
  if (retrievedAt) out.retrievedAt = retrievedAt;
  const verifiedAt = normalizeInstant(input.verifiedAt, 'verifiedAt', errors);
  if (verifiedAt) out.verifiedAt = verifiedAt;

  if (input.provenance !== undefined && input.provenance !== null) {
    if (typeof input.provenance !== 'object' || Array.isArray(input.provenance)) {
      errors.push('provenance must be a plain object');
    } else {
      out.provenance = input.provenance;
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: out };
}
