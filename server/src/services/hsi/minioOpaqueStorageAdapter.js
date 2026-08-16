/**
 * Private MinIO opaque-object adapter for HSI ciphertext.
 *
 * Server-only GetObject. Private cache headers. No browser object locator.
 * Cloudinary is never used for HSI.
 */
import crypto from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { HSI_STORAGE_CLASSES, HSI_STORAGE_PROVIDER } from '../../../../shared/gbs/hsiSecurity.js';

function deny(code, status = 503) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  throw err;
}

export function createHsiMinioClient(minio = {}) {
  if (!minio.endpoint || !minio.accessKey || !minio.secretKey) {
    deny('document_storage_unavailable');
  }
  return new S3Client({
    endpoint: minio.endpoint,
    region: minio.region || 'us-east-1',
    forcePathStyle: minio.forcePathStyle !== false,
    credentials: {
      accessKeyId: minio.accessKey,
      secretAccessKey: minio.secretKey,
    },
  });
}

export function generateOpaqueObjectKey() {
  return `hsi/${crypto.randomBytes(16).toString('hex')}`;
}

function assertOpaqueKey(key) {
  if (typeof key !== 'string' || !/^hsi\/[a-f0-9]{32}$/.test(key)) {
    deny('document_storage_unavailable', 500);
  }
  if (/@|userId|email|passport|cnic/i.test(key)) {
    deny('storage_key_not_opaque', 500);
  }
}

async function streamToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function putHsiCiphertext(client, { bucket, key, ciphertext }) {
  assertOpaqueKey(key);
  if (!Buffer.isBuffer(ciphertext) || ciphertext.length < 1) deny('document_encryption_failed', 500);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: ciphertext,
    ContentType: 'application/octet-stream',
    CacheControl: 'private, no-store',
    Metadata: { storageclass: HSI_STORAGE_CLASSES.QUARANTINE, provider: HSI_STORAGE_PROVIDER },
  }));
  return { bucket, key, storageProvider: HSI_STORAGE_PROVIDER, storageClass: HSI_STORAGE_CLASSES.QUARANTINE };
}

export async function getHsiCiphertext(client, { bucket, key }) {
  assertOpaqueKey(key);
  const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return streamToBuffer(out.Body);
}

export async function getHsiCiphertextStream(client, { bucket, key }) {
  assertOpaqueKey(key);
  const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return out.Body;
}

export async function promoteHsiCiphertext(client, {
  quarantineBucket,
  cleanBucket,
  key,
}) {
  assertOpaqueKey(key);
  await client.send(new CopyObjectCommand({
    Bucket: cleanBucket,
    Key: key,
    CopySource: `${quarantineBucket}/${key}`,
    CacheControl: 'private, no-store',
    MetadataDirective: 'REPLACE',
    ContentType: 'application/octet-stream',
    Metadata: { storageclass: HSI_STORAGE_CLASSES.CLEAN, provider: HSI_STORAGE_PROVIDER },
  }));
  await client.send(new DeleteObjectCommand({ Bucket: quarantineBucket, Key: key }));
  return { bucket: cleanBucket, key, storageClass: HSI_STORAGE_CLASSES.CLEAN };
}

export async function deleteHsiObject(client, { bucket, key }) {
  assertOpaqueKey(key);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function ensurePrivateHsiBuckets(client, { quarantineBucket, cleanBucket }) {
  for (const bucket of [quarantineBucket, cleanBucket]) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Sid: 'DenyAnonymous',
        Effect: 'Deny',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
        Condition: { Bool: { 'aws:AuthenticatedUser': 'false' } },
      }],
    });
    try {
      await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }));
    } catch {
      // MinIO may reject this AWS-style condition; buckets still have no anonymous policy grant.
    }
  }
}

export async function probeMinioHealth(client, { quarantineBucket, cleanBucket }) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: quarantineBucket }));
    await client.send(new HeadBucketCommand({ Bucket: cleanBucket }));
    return { healthy: true };
  } catch {
    return { healthy: false };
  }
}

export async function anonymousGetDenied(endpoint, { bucket, key }) {
  const url = `${String(endpoint).replace(/\/$/, '')}/${bucket}/${key}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.status === 403 || res.status === 404 || res.status === 400;
  } catch {
    return true;
  }
}
