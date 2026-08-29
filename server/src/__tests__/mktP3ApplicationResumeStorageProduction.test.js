/**
 * MKT-P3 production private application resume storage readiness.
 * Run: node server/src/__tests__/mktP3ApplicationResumeStorageProduction.test.js
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRIVATE_CLOUDINARY_PREFIX, PRIVATE_LOCAL_PREFIX } from '../../../shared/application/resumeStorageDescriptor.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const storageSourcePath = path.resolve(here, '../services/applicationResumeStorage.js');
const storageServiceSourcePath = path.resolve(here, '../services/storageService.js');
const uploadsPublicRoot = path.resolve(here, '../../uploads');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const storageSource = await fs.readFile(storageSourcePath, 'utf8');

check(
  /type:\s*['"]authenticated['"]/.test(storageSource),
  'STORAGE-PROD-01: application resume Cloudinary upload uses type authenticated'
);
check(
  storageSource.includes('`${PRIVATE_CLOUDINARY_PREFIX}${result.public_id}`'),
  'STORAGE-PROD-01: DB stores descriptor public_id prefix, not secure_url'
);
check(
  !storageSource.includes('result.secure_url'),
  'STORAGE-PROD-01: application upload does not persist secure_url'
);
check(
  storageSource.includes('expires_at: expiresAt') && storageSource.includes('+ 300'),
  'STORAGE-PROD-01: signed delivery uses ~5 minute expiry'
);

async function loadStorageModule() {
  const url = `${pathToFileURL(storageSourcePath).href}?t=${Date.now()}_${Math.random()}`;
  return import(url);
}

const savedEnv = {
  NODE_ENV: process.env.NODE_ENV,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function applyEnv(overrides) {
  restoreEnv();
  for (const [key, value] of Object.entries(overrides)) {
    if (value === '' || value == null) delete process.env[key];
    else process.env[key] = String(value);
  }
}

async function withEnv(overrides, fn) {
  applyEnv(overrides);
  const mod = await loadStorageModule();
  mod.__resetApplicationResumeCloudinaryCacheForTests();
  try {
    return await fn(mod);
  } finally {
    mod.__resetApplicationResumeCloudinaryCacheForTests();
    restoreEnv();
  }
}

function isolatedDevUploadScript() {
  return `
    import { uploadApplicationResumeFile, resolvePrivateApplicationFile, PRIVATE_APPLICATION_RESUME_DIR } from ${JSON.stringify(pathToFileURL(storageSourcePath).href)};
    import { PRIVATE_LOCAL_PREFIX } from ${JSON.stringify(pathToFileURL(path.resolve(here, '../../../shared/application/resumeStorageDescriptor.js')).href)};
    const uploaded = await uploadApplicationResumeFile({
      buffer: Buffer.from('%PDF-1.4 dev-private-local'),
      originalname: 'resume.pdf',
      mimetype: 'application/pdf',
    });
    const privateKey = uploaded.resumeURL.slice(PRIVATE_LOCAL_PREFIX.length);
    const privatePath = resolvePrivateApplicationFile(privateKey);
    console.log(JSON.stringify({
      resumeURL: uploaded.resumeURL,
      privatePath,
      privateRoot: PRIVATE_APPLICATION_RESUME_DIR,
    }));
    if (privatePath) await import('node:fs/promises').then(({ unlink }) => unlink(privatePath).catch(() => {}));
  `;
}

function runIsolatedDevUpload() {
  const env = {
    NODE_ENV: 'development',
    PATH: process.env.PATH || '',
    SYSTEMROOT: process.env.SYSTEMROOT || '',
    TEMP: process.env.TEMP || process.env.TMP || '',
    TMP: process.env.TMP || process.env.TEMP || '',
  };
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', isolatedDevUploadScript()],
    { env, encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'isolated dev upload subprocess failed');
  }
  return JSON.parse(result.stdout.trim());
}

await withEnv(
  {
    NODE_ENV: 'production',
    CLOUDINARY_CLOUD_NAME: '',
    CLOUDINARY_API_KEY: '',
    CLOUDINARY_API_SECRET: '',
  },
  async ({ uploadApplicationResumeFile, PRIVATE_APPLICATION_RESUME_DIR }) => {
    const before = await fs.readdir(PRIVATE_APPLICATION_RESUME_DIR).catch(() => []);
    let threw = false;
    try {
      await uploadApplicationResumeFile({
        buffer: Buffer.from('%PDF-1.4 prod-fail-closed'),
        originalname: 'resume.pdf',
        mimetype: 'application/pdf',
      });
    } catch (err) {
      threw = true;
      check(err.code === 'APPLICATION_RESUME_STORAGE_NOT_CONFIGURED', 'STORAGE-PROD-02: production missing Cloudinary fails closed');
      check(/Application resume storage is not configured/i.test(err.message), 'STORAGE-PROD-03: production misconfiguration error is explicit');
    }
    check(threw, 'STORAGE-PROD-02: production without durable provider throws');
    const after = await fs.readdir(PRIVATE_APPLICATION_RESUME_DIR).catch(() => []);
    check(after.length === before.length, 'STORAGE-PROD-02: production misconfiguration does not write private filesystem');
  }
);

await withEnv(
  {
    NODE_ENV: 'production',
    CLOUDINARY_CLOUD_NAME: 'demo',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: '',
  },
  async ({ uploadApplicationResumeFile, isApplicationResumeCloudinaryConfigured }) => {
    check(!isApplicationResumeCloudinaryConfigured(), 'STORAGE-PROD-03: partial Cloudinary config treated as unavailable');
    let threw = false;
    try {
      await uploadApplicationResumeFile({
        buffer: Buffer.from('%PDF-1.4 prod-partial'),
        originalname: 'resume.pdf',
        mimetype: 'application/pdf',
      });
    } catch (err) {
      threw = true;
      check(err.code === 'APPLICATION_RESUME_STORAGE_NOT_CONFIGURED', 'STORAGE-PROD-03: incomplete production config fails safely');
    }
    check(threw, 'STORAGE-PROD-03: incomplete production config rejects upload');
  }
);

await withEnv(
  {
    NODE_ENV: 'development',
    CLOUDINARY_CLOUD_NAME: '',
    CLOUDINARY_API_KEY: '',
    CLOUDINARY_API_SECRET: '',
  },
  async ({ isApplicationResumeCloudinaryConfigured }) => {
    check(!isApplicationResumeCloudinaryConfigured(), 'STORAGE-PROD-04: development helper sees Cloudinary unavailable when unset');
    const isolated = runIsolatedDevUpload();
    check(isolated.resumeURL.startsWith(PRIVATE_LOCAL_PREFIX), 'STORAGE-PROD-04: development without Cloudinary uses private local descriptor');
    check(isolated.privatePath?.startsWith(isolated.privateRoot), 'STORAGE-PROD-04: development bytes stored under private-storage');
  }
);

await withEnv(
  {
    NODE_ENV: 'development',
    CLOUDINARY_CLOUD_NAME: '',
    CLOUDINARY_API_KEY: '',
    CLOUDINARY_API_SECRET: '',
  },
  async () => {
    const isolated = runIsolatedDevUpload();
    check(!isolated.resumeURL.includes('/uploads/'), 'STORAGE-PROD-05: new application resume never uses public /uploads URL');
    check(isolated.resumeURL.startsWith(PRIVATE_LOCAL_PREFIX), 'STORAGE-PROD-05: new application resume uses private descriptor');
    const privateKey = isolated.resumeURL.slice(PRIVATE_LOCAL_PREFIX.length);
    const publicCandidate = path.join(uploadsPublicRoot, privateKey);
    let publicCollision = false;
    try {
      await fs.access(publicCandidate);
      publicCollision = true;
    } catch {
      publicCollision = false;
    }
    check(!publicCollision, 'STORAGE-PROD-05: new application resume not written to public uploads tree');
  }
);

const storageServiceSource = await fs.readFile(storageServiceSourcePath, 'utf8');
check(storageServiceSource.includes('LOCAL_UPLOAD_DIR'), 'STORAGE-PROD-06: unrelated uploadFile local path unchanged');
check(storageServiceSource.includes("storage: 'cloudinary'"), 'STORAGE-PROD-06: unrelated uploadFile Cloudinary path unchanged');
check(!storageServiceSource.includes('PRIVATE_APPLICATION_RESUME_DIR'), 'STORAGE-PROD-06: storageService does not reference application private storage');

check(
  storageSource.includes("process.env.NODE_ENV === 'production'"),
  'STORAGE-PROD-02: production guard present in application resume upload path'
);
check(
  storageSource.includes('PRIVATE_CLOUDINARY_PREFIX'),
  'STORAGE-PROD-01: authenticated remote descriptor prefix defined'
);
check(
  !storageSource.includes('secure_url'),
  'STORAGE-PROD-01: application resume storage module avoids secure_url persistence'
);

console.log(`mktP3ApplicationResumeStorageProduction.test.js: ${count} checks passed`);
