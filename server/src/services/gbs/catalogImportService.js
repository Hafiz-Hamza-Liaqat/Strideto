/**
 * Idempotent GBS catalog import (Phase 17D-2).
 * Default dry-run. Never deletes. Supersession creates history.
 */
import { catalogFingerprintCanonical } from '../../../../shared/gbs/catalogFingerprint.js';
import { loadGbsCatalogManifest } from '../../../../shared/gbs/catalog/index.js';
import { assertCatalogApplyAllowed } from './catalogApplyGuard.js';

function sameFingerprint(existing, incoming) {
  const left = existing?.fingerprintCanonical || catalogFingerprintCanonical(existing || {});
  const right = incoming?.fingerprintCanonical || catalogFingerprintCanonical(incoming || {});
  return left === right;
}

export function createMemoryCatalogStore() {
  const buckets = {
    jurisdictions: new Map(),
    authorities: new Map(),
    sources: new Map(),
    entityTypes: new Map(),
    fees: new Map(),
    rules: new Map(),
  };
  const keyers = {
    jurisdictions: (row) => row.id,
    authorities: (row) => row.authorityId,
    sources: (row) => `${row.sourceId}::${row.sourceVersion || 1}`,
    entityTypes: (row) => row.entityTypeId,
    fees: (row) => `${row.feeId}::${row.sourceVersion || 1}`,
    rules: (row) => `${row.ruleId}::${row.sourceVersion || 1}`,
  };
  return {
    async get(kind, row) {
      return buckets[kind].get(keyers[kind](row)) || null;
    },
    async put(kind, row) {
      buckets[kind].set(keyers[kind](row), { ...row });
    },
    async list(kind) {
      return [...buckets[kind].values()];
    },
  };
}

function classifyRow(existing, incoming) {
  if (!existing) return 'create';
  if (sameFingerprint(existing, incoming) && existing.reviewStatus === incoming.reviewStatus) {
    return 'unchanged';
  }
  if (existing.reviewStatus === 'reviewed' && incoming.reviewStatus === 'reviewed') {
    return 'revision';
  }
  if (incoming.reviewStatus === 'stale') return 'stale';
  if (incoming.reviewStatus === 'rejected') return 'rejected';
  return 'update';
}

export async function importGbsCatalog({
  manifest = loadGbsCatalogManifest(),
  store = createMemoryCatalogStore(),
  apply = false,
  dbName = '',
  confirm = process.env.STRIDETO_GBS_CATALOG_APPLY_CONFIRM,
} = {}) {
  const guard = assertCatalogApplyAllowed({ apply, dbName, confirm });
  if (!guard.ok) {
    throw Object.assign(new Error(guard.error), { status: 403, code: guard.error });
  }

  const counts = {
    create: 0,
    update: 0,
    revision: 0,
    unchanged: 0,
    stale: 0,
    rejected: 0,
    invalid: 0,
  };

  const groups = [
    ['jurisdictions', manifest.jurisdictions],
    ['authorities', manifest.authorities],
    ['sources', manifest.sources],
    ['entityTypes', manifest.entityTypes],
    ['fees', manifest.fees],
    ['rules', manifest.rules],
  ];

  for (const [kind, rows] of groups) {
    for (const incoming of rows) {
      if (!incoming) {
        counts.invalid += 1;
        continue;
      }
      const existing = await store.get(kind, incoming);
      const action = classifyRow(existing, incoming);
      counts[action] = (counts[action] || 0) + 1;
      if (!apply || action === 'unchanged') continue;
      if (action === 'revision' && existing) {
        const superseded = {
          ...existing,
          superseded: true,
          supersededBy: `${incoming.sourceId || incoming.feeId || incoming.ruleId}::${incoming.sourceVersion}`,
          reviewStatus: 'superseded',
        };
        await store.put(kind, superseded);
      }
      await store.put(kind, incoming);
    }
  }

  return {
    mode: apply ? 'apply' : 'dry-run',
    schemaVersion: manifest.schemaVersion,
    researchDate: manifest.researchDate,
    persistentImport: false,
    ...counts,
  };
}
