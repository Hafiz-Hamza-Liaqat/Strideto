/**
 * MKT-P3 resume access helper contracts.
 * Run: node server/src/__tests__/mktP3EmployerResumeAccess.test.js
 */
import assert from 'node:assert/strict';
import {
  parseLegacyPublicUploadKey,
  resolvePrivateApplicationFile,
  classifyResumeStorage,
  RESUME_STORAGE_KIND,
} from '../services/applicationResumeStorage.js';
import { PRIVATE_LOCAL_PREFIX } from '../../../shared/application/resumeStorageDescriptor.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

check(
  parseLegacyPublicUploadKey('http://localhost:5000/uploads/applications/foo.pdf') === 'applications/foo.pdf',
  'legacy public upload key parse'
);
check(parseLegacyPublicUploadKey('https://cdn.example/resume.pdf') === null, 'non-local legacy key null');
check(resolvePrivateApplicationFile('../secret.pdf') === null, 'DOC-SEC-07: traversal rejected');
check(resolvePrivateApplicationFile('safe-file.pdf')?.includes('private-storage'), 'DOC-SEC-07: safe private key');
check(
  classifyResumeStorage(`${PRIVATE_LOCAL_PREFIX}file.pdf`) === RESUME_STORAGE_KIND.PRIVATE_LOCAL,
  'private local kind'
);

console.log(`mktP3EmployerResumeAccess.test.js: ${count} checks passed`);
