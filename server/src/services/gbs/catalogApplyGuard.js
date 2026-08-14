/**
 * Refuse persistent Strideto catalog apply (Phase 17D-2).
 * Isolated test DB names only. Never edurozgaar / staging / production.
 */
const FORBIDDEN_DB_NAMES = new Set(['edurozgaar', 'strideto', 'test', 'admin']);

export function parseCatalogImportMode(argv = process.argv.slice(2)) {
  const apply = argv.includes('--apply');
  return { apply, dryRun: !apply };
}

export function databaseNameFromUri(uri) {
  if (typeof uri !== 'string' || !uri.trim()) return '';
  try {
    const u = new URL(uri.replace(/^mongodb\+srv/i, 'https').replace(/^mongodb/i, 'https'));
    return (u.pathname || '').replace(/^\//, '').split('?')[0];
  } catch {
    const m = String(uri).match(/\/([A-Za-z0-9_-]+)(?:\?|$)/);
    return m ? m[1] : '';
  }
}

export function isIsolatedCatalogTestDb(name) {
  return typeof name === 'string' && /^strideto_17d2_[a-z0-9_-]+$/i.test(name);
}

export function assertCatalogApplyAllowed({ apply, dbName, confirm } = {}) {
  if (!apply) return { ok: true, dryRun: true };
  if (FORBIDDEN_DB_NAMES.has(String(dbName || '').toLowerCase())) {
    return { ok: false, error: 'persistent_catalog_import_forbidden' };
  }
  if (!isIsolatedCatalogTestDb(dbName)) {
    return { ok: false, error: 'catalog_apply_requires_isolated_17d2_db' };
  }
  if (confirm !== '1') {
    return { ok: false, error: 'catalog_apply_confirm_required' };
  }
  return { ok: true, dryRun: false };
}
