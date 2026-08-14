/**
 * GBS catalog import CLI (Phase 17D-2).
 *
 * Default: dry-run. Persistent Strideto data apply is refused.
 *
 *   node src/scripts/importGbsCatalog.js
 *   node src/scripts/importGbsCatalog.js --apply   # isolated 17d2 DB + confirm only
 */
import { loadGbsCatalogManifest } from '../../../shared/gbs/catalog/index.js';
import { importGbsCatalog, createMemoryCatalogStore } from '../services/gbs/catalogImportService.js';
import {
  parseCatalogImportMode,
  databaseNameFromUri,
  assertCatalogApplyAllowed,
} from '../services/gbs/catalogApplyGuard.js';

export async function runCatalogImportCli({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
  error = console.error,
} = {}) {
  const { apply } = parseCatalogImportMode(argv);
  const dbName = databaseNameFromUri(env.MONGO_URI || env.STRIDETO_17D2_TEST_MONGO_URI || '');
  const guard = assertCatalogApplyAllowed({
    apply,
    dbName,
    confirm: env.STRIDETO_GBS_CATALOG_APPLY_CONFIRM,
  });
  if (apply && !guard.ok) {
    error(`Refusing catalog apply: ${guard.error}`);
    return { ok: false, code: guard.error, persistentImport: false };
  }

  const summary = await importGbsCatalog({
    manifest: loadGbsCatalogManifest(),
    store: createMemoryCatalogStore(),
    apply: false,
    dbName,
    confirm: env.STRIDETO_GBS_CATALOG_APPLY_CONFIRM,
  });
  log(JSON.stringify({ ...summary, persistentImport: false, applyRequested: apply && guard.ok }));
  return { ok: true, summary };
}

const isDirect = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('importGbsCatalog.js');
if (isDirect) {
  runCatalogImportCli().then((result) => {
    if (!result.ok) process.exit(2);
  }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
