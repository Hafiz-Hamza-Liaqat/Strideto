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

const detail = read('pages/BusinessClient/BusinessClientCaseDetail.jsx');
check(detail.includes('<h3 className="font-medium">Required documents</h3>'), 'required documents heading');
check(detail.includes('htmlFor={`task-${task.publicTaskRef}`}') || detail.includes('htmlFor={`task-choice-${task.publicTaskRef}`}'), 'existing task labels preserved');
check(detail.includes('Secure Business document exchange is not available in this private beta.'), 'truthful private-beta unavailable state');
check(detail.includes('security?.uploadEnabled') && detail.includes('Allowed types: PDF, JPEG, PNG'), 'file policy appears only when safe upload is enabled');
check(detail.includes('role="alert"') && detail.includes('aria-busy'), 'a11y preserved');
check(!/Upload documents|Identity verified|KYC|Submitted to government|Company registered/i.test(detail), 'no prohibited copy');
check(detail.includes('overflow') || detail.includes('min-w-0') || detail.includes('break-words'), 'overflow safety');

console.log(`phase17d8b1BuyerUi.test.js: ${count} assertions passed`);
