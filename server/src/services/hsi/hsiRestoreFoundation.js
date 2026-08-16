/**
 * Engineering backup/restore helpers for encrypted HSI objects.
 * This is not production DR evidence.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { VaultDocumentVersion } from '../../models/vault/VaultDocumentVersion.js';
import { getHsiCiphertext, putHsiCiphertext } from './minioOpaqueStorageAdapter.js';

export async function exportHsiVersionArtifact({ client, version, destDir }) {
  await fs.mkdir(destDir, { recursive: true });
  const bucket = version.cleanBucket || version.quarantineBucket;
  const ciphertext = await getHsiCiphertext(client, { bucket, key: version.storageKey });
  const meta = {
    vaultDocumentVersionId: String(version._id),
    documentId: String(version.documentId),
    storageKey: version.storageKey,
    storageProvider: version.storageProvider,
    storageClass: version.storageClass,
    quarantineBucket: version.quarantineBucket,
    cleanBucket: version.cleanBucket,
    checksum: version.checksum,
    mimeType: version.mimeType,
    fileSize: version.fileSize,
    scanStatus: version.scanStatus,
    encryption: version.encryption,
  };
  await fs.writeFile(path.join(destDir, 'ciphertext.bin'), ciphertext);
  await fs.writeFile(path.join(destDir, 'metadata.json'), JSON.stringify(meta, null, 2), 'utf8');
  return { destDir, bytes: ciphertext.length };
}

export async function restoreHsiVersionArtifact({
  client,
  destDir,
  bucket,
}) {
  const ciphertext = await fs.readFile(path.join(destDir, 'ciphertext.bin'));
  const meta = JSON.parse(await fs.readFile(path.join(destDir, 'metadata.json'), 'utf8'));
  await putHsiCiphertext(client, { bucket, key: meta.storageKey, ciphertext });
  const updated = await VaultDocumentVersion.findByIdAndUpdate(
    meta.vaultDocumentVersionId,
    {
      $set: {
        storageKey: meta.storageKey,
        storageProvider: meta.storageProvider,
        storageClass: meta.storageClass,
        quarantineBucket: meta.quarantineBucket,
        cleanBucket: meta.cleanBucket,
        checksum: meta.checksum,
        mimeType: meta.mimeType,
        fileSize: meta.fileSize,
        encryption: meta.encryption,
        destroyedAt: null,
      },
    },
    { new: true, upsert: false }
  );
  return { version: updated, ciphertextBytes: ciphertext.length };
}
