/**
 * Encrypt-then-quarantine and authorized decrypt for HSI ciphertext.
 * Plaintext is never written to MinIO.
 */
import crypto from 'node:crypto';
import {
  HSI_AAD_SCHEMA_VERSION,
  HSI_ENVELOPE_ALGORITHM,
  HSI_KEY_PROVIDER,
  HSI_SECURITY_POLICY_VERSION,
  HSI_STORAGE_CLASSES,
  HSI_STORAGE_PROVIDER,
  HSI_SECURITY_CODES,
} from '../../../../shared/gbs/hsiSecurity.js';
import { loadHsiSecurityConfig } from '../../config/hsiSecurityConfig.js';
import { canonicalAadBuffer, transitWrapContext } from './canonicalAad.js';
import {
  decryptCiphertextWithDek,
  encryptPlaintextWithDek,
  generateDek,
} from './envelopeEncryptionService.js';
import {
  createHsiMinioClient,
  generateOpaqueObjectKey,
  getHsiCiphertext,
  promoteHsiCiphertext,
  putHsiCiphertext,
} from './minioOpaqueStorageAdapter.js';
import { unwrapDataKey, wrapDataKey } from './vaultTransitClient.js';

function deny(code, status = 503) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  throw err;
}

export function plaintextSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function aadFieldsFromEncryption(encryption, version) {
  return {
    aadVersion: encryption?.aadVersion || HSI_AAD_SCHEMA_VERSION,
    environment: encryption?.environment,
    caseId: encryption?.caseId,
    documentId: encryption?.documentId || String(version?.documentId || ''),
    vaultDocumentVersionId: encryption?.vaultDocumentVersionId || String(version?._id || ''),
    classification: encryption?.classification,
    schemaVersion: encryption?.schemaVersion,
    securityPolicyVersion: encryption?.securityPolicyVersion || HSI_SECURITY_POLICY_VERSION,
  };
}

export async function encryptAndStoreHsiQuarantine({
  plaintext,
  aadFields,
  env = process.env,
} = {}) {
  const config = loadHsiSecurityConfig(env);
  if (!config.enabled) deny(HSI_SECURITY_CODES.DISABLED, 403);
  if (config.skipEncryption || config.productionForbidden) deny(HSI_SECURITY_CODES.ENCRYPTION_FAILED, 503);
  if (!config.kmsConfigured) deny(HSI_SECURITY_CODES.KMS_UNAVAILABLE);
  if (!config.storageConfigured) deny(HSI_SECURITY_CODES.STORAGE_UNAVAILABLE);

  const dek = generateDek();
  const aadBuffer = canonicalAadBuffer(aadFields);
  const wrapContext = transitWrapContext(aadFields.environment);
  let wrapped;
  try {
    wrapped = await wrapDataKey(config.vault, dek, { context: wrapContext, nodeEnv: env.NODE_ENV });
  } catch (err) {
    dek.fill(0);
    deny(err?.code || HSI_SECURITY_CODES.KMS_UNAVAILABLE);
  }
  const sealed = encryptPlaintextWithDek(plaintext, dek, aadBuffer);
  dek.fill(0);

  const client = createHsiMinioClient(config.minio);
  const key = generateOpaqueObjectKey();
  await putHsiCiphertext(client, {
    bucket: config.minio.quarantineBucket,
    key,
    ciphertext: sealed.ciphertext,
  });

  return {
    storageKey: key,
    storageProvider: HSI_STORAGE_PROVIDER,
    storageClass: HSI_STORAGE_CLASSES.QUARANTINE,
    quarantineBucket: config.minio.quarantineBucket,
    cleanBucket: config.minio.cleanBucket,
    checksum: plaintextSha256(plaintext),
    encryption: {
      algorithm: HSI_ENVELOPE_ALGORITHM,
      keyProvider: HSI_KEY_PROVIDER,
      transitKeyName: wrapped.transitKeyName,
      transitKeyVersion: wrapped.keyVersion,
      wrappedDek: wrapped.wrappedDek,
      nonce: sealed.nonce.toString('base64'),
      authTag: sealed.authTag.toString('base64'),
      aadVersion: aadFields.aadVersion || HSI_AAD_SCHEMA_VERSION,
      securityPolicyVersion: aadFields.securityPolicyVersion || HSI_SECURITY_POLICY_VERSION,
      classification: aadFields.classification,
      schemaVersion: aadFields.schemaVersion,
      environment: aadFields.environment,
      caseId: String(aadFields.caseId),
      documentId: String(aadFields.documentId),
      vaultDocumentVersionId: String(aadFields.vaultDocumentVersionId),
    },
  };
}

export async function decryptHsiVersionBytes(version, { env = process.env, aadOverrides = {} } = {}) {
  if (!version?.encryption?.wrappedDek) deny(HSI_SECURITY_CODES.ENCRYPTION_FAILED, 403);
  const config = loadHsiSecurityConfig(env);
  const fields = { ...aadFieldsFromEncryption(version.encryption, version), ...aadOverrides };
  const aadBuffer = canonicalAadBuffer(fields);
  const wrapContext = transitWrapContext(fields.environment);
  let dek;
  try {
    dek = await unwrapDataKey(config.vault, version.encryption.wrappedDek, {
      context: wrapContext,
      nodeEnv: env.NODE_ENV,
    });
  } catch {
    deny(HSI_SECURITY_CODES.KMS_UNAVAILABLE);
  }
  const bucket = version.storageClass === HSI_STORAGE_CLASSES.CLEAN
    ? version.cleanBucket
    : version.quarantineBucket;
  if (!bucket || !version.storageKey) deny(HSI_SECURITY_CODES.STORAGE_UNAVAILABLE);
  const client = createHsiMinioClient(config.minio);
  const ciphertext = await getHsiCiphertext(client, { bucket, key: version.storageKey });
  return decryptCiphertextWithDek({
    ciphertext,
    dek,
    nonce: Buffer.from(version.encryption.nonce, 'base64'),
    authTag: Buffer.from(version.encryption.authTag, 'base64'),
    aadBuffer,
  });
}

export async function promoteHsiVersionCiphertext(version, { env = process.env } = {}) {
  const config = loadHsiSecurityConfig(env);
  const client = createHsiMinioClient(config.minio);
  return promoteHsiCiphertext(client, {
    quarantineBucket: version.quarantineBucket || config.minio.quarantineBucket,
    cleanBucket: version.cleanBucket || config.minio.cleanBucket,
    key: version.storageKey,
  });
}

export function isHsiEncryptedVersion(version) {
  return version?.encryption?.algorithm === HSI_ENVELOPE_ALGORITHM
    && version?.storageProvider === HSI_STORAGE_PROVIDER;
}
