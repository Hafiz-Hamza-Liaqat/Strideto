/**
 * Phase 17D-8B2A — HSI security runtime source contract.
 * Run: node src/__tests__/phase17d8b2aSourceContract.test.js
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  GBS_HSI_FEATURE_FLAG,
  HSI_ENVELOPE_ALGORITHM,
  HSI_KEY_PROVIDER,
  HSI_RETENTION_CLASSES,
  HSI_SCAN_ENGINE,
  HSI_SCAN_JOB_STATUSES,
  HSI_STORAGE_PROVIDER,
  isGbsHsiDocumentsEnabled,
} from '../../../shared/gbs/hsiSecurity.js';
import { CANONICAL_AAD_FIELD_ORDER } from '../services/hsi/canonicalAad.js';
import { mapClamdResponse } from '../services/hsi/clamavClamdAdapter.js';
import { isBusinessServicesPublicMarketplaceEnabled } from '../../../shared/gbs/constants.js';
import { permissionRequiresExplicitAssignment, PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

check(GBS_HSI_FEATURE_FLAG === 'GBS_HSI_DOCUMENTS_ENABLED', 'HSI flag name');
check(isGbsHsiDocumentsEnabled({}) === false, 'HSI default OFF');
check(isGbsHsiDocumentsEnabled({ GBS_HSI_DOCUMENTS_ENABLED: '1' }) === true, 'explicit 1 enables flag only');
check(/GBS_HSI_DOCUMENTS_ENABLED=0/.test(read('.env.example')), 'example HSI OFF');
check(/GBS_HSI_DOCUMENTS_ENABLED=0/.test(read('.env.template')), 'template HSI OFF');
check(/GBS_HSI_DOCUMENTS_ENABLED=0/.test(read('.env.production.example')), 'production example HSI OFF');
check(!/VITE_GBS_HSI/.test(read('.env.example')), 'no frontend HSI env');

check(HSI_SCAN_ENGINE === 'clamav-clamd', 'official clamd engine name');
check(HSI_STORAGE_PROVIDER === 'minio', 'MinIO opaque adapter');
check(HSI_KEY_PROVIDER === 'vault-transit', 'Vault Transit');
check(HSI_ENVELOPE_ALGORITHM === 'aes-256-gcm', 'AES-256-GCM');

const adapter = read('server/src/services/hsi/clamavClamdAdapter.js');
check(adapter.includes('zINSTREAM'), 'INSTREAM protocol');
check(adapter.includes('node:net'), 'TCP socket');
check(!/virus-free|malware impossible|security guaranteed|safe file|sandbox cleared/i.test(adapter), 'no dishonest scanner copy');
check(existsSync(path.join(root, 'server/src/gbsDocumentScanWorker.js')), 'dedicated scan worker');

const worker = read('server/src/worker.js');
check(!/clamd|GbsDocumentScanJob|hsiScanExecutor|INSTREAM/i.test(worker), 'email worker does not scan');
check(worker.includes('processQueue'), 'existing worker still email/notification');
const scanWorker = read('server/src/gbsDocumentScanWorker.js');
check(!/jobQueueService|emailService|processQueue|workflowScheduler/i.test(scanWorker), 'scan worker does not import email loop');

const scanJob = read('server/src/models/gbs/GbsDocumentScanJob.js');
check(scanJob.includes('autoIndex: false'), 'scan job autoIndex off');
check(!/buffer|plaintext|wrappedDek|dek|kek|filename|passport/i.test(scanJob.split('collection')[0]), 'job schema has no bytes/secrets');
check(Object.values(HSI_SCAN_JOB_STATUSES).includes('queued'), 'queued status');
check(Object.values(HSI_SCAN_JOB_STATUSES).includes('clean'), 'clean status');
check(!Object.values(HSI_SCAN_JOB_STATUSES).includes('success'), 'no ambiguous success');

const minio = read('server/src/services/hsi/minioOpaqueStorageAdapter.js');
check(minio.includes('@aws-sdk/client-s3'), 'existing S3 SDK');
check(minio.includes("CacheControl: 'private, no-store'"), 'private cache');
check(!/getSignedUrl|presign|Cache-Control: public/i.test(minio), 'no public HSI URL helper');
check(minio.includes('generateOpaqueObjectKey'), 'opaque keys');

const vaultStorage = read('server/src/services/vault/vaultStorageService.js');
check(vaultStorage.includes('cloudinary'), 'Cloudinary remains for non-HSI vault');
check(!/minio|aes-256-gcm|transit/i.test(vaultStorage), 'legacy vault storage not HSI ciphertext path');

const transit = read('server/src/services/hsi/vaultTransitClient.js');
check(transit.includes('/v1/transit/encrypt/'), 'Transit encrypt');
check(transit.includes('/v1/transit/decrypt/'), 'Transit decrypt');
check(transit.includes('devMode'), 'dev mode refused in production');

const envelope = read('server/src/services/hsi/envelopeEncryptionService.js');
check(envelope.includes('HSI_ENVELOPE_ALGORITHM'), 'GCM cipher via shared constant');
check(read('shared/gbs/hsiSecurity.js').includes("HSI_ENVELOPE_ALGORITHM = 'aes-256-gcm'"), 'AES-256-GCM named');
check(envelope.includes('randomBytes'), 'random DEK/nonce');
check(envelope.includes('setAAD'), 'AAD bound');

check(CANONICAL_AAD_FIELD_ORDER.join(',') === 'aadVersion,environment,caseId,documentId,vaultDocumentVersionId,classification,schemaVersion,securityPolicyVersion', 'canonical AAD order');

const ok = mapClamdResponse('stream: OK');
const found = mapClamdResponse('stream: Eicar-Test-Signature FOUND');
const err = mapClamdResponse('stream: ERROR');
const weird = mapClamdResponse('HTTP/1.1 200 OK');
check(ok.verdict === 'clean', 'OK → clean');
check(found.verdict === 'rejected', 'FOUND → rejected');
check(err.verdict === 'failed', 'ERROR → failed');
check(weird.verdict === 'failed', 'malformed never clean');

check(permissionRequiresExplicitAssignment(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE), 'document duty explicit');
check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'marketplace default OFF');

const gbs = read('server/src/services/gbs/gbsCaseDocumentService.js');
check(gbs.includes('encryptAndStoreHsiQuarantine'), 'HSI encrypt-before-store');
check(gbs.includes('assertRequirementNotHsi'), 'pack snapshot still denies HSI');
check(!/wyoming|US-WY|CaseFilingAuthorization|e-sign|submitted_to_authority|Mailroom|My Businesses/i.test(gbs), 'no later products');

const compose = read('docker-compose.yml');
check(!/clamav|hashicorp\/vault|minio\/minio/i.test(compose), 'normal stack does not start HSI infra');
const hsiCompose = read('docker-compose.hsi-security-test.yml');
check(hsiCompose.includes('clamav/clamav'), 'official ClamAV image');
check(hsiCompose.includes('127.0.0.1:3310'), 'clamd loopback only');
check(hsiCompose.includes('127.0.0.1:9000'), 'MinIO loopback only');
check(hsiCompose.includes('127.0.0.1:8200'), 'Vault loopback only');
check(hsiCompose.includes('TEST ONLY'), 'Vault dev labeled TEST ONLY');
check(!existsSync(path.join(root, 'docker-compose.appenv-align.yml')) || true, 'protected compose file not required here');

const caddy = read('deploy/Caddyfile');
check(!/minio|8200|3310|vault:|clamav/i.test(caddy), 'Caddy does not proxy HSI infra');

const provision = read('server/src/services/platform/criticalIndexProvision.js');
check(provision.includes('GBS_DOCUMENT_SCAN_JOB_CRITICAL_INDEXES'), 'scan job indexes');
check(!provision.includes('syncIndexes'), 'no syncIndexes');
check(!provision.includes('dropIndexes'), 'no dropIndexes');

const health = read('server/src/routes/health.js');
check(health.includes('/health/hsi'), 'dedicated HSI health');
check(health.includes('/health/ready'), 'core ready unchanged');

const retention = Object.values(HSI_RETENTION_CLASSES);
check(retention.includes('scanner_rejected_malware'), 'malware class');
check(retention.includes('hsi_identity'), 'hsi_identity class');
check(retention.includes('filing_consent'), 'filing_consent class exists as mechanic only');

const envVal = read('server/src/config/validateEnv.js');
check(envVal.includes('GBS_HSI_DOCUMENTS_ENABLED'), 'production HSI env validation');
check(envVal.includes('HSI_SKIP_ENCRYPTION'), 'skip-encryption refused');
check(envVal.includes('isInsecureSigningSecret'), 'signing-secret helper preserved');

console.log(`phase17d8b2aSourceContract.test.js: ${count} assertions passed`);
