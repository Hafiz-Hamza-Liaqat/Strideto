/**
 * Engineering restore CLI for encrypted HSI objects.
 * Not production DR evidence.
 *
 *   node src/scripts/hsiRestoreFoundation.js export --version-id <id> --dir <path>
 *   node src/scripts/hsiRestoreFoundation.js restore --dir <path> --bucket <bucket>
 */
import { connectDB, disconnectDB } from '../config/db.js';
import { VaultDocumentVersion } from '../models/vault/VaultDocumentVersion.js';
import { loadHsiSecurityConfig } from '../config/hsiSecurityConfig.js';
import { createHsiMinioClient } from '../services/hsi/minioOpaqueStorageAdapter.js';
import { exportHsiVersionArtifact, restoreHsiVersionArtifact } from '../services/hsi/hsiRestoreFoundation.js';

async function main() {
  const [cmd] = process.argv.slice(2);
  const args = Object.fromEntries(
    process.argv.slice(3).reduce((acc, cur, i, arr) => {
      if (cur.startsWith('--') && arr[i + 1]) acc.push([cur.slice(2), arr[i + 1]]);
      return acc;
    }, [])
  );
  await connectDB();
  const config = loadHsiSecurityConfig();
  const client = createHsiMinioClient(config.minio);
  try {
    if (cmd === 'export') {
      const version = await VaultDocumentVersion.findById(args['version-id']);
      if (!version) throw new Error('version_not_found');
      const out = await exportHsiVersionArtifact({ client, version, destDir: args.dir });
      console.log(JSON.stringify({ ok: true, destDir: out.destDir, bytes: out.bytes }));
      return;
    }
    if (cmd === 'restore') {
      const out = await restoreHsiVersionArtifact({
        client,
        destDir: args.dir,
        bucket: args.bucket,
      });
      console.log(JSON.stringify({ ok: true, versionId: String(out.version?._id || ''), bytes: out.ciphertextBytes }));
      return;
    }
    console.error('usage: export|restore');
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
