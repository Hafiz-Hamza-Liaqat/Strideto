/**
 * Phase 17D-8B2A — envelope crypto + canonical AAD (no KMS).
 * Run: node src/__tests__/phase17d8b2aEnvelopeCrypto.test.js
 */
import assert from 'node:assert/strict';
import {
  decryptCiphertextWithDek,
  encryptPlaintextWithDek,
  generateDek,
} from '../services/hsi/envelopeEncryptionService.js';
import { canonicalAadBuffer, encodeCanonicalAad } from '../services/hsi/canonicalAad.js';

const plaintext = Buffer.from('%PDF-1.4 synthetic-hsi-fixture');
const aad = canonicalAadBuffer({
  environment: 'test',
  caseId: 'case-1',
  documentId: 'doc-1',
  vaultDocumentVersionId: 'ver-1',
  classification: 'highly_sensitive_identity',
  schemaVersion: '17d-8b1.0',
  securityPolicyVersion: 'hsi-policy.v1',
});

{
  const dek = generateDek();
  const dekCopy = Buffer.from(dek);
  const sealed = encryptPlaintextWithDek(plaintext, dek, aad);
  assert.notEqual(sealed.ciphertext.equals(plaintext), true, 'ciphertext != plaintext');
  const round = decryptCiphertextWithDek({
    ciphertext: sealed.ciphertext,
    dek: dekCopy,
    nonce: sealed.nonce,
    authTag: sealed.authTag,
    aadBuffer: aad,
  });
  assert.equal(round.equals(plaintext), true, 'roundtrip');
}

{
  const dek = generateDek();
  const sealed = encryptPlaintextWithDek(plaintext, dek, aad);
  const wrongAad = canonicalAadBuffer({
    environment: 'staging',
    caseId: 'case-1',
    documentId: 'doc-1',
    vaultDocumentVersionId: 'ver-1',
    classification: 'highly_sensitive_identity',
    schemaVersion: '17d-8b1.0',
    securityPolicyVersion: 'hsi-policy.v1',
  });
  assert.throws(() => decryptCiphertextWithDek({
    ciphertext: sealed.ciphertext,
    dek: generateDek(),
    nonce: sealed.nonce,
    authTag: sealed.authTag,
    aadBuffer: aad,
  }), /document_encryption_failed/, 'wrong DEK fails');
  const dek2 = generateDek();
  const sealed2 = encryptPlaintextWithDek(plaintext, dek2, aad);
  assert.throws(() => decryptCiphertextWithDek({
    ciphertext: sealed2.ciphertext,
    dek: Buffer.from(dek2),
    nonce: sealed2.nonce,
    authTag: sealed2.authTag,
    aadBuffer: wrongAad,
  }), /document_encryption_failed/, 'wrong environment AAD fails');
}

{
  const dek = generateDek();
  const dekCopy = Buffer.from(dek);
  const sealed = encryptPlaintextWithDek(plaintext, dek, aad);
  const tampered = Buffer.from(sealed.ciphertext);
  tampered[0] ^= 0xff;
  assert.throws(() => decryptCiphertextWithDek({
    ciphertext: tampered,
    dek: dekCopy,
    nonce: sealed.nonce,
    authTag: sealed.authTag,
    aadBuffer: aad,
  }), /document_encryption_failed/, 'tampered ciphertext fails');
}

{
  const a = encodeCanonicalAad({
    environment: 'test',
    caseId: 'c',
    documentId: 'd',
    vaultDocumentVersionId: 'v',
    classification: 'highly_sensitive_identity',
    schemaVersion: 's',
    securityPolicyVersion: 'p',
  });
  const b = encodeCanonicalAad({
    schemaVersion: 's',
    classification: 'highly_sensitive_identity',
    vaultDocumentVersionId: 'v',
    documentId: 'd',
    caseId: 'c',
    environment: 'test',
    securityPolicyVersion: 'p',
  });
  assert.equal(a, b, 'canonical encoding ignores input object order');
}

console.log('phase17d8b2aEnvelopeCrypto.test.js: assertions passed');
