/**
 * Per-version AES-256-GCM envelope encryption.
 *
 * DEK is never persisted in plaintext. Wrapping is Vault Transit.
 * Decrypt failures fail closed — no partial plaintext.
 */
import crypto from 'node:crypto';
import { HSI_ENVELOPE_ALGORITHM } from '../../../../shared/gbs/hsiSecurity.js';

export const HSI_DEK_BYTES = 32;
export const HSI_NONCE_BYTES = 12;
export const HSI_AUTH_TAG_BYTES = 16;

export function generateDek() {
  return crypto.randomBytes(HSI_DEK_BYTES);
}

export function generateNonce() {
  return crypto.randomBytes(HSI_NONCE_BYTES);
}

export function encryptPlaintextWithDek(plaintext, dek, aadBuffer) {
  if (!Buffer.isBuffer(plaintext) || plaintext.length < 1) {
    const err = new Error('document_encryption_failed');
    err.code = 'document_encryption_failed';
    throw err;
  }
  if (!Buffer.isBuffer(dek) || dek.length !== HSI_DEK_BYTES) {
    const err = new Error('document_encryption_failed');
    err.code = 'document_encryption_failed';
    throw err;
  }
  const nonce = generateNonce();
  const cipher = crypto.createCipheriv(HSI_ENVELOPE_ALGORITHM, dek, nonce);
  cipher.setAAD(aadBuffer);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  if (authTag.length !== HSI_AUTH_TAG_BYTES) {
    const err = new Error('document_encryption_failed');
    err.code = 'document_encryption_failed';
    throw err;
  }
  return { ciphertext, nonce, authTag, algorithm: HSI_ENVELOPE_ALGORITHM };
}

export function createGcmDecipher({ dek, nonce, authTag, aadBuffer }) {
  if (!Buffer.isBuffer(dek) || dek.length !== HSI_DEK_BYTES) {
    const err = new Error('document_encryption_failed');
    err.code = 'document_encryption_failed';
    throw err;
  }
  if (!Buffer.isBuffer(nonce) || nonce.length !== HSI_NONCE_BYTES) {
    const err = new Error('document_encryption_failed');
    err.code = 'document_encryption_failed';
    throw err;
  }
  if (!Buffer.isBuffer(authTag) || authTag.length !== HSI_AUTH_TAG_BYTES) {
    const err = new Error('document_encryption_failed');
    err.code = 'document_encryption_failed';
    throw err;
  }
  const decipher = crypto.createDecipheriv(HSI_ENVELOPE_ALGORITHM, dek, nonce);
  decipher.setAAD(aadBuffer);
  decipher.setAuthTag(authTag);
  return decipher;
}

export function decryptCiphertextWithDek({ ciphertext, dek, nonce, authTag, aadBuffer }) {
  try {
    const decipher = createGcmDecipher({ dek, nonce, authTag, aadBuffer });
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext;
  } catch {
    const err = new Error('document_encryption_failed');
    err.code = 'document_encryption_failed';
    err.status = 403;
    throw err;
  } finally {
    if (Buffer.isBuffer(dek)) dek.fill(0);
  }
}
