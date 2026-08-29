/**
 * MKT-P3 private application resume storage contracts.
 * Run: node server/src/__tests__/mktP3ApplicationResumeStorage.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRIVATE_LOCAL_PREFIX,
  PRIVATE_CLOUDINARY_PREFIX,
  classifyResumeStorage,
  RESUME_STORAGE_KIND,
} from '../../../shared/application/resumeStorageDescriptor.js';
import {
  uploadApplicationResumeFile,
  resolveEmployerApplicationResumeAccess,
  resolvePrivateApplicationFile,
  PRIVATE_APPLICATION_RESUME_DIR,
} from '../services/applicationResumeStorage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const uploadsPublicRoot = path.resolve(here, '../../uploads');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

check(
  classifyResumeStorage(`${PRIVATE_LOCAL_PREFIX}abc123.pdf`) === RESUME_STORAGE_KIND.PRIVATE_LOCAL,
  'DOC-SEC-11: private local descriptor classified'
);
check(
  classifyResumeStorage(`${PRIVATE_CLOUDINARY_PREFIX}applications/x`) === RESUME_STORAGE_KIND.PRIVATE_CLOUDINARY,
  'DOC-SEC-11: private cloudinary descriptor classified'
);
check(
  classifyResumeStorage('http://localhost:5000/uploads/old.pdf') === RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC,
  'DOC-SEC-11: legacy public local classified'
);
check(
  classifyResumeStorage('https://res.cloudinary.com/demo/x.pdf') === RESUME_STORAGE_KIND.LEGACY_CLOUDINARY_PUBLIC,
  'DOC-SEC-11: legacy cloudinary public classified'
);
check(classifyResumeStorage(null) === RESUME_STORAGE_KIND.MISSING, 'DOC-SEC-08: missing classified');

check(resolvePrivateApplicationFile('../etc/passwd') === null, 'DOC-SEC-07: traversal rejected');
check(resolvePrivateApplicationFile('foo/bar') === null, 'DOC-SEC-07: nested path rejected');
check(resolvePrivateApplicationFile('safe.pdf')?.includes('private-storage'), 'DOC-SEC-07: safe key resolves under private root');

const uploaded = await uploadApplicationResumeFile({
  buffer: Buffer.from('%PDF-1.4 mktp3-private-test'),
  originalname: 'resume.pdf',
  mimetype: 'application/pdf',
});
check(uploaded.resumeURL.startsWith(PRIVATE_LOCAL_PREFIX), 'DOC-SEC-01: new upload uses private descriptor');
const privateKey = uploaded.resumeURL.slice(PRIVATE_LOCAL_PREFIX.length);
const privatePath = resolvePrivateApplicationFile(privateKey);
check(privatePath && privatePath.startsWith(PRIVATE_APPLICATION_RESUME_DIR), 'DOC-SEC-01: bytes live in private-storage');
check(!privatePath.startsWith(uploadsPublicRoot + path.sep), 'DOC-SEC-01: not in public uploads tree');

const publicCandidate = path.join(uploadsPublicRoot, privateKey);
let publicCollision = false;
try {
  await fs.access(publicCandidate);
  publicCollision = true;
} catch {
  publicCollision = false;
}
check(!publicCollision, 'DOC-SEC-01: same key not present in public uploads');

const access = await resolveEmployerApplicationResumeAccess({ resumeURL: uploaded.resumeURL });
check(access.ok && access.mode === 'local_stream', 'DOC-SEC-02: authorized resolver streams private local file');
check(access.legacyPublicRisk === false, 'DOC-SEC-10: new private upload has no legacy public risk flag');

const missing = await resolveEmployerApplicationResumeAccess({ resumeURL: null });
check(!missing.ok && missing.reason === 'no_resume', 'DOC-SEC-08: missing resume truthful');

// cleanup test artifact
if (privatePath) {
  await fs.unlink(privatePath).catch(() => {});
}

console.log(`mktP3ApplicationResumeStorage.test.js: ${count} checks passed`);
