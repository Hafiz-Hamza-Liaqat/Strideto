/**
 * Vault private storage abstraction.
 *
 * NEVER exposes raw storage keys or public URLs to clients.
 * All access is mediated through server-authorized routes.
 *
 * Uses the existing storageService for provider-abstracted upload
 * but strips the public URL before returning to vault callers.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_VAULT_DIR = path.join(__dirname, '../../../vault-storage');

let cloudinary = null;

async function getCloudinary() {
  if (cloudinary) return cloudinary;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return null;
  const mod = await import('cloudinary');
  const v2 = mod.v2 || mod.default?.v2;
  v2.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
  cloudinary = v2;
  return cloudinary;
}

function computeChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Upload a file buffer to private vault storage.
 * Returns { storageKey, storageProvider, checksum } — never a public URL.
 */
export async function vaultUploadFile({ buffer, mimeType, userId }) {
  if (!buffer?.length) {
    const err = new Error('Empty file');
    err.status = 400;
    throw err;
  }

  const checksum = computeChecksum(buffer);
  const uniquePart = `${Date.now()}_${crypto.randomBytes(12).toString('hex')}`;
  const folder = `vault/${String(userId)}`;

  const cld = await getCloudinary();
  if (cld) {
    const b64 = buffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${b64}`;
    const publicId = `${folder}/${uniquePart}`;
    const result = await cld.uploader.upload(dataUri, {
      folder,
      resource_type: 'auto',
      public_id: publicId,
      // Store with access_mode private where supported
      access_mode: 'authenticated',
    });
    return {
      storageKey: result.public_id,
      storageProvider: 'cloudinary',
      checksum,
    };
  }

  await fs.mkdir(LOCAL_VAULT_DIR, { recursive: true });
  const filename = `${uniquePart}`;
  const filepath = path.join(LOCAL_VAULT_DIR, filename);
  await fs.writeFile(filepath, buffer);
  return {
    storageKey: filename,
    storageProvider: 'local',
    checksum,
  };
}

/**
 * Stream/retrieve a vault file for authorized server-side access.
 * Returns { buffer, mimeType, storageKey }.
 * NEVER called without prior ownership/grant verification.
 */
export async function vaultRetrieveFile({ storageKey, storageProvider, mimeType }) {
  const provider = storageProvider || 'local';

  if (provider === 'cloudinary') {
    const cld = await getCloudinary();
    if (!cld) throw new Error('Cloudinary not configured');
    // Generate a short-lived signed URL for internal streaming
    const signedUrl = cld.url(storageKey, {
      resource_type: 'auto',
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 60,
      secure: true,
    });
    return { signedUrl, mimeType };
  }

  const filepath = path.join(LOCAL_VAULT_DIR, storageKey);
  const buffer = await fs.readFile(filepath);
  return { buffer, mimeType };
}

/**
 * Delete a vault file from storage (used on hard-purge path, deferred in practice).
 */
export async function vaultDeleteFile({ storageKey, storageProvider }) {
  const provider = storageProvider || 'local';

  if (provider === 'cloudinary') {
    const cld = await getCloudinary();
    if (cld) await cld.uploader.destroy(storageKey, { resource_type: 'auto' });
    return;
  }

  const filepath = path.join(LOCAL_VAULT_DIR, storageKey);
  await fs.unlink(filepath).catch(() => {});
}
