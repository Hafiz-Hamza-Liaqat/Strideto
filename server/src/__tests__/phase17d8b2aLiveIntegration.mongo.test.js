/**
 * Phase 17D-8B2A — real ClamAV + MinIO + Vault Transit + scan executor.
 *
 *   STRIDETO_17D8B2A_TEST_MONGO_URI=mongodb://127.0.0.1:27017/strideto_17d8b2a_live_run1
 *   node src/__tests__/phase17d8b2aLiveIntegration.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { HSI_REQUIRED_RETENTION_CLASSES, HSI_RETENTION_CLASSES } from '../../../shared/gbs/hsiSecurity.js';
import {
  clamdInstream,
  clamdPing,
  clamdVersion,
  isClamdSignatureDatabaseReady,
} from '../services/hsi/clamavClamdAdapter.js';
import {
  anonymousGetDenied,
  createHsiMinioClient,
  deleteHsiObject,
  ensurePrivateHsiBuckets,
  generateOpaqueObjectKey,
  getHsiCiphertext,
  promoteHsiCiphertext,
  putHsiCiphertext,
} from '../services/hsi/minioOpaqueStorageAdapter.js';
import {
  ensureTransitKey,
  ensureTransitMount,
  unwrapDataKey,
  wrapDataKey,
} from '../services/hsi/vaultTransitClient.js';
import { generateDek } from '../services/hsi/envelopeEncryptionService.js';
import { transitWrapContext } from '../services/hsi/canonicalAad.js';
import {
  decryptHsiVersionBytes,
  encryptAndStoreHsiQuarantine,
} from '../services/hsi/hsiObjectPipeline.js';
import { enqueueGbsDocumentScanJob, touchScanExecutorHeartbeat, claimNextScanJob } from '../services/hsi/gbsDocumentScanJobService.js';
import { processClaimedScanJob } from '../services/hsi/hsiScanExecutor.js';
import { VaultDocument } from '../models/vault/VaultDocument.js';
import { VaultDocumentVersion } from '../models/vault/VaultDocumentVersion.js';
import { GbsDocumentScanJob } from '../models/gbs/GbsDocumentScanJob.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  GBS_DOCUMENT_SCAN_JOB_CRITICAL_INDEXES,
  provisionMissingIndexes,
} from '../services/platform/criticalIndexProvision.js';
import { exportHsiVersionArtifact, restoreHsiVersionArtifact } from '../services/hsi/hsiRestoreFoundation.js';
import { destroyExpiredHsiCiphertext } from '../services/hsi/hsiRetentionService.js';
import { isHsiDocumentCapabilityReady } from '../services/hsi/hsiCapabilityService.js';
import {
  completeCustomerDocumentUpload,
  createSyntheticHsiRequirementForTest,
  downloadCustomerCaseDocument,
  downloadProviderCaseDocument,
  initializeCustomerDocumentUpload,
} from '../services/gbs/gbsCaseDocumentService.js';
import { activateBusinessClient } from '../services/gbs/gbsBuyerActivationService.js';
import { startPreparation } from '../services/gbs/gbsCaseService.js';
import {
  acceptCustomerQuote,
  createProviderQuote,
  sendProviderQuote,
  updateProviderQuoteDraft,
} from '../services/gbs/gbsQuoteService.js';
import {
  createCustomerServiceRequest,
  readyForQuoteProviderServiceRequest,
  reviewProviderServiceRequest,
} from '../services/gbs/gbsServiceRequestService.js';
import { GbsCase } from '../models/gbs/GbsCase.js';
import { GbsCaseDocumentRequirement } from '../models/gbs/GbsCaseDocumentRequirement.js';
import { GbsCaseDocumentGrant } from '../models/gbs/GbsCaseDocumentGrant.js';
import { GbsServiceRequest } from '../models/gbs/GbsServiceRequest.js';
import { GbsQuote } from '../models/gbs/GbsQuote.js';
import { GbsServiceListing } from '../models/gbs/GbsServiceListing.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { Organization } from '../models/Organization.js';
import { ProviderCapability } from '../models/gbs/ProviderCapability.js';
import { ProviderDomainEnrollment } from '../models/gbs/ProviderDomainEnrollment.js';
import { UserCapabilityGrant } from '../models/capability/UserCapabilityGrant.js';
import { IdempotencyRecord } from '../models/platform/IdempotencyRecord.js';
import { ORGANIZATION_TYPES, ORGANIZATION_STATUSES } from '../../../shared/international/organization.js';
import { AGENT_TYPES } from '../../../shared/agent/constants.js';
import {
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  GBS_LISTING_MODERATION_STATUSES,
  GBS_LISTING_PUBLICATION_STATUSES,
  GBS_PRICING_MODES,
  GBS_SERVICE_REQUEST_ACTING_FOR,
  PROVIDER_SUBJECT_TYPES,
  PROVIDER_TRUST_STATUSES,
} from '../../../shared/gbs/constants.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_DOMAIN_ENROLLMENT_STATUSES, PROVIDER_DOMAIN_IDS, PROVIDER_DOMAIN_INITIALIZATION_STATES } from '../../../shared/provider/providerDomains.js';
import { assignListingPublicSlugIfAbsent } from '../utils/gbsListingSlug.js';
import { GBS_DOCUMENT_SECURITY_CODES } from '../../../shared/gbs/caseDocumentContract.js';

const TEST_URI = process.env.STRIDETO_17D8B2A_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_17d8b2a_live_run1';
if (!/\/strideto_17d8b2a_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D8B2A_TEST_MONGO_URI must name a disposable strideto_17d8b2a_* database');
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const CLEAN_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

function retentionJson() {
  const policy = {};
  for (const cls of HSI_REQUIRED_RETENTION_CLASSES) policy[cls] = 1;
  return JSON.stringify(policy);
}

function runCompose(args, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', '-f', 'docker-compose.hsi-security-test.yml', ...args], {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`docker compose ${args.join(' ')} failed (${code}): ${out.slice(-2000)}`));
    });
  });
}

function blocker(msg) {
  const err = new Error(`17D-8B2A ACCEPTANCE BLOCKER — ${msg}`);
  err.code = 'HSI_ACCEPTANCE_BLOCKER';
  throw err;
}

async function waitFor(fn, ms, label) {
  const start = Date.now();
  let last;
  while (Date.now() - start < ms) {
    try {
      const ok = await fn();
      if (ok) return true;
      last = ok;
    } catch (err) {
      last = err.message;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  blocker(`${label} not proven: ${last}`);
}

const access = process.env.HSI_TEST_MINIO_ROOT_USER || `hsi${crypto.randomBytes(6).toString('hex')}`;
const secret = process.env.HSI_TEST_MINIO_ROOT_PASSWORD || crypto.randomBytes(18).toString('hex');
const vaultToken = process.env.HSI_TEST_VAULT_TOKEN || crypto.randomBytes(18).toString('hex');
const composeEnv = {
  HSI_TEST_MINIO_ROOT_USER: access,
  HSI_TEST_MINIO_ROOT_PASSWORD: secret,
  HSI_TEST_VAULT_TOKEN: vaultToken,
};

const hsiEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'hsi-test',
  GBS_HSI_DOCUMENTS_ENABLED: '1',
  BUSINESS_SERVICES_ENABLED: '1',
  CLAMAV_CLAMD_HOST: '127.0.0.1',
  CLAMAV_CLAMD_PORT: '3310',
  HSI_MINIO_ENDPOINT: 'http://127.0.0.1:9000',
  HSI_MINIO_ACCESS_KEY: access,
  HSI_MINIO_SECRET_KEY: secret,
  HSI_MINIO_QUARANTINE_BUCKET: 'hsi-quarantine-test',
  HSI_MINIO_CLEAN_BUCKET: 'hsi-clean-test',
  HSI_MINIO_FORCE_PATH_STYLE: '1',
  VAULT_ADDR: 'http://127.0.0.1:8200',
  VAULT_TOKEN: vaultToken,
  VAULT_TRANSIT_KEY_NAME: 'hsi-test-transit',
  VAULT_DEV_MODE: '1',
  GBS_HSI_RETENTION_POLICY_JSON: retentionJson(),
};

let startedCompose = false;
const vaultCfg = {
  addr: hsiEnv.VAULT_ADDR,
  token: vaultToken,
  transitKeyName: hsiEnv.VAULT_TRANSIT_KEY_NAME,
  timeoutMs: 8000,
  devMode: true,
};

before(async () => {
  Object.assign(process.env, hsiEnv);
  try {
    await runCompose(['up', '-d'], composeEnv);
    startedCompose = true;
  } catch (err) {
    blocker(`REAL CLAMAV/MINIO/VAULT INTEGRATION NOT PROVEN (${err.message})`);
  }

  await waitFor(async () => {
    const pong = await clamdPing({ host: '127.0.0.1', port: 3310, timeoutMs: 2000 });
    if (!pong) return false;
    const version = await clamdVersion({ host: '127.0.0.1', port: 3310, timeoutMs: 4000 });
    return isClamdSignatureDatabaseReady(version);
  }, 240000, 'REAL CLAMAV INTEGRATION');

  await waitFor(async () => {
    const client = createHsiMinioClient({
      endpoint: hsiEnv.HSI_MINIO_ENDPOINT,
      accessKey: access,
      secretKey: secret,
      forcePathStyle: true,
    });
    await ensurePrivateHsiBuckets(client, {
      quarantineBucket: hsiEnv.HSI_MINIO_QUARANTINE_BUCKET,
      cleanBucket: hsiEnv.HSI_MINIO_CLEAN_BUCKET,
    });
    return true;
  }, 60000, 'REAL MINIO INTEGRATION');

  await waitFor(async () => {
    await ensureTransitMount(vaultCfg, { nodeEnv: 'test' });
    await ensureTransitKey(vaultCfg, { nodeEnv: 'test' });
    return true;
  }, 60000, 'REAL TRANSIT TEST INTEGRATION');

  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(),
    AuditLog.init(),
    VaultDocument.init(),
    VaultDocumentVersion.init(),
    UserCapabilityGrant.init(),
    AgentAccount.init(),
    AgentProfile.init(),
    Organization.init(),
    ProviderCapability.init(),
    ProviderDomainEnrollment.init(),
    GbsServiceListing.init(),
    GbsServiceRequest.init(),
    GbsQuote.init(),
    GbsCase.init(),
    GbsCaseDocumentRequirement.init(),
    GbsCaseDocumentGrant.init(),
    IdempotencyRecord.init(),
  ]);
  await provisionMissingIndexes({
    collection: GbsDocumentScanJob.collection,
    expected: GBS_DOCUMENT_SCAN_JOB_CRITICAL_INDEXES,
  });
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (startedCompose && process.env.HSI_TEST_KEEP_STACK !== '1') {
    await runCompose(['down', '-v'], composeEnv).catch(() => {});
  }
});

test('official clamd maps clean / EICAR / unavailable / timeout fail-closed', { timeout: 60000 }, async () => {
  const clean = await clamdInstream(CLEAN_PDF, { host: '127.0.0.1', port: 3310, timeoutMs: 20000 });
  assert.equal(clean.verdict, 'clean');
  const eicar = await clamdInstream(Buffer.from(EICAR), { host: '127.0.0.1', port: 3310, timeoutMs: 20000 });
  assert.equal(eicar.verdict, 'rejected');
  const down = await clamdInstream(CLEAN_PDF, { host: '127.0.0.1', port: 9, timeoutMs: 500 });
  assert.equal(down.verdict, 'failed');
  const hang = net.createServer(() => {});
  await new Promise((resolve) => hang.listen(0, '127.0.0.1', resolve));
  const hangPort = hang.address().port;
  const timeout = await clamdInstream(CLEAN_PDF, { host: '127.0.0.1', port: hangPort, timeoutMs: 250 });
  hang.close();
  assert.equal(timeout.verdict, 'timeout');
  assert.notEqual(timeout.verdict, 'clean');
});

test('MinIO stores ciphertext privately and anonymous GET is denied', { timeout: 30000 }, async () => {
  const client = createHsiMinioClient({
    endpoint: hsiEnv.HSI_MINIO_ENDPOINT,
    accessKey: access,
    secretKey: secret,
    forcePathStyle: true,
  });
  const key = generateOpaqueObjectKey();
  const plaintext = CLEAN_PDF;
  const ciphertext = crypto.randomBytes(plaintext.length + 16);
  await putHsiCiphertext(client, {
    bucket: hsiEnv.HSI_MINIO_QUARANTINE_BUCKET,
    key,
    ciphertext,
  });
  const stored = await getHsiCiphertext(client, { bucket: hsiEnv.HSI_MINIO_QUARANTINE_BUCKET, key });
  assert.equal(stored.equals(plaintext), false);
  assert.equal(stored.equals(ciphertext), true);
  const denied = await anonymousGetDenied(hsiEnv.HSI_MINIO_ENDPOINT, {
    bucket: hsiEnv.HSI_MINIO_QUARANTINE_BUCKET,
    key,
  });
  assert.equal(denied, true);
  const promoted = await promoteHsiCiphertext(client, {
    quarantineBucket: hsiEnv.HSI_MINIO_QUARANTINE_BUCKET,
    cleanBucket: hsiEnv.HSI_MINIO_CLEAN_BUCKET,
    key,
  });
  assert.equal(promoted.storageClass, 'clean');
  let quarantineGone = false;
  try {
    await getHsiCiphertext(client, { bucket: hsiEnv.HSI_MINIO_QUARANTINE_BUCKET, key });
  } catch {
    quarantineGone = true;
  }
  assert.equal(quarantineGone, true);
});

test('Vault Transit wrap/unwrap binds environment context (TEST ONLY dev)', { timeout: 30000 }, async () => {
  const dek = generateDek();
  const copy = Buffer.from(dek);
  const wrapped = await wrapDataKey(vaultCfg, dek, {
    context: transitWrapContext('hsi-test'),
    nodeEnv: 'test',
  });
  assert.match(wrapped.wrappedDek, /^vault:/);
  const unwrapped = await unwrapDataKey(vaultCfg, wrapped.wrappedDek, {
    context: transitWrapContext('hsi-test'),
    nodeEnv: 'test',
  });
  assert.equal(unwrapped.equals(copy), true);
  await assert.rejects(
    () => unwrapDataKey(vaultCfg, wrapped.wrappedDek, {
      context: transitWrapContext('production'),
      nodeEnv: 'test',
    }),
    /document_kms_unavailable/
  );
});

test('encrypt-quarantine-scan-promote and restore; malware never promoted', { timeout: 120000 }, async () => {
  await touchScanExecutorHeartbeat('test-exec');
  const owner = await User.create({
    email: 'hsi-owner-17d8b2a@example.com',
    password: 'TestPass123!',
    name: 'HSI Owner',
    role: 'User',
  });
  const vaultDoc = await VaultDocument.create({
    ownerUserId: owner._id,
    documentType: 'other',
    displayName: 'GBS case document',
    status: 'active',
    privacyClassification: 'restricted',
  });
  const versionId = new mongoose.Types.ObjectId();
  const stored = await encryptAndStoreHsiQuarantine({
    plaintext: CLEAN_PDF,
    aadFields: {
      environment: 'hsi-test',
      caseId: new mongoose.Types.ObjectId().toString(),
      documentId: String(vaultDoc._id),
      vaultDocumentVersionId: String(versionId),
      classification: 'highly_sensitive_identity',
      schemaVersion: '17d-8b1.0',
      securityPolicyVersion: 'hsi-policy.v1',
    },
    env: process.env,
  });
  const version = await VaultDocumentVersion.create({
    _id: versionId,
    documentId: vaultDoc._id,
    ownerUserId: owner._id,
    versionNumber: 1,
    storageKey: stored.storageKey,
    storageProvider: stored.storageProvider,
    originalFilename: '',
    mimeType: 'application/pdf',
    fileSize: CLEAN_PDF.length,
    checksum: stored.checksum,
    uploadedBy: owner._id,
    scanStatus: 'pending',
    storageClass: stored.storageClass,
    quarantineBucket: stored.quarantineBucket,
    cleanBucket: stored.cleanBucket,
    encryption: stored.encryption,
    classification: 'highly_sensitive_identity',
  });
  const client = createHsiMinioClient({
    endpoint: hsiEnv.HSI_MINIO_ENDPOINT,
    accessKey: access,
    secretKey: secret,
    forcePathStyle: true,
  });
  const cipherOnDisk = await getHsiCiphertext(client, {
    bucket: stored.quarantineBucket,
    key: stored.storageKey,
  });
  assert.equal(cipherOnDisk.equals(CLEAN_PDF), false);

  await enqueueGbsDocumentScanJob({
    vaultDocumentVersionId: version._id,
    opaqueStorageRef: stored.storageKey,
    checksumSha256: stored.checksum,
    mimeType: 'application/pdf',
    sizeBytes: CLEAN_PDF.length,
    classification: 'highly_sensitive_identity',
  });
  const job = await claimNextScanJob({ leaseOwner: 'test-exec' });
  const scanned = await processClaimedScanJob(job, { env: process.env });
  assert.equal(scanned.status, 'clean');
  const after = await VaultDocumentVersion.findById(version._id);
  assert.equal(after.scanStatus, 'clean');
  assert.equal(after.storageClass, 'clean');
  const plaintext = await decryptHsiVersionBytes(after, { env: process.env });
  assert.equal(plaintext.equals(CLEAN_PDF), true);
  await assert.rejects(
    () => decryptHsiVersionBytes(after, {
      env: process.env,
      aadOverrides: { environment: 'production' },
    }),
    /document_encryption_failed|document_kms_unavailable/
  );

  const destDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hsi-restore-'));
  await exportHsiVersionArtifact({ client, version: after, destDir });
  await deleteHsiObject(client, { bucket: after.cleanBucket, key: after.storageKey });
  await restoreHsiVersionArtifact({ client, destDir, bucket: after.cleanBucket });
  const restored = await VaultDocumentVersion.findById(after._id);
  const restoredPlain = await decryptHsiVersionBytes(restored, { env: process.env });
  assert.equal(restoredPlain.equals(CLEAN_PDF), true);

  const eicarVersionId = new mongoose.Types.ObjectId();
  const eicarStored = await encryptAndStoreHsiQuarantine({
    plaintext: Buffer.from(EICAR),
    aadFields: {
      environment: 'hsi-test',
      caseId: new mongoose.Types.ObjectId().toString(),
      documentId: String(vaultDoc._id),
      vaultDocumentVersionId: String(eicarVersionId),
      classification: 'highly_sensitive_identity',
      schemaVersion: '17d-8b1.0',
      securityPolicyVersion: 'hsi-policy.v1',
    },
    env: process.env,
  });
  const eicarVersion = await VaultDocumentVersion.create({
    _id: eicarVersionId,
    documentId: vaultDoc._id,
    ownerUserId: owner._id,
    versionNumber: 2,
    storageKey: eicarStored.storageKey,
    storageProvider: eicarStored.storageProvider,
    originalFilename: '',
    mimeType: 'application/pdf',
    fileSize: EICAR.length,
    checksum: eicarStored.checksum,
    uploadedBy: owner._id,
    scanStatus: 'pending',
    storageClass: eicarStored.storageClass,
    quarantineBucket: eicarStored.quarantineBucket,
    cleanBucket: eicarStored.cleanBucket,
    encryption: eicarStored.encryption,
    classification: 'highly_sensitive_identity',
    retentionClass: HSI_RETENTION_CLASSES.SCANNER_REJECTED_MALWARE,
    retentionEligibleAt: new Date(Date.now() - 1000),
  });
  await enqueueGbsDocumentScanJob({
    vaultDocumentVersionId: eicarVersion._id,
    opaqueStorageRef: eicarStored.storageKey,
    checksumSha256: eicarStored.checksum,
    mimeType: 'application/pdf',
    sizeBytes: EICAR.length,
    classification: 'highly_sensitive_identity',
  });
  const eicarJob = await claimNextScanJob({ leaseOwner: 'test-exec' });
  const eicarResult = await processClaimedScanJob(eicarJob, { env: process.env });
  assert.equal(eicarResult.status, 'rejected');
  await VaultDocumentVersion.updateOne(
    { _id: eicarVersion._id },
    {
      $set: {
        retentionClass: HSI_RETENTION_CLASSES.SCANNER_REJECTED_MALWARE,
        retentionEligibleAt: new Date(Date.now() - 1000),
      },
    }
  );
  const eicarAfter = await VaultDocumentVersion.findById(eicarVersion._id);
  assert.equal(eicarAfter.scanStatus, 'rejected');
  assert.notEqual(eicarAfter.storageClass, 'clean');
  const destroyed = await destroyExpiredHsiCiphertext({ client, version: eicarAfter, actor: { userId: owner._id } });
  assert.ok(destroyed);
  assert.equal(destroyed.storageClass, 'destroyed');
  assert.equal(eicarAfter.checksum, eicarStored.checksum);
});

test('HSI capability is ready only with healthy dependencies', { timeout: 30000 }, async () => {
  await touchScanExecutorHeartbeat('test-exec');
  const ready = await isHsiDocumentCapabilityReady({ env: process.env });
  assert.equal(ready.enabled, true);
  assert.equal(ready.ready, true);
  const off = await isHsiDocumentCapabilityReady({ env: { ...process.env, GBS_HSI_DOCUMENTS_ENABLED: '0' } });
  assert.equal(off.state, 'disabled');
  assert.equal(off.ready, false);
});

test('synthetic GBS HSI upload is pending-denied then clean-proxy without object URLs', { timeout: 180000 }, async () => {
  await touchScanExecutorHeartbeat('test-exec');
  process.env.BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED = '1';
  const wyScope = {
    serviceCategoryIds: [],
    countryCodes: ['US'],
    jurisdictionIds: ['j:US-WY'],
    entityTypeIds: ['et:US-WY:LLC'],
    protectedTitleIds: [],
    flags: { registered_agent: false, registered_office: false },
  };
  const customer = await User.create({
    email: 'hsi-buyer-17d8b2a@example.com',
    password: 'TestPass123!',
    name: 'HSI Buyer',
    role: 'User',
  });
  const other = await User.create({
    email: 'hsi-other-17d8b2a@example.com',
    password: 'TestPass123!',
    name: 'Other Buyer',
    role: 'User',
  });
  const agent = await AgentAccount.create({
    email: 'hsi-ind-17d8b2a@example.com',
    password: 'TestPass123!',
    accountStatus: 'active',
  });
  const home = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENT,
    displayName: 'HSI Independent Home',
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  await AgentProfile.create({
    agentAccountId: agent._id,
    organizationId: home._id,
    agentType: AGENT_TYPES.AGENT,
    professionalName: 'HSI Independent',
    phone: '+1-555-0199',
    email: 'hsi-ind-17d8b2a@example.com',
    providerDomainInitializationState: PROVIDER_DOMAIN_INITIALIZATION_STATES.READY,
  });
  await ProviderDomainEnrollment.create({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(agent._id),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE,
  });
  await ProviderCapability.create({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(agent._id),
    capabilityId: 'business_formation',
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    scope: wyScope,
  });
  let listing = await GbsServiceListing.create({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(agent._id),
    capabilityId: 'business_formation',
    countryCode: 'US',
    jurisdictionId: 'j:US-WY',
    entityTypeIds: ['et:US-WY:LLC'],
    title: 'HSI test listing',
    shortDescription: 'HSI test listing short',
    description: 'HSI test listing long',
    deliveryMode: 'remote',
    languages: ['en'],
    pricingMode: GBS_PRICING_MODES.QUOTE_REQUIRED,
    providerFeeLines: [],
    publicSlug: null,
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
    publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
    scope: wyScope,
    creationCommandId: `hsi-listing-${Date.now()}`,
  });
  listing = await assignListingPublicSlugIfAbsent(listing);
  await activateBusinessClient({ userId: customer._id, actor: { userId: customer._id } });
  const subject = { subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: String(agent._id) };
  const actor = { id: String(agent._id), agentAccountId: agent._id, role: 'agent' };
  const customerActor = { id: String(customer._id), userId: customer._id };
  const created = await createCustomerServiceRequest({
    userId: customer._id,
    body: {
      listingSlug: listing.publicSlug,
      creationCommandId: `hsi-req-${Date.now()}`,
      actingFor: GBS_SERVICE_REQUEST_ACTING_FOR.SELF,
      customerSummary: 'Synthetic HSI infrastructure case.',
    },
    env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
  });
  const stored = await GbsServiceRequest.findOne({ publicRequestRef: created.publicRequestRef });
  const reviewed = await reviewProviderServiceRequest({
    subject,
    requestRef: created.publicRequestRef,
    expectedVersion: stored.recordVersion,
    body: { expectedVersion: stored.recordVersion },
  });
  await readyForQuoteProviderServiceRequest({
    subject,
    requestRef: created.publicRequestRef,
    expectedVersion: reviewed.recordVersion,
    body: { expectedVersion: reviewed.recordVersion },
    env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' },
  });
  const quote = await createProviderQuote({
    subject,
    requestRef: created.publicRequestRef,
    body: { creationCommandId: `hsi-q-${Date.now()}` },
    actor,
    env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' },
  });
  const filled = await updateProviderQuoteDraft({
    subject,
    quoteRef: quote.publicQuoteRef,
    expectedVersion: quote.recordVersion,
    body: {
      expectedVersion: quote.recordVersion,
      professionalFeeLines: [{ label: 'Formation support', amountMinor: 50000, currency: 'USD' }],
      providerTerms: 'Plain text.',
    },
    actor,
  });
  const sent = await sendProviderQuote({
    subject,
    quoteRef: quote.publicQuoteRef,
    expectedVersion: filled.recordVersion,
    body: { expectedVersion: filled.recordVersion },
    actor,
    env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' },
  });
  const accepted = await acceptCustomerQuote({
    userId: customer._id,
    quoteRef: sent.publicQuoteRef,
    expectedVersion: sent.recordVersion,
    body: { expectedVersion: sent.recordVersion },
    actor: customerActor,
    env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' },
  });
  const record = await GbsCase.findOne({ publicCaseRef: accepted.publicCaseRef });
  await startPreparation({
    subject,
    caseRef: record.publicCaseRef,
    expectedVersion: record.recordVersion,
    body: { expectedVersion: record.recordVersion },
    actor,
    env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '0' },
  });
  const requirement = await createSyntheticHsiRequirementForTest(record, { actor: customerActor });
  await initializeCustomerDocumentUpload({
    userId: customer._id,
    caseRef: record.publicCaseRef,
    requirementRef: requirement.publicRequirementRef,
    expectedVersion: requirement.recordVersion,
    body: { expectedVersion: requirement.recordVersion },
    actor: customerActor,
  });
  await completeCustomerDocumentUpload({
    userId: customer._id,
    caseRef: record.publicCaseRef,
    requirementRef: requirement.publicRequirementRef,
    expectedVersion: requirement.recordVersion,
    file: { buffer: CLEAN_PDF, mimeType: 'application/pdf', originalname: 'synthetic-hsi.pdf' },
    body: { expectedVersion: requirement.recordVersion, commandId: `hsi-up-${Date.now()}` },
    actor: customerActor,
  });
  const headers = {};
  const pendingRes = {
    headers,
    set(k, v) { headers[k] = v; return this; },
    send() { throw new Error('should_not_send'); },
  };
  await assert.rejects(
    () => downloadCustomerCaseDocument({
      userId: customer._id,
      caseRef: record.publicCaseRef,
      requirementRef: requirement.publicRequirementRef,
      res: pendingRes,
      actor: customerActor,
    }),
    (err) => err.code === GBS_DOCUMENT_SECURITY_CODES.SCAN_PENDING
  );
  await assert.rejects(
    () => downloadProviderCaseDocument({
      subject,
      caseRef: record.publicCaseRef,
      requirementRef: requirement.publicRequirementRef,
      res: pendingRes,
      actor,
    }),
    (err) => err.status === 403
  );
  const job = await claimNextScanJob({ leaseOwner: 'test-exec' });
  assert.ok(job);
  const scanned = await processClaimedScanJob(job, { env: process.env });
  assert.equal(scanned.status, 'clean');
  const okRes = {
    headers: {},
    body: null,
    set(k, v) { this.headers[k] = v; return this; },
    send(buf) { this.body = buf; return this; },
  };
  await downloadCustomerCaseDocument({
    userId: customer._id,
    caseRef: record.publicCaseRef,
    requirementRef: requirement.publicRequirementRef,
    res: okRes,
    actor: customerActor,
  });
  assert.equal(Buffer.isBuffer(okRes.body) && okRes.body.equals(CLEAN_PDF), true);
  assert.equal(okRes.headers['Cache-Control']?.includes('no-store'), true);
  assert.equal(JSON.stringify(okRes.headers).includes('9000'), false);
  await assert.rejects(
    () => downloadCustomerCaseDocument({
      userId: other._id,
      caseRef: record.publicCaseRef,
      requirementRef: requirement.publicRequirementRef,
      res: okRes,
      actor: { userId: other._id },
    }),
    (err) => err.status === 404
  );
  const providerRes = {
    headers: {},
    body: null,
    set(k, v) { this.headers[k] = v; return this; },
    send(buf) { this.body = buf; return this; },
  };
  await downloadProviderCaseDocument({
    subject,
    caseRef: record.publicCaseRef,
    requirementRef: requirement.publicRequirementRef,
    res: providerRes,
    actor,
  });
  assert.equal(Buffer.isBuffer(providerRes.body) && providerRes.body.equals(CLEAN_PDF), true);
  process.env.BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED = '0';
});
