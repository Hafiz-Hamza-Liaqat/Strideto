/**
 * MKT-P4 — index definition and readiness contract tests.
 * Run: node src/__tests__/mktP4CommunicationIndexes.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPLICATION_MESSAGE_CRITICAL_INDEXES,
  APPLICATION_INTERVIEW_INVITATION_CRITICAL_INDEXES,
  verifyMktP4CommunicationIndexes,
} from '../services/platform/mktP4CommunicationIndexProvision.js';
import { compareCriticalIndexes } from '../services/platform/criticalIndexProvision.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(here, '..', rel), 'utf8');

const messageModel = read('models/ApplicationMessage.js');
const invitationModel = read('models/ApplicationInterviewInvitation.js');
const provisionScript = read('scripts/provisionMktP4CommunicationIndexes.js');

const idempotencySpec = APPLICATION_MESSAGE_CRITICAL_INDEXES.find(
  (s) => s.name === 'application_message_client_idempotency_unique'
);
const historySpec = APPLICATION_MESSAGE_CRITICAL_INDEXES.find(
  (s) => s.name === 'application_message_history'
);
const invitationSpec = APPLICATION_INTERVIEW_INVITATION_CRITICAL_INDEXES[0];

check(idempotencySpec?.unique === true, 'IDX-01: idempotency index is unique');
check(
  idempotencySpec?.partialFilterExpression?.clientMessageId?.$type === 'string',
  'IDX-01: partial filter on clientMessageId'
);
check(
  messageModel.includes('applicationId: 1, clientMessageId: 1') &&
    messageModel.includes('unique: true'),
  'IDX-01: schema declares idempotency unique index'
);
check(
  historySpec?.key?.applicationId === 1 && historySpec?.key?.createdAt === 1,
  'IDX-06: history query index on applicationId + createdAt'
);
check(
  invitationSpec.key.applicationId === 1 && invitationSpec.key.status === 1,
  'IDX-06: invitation status query index'
);

check(
  provisionScript.includes('--verify') &&
    provisionScript.includes('STRIDETO_INDEX_PROVISION_CONFIRM'),
  'IDX-07: provision script verify/apply with operator confirm'
);
check(messageModel.includes('autoIndex: false'), 'IDX: ApplicationMessage autoIndex false');
check(invitationModel.includes('autoIndex: false'), 'IDX: ApplicationInterviewInvitation autoIndex false');

const missingReport = compareCriticalIndexes(APPLICATION_MESSAGE_CRITICAL_INDEXES, []);
check(missingReport.missing.length === 2, 'IDX-02: verify detects missing message indexes');
check(
  verifyMktP4CommunicationIndexes.toString().includes('compareCriticalIndexes'),
  'IDX-02: readiness helper compares physical indexes'
);

console.log(`mktP4CommunicationIndexes.test.js: ${count} checks passed`);
