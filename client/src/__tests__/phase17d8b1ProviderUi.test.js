import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(src, rel), 'utf8');
}

const detail = read('pages/Agent/business-services/GbsCaseDetail.jsx');
check(detail.includes('Required documents'), 'provider required documents');
check(detail.includes('Document security scanning is not configured'), 'scanner unavailable');
check(detail.includes('explicit case documents duty'), 'duty not implied by owner/admin');
check(detail.includes('does not submit anything to a government authority'), '17D-8A ready copy preserved');
check(!/Identity verified|Government verified|KYC|Upload documents|Mark Verified/i.test(detail), 'no prohibited copy');
check(detail.includes('role="alert"') || detail.includes('errorBox'), 'errors announced');

console.log(`phase17d8b1ProviderUi.test.js: ${count} assertions passed`);
