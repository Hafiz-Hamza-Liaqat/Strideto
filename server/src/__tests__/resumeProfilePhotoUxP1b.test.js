/**
 * STRIDETO JOB-AUTHORING-P1B — Resume profile photo URL UX.
 * Run: node src/__tests__/resumeProfilePhotoUxP1b.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

const modPath = pathToFileURL(
  path.resolve(repoRoot, 'client/src/utils/imageUrlHints.js')
).href;
const { isLikelyWebpageNotDirectImage } = await import(modPath);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

check(
  read('client/src/pages/ResumeBuilder/ResumeForm.jsx').includes('Profile/webpage URLs cannot be used as images'),
  'RESUME-PHOTO-01: helper text present'
);
check(
  read('client/src/pages/ResumeBuilder/ResumeForm.jsx').includes('allowUpload={false}'),
  'RESUME-PHOTO-02: field remains optional URL-only (no upload)'
);
check(
  read('client/src/components/admin/AdminImageUrlField.jsx').includes('isLikelyWebpageNotDirectImage'),
  'RESUME-PHOTO-03: webpage detection wired in image field'
);
check(
  isLikelyWebpageNotDirectImage('https://github.com/username'),
  'RESUME-PHOTO-04: github profile detected as webpage'
);
check(
  !isLikelyWebpageNotDirectImage('https://cdn.example.com/avatar.png'),
  'RESUME-PHOTO-05: direct image URL not flagged'
);
check(
  !isLikelyWebpageNotDirectImage(''),
  'RESUME-PHOTO-06: empty URL not flagged'
);

console.log(`resumeProfilePhotoUxP1b.test.js: ${count} assertions passed`);
