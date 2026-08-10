/**
 * Verified Data Launch — manifest parsing, validation and fingerprinting
 * (Mission 25).
 *
 * Pure computation over an in-memory manifest object or a JSON string.
 * No DB access, no filesystem access, no network. Safe to run in tests.
 *
 * A bad record never aborts the run: it is recorded as invalid with a
 * record/field/reason triple and planning continues over the remainder.
 * Structural failures (bad JSON, unsupported schema version, oversized batch)
 * fail the whole manifest closed — there is nothing trustworthy to plan.
 */
import { createHash } from 'crypto';
import {
  LAUNCH_LIMITS,
  MANIFEST_SCHEMA_VERSION,
  PROVENANCE_ORIGINS,
  canonicalizeValue,
  evaluateLaunchFreshness,
  isLaunchableAuthorityType,
  isLaunchableOrigin,
  isNonCanonicalAuthorityToken,
  isSupportedManifestVersion,
  isValidBatchId,
  isValidEnvironmentIntent,
  isValidLaunchEntityType,
  isValidProvenanceOrigin,
  isValidRecordKey,
  isValidSourceStatus,
  materialFactKeys,
  normalizeManifestForFingerprint,
  validateLaunchSourceUrl,
  FORBIDDEN_ENVIRONMENT_INTENTS,
  ENTITY_DEPENDENCY_FIELDS,
  LAUNCH_FRESHNESS_DECISIONS,
  canAssertScope,
  attributionForOrigin,
} from '../../../../shared/data/verifiedLaunch.js';
import {
  deriveFreshness,
  isValidFreshnessState,
  authorityTier,
} from '../../../../shared/trust/sourceVerification.js';
import { isValidSourceType } from '../../../../shared/international/evidence.js';
import { isValidCountryCode } from '../../../../shared/international/country.js';
import { normalizeCurrency, currencyMinorUnits } from '../../../../shared/international/currency.js';
import { isValidTimeZone } from '../../../../shared/international/timezone.js';
import {
  isValidAcceptanceScope,
  isValidAcceptanceStatus,
} from '../../../../shared/education/acceptanceExplorer.js';

// ── Structural failure ───────────────────────────────────────────────────────

export class ManifestStructureError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ManifestStructureError';
    this.code = code;
  }
}

// ── Safe JSON parsing ────────────────────────────────────────────────────────

/**
 * Parse manifest JSON with hard bounds. Rejects oversized payloads before
 * JSON.parse so a hostile file cannot exhaust memory through the parser.
 *
 * @param {string} raw
 * @returns {object}
 */
export function parseManifestJson(raw) {
  if (typeof raw !== 'string') {
    throw new ManifestStructureError('manifest_not_a_string', 'manifest input must be a string');
  }
  const bytes = Buffer.byteLength(raw, 'utf8');
  if (bytes > LAUNCH_LIMITS.MAX_MANIFEST_BYTES) {
    throw new ManifestStructureError(
      'manifest_too_large',
      `manifest exceeds ${LAUNCH_LIMITS.MAX_MANIFEST_BYTES} bytes`
    );
  }

  // Detect duplicate object keys, which JSON.parse silently last-wins.
  const duplicate = findDuplicateJsonKey(raw);
  if (duplicate) {
    throw new ManifestStructureError(
      'manifest_duplicate_json_key',
      `duplicate JSON key: ${duplicate}`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ManifestStructureError('manifest_malformed_json', `malformed JSON: ${err.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ManifestStructureError('manifest_not_an_object', 'manifest must be a JSON object');
  }
  // Prototype-pollution guard: reject reserved keys anywhere in the tree.
  assertNoReservedKeys(parsed);
  return parsed;
}

const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertNoReservedKeys(value, depth = 0) {
  if (depth > LAUNCH_LIMITS.MAX_OBJECT_DEPTH) {
    throw new ManifestStructureError('manifest_too_deep', 'manifest nesting exceeds allowed depth');
  }
  if (Array.isArray(value)) {
    if (value.length > LAUNCH_LIMITS.MAX_RECORDS_PER_BATCH) {
      throw new ManifestStructureError('manifest_array_too_long', 'array exceeds allowed length');
    }
    for (const entry of value) assertNoReservedKeys(entry, depth + 1);
    return;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    for (const key of keys) {
      if (RESERVED_KEYS.has(key)) {
        throw new ManifestStructureError('manifest_reserved_key', `reserved key not allowed: ${key}`);
      }
      assertNoReservedKeys(value[key], depth + 1);
    }
  }
}

/**
 * Scan raw JSON text for a duplicate key within the same object literal.
 * Returns the first duplicate key found, or null.
 */
function findDuplicateJsonKey(raw) {
  const stack = [];
  let i = 0;
  const n = raw.length;
  let expectKey = false;

  while (i < n) {
    const ch = raw[i];
    if (ch === '"') {
      // Read the string token.
      let j = i + 1;
      let str = '';
      while (j < n) {
        if (raw[j] === '\\') {
          str += raw[j + 1];
          j += 2;
          continue;
        }
        if (raw[j] === '"') break;
        str += raw[j];
        j += 1;
      }
      // A string is a key when the next non-space char is ':'.
      let k = j + 1;
      while (k < n && /\s/.test(raw[k])) k += 1;
      if (raw[k] === ':' && stack.length && stack[stack.length - 1]) {
        const seen = stack[stack.length - 1];
        if (seen.has(str)) return str;
        seen.add(str);
      }
      i = j + 1;
      expectKey = false;
      continue;
    }
    if (ch === '{') stack.push(new Set());
    else if (ch === '[') stack.push(null);
    else if (ch === '}' || ch === ']') stack.pop();
    i += 1;
    void expectKey;
  }
  return null;
}

// ── Fingerprint ──────────────────────────────────────────────────────────────

/**
 * Deterministic SHA-256 over the normalized manifest content.
 * Independent of key/array insertion order; independent of batchId, createdAt,
 * createdByProcess and reviewState.
 */
export function manifestFingerprint(manifest) {
  const normalized = normalizeManifestForFingerprint(manifest);
  return createHash('sha256').update(JSON.stringify(normalized), 'utf8').digest('hex');
}

/** Opaque, non-reversible digest of a claimed value (FactProvenance contract). */
export function claimValueFingerprint(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalizeValue(value ?? null)), 'utf8')
    .digest('hex');
}

// ── Field-level validators ───────────────────────────────────────────────────

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isSafeString(v, max = LAUNCH_LIMITS.MAX_STRING_LENGTH) {
  return typeof v === 'string' && v.length <= max;
}

/** Strict ISO-8601 instant. Rejects "2026-13-40" and other rolled-over dates. */
export function parseIsoInstant(value) {
  if (typeof value !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Strict date-only value. Returned as the original `YYYY-MM-DD` string —
 * a date-only fact never acquires a time-of-day or a timezone here.
 */
export function parseDateOnly(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return value;
}

/**
 * Validate an imported Money value against the Mission 1 contract:
 * integer minor units + ISO 4217 currency. No floats, and no blanket hundred-fold
 * division — the currency's own minor-unit scale is authoritative.
 *
 * @returns {{ ok: true, value: object } | { ok: false, reason: string }}
 */
export function validateLaunchMoney(value) {
  if (!isPlainObject(value)) return { ok: false, reason: 'money_not_an_object' };
  const currency = normalizeCurrency(value.currency);
  if (!currency) return { ok: false, reason: 'money_currency_invalid' };
  const amount = value.amountMinor;
  if (amount === null || amount === undefined) {
    // Unknown amount is legitimate; currency alone with no amount is not money.
    return { ok: false, reason: 'money_amount_missing' };
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    return { ok: false, reason: 'money_amount_not_integer_minor_units' };
  }
  if (!Number.isSafeInteger(amount)) return { ok: false, reason: 'money_amount_unsafe_integer' };
  if (amount < 0) return { ok: false, reason: 'money_amount_negative' };
  return {
    ok: true,
    value: { amountMinor: amount, currency, minorUnits: currencyMinorUnits(currency) },
  };
}

// ── Source snapshot validation ───────────────────────────────────────────────

/**
 * Validate one sourceSnapshot entry against Mission 5 provenance semantics
 * and Mission 25 URL safety. Derives freshness from stored metadata only —
 * no live source check is performed.
 */
export function validateSourceEntry(entry, { now = new Date() } = {}) {
  const errors = [];
  if (!isPlainObject(entry)) {
    return { ok: false, errors: [{ field: 'source', reason: 'source_not_an_object' }] };
  }

  const sourceKey = entry.sourceKey;
  if (!isValidRecordKey(sourceKey)) {
    errors.push({ field: 'sourceKey', reason: 'source_key_invalid' });
  }

  const urlCheck = validateLaunchSourceUrl(entry.url);
  if (!urlCheck.ok) errors.push({ field: 'url', reason: urlCheck.reason });

  if (!isValidSourceType(entry.sourceType)) {
    errors.push({ field: 'sourceType', reason: 'source_type_invalid' });
  }

  if (isNonCanonicalAuthorityToken(entry.authorityType)) {
    errors.push({
      field: 'authorityType',
      reason: 'authority_type_cannot_be_canonical_verified',
    });
  } else if (!isLaunchableAuthorityType(entry.authorityType)) {
    errors.push({ field: 'authorityType', reason: 'authority_type_invalid' });
  }

  if (!isSafeString(entry.publisher, 300) || !entry.publisher.trim()) {
    errors.push({ field: 'publisher', reason: 'publisher_required' });
  }

  if (!isValidSourceStatus(entry.status)) {
    errors.push({ field: 'status', reason: 'source_status_invalid' });
  }

  if (entry.countryCode !== undefined && entry.countryCode !== null && entry.countryCode !== '') {
    if (!isValidCountryCode(entry.countryCode)) {
      errors.push({ field: 'countryCode', reason: 'country_code_invalid' });
    }
  }

  const lastVerifiedAt = entry.lastVerifiedAt ? parseIsoInstant(entry.lastVerifiedAt) : null;
  if (entry.lastVerifiedAt && !lastVerifiedAt) {
    errors.push({ field: 'lastVerifiedAt', reason: 'last_verified_at_invalid_iso_instant' });
  }
  if (lastVerifiedAt && lastVerifiedAt.getTime() > new Date(now).getTime()) {
    errors.push({ field: 'lastVerifiedAt', reason: 'last_verified_at_in_the_future' });
  }

  const retrievedAt = entry.retrievedAt ? parseIsoInstant(entry.retrievedAt) : null;
  if (entry.retrievedAt && !retrievedAt) {
    errors.push({ field: 'retrievedAt', reason: 'retrieved_at_invalid_iso_instant' });
  }

  const nextReviewAt = entry.nextReviewAt ? parseIsoInstant(entry.nextReviewAt) : null;
  if (entry.nextReviewAt && !nextReviewAt) {
    errors.push({ field: 'nextReviewAt', reason: 'next_review_at_invalid_iso_instant' });
  }

  if (entry.dataType !== undefined && !isSafeString(entry.dataType, 60)) {
    errors.push({ field: 'dataType', reason: 'data_type_invalid' });
  }

  if (errors.length) return { ok: false, errors, sourceKey };

  // Freshness is derived from stored metadata, never from a live check.
  const freshnessState = deriveFreshness({
    lastVerifiedAt,
    nextReviewAt,
    sourceStatus: entry.status,
    dataType: entry.dataType || null,
    now,
  });

  return {
    ok: true,
    value: {
      sourceKey,
      url: entry.url.trim(),
      normalizedUrl: urlCheck.normalizedUrl,
      sourceType: entry.sourceType,
      authorityType: entry.authorityType,
      authorityTier: authorityTier(entry.authorityType),
      publisher: entry.publisher.trim(),
      label: isSafeString(entry.label, 300) ? entry.label : '',
      countryCode: entry.countryCode ? String(entry.countryCode).toUpperCase() : '',
      status: entry.status,
      dataType: entry.dataType || 'source_default',
      lastVerifiedAt: lastVerifiedAt ? lastVerifiedAt.toISOString() : null,
      retrievedAt: retrievedAt ? retrievedAt.toISOString() : null,
      nextReviewAt: nextReviewAt ? nextReviewAt.toISOString() : null,
      freshnessState,
      isOfficialDomain: entry.isOfficialDomain === true,
    },
  };
}

// ── Record validation ────────────────────────────────────────────────────────

function validateEffectiveWindow(payload, errors) {
  const from = payload.effectiveFrom;
  const to = payload.effectiveTo ?? payload.effectiveUntil;

  const parsedFrom = from ? parseDateOnly(from) || parseIsoInstant(from) : null;
  if (from && !parsedFrom) {
    errors.push({ field: 'effectiveFrom', reason: 'effective_from_invalid_date' });
  }
  const parsedTo = to ? parseDateOnly(to) || parseIsoInstant(to) : null;
  if (to && !parsedTo) {
    errors.push({ field: 'effectiveTo', reason: 'effective_to_invalid_date' });
  }
  if (parsedFrom && parsedTo) {
    const a = new Date(typeof parsedFrom === 'string' ? `${parsedFrom}T00:00:00Z` : parsedFrom);
    const b = new Date(typeof parsedTo === 'string' ? `${parsedTo}T00:00:00Z` : parsedTo);
    if (a.getTime() > b.getTime()) {
      errors.push({ field: 'effectiveTo', reason: 'effective_window_inverted' });
    }
  }
  return { effectiveFrom: parsedFrom ?? null, effectiveTo: parsedTo ?? null };
}

function validateEntityPayload(entityType, payload, errors) {
  if (!isPlainObject(payload)) {
    errors.push({ field: 'payload', reason: 'payload_not_an_object' });
    return;
  }
  if (Object.keys(payload).length > LAUNCH_LIMITS.MAX_OBJECT_KEYS) {
    errors.push({ field: 'payload', reason: 'payload_too_many_keys' });
    return;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' && value.length > LAUNCH_LIMITS.MAX_STRING_LENGTH) {
      errors.push({ field: `payload.${key}`, reason: 'string_too_long' });
    }
    if (Array.isArray(value) && value.length > LAUNCH_LIMITS.MAX_ARRAY_LENGTH) {
      errors.push({ field: `payload.${key}`, reason: 'array_too_long' });
    }
  }

  if (payload.countryCode !== undefined && payload.countryCode !== '') {
    if (!isValidCountryCode(payload.countryCode)) {
      errors.push({ field: 'payload.countryCode', reason: 'country_code_invalid' });
    }
  }
  if (payload.country !== undefined && payload.country !== '') {
    if (!isValidCountryCode(payload.country)) {
      errors.push({ field: 'payload.country', reason: 'country_code_invalid' });
    }
  }
  if (Array.isArray(payload.countryCodes)) {
    payload.countryCodes.forEach((code, i) => {
      if (!isValidCountryCode(code)) {
        errors.push({ field: `payload.countryCodes[${i}]`, reason: 'country_code_invalid' });
      }
    });
  }
  if (Array.isArray(payload.destinationCountries)) {
    payload.destinationCountries.forEach((code, i) => {
      if (!isValidCountryCode(code)) {
        errors.push({ field: `payload.destinationCountries[${i}]`, reason: 'country_code_invalid' });
      }
    });
  }
  if (payload.timeZone !== undefined && payload.timeZone !== '') {
    if (!isValidTimeZone(payload.timeZone)) {
      errors.push({ field: 'payload.timeZone', reason: 'time_zone_invalid' });
    }
  }

  // Money-bearing fields
  if (payload.tuition !== undefined && payload.tuition !== null) {
    const money = validateLaunchMoney(payload.tuition);
    if (!money.ok) errors.push({ field: 'payload.tuition', reason: money.reason });
  }
  if (isPlainObject(payload.funding) && payload.funding.amountMinor !== undefined
      && payload.funding.amountMinor !== null) {
    const money = validateLaunchMoney(payload.funding);
    if (!money.ok) errors.push({ field: 'payload.funding', reason: money.reason });
  }

  // Date-only deadlines stay date-only.
  if (payload.deadlineDate !== undefined && payload.deadlineDate !== null) {
    if (!parseDateOnly(payload.deadlineDate)) {
      errors.push({ field: 'payload.deadlineDate', reason: 'deadline_must_be_date_only' });
    }
  }

  validateEffectiveWindow(payload, errors);

  // Entity-specific required identity
  switch (entityType) {
    case 'canonical_institution':
      if (!isSafeString(payload.officialName, 300) || !payload.officialName.trim()) {
        errors.push({ field: 'payload.officialName', reason: 'official_name_required' });
      }
      if (!isValidCountryCode(payload.countryCode)) {
        errors.push({ field: 'payload.countryCode', reason: 'country_code_required' });
      }
      break;
    case 'test_provider':
      if (!isSafeString(payload.name, 300) || !payload.name.trim()) {
        errors.push({ field: 'payload.name', reason: 'name_required' });
      }
      break;
    case 'test':
      if (!isSafeString(payload.name, 300) || !payload.name.trim()) {
        errors.push({ field: 'payload.name', reason: 'name_required' });
      }
      if (!isSafeString(payload.category, 60) || !payload.category) {
        errors.push({ field: 'payload.category', reason: 'category_required' });
      }
      break;
    case 'program':
      if (!isSafeString(payload.name, 300) || !payload.name.trim()) {
        errors.push({ field: 'payload.name', reason: 'name_required' });
      }
      if (!isSafeString(payload.degreeLevel, 60) || !payload.degreeLevel) {
        errors.push({ field: 'payload.degreeLevel', reason: 'degree_level_required' });
      }
      break;
    case 'test_acceptance':
      if (!isValidAcceptanceStatus(payload.acceptanceStatus)) {
        errors.push({ field: 'payload.acceptanceStatus', reason: 'acceptance_status_invalid' });
      }
      if (!isValidAcceptanceScope(payload.acceptanceScope)) {
        errors.push({ field: 'payload.acceptanceScope', reason: 'acceptance_scope_invalid' });
      }
      if (payload.acceptanceScope === 'country' && !isValidCountryCode(payload.countryCode)) {
        errors.push({ field: 'payload.countryCode', reason: 'country_scope_requires_country_code' });
      }
      if (payload.minimumOverallScore !== undefined && payload.minimumOverallScore !== null) {
        if (typeof payload.minimumOverallScore !== 'number'
            || !Number.isFinite(payload.minimumOverallScore)) {
          errors.push({ field: 'payload.minimumOverallScore', reason: 'minimum_score_not_numeric' });
        }
      }
      break;
    case 'canonical_scholarship':
      if (!isSafeString(payload.title, 300) || !payload.title.trim()) {
        errors.push({ field: 'payload.title', reason: 'title_required' });
      }
      if (!isPlainObject(payload.provider) || !isSafeString(payload.provider.name, 300)
          || !payload.provider.name?.trim()) {
        errors.push({ field: 'payload.provider.name', reason: 'provider_name_required' });
      }
      break;
    default:
      break;
  }
}

/**
 * Validate one manifest record.
 *
 * @param {object} record
 * @param {object} ctx
 * @param {Map<string, object>} ctx.sourcesByKey validated sources, already
 *   carrying the freshness state derived from their stored metadata
 * @returns {{ ok: boolean, errors?: Array, value?: object }}
 */
export function validateRecord(record, { sourcesByKey } = {}) {
  const errors = [];

  if (!isPlainObject(record)) {
    return { ok: false, errors: [{ field: 'record', reason: 'record_not_an_object' }] };
  }

  const recordKey = record.recordKey;
  if (!isValidRecordKey(recordKey)) {
    errors.push({ field: 'recordKey', reason: 'record_key_invalid' });
  }

  const entityType = record.entityType;
  if (!isValidLaunchEntityType(entityType)) {
    errors.push({ field: 'entityType', reason: 'entity_type_unsupported' });
    // Without a known entity type nothing else can be checked meaningfully.
    return { ok: false, errors, recordKey, entityType };
  }

  const operation = record.operation ?? 'upsert';
  if (operation !== 'upsert') {
    errors.push({ field: 'operation', reason: 'operation_intent_unsupported' });
  }

  // ── Provenance origin: the synthetic/demo firewall ────────────────────────
  const provenance = isPlainObject(record.provenance) ? record.provenance : null;
  if (!provenance) {
    errors.push({ field: 'provenance', reason: 'provenance_required' });
  } else {
    if (!isValidProvenanceOrigin(provenance.origin)) {
      errors.push({ field: 'provenance.origin', reason: 'provenance_origin_invalid' });
    } else if (!isLaunchableOrigin(provenance.origin)) {
      errors.push({
        field: 'provenance.origin',
        reason: `provenance_origin_not_launchable:${provenance.origin}`,
      });
    }
    if (provenance.origin === PROVENANCE_ORIGINS.INSTITUTION_OFFICIAL) {
      if (!isSafeString(provenance.submittedByInstitutionKey, 160)
          || !provenance.submittedByInstitutionKey) {
        errors.push({
          field: 'provenance.submittedByInstitutionKey',
          reason: 'institution_official_requires_institution_attribution',
        });
      }
    }
  }

  // ── Record-level sources ──────────────────────────────────────────────────
  const sourceKeys = Array.isArray(provenance?.sourceKeys) ? provenance.sourceKeys : [];
  if (!sourceKeys.length) {
    errors.push({ field: 'provenance.sourceKeys', reason: 'source_required' });
  }
  if (sourceKeys.length > LAUNCH_LIMITS.MAX_SOURCES_PER_RECORD) {
    errors.push({ field: 'provenance.sourceKeys', reason: 'too_many_sources' });
  }

  const resolvedSources = [];
  for (const key of sourceKeys.slice(0, LAUNCH_LIMITS.MAX_SOURCES_PER_RECORD)) {
    const src = sourcesByKey?.get(key);
    if (!src) {
      errors.push({ field: 'provenance.sourceKeys', reason: `source_not_found:${String(key).slice(0, 80)}` });
      continue;
    }
    resolvedSources.push(src);
  }

  // ── Fact-level provenance for material facts ──────────────────────────────
  const facts = isPlainObject(provenance?.facts) ? provenance.facts : {};
  if (Object.keys(facts).length > LAUNCH_LIMITS.MAX_FACT_ENTRIES_PER_RECORD) {
    errors.push({ field: 'provenance.facts', reason: 'too_many_fact_entries' });
  }
  const payload = record.payload;
  const materialKeys = materialFactKeys(entityType);
  const unsourcedFacts = [];
  for (const key of materialKeys) {
    const present = isPlainObject(payload)
      && payload[key] !== undefined
      && payload[key] !== null
      && !(Array.isArray(payload[key]) && payload[key].length === 0);
    if (!present) continue; // unknown optional fields legitimately stay unknown
    const factSourceKey = facts[key];
    if (!factSourceKey || !sourcesByKey?.get(factSourceKey)) {
      unsourcedFacts.push(key);
      errors.push({ field: `provenance.facts.${key}`, reason: 'material_fact_unsourced' });
    }
  }

  // ── Payload ───────────────────────────────────────────────────────────────
  validateEntityPayload(entityType, payload, errors);

  // ── Scope authority (Mission 6) ───────────────────────────────────────────
  if (entityType === 'test_acceptance' && isPlainObject(payload) && resolvedSources.length) {
    const scope = payload.acceptanceScope;
    const bestSource = [...resolvedSources].sort(
      (a, b) => (a.authorityTier ?? 99) - (b.authorityTier ?? 99)
    )[0];
    if (!canAssertScope(scope, bestSource.authorityType)) {
      errors.push({
        field: 'payload.acceptanceScope',
        reason: `scope_not_assertable_by_authority:${bestSource.authorityType}`,
      });
    }
  }

  // ── Dependency references ─────────────────────────────────────────────────
  const depFields = ENTITY_DEPENDENCY_FIELDS[entityType] ?? {};
  const dependencies = [];
  const declaredDeps = isPlainObject(record.dependencies) ? record.dependencies : {};
  for (const [field, depType] of Object.entries(depFields)) {
    const value = declaredDeps[field];
    if (value === undefined || value === null || value === '') continue;
    if (!isValidRecordKey(value)) {
      errors.push({ field: `dependencies.${field}`, reason: 'dependency_key_invalid' });
      continue;
    }
    dependencies.push({ field, entityType: depType, recordKey: value });
  }
  // Required dependencies
  if (entityType === 'program' && !declaredDeps.institutionKey) {
    errors.push({ field: 'dependencies.institutionKey', reason: 'program_requires_institution' });
  }
  if (entityType === 'program_requirement' && !declaredDeps.programKey) {
    errors.push({ field: 'dependencies.programKey', reason: 'requirement_requires_program' });
  }
  if (entityType === 'test_acceptance' && !declaredDeps.testKey) {
    errors.push({ field: 'dependencies.testKey', reason: 'acceptance_requires_test' });
  }
  if (entityType === 'scholarship_applicability' && !declaredDeps.scholarshipKey) {
    errors.push({ field: 'dependencies.scholarshipKey', reason: 'applicability_requires_scholarship' });
  }

  // ── Review metadata ───────────────────────────────────────────────────────
  const review = isPlainObject(record.review) ? record.review : {};
  if (review.decision !== undefined && !['approved', 'rejected'].includes(review.decision)) {
    errors.push({ field: 'review.decision', reason: 'review_decision_invalid' });
  }

  if (errors.length) {
    return { ok: false, errors, recordKey, entityType };
  }

  // ── Freshness gate over resolved sources ──────────────────────────────────
  // The record inherits the *weakest* freshness among its sources: a record is
  // only as current as its least-current evidence.
  const FRESHNESS_RANK = { fresh: 0, review_due: 1, stale: 2, broken: 3, unknown: 4 };
  const weakest = resolvedSources.reduce(
    (worst, src) =>
      (FRESHNESS_RANK[src.freshnessState] ?? 4) > (FRESHNESS_RANK[worst] ?? -1)
        ? src.freshnessState
        : worst,
    'fresh'
  );
  const freshness = evaluateLaunchFreshness(weakest, review);

  const bestAuthority = [...resolvedSources].sort(
    (a, b) => (a.authorityTier ?? 99) - (b.authorityTier ?? 99)
  )[0];

  const window = validateEffectiveWindow(isPlainObject(payload) ? payload : {}, []);

  return {
    ok: true,
    value: {
      recordKey,
      entityType,
      operation,
      payload,
      dependencies,
      declaredDependencies: declaredDeps,
      provenance: {
        origin: provenance.origin,
        attribution: attributionForOrigin(provenance.origin),
        submittedByInstitutionKey: provenance.submittedByInstitutionKey ?? null,
        sourceKeys: resolvedSources.map((s) => s.sourceKey),
        facts,
      },
      sources: resolvedSources,
      sourceAuthority: bestAuthority?.authorityType ?? null,
      sourceAuthorityTier: bestAuthority?.authorityTier ?? null,
      freshnessState: weakest,
      freshnessDecision: freshness.decision,
      freshnessReason: freshness.reason,
      lastVerifiedAt: resolvedSources.reduce(
        (min, s) => (s.lastVerifiedAt && (!min || s.lastVerifiedAt < min) ? s.lastVerifiedAt : min),
        null
      ),
      effectiveFrom: window.effectiveFrom,
      effectiveTo: window.effectiveTo,
      countryCode:
        (isPlainObject(payload) && (payload.countryCode || payload.country)) || '',
      review,
      unsourcedFacts,
      valueFingerprint: claimValueFingerprint(payload),
    },
  };
}

// ── Whole-manifest validation ────────────────────────────────────────────────

/**
 * Validate a manifest object end to end.
 *
 * Structural problems throw ManifestStructureError (fail closed).
 * Per-record problems are collected; the remainder still validates.
 *
 * @param {object} manifest
 * @param {object} [opts]
 * @param {Date} [opts.now] injectable clock
 * @returns {object} validation result
 */
export function validateManifest(manifest, { now = new Date() } = {}) {
  if (!isPlainObject(manifest)) {
    throw new ManifestStructureError('manifest_not_an_object', 'manifest must be an object');
  }

  // ── Schema version: required and fails closed on anything unknown ─────────
  if (manifest.manifestVersion === undefined || manifest.manifestVersion === null) {
    throw new ManifestStructureError(
      'manifest_version_required',
      'manifestVersion is required'
    );
  }
  if (!isSupportedManifestVersion(manifest.manifestVersion)) {
    throw new ManifestStructureError(
      'manifest_version_unsupported',
      `unsupported manifestVersion ${String(manifest.manifestVersion)}; supported: ${MANIFEST_SCHEMA_VERSION}`
    );
  }

  if (!isValidBatchId(manifest.batchId)) {
    throw new ManifestStructureError('manifest_batch_id_invalid', 'batchId is invalid');
  }

  const intent = manifest.environmentIntent;
  if (typeof intent === 'string'
      && FORBIDDEN_ENVIRONMENT_INTENTS.includes(intent.trim().toLowerCase())) {
    throw new ManifestStructureError(
      'manifest_environment_intent_forbidden',
      'environmentIntent must not target production or staging in this mission'
    );
  }
  if (!isValidEnvironmentIntent(intent)) {
    throw new ManifestStructureError(
      'manifest_environment_intent_invalid',
      'environmentIntent must be local, test or nonproduction'
    );
  }

  const rawRecords = manifest.records;
  const rawSources = manifest.sourceSnapshot;
  if (!Array.isArray(rawRecords)) {
    throw new ManifestStructureError('manifest_records_not_an_array', 'records must be an array');
  }
  if (!Array.isArray(rawSources)) {
    throw new ManifestStructureError(
      'manifest_sources_not_an_array',
      'sourceSnapshot must be an array'
    );
  }
  if (rawRecords.length > LAUNCH_LIMITS.MAX_RECORDS_PER_BATCH) {
    throw new ManifestStructureError(
      'manifest_too_many_records',
      `records exceed the ${LAUNCH_LIMITS.MAX_RECORDS_PER_BATCH}-record batch bound`
    );
  }
  if (rawSources.length > LAUNCH_LIMITS.MAX_SOURCES_PER_BATCH) {
    throw new ManifestStructureError(
      'manifest_too_many_sources',
      `sourceSnapshot exceeds the ${LAUNCH_LIMITS.MAX_SOURCES_PER_BATCH}-source bound`
    );
  }

  // ── Sources ───────────────────────────────────────────────────────────────
  const sourcesByKey = new Map();
  const invalidSources = [];
  const seenSourceKeys = new Set();
  const seenNormalizedUrls = new Map();

  for (let i = 0; i < rawSources.length; i += 1) {
    const entry = rawSources[i];
    const key = isPlainObject(entry) ? entry.sourceKey : undefined;
    if (typeof key === 'string' && seenSourceKeys.has(key)) {
      throw new ManifestStructureError(
        'manifest_duplicate_source_key',
        `duplicate sourceKey: ${key.slice(0, 80)}`
      );
    }
    if (typeof key === 'string') seenSourceKeys.add(key);

    const result = validateSourceEntry(entry, { now });
    if (!result.ok) {
      invalidSources.push({
        index: i,
        sourceKey: typeof key === 'string' ? key.slice(0, 160) : null,
        errors: result.errors,
      });
      continue;
    }
    const prior = seenNormalizedUrls.get(result.value.normalizedUrl);
    if (prior) {
      invalidSources.push({
        index: i,
        sourceKey: result.value.sourceKey,
        errors: [{ field: 'url', reason: `duplicate_normalized_url_of:${prior}` }],
      });
      continue;
    }
    seenNormalizedUrls.set(result.value.normalizedUrl, result.value.sourceKey);
    sourcesByKey.set(result.value.sourceKey, result.value);
  }

  // ── Records ───────────────────────────────────────────────────────────────
  const validRecords = [];
  const invalidRecords = [];
  const seenRecordKeys = new Set();

  for (let i = 0; i < rawRecords.length; i += 1) {
    const raw = rawRecords[i];
    const key = isPlainObject(raw) ? raw.recordKey : undefined;
    if (typeof key === 'string' && seenRecordKeys.has(key)) {
      throw new ManifestStructureError(
        'manifest_duplicate_record_key',
        `duplicate recordKey: ${key.slice(0, 80)}`
      );
    }
    if (typeof key === 'string') seenRecordKeys.add(key);

    const result = validateRecord(raw, { sourcesByKey });
    if (!result.ok) {
      invalidRecords.push({
        index: i,
        recordKey: typeof key === 'string' ? key.slice(0, 160) : null,
        entityType: result.entityType ?? null,
        errors: result.errors,
      });
      continue;
    }
    validRecords.push(result.value);
  }

  const fingerprint = manifestFingerprint(manifest);

  const summary = {
    totalRecords: rawRecords.length,
    validRecords: validRecords.length,
    invalidRecords: invalidRecords.length,
    totalSources: rawSources.length,
    validSources: sourcesByKey.size,
    invalidSources: invalidSources.length,
    freshnessEligible: validRecords.filter(
      (r) => r.freshnessDecision === LAUNCH_FRESHNESS_DECISIONS.ELIGIBLE
    ).length,
    freshnessReviewRequired: validRecords.filter(
      (r) => r.freshnessDecision === LAUNCH_FRESHNESS_DECISIONS.REVIEW_REQUIRED
    ).length,
  };

  return {
    ok: invalidRecords.length === 0 && invalidSources.length === 0,
    manifestVersion: manifest.manifestVersion,
    batchId: manifest.batchId,
    environmentIntent: intent,
    scope: isPlainObject(manifest.scope) ? manifest.scope : null,
    createdAt: manifest.createdAt ?? null,
    createdByProcess: isSafeString(manifest.createdByProcess, 160)
      ? manifest.createdByProcess
      : '',
    reviewState: manifest.reviewState ?? 'draft',
    fingerprint,
    sources: [...sourcesByKey.values()],
    records: validRecords,
    invalidRecords,
    invalidSources,
    summary,
  };
}

export { isValidFreshnessState };
