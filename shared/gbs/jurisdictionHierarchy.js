/**
 * Jurisdiction hierarchy validation (Phase 17D-2).
 *
 * Country → Jurisdiction. No universal `state` field.
 * Unknown parent: DENY. Cycles: DENY. Codes unique within countryCode+code.
 */
import { isValidJurisdictionLevel, CATALOG_REVIEW_STATUSES } from './catalogConstants.js';
import { isValidCountryCode } from '../international/country.js';

export function jurisdictionNamespaceKey(countryCode, code) {
  return `${String(countryCode || '').toUpperCase()}::${String(code || '').toUpperCase()}`;
}

export function validateJurisdictionRecord(input = {}, { knownIds = new Set() } = {}) {
  const errors = [];
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  const code = typeof input.code === 'string' ? input.code.trim().toUpperCase() : '';
  const countryCode = typeof input.countryCode === 'string' ? input.countryCode.trim().toUpperCase() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const level = input.level;
  const parentJurisdictionId =
    input.parentJurisdictionId == null || input.parentJurisdictionId === ''
      ? null
      : String(input.parentJurisdictionId).trim();

  if (!id) errors.push('id is required');
  if (!code) errors.push('code is required');
  if (!isValidCountryCode(countryCode)) errors.push('countryCode must be ISO 3166-1 alpha-2');
  if (!name) errors.push('name is required');
  if (!isValidJurisdictionLevel(level)) errors.push('level is invalid');
  if (level === 'country' && parentJurisdictionId) {
    errors.push('country-level jurisdiction must not have a parent');
  }
  if (level !== 'country' && !parentJurisdictionId) {
    errors.push('non-country jurisdiction requires parentJurisdictionId');
  }
  if (parentJurisdictionId && parentJurisdictionId === id) {
    errors.push('parentJurisdictionId cannot equal id');
  }
  if (parentJurisdictionId && knownIds.size && !knownIds.has(parentJurisdictionId)) {
    errors.push('unknown parentJurisdictionId');
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id,
      code,
      countryCode,
      name,
      level,
      parentJurisdictionId,
      status: input.status || 'active',
      reviewStatus: input.reviewStatus || CATALOG_REVIEW_STATUSES.DRAFT,
      launchCandidate: input.launchCandidate === true,
      launchCoverage: input.launchCoverage === true,
      schemaVersion: input.schemaVersion,
      recordVersion: Number.isInteger(input.recordVersion) ? input.recordVersion : 0,
    },
  };
}

export function detectJurisdictionCycle(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visiting = new Set();
  const visited = new Set();
  const cyclic = [];

  function walk(id, stack) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      cyclic.push([...stack, id]);
      return;
    }
    visiting.add(id);
    const node = byId.get(id);
    if (node?.parentJurisdictionId) {
      if (!byId.has(node.parentJurisdictionId)) {
        cyclic.push([id, node.parentJurisdictionId, 'unknown_parent']);
      } else {
        walk(node.parentJurisdictionId, [...stack, id]);
      }
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const node of nodes) walk(node.id, []);
  return cyclic;
}

export function validateJurisdictionGraph(records = []) {
  const errors = [];
  const parsed = [];
  const ids = new Set();
  const namespace = new Map();

  for (const raw of records) {
    const id = typeof raw?.id === 'string' ? raw.id.trim() : '';
    if (id) ids.add(id);
  }

  for (const raw of records) {
    const result = validateJurisdictionRecord(raw, { knownIds: ids });
    if (!result.ok) {
      errors.push(`${raw?.id || raw?.code || 'unknown'}: ${result.errors.join('; ')}`);
      continue;
    }
    const key = jurisdictionNamespaceKey(result.value.countryCode, result.value.code);
    if (namespace.has(key)) {
      errors.push(`duplicate jurisdiction code in namespace ${key}`);
    } else {
      namespace.set(key, result.value.id);
    }
    parsed.push(result.value);
  }

  const cycles = detectJurisdictionCycle(parsed);
  if (cycles.length) {
    errors.push('jurisdiction hierarchy cycle detected');
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: parsed };
}
