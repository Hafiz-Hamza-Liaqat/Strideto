/**
 * Phase 17D-1 — ProviderCapability subject/scope, concurrency, idempotency, quotes.
 * Run: node src/__tests__/phase17d1ProviderAndPlatform.test.js
 */
import assert from 'node:assert/strict';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_SUBJECT_TYPES, PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { authorizeListingScope, LISTING_SCOPE_DENY_REASONS } from '../../../shared/gbs/listingScope.js';
import { sameProviderSubject, validateProviderCapabilityRecord } from '../../../shared/gbs/providerCapability.js';
import {
  validateQuoteContract,
  nextQuoteRevision,
  assertQuoteRevisionMutable,
  QUOTE_STATUSES,
  QUOTE_FEE_TYPES,
} from '../../../shared/gbs/quoteContract.js';
import {
  applyOptimisticMutation,
  assertExpectedVersion,
  OPTIMISTIC_CONCURRENCY_CODE,
} from '../../../shared/platform/optimisticConcurrency.js';
import {
  createIdempotencyStore,
  createInMemoryIdempotencyStore,
  IDEMPOTENCY_CODES,
  IDEMPOTENCY_STORE_KINDS,
} from '../../../shared/platform/idempotency.js';
import { fingerprintRequest } from '../services/platform/idempotencyService.js';
import { GBS_AUDIT_EVENTS } from '../../../shared/security/gbsAuditEvents.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

function wyFormation({ subjectType = 'agent', subjectId = 'agent-A' } = {}) {
  return {
    subjectType,
    subjectId,
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    scope: {
      serviceCategoryIds: ['formation'],
      countryCodes: ['US'],
      jurisdictionIds: ['US-WY'],
      entityTypeIds: ['llc'],
      protectedTitleIds: [],
      flags: { registered_agent: false, registered_office: false },
    },
  };
}

function requestScope(overrides = {}) {
  return {
    subjectType: 'agent',
    subjectId: 'agent-A',
    scope: {
      serviceCategoryIds: ['formation'],
      countryCodes: ['US'],
      jurisdictionIds: ['US-WY'],
      entityTypeIds: ['llc'],
      protectedTitleIds: [],
      flags: { registered_agent: false, registered_office: false },
    },
    ...overrides,
  };
}

// --- 30F subject isolation ---
{
  const agentCap = wyFormation({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: 'agent-A' });
  const agencyCap = wyFormation({ subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: 'org-ABC' });
  check(sameProviderSubject(agentCap, { subjectType: 'agent', subjectId: 'agent-A' }), 'agent subject matches itself');
  check(!sameProviderSubject(agentCap, agencyCap), 'agent capability is not agency capability');
  check(!sameProviderSubject(agencyCap, agentCap), 'agency capability is not agent capability');

  const parsed = validateProviderCapabilityRecord(agentCap);
  check(parsed.ok === true, 'valid provider capability record');
  check(parsed.value.trustStatus === 'verified', 'trust status is verified, not isVerified boolean');
}

// --- 30G listing subset ---
{
  const cap = wyFormation();
  const allowed = authorizeListingScope({ requested: requestScope(), capability: cap });
  check(allowed.allowed, 'WY formation ⊆ WY formation');

  const de = authorizeListingScope({
    requested: requestScope({
      scope: { ...requestScope().scope, jurisdictionIds: ['US-DE'] },
    }),
    capability: cap,
  });
  check(!de.allowed && de.reason === LISTING_SCOPE_DENY_REASONS.SCOPE_NOT_SUBSET, 'WY formation cannot list DE');

  const ra = authorizeListingScope({
    requested: requestScope({
      scope: { ...requestScope().scope, flags: { registered_agent: true, registered_office: false } },
    }),
    capability: cap,
  });
  check(!ra.allowed, 'WY formation cannot list Registered Agent without RA flag');

  const agencyUsingAgent = authorizeListingScope({
    requested: requestScope({ subjectType: 'organization', subjectId: 'org-ABC' }),
    capability: cap,
  });
  check(
    !agencyUsingAgent.allowed && agencyUsingAgent.reason === LISTING_SCOPE_DENY_REASONS.SUBJECT_MISMATCH,
    'Agency cannot use independent Agent capability'
  );

  const agentUsingAgency = authorizeListingScope({
    requested: requestScope(),
    capability: wyFormation({ subjectType: 'organization', subjectId: 'org-ABC' }),
  });
  check(!agentUsingAgency.allowed, 'Agent cannot use Agency capability');

  const suspended = authorizeListingScope({
    requested: requestScope(),
    capability: { ...cap, status: GRANT_STATUSES.SUSPENDED },
  });
  check(!suspended.allowed && suspended.reason === LISTING_SCOPE_DENY_REASONS.NOT_ACTIVE, 'suspended capability denied');

  const revoked = authorizeListingScope({
    requested: requestScope(),
    capability: { ...cap, status: GRANT_STATUSES.REVOKED },
  });
  check(!revoked.allowed, 'revoked capability denied');

  const unverified = authorizeListingScope({
    requested: requestScope(),
    capability: { ...cap, trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED },
  });
  check(!unverified.allowed && unverified.reason === LISTING_SCOPE_DENY_REASONS.NOT_VERIFIED, 'claimed != verified');

  const evidence = authorizeListingScope({
    requested: requestScope(),
    capability: { ...cap, trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED },
  });
  check(!evidence.allowed, 'evidence_submitted != verified');

  const backed = authorizeListingScope({
    requested: requestScope(),
    capability: { ...cap, trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED },
  });
  check(!backed.allowed, 'evidence_backed != verified');
}

// --- 30I optimistic concurrency ---
{
  const record = { recordVersion: 3, value: 'a' };
  const first = applyOptimisticMutation({
    currentVersion: record.recordVersion,
    expectedVersion: 3,
    mutate: (next) => {
      record.value = 'b';
      record.recordVersion = next;
      return record.value;
    },
  });
  check(first.nextVersion === 4 && record.recordVersion === 4, 'correct version mutates and increments');

  let stale = false;
  try {
    applyOptimisticMutation({
      currentVersion: record.recordVersion,
      expectedVersion: 3,
      mutate: () => {
        record.value = 'clobber';
      },
    });
  } catch (err) {
    stale = err.code === OPTIMISTIC_CONCURRENCY_CODE && err.status === 409;
  }
  check(stale, 'stale expectedVersion → 409');
  check(record.value === 'b', 'stale write does not overwrite');

  const shared = { recordVersion: 1, wins: 0 };
  const results = [];
  for (const expected of [1, 1]) {
    try {
      applyOptimisticMutation({
        currentVersion: shared.recordVersion,
        expectedVersion: expected,
        mutate: (next) => {
          shared.wins += 1;
          shared.recordVersion = next;
        },
      });
      results.push('win');
    } catch (err) {
      results.push(err.code);
    }
  }
  check(results.filter((r) => r === 'win').length === 1, 'one competing update wins');
  check(results.includes(OPTIMISTIC_CONCURRENCY_CODE), 'stale competitor conflicts');
  check(shared.wins === 1 && shared.recordVersion === 2, 'version increments only on success');

  check(assertExpectedVersion(0, 0) === 1, 'version 0 increments to 1');
}

// --- 30J idempotency ---
{
  const store = createIdempotencyStore();
  check(store.kind === IDEMPOTENCY_STORE_KINDS.IN_MEMORY, 'createIdempotencyStore remains the in-memory test adapter');
  check(createInMemoryIdempotencyStore().kind === IDEMPOTENCY_STORE_KINDS.IN_MEMORY, 'explicit in-memory kind');
  let effects = 0;
  const fp = fingerprintRequest({ cmd: 'quote.accept', revision: 1 });
  const first = await store.execute({
    principalId: 'user-1',
    tenantId: 'org-1',
    commandType: 'gbs.quote.accept',
    idempotencyKey: 'cmd-1',
    fingerprint: fp,
    perform: async () => {
      effects += 1;
      return { accepted: true };
    },
  });
  check(first.replay === false && effects === 1, 'first command performs once');
  const replay = await store.execute({
    principalId: 'user-1',
    tenantId: 'org-1',
    commandType: 'gbs.quote.accept',
    idempotencyKey: 'cmd-1',
    fingerprint: fp,
    perform: async () => {
      effects += 1;
      return { accepted: true };
    },
  });
  check(replay.replay === true && replay.code === IDEMPOTENCY_CODES.REPLAY, 'replay is detected');
  check(effects === 1, 'replay does not duplicate side effect');

  let conflict = false;
  try {
    await store.execute({
      principalId: 'user-1',
      tenantId: 'org-1',
      commandType: 'gbs.quote.accept',
      idempotencyKey: 'cmd-1',
      fingerprint: fingerprintRequest({ cmd: 'quote.accept', revision: 2 }),
      perform: async () => {
        effects += 1;
      },
    });
  } catch (err) {
    conflict = err.code === IDEMPOTENCY_CODES.CONFLICT && err.status === 409;
  }
  check(conflict, 'same key + different fingerprint conflicts');
  check(effects === 1, 'conflict does not perform');

  const concurrentStore = createIdempotencyStore();
  let concurrentEffects = 0;
  const cfp = fingerprintRequest({ n: 1 });
  const run = () =>
    concurrentStore.execute({
      principalId: 'p',
      tenantId: 't',
      commandType: 'demo',
      idempotencyKey: 'same',
      fingerprint: cfp,
      perform: async () => {
        concurrentEffects += 1;
        return { ok: true };
      },
    });
  const [a, b] = await Promise.all([run(), run()]);
  check(concurrentEffects === 1, 'concurrent duplicates produce one effect');
  check([a, b].filter((r) => r.replay).length === 1, 'one concurrent caller sees replay');
  check([a, b].some((r) => r.replay === false), 'one concurrent caller performs');
}

// --- Quote revision contract ---
{
  const draft = validateQuoteContract({
    quoteNumber: 'Q-100',
    revision: 1,
    status: QUOTE_STATUSES.DRAFT,
    currency: 'USD',
    lineItems: [{ label: 'Formation', feeType: QUOTE_FEE_TYPES.PROVIDER, amountMinor: 50000 }],
    providerFee: 50000,
    governmentFee: 10000,
    thirdPartyFee: 0,
    optionalFee: 0,
    recordVersion: 0,
  });
  check(draft.ok, 'valid quote contract');
  check(nextQuoteRevision(draft.value) === 2, 'material change allocates new revision');
  assertQuoteRevisionMutable({ status: QUOTE_STATUSES.DRAFT });
  let immutable = false;
  try {
    assertQuoteRevisionMutable({ status: QUOTE_STATUSES.SENT });
  } catch (err) {
    immutable = err.code === 'quote_revision_immutable';
  }
  check(immutable, 'sent quote revision is immutable');
  let accepted = false;
  try {
    assertQuoteRevisionMutable({ status: QUOTE_STATUSES.ACCEPTED });
  } catch (err) {
    accepted = err.code === 'quote_revision_immutable';
  }
  check(accepted, 'accepted quote revision is immutable');
  assertQuoteRevisionMutable({ status: QUOTE_STATUSES.ACCEPTED }, { privilegedCorrection: true });
  check(true, 'privileged audited correction may mutate accepted revision');
}

check(GBS_AUDIT_EVENTS.LISTING_SCOPE_DENIED === 'listing_scope_denied', 'listing_scope_denied event exists');
check(GBS_AUDIT_EVENTS.OPTIMISTIC_CONCURRENCY_CONFLICT === 'optimistic_concurrency_conflict', 'concurrency event exists');
check(GBS_AUDIT_EVENTS.IDEMPOTENCY_REPLAY === 'idempotency_replay', 'idempotency_replay event exists');
check(GBS_AUDIT_EVENTS.IDEMPOTENCY_CONFLICT === 'idempotency_conflict', 'idempotency_conflict event exists');

console.log(`phase17d1ProviderAndPlatform.test.js: ${count} assertions passed`);
