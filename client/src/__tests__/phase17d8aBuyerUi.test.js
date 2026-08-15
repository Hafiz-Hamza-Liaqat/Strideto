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

const layout = read('pages/BusinessClient/BusinessClientLayout.jsx');
const list = read('pages/BusinessClient/BusinessClientCases.jsx');
const detail = read('pages/BusinessClient/BusinessClientCaseDetail.jsx');
const quote = read('pages/BusinessClient/BusinessClientQuoteDetail.jsx');
const home = read('pages/BusinessClient/BusinessClientOverview.jsx');
const routes = read('routes/index.jsx');

check(layout.includes('Cases') && layout.includes('/cases'), 'Cases nav');
check(layout.includes('Overview') && layout.includes('Service Requests') && layout.includes('Quotes'), 'existing nav preserved');
check(!/Payments|Formation Cases|Messages|Documents|My Businesses/.test(layout), 'no later-product nav');

check(list.includes('No cases yet'), 'empty state');
check(list.includes('View Case') && list.includes('Pagination'), 'list + pagination');
check(list.includes('overflow-x-auto'), 'table scrolls');
check(list.includes('caseStatusLabel'), 'status as text');
check(!/Pay now|Upload Documents|Chat|submitted to government/i.test(list), 'list has no pay/docs/chat/filing');

check(detail.includes('<h2') && detail.includes('Timeline'), 'semantic headings and timeline');
check(detail.includes('Customer actions') && detail.includes('Complete action'), 'customer task UI');
check(detail.includes('htmlFor={`task-${task.publicTaskRef}`}') || detail.includes('htmlFor={`task-choice-${task.publicTaskRef}`}'), 'task inputs labelled');
check(detail.includes('Cancel Case') && detail.includes('open={cancelOpen}'), 'cancel dialog');
check(detail.includes('htmlFor="case-cancel-reason"'), 'cancel reason labelled');
check(detail.includes('View accepted quote'), 'accepted quote link');
check(detail.includes('readyForSubmissionCopy') || detail.includes('next filing or submission step'), 'ready copy is next-step not filed');
check(detail.includes('not government processing'), 'in_progress is not government processing');
check(detail.includes('role="alert"') && detail.includes('aria-busy'), 'errors and loading');
check(detail.includes('whitespace-pre-wrap') && !detail.includes('dangerouslySetInnerHTML'), 'notes as text');
check(!/Pay now|Upload documents|Chat|Submitted to government|Company registered|STRIDETO filed/i.test(detail), 'no pay/docs/chat/filing claims');
check(detail.includes("status === 404") && detail.includes('Case not found'), 'unknown/other-customer 404');
check(detail.includes('Business Services access is not active'), 'grant-loss mutation copy');

check(quote.includes('service Case') && quote.includes('does not take payment'), 'accept copy starts Case without payment');
check(quote.includes('View service Case'), 'accepted quote links Case');

check(home.includes('Service Cases') && home.includes('/cases'), 'overview case counts');
check(routes.includes('BusinessClientCases') && routes.includes("path: 'cases'"), 'nested customer case routes');

console.log(`phase17d8aBuyerUi.test.js: ${count} assertions passed`);
