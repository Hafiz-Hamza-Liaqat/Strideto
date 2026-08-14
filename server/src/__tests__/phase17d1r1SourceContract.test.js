/**
 * Phase 17D-1R1 — source-contract integrity (no GBS UI, atomic CAS, no silent in-memory).
 * Run: node src/__tests__/phase17d1r1SourceContract.test.js
 */
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
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

const cas = read('server/src/services/platform/optimisticConcurrency.js');
check(/findOneAndUpdate\(/.test(cas), 'ProviderCapability mutation uses findOneAndUpdate');
check(/recordVersion: expected/.test(cas) && /\$inc: \{ recordVersion: 1 \}/.test(cas), 'CAS filter includes recordVersion and increments atomically');
check(/subjectType/.test(cas) && /subjectId/.test(cas), 'CAS includes subject/tenant predicates');
check(!/assertExpectedVersion\(doc\.recordVersion/.test(cas), 'read-check-save path is gone');
check(!/doc\.save\(\)/.test(cas), 'non-atomic save() path is gone');
check(/findOne\(subjectFilter\)/.test(cas), 'conflict vs not-found is scoped to authorized subject');
check(!/ProviderCapability\.findById\(id\)/.test(cas), 'no unscoped existence query by id');

const idemShared = read('shared/platform/idempotency.js');
check(/IN_MEMORY: 'in_memory'/.test(idemShared), 'in-memory store kind is explicit');
check(/MONGO: 'mongo'/.test(idemShared), 'mongo store kind is explicit');
check(/TEST \/ isolated-dev only/.test(idemShared), 'in-memory is documented test/dev only');
check(/FAILED: 'failed'/.test(idemShared), 'FAILED status exists so crashes are not COMPLETED');
check(/IDEMPOTENCY_IN_PROGRESS_STALE_MS/.test(idemShared), 'bounded IN_PROGRESS recovery TTL exists');

const idemSvc = read('server/src/services/platform/idempotencyService.js');
check(/Idempotency store must be injected/.test(idemSvc), 'no silent default store on executeIdempotentCommand');
check(/STORE_NOT_SHARED/.test(idemSvc), 'high-value commands reject non-shared stores');
check(/getMongoIdempotencyStore/.test(idemSvc), 'Mongo adapter is the shared production store');
check(!/createIdempotencyStore\(\)/.test(idemSvc), 'idempotencyService no longer constructs in-memory as default');

const mongoStore = read('server/src/services/platform/mongoIdempotencyStore.js');
check(/kind: IDEMPOTENCY_STORE_KINDS\.MONGO/.test(mongoStore), 'Mongo store advertises mongo kind');
check(/isDuplicateKey/.test(mongoStore) && /11000/.test(mongoStore), 'reservation uses unique-index atomicity');
check(/IN_FLIGHT/.test(mongoStore), 'IN_PROGRESS duplicate returns deterministic in-flight');
check(/tryTakeOverStale/.test(mongoStore), 'abandoned IN_PROGRESS has bounded takeover, not silent complete');

const model = read('server/src/models/platform/IdempotencyRecord.js');
check(/principalId: 1, tenantId: 1, commandType: 1, idempotencyKey: 1/.test(model), 'unique index covers the logical key');
check(/unique: true/.test(model), 'logical key index is unique');
check(/expireAfterSeconds: 0/.test(model), 'TTL index is bounded');
check(!/expiresAt: \{ type: Date, required: true, index: true \}/.test(model), 'expiresAt is not double-indexed');

const flows = read('server/src/services/auth/userSecureAuthFlows.js');
check(/applyRoleTransitionCapabilities/.test(flows), 'changeUserRole applies capability transition');
check(/DEFAULT_ADMIN_ROLE_TRANSITION_MODE/.test(flows), 'role transition mode is server-authoritative');
check(/reason: 'role_changed'/.test(flows), 'role change still revokes refresh families');

const users = read('server/src/controllers/admin/usersController.js');
check(!/req\.body\?\.capabilityTransitionMode|req\.body\.mode/.test(users), 'Admin role API cannot choose capability mode from the body');
check(/grantedBusinessClient: false/.test(users), 'role-change audit records no business_client grant');

const register = read('server/src/controllers/authController.js');
check(/initializeCustomerUser/.test(register), 'student registration still initializes student grant');
check(/student_registration_retry/.test(register), 'uninitialized duplicate registration retries grant+init');
check(/isLegacyCustomerRole\(existing\.role\)/.test(register), 'retry compensation is limited to customer role');
check(/isCapabilitySchemaInitialized\(existing\.capabilitySchemaVersion\)/.test(register), 'initialized zero-grant accounts are not auto-granted student on re-register');

const ensureAdmin = read('server/src/seed/ensureAdmin.js');
check(/applyRoleTransitionCapabilities/.test(ensureAdmin), 'ensureAdmin update initializes capabilities deterministically');
check(/initializeStaffUser/.test(ensureAdmin), 'ensureAdmin create still initializes staff without student');

const pages = read('shared/pageRegistry.js');
check(!/\/business-services/.test(pages), 'no public /business-services page');
check(!/route: '\/business'/.test(pages), 'no /business dashboard page');

const backfill = read('server/src/scripts/backfillUserCapabilities.js');
check(/Live User capability backfill is not permitted/.test(backfill), 'live User capability backfill still refused');

console.log(`phase17d1r1SourceContract.test.js: ${count} assertions passed`);
