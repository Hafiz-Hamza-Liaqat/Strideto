/**
 * Generic audit primitive (Mission 1 — International Foundation).
 *
 * A bounded, standards-shaped audit *record contract* for future Trust,
 * Payments, Cases and Admin. It complements (does not replace) the existing
 * server audit service / AuditLog model; those keep working unchanged. This
 * contract's job is to give new domains ONE shape and, critically, to keep
 * secrets and sensitive payloads out of audit metadata.
 *
 * Immutable-event semantics: an audit record describes something that already
 * happened and is never mutated after creation.
 *
 * Mission 1 does NOT retrofit existing actions onto this primitive — later
 * missions adopt it incrementally.
 *
 * Client- and server-safe: pure JS.
 */
import { isValidRealm } from './realms.js';

/**
 * Metadata keys that must never appear in an audit record — secrets, raw card
 * data, private document bodies. Matching is case-insensitive and substring so
 * `authToken`, `card_number`, `cvv2` are all rejected.
 */
export const FORBIDDEN_METADATA_KEY_PATTERNS = Object.freeze([
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'sessionid',
  'session_id',
  'privatekey',
  'private_key',
  'card',
  'cardnumber',
  'pan',
  'cvv',
  'cvc',
  'iban',
  'ssn',
  'documentcontent',
  'document_content',
]);

const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
const NORM_FORBIDDEN = FORBIDDEN_METADATA_KEY_PATTERNS.map(norm);

/** True when a metadata key name matches a forbidden pattern. */
export function isForbiddenMetadataKey(key) {
  const n = norm(key);
  return NORM_FORBIDDEN.some((bad) => n.includes(bad));
}

/**
 * Recursively scan metadata for forbidden keys. Returns the list of offending
 * key paths (empty when clean). Bounded by `maxDepth` so a pathological nested
 * object cannot stall the check.
 */
export function findForbiddenMetadataKeys(metadata, { maxDepth = 6 } = {}) {
  const offenders = [];
  const walk = (obj, depth, path) => {
    if (depth > maxDepth || !obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const here = path ? `${path}.${key}` : key;
      if (isForbiddenMetadataKey(key)) offenders.push(here);
      const val = obj[key];
      if (val && typeof val === 'object') walk(val, depth + 1, here);
    }
  };
  walk(metadata, 0, '');
  return offenders;
}

/**
 * Validate + normalize a generic audit record.
 *
 * @param {object} input
 * @param {string} input.actorRealm one of the canonical realms
 * @param {string} [input.actorId]
 * @param {string} input.action verb, e.g. 'organization.created'
 * @param {string} [input.targetType]
 * @param {string} [input.targetId]
 * @param {object} [input.metadata] structured, non-sensitive
 * @param {string} [input.correlationId] request/trace id when available
 * @param {Date|string} [input.timestamp]
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateAuditRecord(input = {}) {
  const errors = [];
  const out = {};

  if (!isValidRealm(input.actorRealm)) errors.push('actorRealm is invalid');
  else out.actorRealm = input.actorRealm;

  if (typeof input.action !== 'string' || !input.action.trim()) {
    errors.push('action is required');
  } else {
    out.action = input.action.trim();
  }

  out.actorId = input.actorId != null ? String(input.actorId) : '';
  out.targetType = typeof input.targetType === 'string' ? input.targetType.trim() : '';
  out.targetId = input.targetId != null ? String(input.targetId) : '';
  out.correlationId = input.correlationId != null ? String(input.correlationId) : '';

  const metadata = input.metadata == null ? {} : input.metadata;
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    errors.push('metadata must be a plain object');
  } else {
    const offenders = findForbiddenMetadataKeys(metadata);
    if (offenders.length) {
      errors.push(`metadata contains forbidden key(s): ${offenders.join(', ')}`);
    } else {
      out.metadata = metadata;
    }
  }

  const ts = input.timestamp ? new Date(input.timestamp) : new Date();
  if (Number.isNaN(ts.getTime())) errors.push('timestamp is invalid');
  else out.timestamp = ts.toISOString();

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: out };
}
