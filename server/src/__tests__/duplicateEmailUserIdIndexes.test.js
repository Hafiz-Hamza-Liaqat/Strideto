/**
 * Focused schema index tests for email / userId duplicate warnings (no DB).
 * Run: node src/__tests__/duplicateEmailUserIdIndexes.test.js
 */
import assert from 'assert';
import { NewsletterSubscriber } from '../models/NewsletterSubscriber.js';
import { DashboardPreference } from '../models/career/DashboardPreference.js';

function exactKeyIndexes(schema, keySpec) {
  const target = JSON.stringify(keySpec);
  return schema.indexes().filter(([fields]) => JSON.stringify(fields) === target);
}

function pathOpts(schema, path) {
  return schema.path(path)?.options || {};
}

// --- NewsletterSubscriber: email unique via field only ---
const emailPath = pathOpts(NewsletterSubscriber.schema, 'email');
assert.strictEqual(emailPath.unique, true, 'NewsletterSubscriber.email must remain unique');
assert.notStrictEqual(emailPath.sparse, true, 'NewsletterSubscriber.email is not sparse');

const emailIndexes = exactKeyIndexes(NewsletterSubscriber.schema, { email: 1 });
assert.strictEqual(
  emailIndexes.length,
  1,
  `expected exactly one { email: 1 } index, got ${emailIndexes.length}`
);
assert.strictEqual(
  emailIndexes[0][1]?.unique,
  true,
  'retained { email: 1 } index must be unique'
);

const subscribedIndexes = exactKeyIndexes(NewsletterSubscriber.schema, { subscribed: 1 });
assert.strictEqual(subscribedIndexes.length, 1, 'subscribed index must remain');

// --- DashboardPreference: userId unique via field only ---
const userIdPath = pathOpts(DashboardPreference.schema, 'userId');
assert.strictEqual(userIdPath.unique, true, 'DashboardPreference.userId must remain unique');
assert.notStrictEqual(userIdPath.sparse, true, 'DashboardPreference.userId is not sparse');

const userIdIndexes = exactKeyIndexes(DashboardPreference.schema, { userId: 1 });
assert.strictEqual(
  userIdIndexes.length,
  1,
  `expected exactly one { userId: 1 } index, got ${userIdIndexes.length}`
);
assert.strictEqual(
  userIdIndexes[0][1]?.unique,
  true,
  'retained { userId: 1 } index must be unique'
);

console.log('duplicateEmailUserIdIndexes tests passed.');
