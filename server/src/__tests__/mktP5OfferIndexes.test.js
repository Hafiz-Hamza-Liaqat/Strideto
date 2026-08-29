/**
 * MKT-P5 — ApplicationOffer critical index contract.
 * Run: node src/__tests__/mktP5OfferIndexes.test.js
 */
import assert from 'node:assert/strict';
import { APPLICATION_OFFER_CRITICAL_INDEXES } from '../services/platform/mktP5OfferIndexProvision.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

check(APPLICATION_OFFER_CRITICAL_INDEXES.length === 3, 'MKT-P5-65: three critical indexes');

const idempotency = APPLICATION_OFFER_CRITICAL_INDEXES.find(
  (i) => i.name === 'application_offer_client_idempotency_unique'
);
check(idempotency?.unique === true, 'MKT-P5-64: client idempotency index is unique');

const activeSent = APPLICATION_OFFER_CRITICAL_INDEXES.find(
  (i) => i.name === 'application_offer_active_sent_unique'
);
check(activeSent?.unique === true, 'MKT-P5-CONC: active sent unique index');
check(activeSent?.partialFilterExpression?.status === 'sent', 'MKT-P5-CONC: partial filter status sent only');

const statusIdx = APPLICATION_OFFER_CRITICAL_INDEXES.find((i) => i.name === 'application_offer_app_status');
check(statusIdx?.key?.applicationId === 1 && statusIdx?.key?.status === 1, 'MKT-P5-65: app status index fields');

console.log(`MKT-P5 offer index contract tests: ${count} passed`);
