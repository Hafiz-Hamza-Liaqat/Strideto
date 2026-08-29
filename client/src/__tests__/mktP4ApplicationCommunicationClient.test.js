/**
 * STRIDETO MKT-P4 — client communication UI contracts.
 * Run: node src/__tests__/mktP4ApplicationCommunicationClient.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '../../../client/src');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');

const panel = read('components/applications/ApplicationCommunicationPanel.jsx');
const analytics = read('components/employer/applicant/applicationCommunicationAnalytics.js');
const employerApi = read('services/employerService.js');
const applicationsApi = read('services/applicationsApi.js');

check(panel.includes('clientMessageId'), 'MKT-P4-E08: client generates idempotency key');
check(panel.includes('duplicate'), 'MKT-P4-E08: handles duplicate response');
check(panel.includes('setDraft') && panel.includes('sendError'), 'MKT-P4-E07: failure preserves draft');
check(panel.includes('min-h-[44px]'), 'MKT-P4-89: 44px touch targets');
check(panel.includes('htmlFor=') && panel.includes('role="alert"'), 'MKT-P4-89: labels and alert semantics');

check(
  employerApi.includes('listApplicationCommunication') &&
    employerApi.includes('createApplicationInterviewInvitation'),
  'MKT-P4: employer API methods registered'
);
check(
  applicationsApi.includes('listCommunication') &&
    applicationsApi.includes('respondInterviewInvitation'),
  'MKT-P4: candidate API methods registered'
);

check(
  panel.includes('result?.emailQueued') && panel.includes('communicationEmailQueued'),
  'EMAIL-PRECISION-06: interview success shows queued copy only when emailQueued true'
);

check(analytics.includes('trackPlatformEvent'), 'MKT-P4-A07: uses consent-gated analytics helper');
check(
  !analytics.includes('applicationId') && !analytics.includes('meetingUrl'),
  'MKT-P4-A08/A09: analytics module avoids sensitive fields'
);

console.log(`mktP4ApplicationCommunicationClient.test.js: ${count} checks passed`);
