/**
 * Dormant application-destination pure contract tests (E.1F-H2B-B3-C1).
 * Run: node src/__tests__/applicationDestinationContract.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = join(TEST_DIR, '..');
const CLIENT_SRC = join(SERVER_SRC, '..', '..', 'client', 'src');
const CONTRACT_PATH = join(
  SERVER_SRC,
  'services',
  'publishing',
  'contracts',
  'ApplicationDestinationContract.js'
);
const CONTRACT_URL = pathToFileURL(CONTRACT_PATH).href;
const CONTRACT_SOURCE = readFileSync(CONTRACT_PATH, 'utf8');

let assertions = 0;

function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}

function deepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}

function doesNotContain(value, forbidden, message) {
  assert.equal(String(value).includes(forbidden), false, message);
  assertions += 1;
}

function listSourceFiles(root) {
  const results = [];
  for (const entry of readdirSync(root)) {
    const absolutePath = join(root, entry);
    if (statSync(absolutePath).isDirectory()) {
      results.push(...listSourceFiles(absolutePath));
    } else if (/\.(?:js|jsx)$/u.test(entry)) {
      results.push(absolutePath);
    }
  }
  return results;
}

const readyStateBefore = mongoose.connection.readyState;
const collectionNamesBefore = Object.keys(
  mongoose.connection.collections
).sort();
const modelNamesBefore = mongoose.modelNames().sort();
const listenerCountsBefore = new Map(
  process
    .eventNames()
    .map((eventName) => [eventName, process.listenerCount(eventName)])
);
const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const originalSetInterval = globalThis.setInterval;
const originalConsole = {
  debug: console.debug,
  error: console.error,
  info: console.info,
  log: console.log,
  warn: console.warn,
};
let networkCalls = 0;
let timerCalls = 0;
let consoleCalls = 0;

globalThis.fetch = () => {
  networkCalls += 1;
  throw new Error('network use is forbidden');
};
globalThis.setTimeout = () => {
  timerCalls += 1;
  throw new Error('timer use is forbidden');
};
globalThis.setInterval = () => {
  timerCalls += 1;
  throw new Error('timer use is forbidden');
};
for (const method of Object.keys(originalConsole)) {
  console[method] = () => {
    consoleCalls += 1;
  };
}

let contract;
try {
  contract = await import(`${CONTRACT_URL}?purity=${Date.now()}`);
} finally {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.setInterval = originalSetInterval;
  Object.assign(console, originalConsole);
}

const {
  APPLICATION_DESTINATION_ACTOR_TYPES,
  APPLICATION_DESTINATION_BOUNDS,
  APPLICATION_DESTINATION_CHANGE_CLASSIFICATIONS,
  APPLICATION_DESTINATION_ERROR_CODES,
  APPLICATION_DESTINATION_EVIDENCE_SOURCES,
  APPLICATION_DESTINATION_MODES,
  APPLICATION_DESTINATION_SCHEMA_VERSION,
  APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS,
  APPLICATION_DESTINATION_VALIDATION_POLICY_VERSION,
  ApplicationDestinationContractError,
  buildApplicationDestinationEvidence,
  classifyApplicationDestinationChange,
  validateApplicationDestinationEvidence,
} = contract;

function throwsCode(action, code, forbiddenValues = []) {
  let captured;
  assert.throws(action, (error) => {
    captured = error;
    return (
      error instanceof ApplicationDestinationContractError &&
      error.code === code
    );
  });
  assertions += 1;
  equal(captured.message.length <= 80, true);
  const serialized = JSON.stringify(captured);
  doesNotContain(serialized, 'stack');
  for (const forbidden of forbiddenValues) {
    doesNotContain(captured.message, forbidden);
    doesNotContain(serialized, forbidden);
  }
  return captured;
}

const JOB_ID = '507f1f77bcf86cd799439011';
const OTHER_JOB_ID = '507f1f77bcf86cd799439012';
const NOW = new Date('2026-07-29T10:00:00.000Z');

function serverContext(overrides = {}) {
  return {
    jobId: JOB_ID,
    evaluatedAt: new Date(NOW.getTime()),
    validationPolicyVersion: APPLICATION_DESTINATION_VALIDATION_POLICY_VERSION,
    ...overrides,
  };
}

function validationContext(jobId = JOB_ID) {
  return { jobId };
}

function internalInput(overrides = {}) {
  return {
    mode: APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM,
    ...overrides,
  };
}

function urlInput(target = 'https://careers.acmejobs.pk/openings/42') {
  return {
    mode: APPLICATION_DESTINATION_MODES.EXTERNAL_URL,
    target,
  };
}

function emailInput(target = 'Hiring.Team@careers-acme.pk') {
  return {
    mode: APPLICATION_DESTINATION_MODES.EXTERNAL_EMAIL,
    target,
  };
}

function build(input, context = serverContext()) {
  return buildApplicationDestinationEvidence(input, context);
}

// Module purity and immutable exports.
equal(readyStateBefore, 0);
equal(mongoose.connection.readyState, 0);
equal(networkCalls, 0);
equal(timerCalls, 0);
equal(consoleCalls, 0);
for (const [eventName, count] of listenerCountsBefore) {
  equal(process.listenerCount(eventName), count);
}
doesNotContain(CONTRACT_SOURCE, 'mongoose');
doesNotContain(CONTRACT_SOURCE, '../models/');
doesNotContain(CONTRACT_SOURCE, 'process.env');
doesNotContain(CONTRACT_SOURCE, 'setTimeout');
doesNotContain(CONTRACT_SOURCE, 'setInterval');
doesNotContain(CONTRACT_SOURCE, 'process.on(');
doesNotContain(CONTRACT_SOURCE, 'console.');
doesNotContain(CONTRACT_SOURCE, 'fetch(');
doesNotContain(CONTRACT_SOURCE, 'new Proxy');
doesNotContain(CONTRACT_SOURCE, 'DATE_MUTATOR_METHODS');
doesNotContain(CONTRACT_SOURCE, 'node:http');
doesNotContain(CONTRACT_SOURCE, 'node:https');
doesNotContain(CONTRACT_SOURCE, 'nodemailer');
doesNotContain(CONTRACT_SOURCE, 'Schema.Types.Mixed');

for (const exportedPolicy of [
  APPLICATION_DESTINATION_MODES,
  APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS,
  APPLICATION_DESTINATION_EVIDENCE_SOURCES,
  APPLICATION_DESTINATION_ACTOR_TYPES,
  APPLICATION_DESTINATION_CHANGE_CLASSIFICATIONS,
  APPLICATION_DESTINATION_ERROR_CODES,
  APPLICATION_DESTINATION_BOUNDS,
]) {
  equal(Object.isFrozen(exportedPolicy), true);
}

const originalInternalMode = APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM;
assert.throws(() => {
  APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM = 'weakened';
}, TypeError);
assertions += 1;
equal(APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM, originalInternalMode);

// Exported errors accept only approved stable codes and canonical messages.
const CANONICAL_ERROR_MESSAGES = Object.freeze({
  DESTINATION_MODE_INVALID: 'Application destination is invalid',
  DESTINATION_OWNERSHIP_UNVERIFIED: 'Application destination requires review',
  DESTINATION_EVIDENCE_CONFLICT: 'Application destination evidence is invalid',
  DESTINATION_CHANGED_BEYOND_CORRECTION_SCOPE:
    'Application destination changed beyond correction scope',
});

for (const approvedCode of Object.values(APPLICATION_DESTINATION_ERROR_CODES)) {
  const approvedError = new ApplicationDestinationContractError(approvedCode);
  const firstSerialization = approvedError.toJSON();
  const secondSerialization = approvedError.toJSON();
  equal(approvedError.code, approvedCode);
  equal(approvedError.message, CANONICAL_ERROR_MESSAGES[approvedCode]);
  equal(firstSerialization.code, approvedCode);
  equal(firstSerialization.message, CANONICAL_ERROR_MESSAGES[approvedCode]);
  deepEqual(Object.keys(firstSerialization), ['status', 'code', 'message']);
  equal(Object.hasOwn(firstSerialization, 'stack'), false);
  equal(Object.hasOwn(firstSerialization, 'details'), false);
  equal(approvedError.cause, undefined);
  equal(Object.hasOwn(approvedError, 'cause'), false);
  equal(firstSerialization === secondSerialization, false);
  equal(Object.isFrozen(firstSerialization), true);
  assert.throws(() => {
    firstSerialization.code = 'changed';
  }, TypeError);
  assertions += 1;
  equal(secondSerialization.code, approvedCode);
}

const arbitraryErrorValues = [
  'UNAPPROVED_ERROR_CODE',
  'https://private-value.invalid/path',
  'private-value@invalid.test',
  JOB_ID,
  { privateValue: 'must-not-serialize' },
  Symbol('must-not-serialize'),
  null,
  undefined,
];
const accessorCode = {};
Object.defineProperty(accessorCode, 'privateValue', {
  get() {
    throw new Error('accessor must not execute');
  },
});
arbitraryErrorValues.push(accessorCode);
let errorToStringCalls = 0;
let errorPrimitiveCalls = 0;
const trappedErrorCode = {
  toString() {
    errorToStringCalls += 1;
    throw new Error('error toString must not execute');
  },
  [Symbol.toPrimitive]() {
    errorPrimitiveCalls += 1;
    throw new Error('error primitive conversion must not execute');
  },
};
arbitraryErrorValues.push(trappedErrorCode);

for (const arbitraryCode of arbitraryErrorValues) {
  const arbitraryError = new ApplicationDestinationContractError(
    arbitraryCode,
    'caller message must be ignored',
    { details: 'caller details must be ignored' }
  );
  const serialized = JSON.stringify(arbitraryError);
  const normalLoggingSurfaces = [
    arbitraryError.name,
    arbitraryError.code,
    arbitraryError.message,
    arbitraryError.stack,
    JSON.stringify(Object.keys(arbitraryError)),
    JSON.stringify(Object.getOwnPropertyNames(arbitraryError)),
    serialized,
    JSON.stringify(arbitraryError.toJSON()),
  ].join('|');
  equal(arbitraryError.code, APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID);
  equal(
    arbitraryError.message,
    CANONICAL_ERROR_MESSAGES.DESTINATION_MODE_INVALID
  );
  equal(
    arbitraryError.toJSON().code,
    APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
  );
  deepEqual(Object.keys(arbitraryError.toJSON()), [
    'status',
    'code',
    'message',
  ]);
  doesNotContain(serialized, 'caller message');
  doesNotContain(serialized, 'caller details');
  doesNotContain(serialized, 'private-value');
  doesNotContain(serialized, JOB_ID);
  doesNotContain(serialized, 'UNAPPROVED_ERROR_CODE');
  doesNotContain(normalLoggingSurfaces, 'caller message');
  doesNotContain(normalLoggingSurfaces, 'caller details');
  doesNotContain(normalLoggingSurfaces, 'must-not-serialize');
  doesNotContain(normalLoggingSurfaces, 'error toString');
  doesNotContain(normalLoggingSurfaces, 'error primitive conversion');
  equal(arbitraryError.cause, undefined);
  equal(Object.hasOwn(arbitraryError, 'details'), false);
  equal(Object.hasOwn(arbitraryError, 'cause'), false);
}
equal(errorToStringCalls, 0);
equal(errorPrimitiveCalls, 0);

// Strict client input envelope.
for (const invalidInput of [
  undefined,
  null,
  true,
  1,
  'internal_platform',
  [],
  new Date(),
  new (class Destination {})(),
]) {
  throwsCode(
    () => build(invalidInput),
    APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
  );
}

const accessorInput = {};
Object.defineProperty(accessorInput, 'mode', {
  enumerable: true,
  get() {
    throw new Error('accessor must not execute');
  },
});
throwsCode(
  () => build(accessorInput),
  APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
);

const inheritedInput = Object.create({ sourceUrl: 'forbidden' });
inheritedInput.mode = APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM;
throwsCode(
  () => build(inheritedInput),
  APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
);

const circularInput = internalInput();
circularInput.self = circularInput;
throwsCode(
  () => build(circularInput),
  APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
);

const hiddenInput = internalInput();
Object.defineProperty(hiddenInput, 'token', {
  enumerable: false,
  value: 'hidden',
});
throwsCode(
  () => build(hiddenInput),
  APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
);

const symbolInput = internalInput();
symbolInput[Symbol('hidden')] = 'hidden';
throwsCode(
  () => build(symbolInput),
  APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
);

for (const invalidInput of [
  JSON.parse('{"mode":"internal_platform","__proto__":"blocked"}'),
  { mode: 'internal_platform', constructor: 'blocked' },
  { mode: 'internal_platform', prototype: 'blocked' },
  { mode: 'internal_platform', 'destination.value': 'blocked' },
  { mode: 'internal_platform', $where: 'blocked' },
  { mode: 'internal_platform', unknown: true },
  { mode: 'internal_platform', metadata: {} },
  { mode: 'internal_platform', ownershipVerified: true },
  { mode: 'internal_platform', approved: true },
  { mode: 'internal_platform', verified: true },
  { mode: 'internal_platform', applicantId: JOB_ID },
  { mode: 'internal_platform', paymentStatus: 'paid' },
  { mode: 'internal_platform', moderationNote: 'private' },
  { mode: 'internal_platform', request: {} },
  { mode: 'internal_platform', headers: {} },
  { mode: 'internal_platform', cookies: {} },
  { mode: 'internal_platform', token: 'hidden' },
  { mode: 'internal_platform', credentials: 'hidden' },
  { mode: 'internal_platform', evidenceSource: 'client' },
  { mode: 'internal_platform', classifiedByActorType: 'employer' },
  { mode: 'internal_platform', evaluatedAt: NOW.toISOString() },
  { mode: 'internal_platform', sourceUrl: 'https://fallback.invalid' },
]) {
  throwsCode(
    () => build(invalidInput),
    APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
  );
}

// Internal platform derives identity only from strict server context.
const internalSource = internalInput();
const internalContext = serverContext();
const internalValidationContext = validationContext();
const internalSourceSnapshot = JSON.stringify(internalSource);
const internalContextTime = internalContext.evaluatedAt.toISOString();
const internal = build(internalSource, internalContext);
const internalValidationContextSnapshot = JSON.stringify(
  internalValidationContext
);
equal(
  validateApplicationDestinationEvidence(internal, internalValidationContext),
  true
);
equal(internal.mode, 'internal_platform');
equal(
  internal.trustClassification,
  APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.INTERNAL_PLATFORM
);
equal(
  internal.evidenceSource,
  APPLICATION_DESTINATION_EVIDENCE_SOURCES.SERVER_DERIVED_INTERNAL_ROUTE
);
equal(
  internal.classifiedByActorType,
  APPLICATION_DESTINATION_ACTOR_TYPES.SYSTEM
);
equal(internal.classifiedByActorId, null);
equal(internal.normalizedTarget, null);
equal(internal.normalizedDomain, null);
equal(internal.targetDigest.length, 64);
equal(internal.targetDigest, build(internalInput()).targetDigest);
equal(
  internal.targetDigest ===
    build(internalInput(), serverContext({ jobId: OTHER_JOB_ID })).targetDigest,
  false
);
equal(JSON.stringify(internalSource), internalSourceSnapshot);
equal(internalContext.evaluatedAt.toISOString(), internalContextTime);
equal(internal.evaluatedAt === internalContext.evaluatedAt, false);
equal(internal.evaluatedAt, internalContextTime);
equal(typeof internal.evaluatedAt, 'string');
equal(internal.evaluatedAt.length, 24);
equal(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(internal.evaluatedAt),
  true
);
equal(internal.evaluatedAt instanceof Date, false);
const evaluatedAtDescriptor = Object.getOwnPropertyDescriptor(
  internal,
  'evaluatedAt'
);
equal(typeof evaluatedAtDescriptor.get, 'undefined');
equal(typeof evaluatedAtDescriptor.set, 'undefined');
equal(evaluatedAtDescriptor.value, internalContextTime);
equal(Object.isFrozen(internal), true);
equal(
  JSON.stringify(internalValidationContext),
  internalValidationContextSnapshot
);
equal(Object.hasOwn(internal, 'jobId'), false);
equal(Object.hasOwn(internal, 'validationContext'), false);
equal(Object.values(internal).includes(internalValidationContext), false);

for (const invalidValidationContext of [
  undefined,
  null,
  true,
  1,
  'job',
  [],
  new Date(),
  new (class ValidationContext {
    constructor() {
      this.jobId = JOB_ID;
    }
  })(),
  Object.assign(Object.create(null), { jobId: JOB_ID }),
  {},
  { jobId: '' },
  { jobId: JOB_ID, trustClassification: 'INTERNAL_PLATFORM' },
  { jobId: JOB_ID, classifiedByActorType: 'system' },
  { jobId: JOB_ID, evidenceSource: 'server' },
  { jobId: JOB_ID, target: 'forbidden' },
  { jobId: JOB_ID, approval: true },
  { jobId: JOB_ID, metadata: {} },
  { jobId: JOB_ID, request: {} },
  { jobId: JOB_ID, auth: {} },
  { jobId: JOB_ID, session: {} },
]) {
  throwsCode(
    () =>
      validateApplicationDestinationEvidence(
        internal,
        invalidValidationContext
      ),
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT,
    [JOB_ID, internal.targetDigest]
  );
}

let validationContextAccessorReads = 0;
const accessorValidationContext = {};
Object.defineProperty(accessorValidationContext, 'jobId', {
  enumerable: true,
  get() {
    validationContextAccessorReads += 1;
    return JOB_ID;
  },
});
throwsCode(
  () =>
    validateApplicationDestinationEvidence(internal, accessorValidationContext),
  APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
);
equal(validationContextAccessorReads, 0);

const hiddenValidationContext = {};
Object.defineProperty(hiddenValidationContext, 'jobId', {
  enumerable: false,
  value: JOB_ID,
});
const symbolValidationContext = validationContext();
symbolValidationContext[Symbol('hidden')] = true;
const inheritedValidationContext = Object.create({ jobId: JOB_ID });
const circularValidationContext = validationContext();
circularValidationContext.self = circularValidationContext;
for (const invalidValidationContext of [
  hiddenValidationContext,
  symbolValidationContext,
  inheritedValidationContext,
  circularValidationContext,
]) {
  throwsCode(
    () =>
      validateApplicationDestinationEvidence(
        internal,
        invalidValidationContext
      ),
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
  );
}

throwsCode(
  () =>
    validateApplicationDestinationEvidence(
      internal,
      validationContext(OTHER_JOB_ID)
    ),
  APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT,
  [JOB_ID, OTHER_JOB_ID, internal.targetDigest]
);

const forgedInternalDigest = {
  ...internal,
  targetDigest: 'a'.repeat(64),
};
throwsCode(
  () =>
    validateApplicationDestinationEvidence(
      forgedInternalDigest,
      validationContext()
    ),
  APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT,
  [JOB_ID, forgedInternalDigest.targetDigest]
);

for (const replacementDigest of [
  '0'.repeat(64),
  'f'.repeat(64),
  '0123456789abcdef'.repeat(4),
  internal.targetDigest.toUpperCase(),
  internal.targetDigest.slice(0, -1),
  `${internal.targetDigest}0`,
  'g'.repeat(64),
]) {
  throwsCode(
    () =>
      validateApplicationDestinationEvidence(
        { ...internal, targetDigest: replacementDigest },
        validationContext()
      ),
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT,
    [replacementDigest]
  );
}

const otherJobInternal = build(
  internalInput(),
  serverContext({ jobId: OTHER_JOB_ID })
);
const otherJobDigestForgery = {
  ...internal,
  targetDigest: otherJobInternal.targetDigest,
};
throwsCode(
  () =>
    validateApplicationDestinationEvidence(
      otherJobDigestForgery,
      validationContext()
    ),
  APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT,
  [JOB_ID, OTHER_JOB_ID, otherJobDigestForgery.targetDigest]
);
equal(
  validateApplicationDestinationEvidence(
    otherJobInternal,
    validationContext(OTHER_JOB_ID)
  ),
  true
);

for (const invalidInput of [
  internalInput({ target: 'other-job' }),
  internalInput({ url: 'https://careers.acmejobs.pk' }),
  internalInput({ email: 'team@careers-acme.pk' }),
  internalInput({ route: '/api/applications/other-job' }),
  internalInput({ slug: 'another-job' }),
  internalInput({ redirect: 'https://careers.acmejobs.pk' }),
]) {
  throwsCode(
    () => build(invalidInput),
    APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
  );
}

throwsCode(
  () => buildApplicationDestinationEvidence(internalInput(), undefined),
  APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
);

for (const invalidContext of [
  null,
  {},
  serverContext({ jobId: '' }),
  serverContext({ jobId: OTHER_JOB_ID, actorType: 'system' }),
  serverContext({ evaluatedAt: new Date('invalid') }),
  serverContext({ evaluatedAt: NOW.toISOString() }),
  serverContext({ evaluatedAt: NOW.getTime() }),
  serverContext({ evaluatedAt: new Date('+010000-01-01T00:00:00.000Z') }),
  serverContext({ validationPolicyVersion: '' }),
  serverContext({ validationPolicyVersion: 'future-client-policy' }),
]) {
  throwsCode(
    () => build(internalInput(), invalidContext),
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
  );
}

// External URL normalization is syntactic and always review-required.
const normalizedUrl = build(
  urlInput('https://Careers.AcmeJobs.pk:443/apply/../openings/42')
);
equal(
  normalizedUrl.normalizedTarget,
  'https://careers.acmejobs.pk/openings/42'
);
equal(normalizedUrl.normalizedDomain, 'careers.acmejobs.pk');
equal(
  normalizedUrl.trustClassification,
  APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.ADMIN_REVIEW_REQUIRED
);
equal(
  normalizedUrl.evidenceSource,
  APPLICATION_DESTINATION_EVIDENCE_SOURCES.EMPLOYER_DECLARED_EXTERNAL_TARGET
);
equal(
  normalizedUrl.classifiedByActorType,
  APPLICATION_DESTINATION_ACTOR_TYPES.SYSTEM
);
equal(normalizedUrl.classifiedByActorId, null);
equal(
  normalizedUrl.targetDigest,
  build(urlInput('https://careers.acmejobs.pk/openings/42')).targetDigest
);
equal(
  normalizedUrl.targetDigest ===
    build(urlInput('https://careers.acmejobs.pk/openings/43')).targetDigest,
  false
);
equal(
  normalizedUrl.targetDigest ===
    build(emailInput('openings@careers.acmejobs.pk')).targetDigest,
  false
);
equal(validateApplicationDestinationEvidence(normalizedUrl), true);
equal(
  validateApplicationDestinationEvidence(
    normalizedUrl,
    validationContext(OTHER_JOB_ID)
  ),
  true
);
equal(
  normalizedUrl.trustClassification,
  APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.ADMIN_REVIEW_REQUIRED
);

const idnUrl = build(urlInput('https://BÜCHER.jobs.pk/stellen'));
equal(idnUrl.normalizedDomain, 'xn--bcher-kva.jobs.pk');
equal(idnUrl.normalizedTarget, 'https://xn--bcher-kva.jobs.pk/stellen');

for (const invalidUrl of [
  'http://careers.acmejobs.pk/openings/42',
  'https:///openings/42',
  'https://user:secret@careers.acmejobs.pk/openings/42',
  'https://careers.acmejobs.pk/openings/42#details',
  'https://careers.acmejobs.pk/openings/42?token=value',
  'https://careers.acmejobs.pk:444/openings/42',
  ' https://careers.acmejobs.pk/openings/42',
  'https://careers.acmejobs.pk/openings/42 ',
  'https://careers.acmejobs.pk/openings/\n42',
  'https://careers.acmejobs.pk/openings/%0a42',
  'https://localhost/openings/42',
  'https://intranet/openings/42',
  'https://127.0.0.1/openings/42',
  'https://[::1]/openings/42',
  'https://careers.acmejobs.pk./openings/42',
  'https://bit.ly/openings42',
  'https://sub.tinyurl.com/openings42',
  `https://careers.acmejobs.pk/${'a'.repeat(2050)}`,
]) {
  throwsCode(
    () => build(urlInput(invalidUrl)),
    APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID,
    [invalidUrl]
  );
}

throwsCode(
  () => build({ mode: 'external_url' }),
  APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
);
throwsCode(
  () => build({ mode: 'manual_instructions', target: 'Apply elsewhere' }),
  APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
);

// External email normalization preserves local semantics and reviews all mailboxes.
const normalizedEmail = build(
  emailInput('  Hiring.Team+Role@CAREERS-ACME.PK  ')
);
equal(normalizedEmail.normalizedTarget, 'Hiring.Team+Role@careers-acme.pk');
equal(normalizedEmail.normalizedDomain, 'careers-acme.pk');
equal(
  normalizedEmail.trustClassification,
  APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.ADMIN_REVIEW_REQUIRED
);
equal(
  normalizedEmail.evidenceSource,
  APPLICATION_DESTINATION_EVIDENCE_SOURCES.EMPLOYER_DECLARED_EXTERNAL_TARGET
);
equal(
  normalizedEmail.targetDigest,
  build(emailInput('Hiring.Team+Role@careers-acme.pk')).targetDigest
);
equal(
  normalizedEmail.targetDigest ===
    build(emailInput('hiring.team+role@careers-acme.pk')).targetDigest,
  false
);
equal(
  normalizedEmail.targetDigest ===
    build(emailInput('Hiring.Team+Other@careers-acme.pk')).targetDigest,
  false
);
equal(validateApplicationDestinationEvidence(normalizedEmail), true);
equal(
  validateApplicationDestinationEvidence(
    normalizedEmail,
    validationContext(OTHER_JOB_ID)
  ),
  true
);
equal(
  normalizedEmail.trustClassification,
  APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.ADMIN_REVIEW_REQUIRED
);

const idnEmail = build(emailInput('Hiring@BÜCHER.jobs.pk'));
equal(idnEmail.normalizedTarget, 'Hiring@xn--bcher-kva.jobs.pk');
equal(idnEmail.normalizedDomain, 'xn--bcher-kva.jobs.pk');

for (const acceptedUnprovenEmail of [
  'vacancy@gmail.com',
  'vacancy@corporate-looking.pk',
]) {
  const evidence = build(emailInput(acceptedUnprovenEmail));
  equal(
    evidence.trustClassification,
    APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.ADMIN_REVIEW_REQUIRED
  );
}

for (const invalidEmail of [
  'missing-domain',
  'missing@',
  '@careers-acme.pk',
  'Display Name <hiring@careers-acme.pk>',
  'first@careers-acme.pk,second@careers-acme.pk',
  'first@careers-acme.pk;second@careers-acme.pk',
  'first@careers-acme.pk second@careers-acme.pk',
  'hiring\n@careers-acme.pk',
  '.hiring@careers-acme.pk',
  'hiring.@careers-acme.pk',
  'hiring..team@careers-acme.pk',
  `${'a'.repeat(65)}@careers-acme.pk`,
  `${'a'.repeat(250)}@careers-acme.pk`,
  'hiring@localhost',
  'hiring@127.0.0.1',
]) {
  throwsCode(
    () => build(emailInput(invalidEmail)),
    APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID,
    [invalidEmail]
  );
}

// Exact evidence structure, isolation, and fail-closed validation.
deepEqual(Object.keys(normalizedUrl), [
  'schemaVersion',
  'mode',
  'normalizedTarget',
  'targetDigest',
  'normalizedDomain',
  'trustClassification',
  'evidenceSource',
  'evaluatedAt',
  'validationPolicyVersion',
  'classifiedByActorType',
  'classifiedByActorId',
]);
equal(normalizedUrl.schemaVersion, APPLICATION_DESTINATION_SCHEMA_VERSION);
equal(
  normalizedUrl.validationPolicyVersion,
  APPLICATION_DESTINATION_VALIDATION_POLICY_VERSION
);
equal(normalizedUrl.evaluatedAt, NOW.toISOString());
equal(typeof normalizedUrl.evaluatedAt, 'string');
equal(validateApplicationDestinationEvidence(normalizedUrl), true);
for (const invalidEvidence of [
  { ...normalizedUrl, extra: true },
  { ...normalizedUrl, mode: 'internal_platform' },
  { ...normalizedUrl, trustClassification: 'INTERNAL_PLATFORM' },
  { ...normalizedUrl, evidenceSource: 'client_verified' },
  { ...normalizedUrl, classifiedByActorType: 'staff' },
  { ...normalizedUrl, classifiedByActorId: OTHER_JOB_ID },
  { ...normalizedUrl, validationPolicyVersion: '' },
  { ...normalizedUrl, validationPolicyVersion: 'free-beta-2026-02' },
  { ...normalizedUrl, evaluatedAt: NOW },
  { ...normalizedUrl, evaluatedAt: new Date('invalid') },
  { ...normalizedUrl, evaluatedAt: NOW.getTime() },
  { ...normalizedUrl, evaluatedAt: new String(NOW.toISOString()) },
  { ...normalizedUrl, evaluatedAt: 'invalid-date' },
  { ...normalizedUrl, evaluatedAt: '2026-07-29T15:00:00.000+05:00' },
  { ...normalizedUrl, evaluatedAt: '2026-07-29T10:00:00Z' },
  { ...normalizedUrl, evaluatedAt: '2026-07-29T10:00:00.0000Z' },
  { ...normalizedUrl, evaluatedAt: '2026-07-29T10:00:00.000z' },
  { ...normalizedUrl, evaluatedAt: '2026-07-29' },
  { ...normalizedUrl, evaluatedAt: ' 2026-07-29T10:00:00.000Z' },
  { ...normalizedUrl, evaluatedAt: '2026-07-29T10:00:00.000Z ' },
  { ...normalizedUrl, evaluatedAt: '2026-07-29T10:00:00.000Z\n' },
  { ...normalizedUrl, evaluatedAt: '7/29/2026, 10:00:00 AM' },
  { ...normalizedUrl, evaluatedAt: '2026-02-30T10:00:00.000Z' },
  { ...normalizedUrl, evaluatedAtIso: NOW.toISOString() },
  { ...normalizedUrl, normalizedDomain: 'other-domain.pk' },
  { ...normalizedUrl, normalizedTarget: 'https://other-domain.pk/opening' },
  { ...normalizedUrl, targetDigest: 'a'.repeat(64) },
  { ...internal, normalizedTarget: '/api/jobs/apply' },
  { ...internal, normalizedDomain: 'careers-acme.pk' },
]) {
  const context =
    invalidEvidence.mode === APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM
      ? validationContext()
      : undefined;
  throwsCode(
    () => validateApplicationDestinationEvidence(invalidEvidence, context),
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
  );
}

const mutableTime = new Date(NOW.getTime());
const canonicalMutableTime = mutableTime.toISOString();
const mutableInput = urlInput();
const mutableContext = serverContext({ evaluatedAt: mutableTime });
const isolatedEvidence = build(mutableInput, mutableContext);
mutableInput.target = 'https://changed.acmejobs.pk/opening';
mutableContext.jobId = OTHER_JOB_ID;
mutableContext.validationPolicyVersion = 'changed';
mutableTime.setUTCFullYear(2030);
equal(
  isolatedEvidence.normalizedTarget,
  'https://careers.acmejobs.pk/openings/42'
);
equal(isolatedEvidence.evaluatedAt, canonicalMutableTime);
equal(typeof isolatedEvidence.evaluatedAt, 'string');
equal(isolatedEvidence.evaluatedAt instanceof Date, false);
equal(isolatedEvidence.validationPolicyVersion, 'free-beta-2026-01');
equal(validateApplicationDestinationEvidence(isolatedEvidence), true);

const isolatedTwin = build(urlInput());
equal(isolatedEvidence.evaluatedAt, canonicalMutableTime);
equal(isolatedTwin.evaluatedAt, canonicalMutableTime);
equal(typeof isolatedTwin.evaluatedAt, 'string');
equal(String(isolatedEvidence.evaluatedAt), canonicalMutableTime);
const serializedIsolatedEvidence = JSON.stringify(isolatedEvidence);
const parsedIsolatedEvidence = JSON.parse(serializedIsolatedEvidence);
equal(parsedIsolatedEvidence.evaluatedAt, canonicalMutableTime);
const clonedIsolatedEvidence = structuredClone(isolatedEvidence);
equal(clonedIsolatedEvidence.evaluatedAt, canonicalMutableTime);
equal(clonedIsolatedEvidence.evaluatedAt instanceof Date, false);
clonedIsolatedEvidence.evaluatedAt = '2027-01-01T00:00:00.000Z';
equal(isolatedEvidence.evaluatedAt, canonicalMutableTime);
equal(clonedIsolatedEvidence.evaluatedAt, '2027-01-01T00:00:00.000Z');
equal(validateApplicationDestinationEvidence(isolatedTwin), true);

const mongooseDatePath = new mongoose.Schema({
  evaluatedAt: { type: Date, required: true },
}).path('evaluatedAt');
const mongooseCastedTimestamp = mongooseDatePath.cast(
  isolatedEvidence.evaluatedAt
);
equal(mongooseCastedTimestamp instanceof Date, true);
equal(mongooseCastedTimestamp.getTime(), NOW.getTime());
assert.throws(() => mongooseDatePath.cast('invalid-date'));
assertions += 1;
equal(mongoose.connection.readyState, readyStateBefore);
deepEqual(
  Object.keys(mongoose.connection.collections).sort(),
  collectionNamesBefore
);
deepEqual(mongoose.modelNames().sort(), modelNamesBefore);
equal(
  normalizedUrl.targetDigest.includes(normalizedUrl.normalizedTarget),
  false
);
equal(
  normalizedEmail.targetDigest.includes(normalizedEmail.normalizedTarget),
  false
);
equal(
  normalizedUrl.trustClassification ===
    APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.ADMIN_APPROVED_FOR_PUBLICATION,
  false
);

// Destination identity comparison never makes quota or correction decisions.
function comparisonContextsFor(previousEvidence, nextEvidence) {
  const contexts = {};
  if (
    previousEvidence.mode === APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM
  ) {
    contexts.previousValidationContext = validationContext();
  }
  if (nextEvidence.mode === APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM) {
    contexts.nextValidationContext = validationContext();
  }
  return Object.keys(contexts).length > 0 ? contexts : undefined;
}

function assertMajorChange(
  previousEvidence,
  nextEvidence,
  validationContexts = comparisonContextsFor(previousEvidence, nextEvidence)
) {
  const result = classifyApplicationDestinationChange(
    previousEvidence,
    nextEvidence,
    validationContexts
  );
  equal(
    result.classification,
    APPLICATION_DESTINATION_CHANGE_CLASSIFICATIONS.MAJOR_SCOPE_CHANGE
  );
  equal(result.requiresRenewedValidation, true);
  equal(result.priorApprovalTransferAllowed, false);
  equal(Object.isFrozen(result), true);
  equal(Object.hasOwn(result, 'quotaCharged'), false);
  equal(Object.hasOwn(result, 'correctionExempt'), false);
  equal(Object.hasOwn(result, 'normalizedTarget'), false);
  equal(Object.hasOwn(result, 'normalizedDomain'), false);
}

const unchanged = classifyApplicationDestinationChange(
  normalizedUrl,
  build(urlInput('https://careers.acmejobs.pk/openings/42'))
);
equal(
  unchanged.classification,
  APPLICATION_DESTINATION_CHANGE_CLASSIFICATIONS.NO_SCOPE_CHANGE
);
equal(unchanged.requiresRenewedValidation, false);
equal(unchanged.priorApprovalTransferAllowed, true);
equal(Object.hasOwn(unchanged, 'quotaCharged'), false);
equal(Object.hasOwn(unchanged, 'correctionExempt'), false);

const email = build(emailInput());
assertMajorChange(internal, normalizedUrl);
assertMajorChange(internal, email);
assertMajorChange(normalizedUrl, internal);
assertMajorChange(email, internal);
assertMajorChange(normalizedUrl, email);
assertMajorChange(email, normalizedUrl);
assertMajorChange(
  normalizedUrl,
  build(urlInput('https://other.acmejobs.pk/openings/42'))
);
assertMajorChange(
  normalizedUrl,
  build(urlInput('https://careers.acmejobs.pk/openings/43'))
);
assertMajorChange(email, build(emailInput('Other@careers-acme.pk')));
assertMajorChange(email, build(emailInput('Hiring.Team@other-acme.pk')));

const unchangedInternal = classifyApplicationDestinationChange(
  internal,
  build(internalInput()),
  {
    previousValidationContext: validationContext(),
    nextValidationContext: validationContext(),
  }
);
equal(
  unchangedInternal.classification,
  APPLICATION_DESTINATION_CHANGE_CLASSIFICATIONS.NO_SCOPE_CHANGE
);
equal(unchangedInternal.requiresRenewedValidation, false);
equal(unchangedInternal.priorApprovalTransferAllowed, true);

assertMajorChange(internal, otherJobInternal, {
  previousValidationContext: validationContext(),
  nextValidationContext: validationContext(OTHER_JOB_ID),
});

const unchangedExternalWithIgnoredContexts =
  classifyApplicationDestinationChange(normalizedUrl, normalizedUrl, {
    previousValidationContext: validationContext(),
    nextValidationContext: validationContext(OTHER_JOB_ID),
  });
equal(
  unchangedExternalWithIgnoredContexts.classification,
  APPLICATION_DESTINATION_CHANGE_CLASSIFICATIONS.NO_SCOPE_CHANGE
);
equal(unchangedExternalWithIgnoredContexts.requiresRenewedValidation, false);
equal(unchangedExternalWithIgnoredContexts.priorApprovalTransferAllowed, true);

const internalToExternal = classifyApplicationDestinationChange(
  internal,
  normalizedUrl,
  {
    previousValidationContext: validationContext(),
  }
);
equal(
  internalToExternal.classification,
  APPLICATION_DESTINATION_CHANGE_CLASSIFICATIONS.MAJOR_SCOPE_CHANGE
);
equal(Object.hasOwn(internalToExternal, 'jobId'), false);
equal(Object.hasOwn(internalToExternal, 'targetDigest'), false);
equal(Object.hasOwn(internalToExternal, 'normalizedTarget'), false);
equal(Object.hasOwn(internalToExternal, 'normalizedDomain'), false);

for (const [previousEvidence, nextEvidence, contexts] of [
  [
    forgedInternalDigest,
    normalizedUrl,
    { previousValidationContext: validationContext() },
  ],
  [
    normalizedUrl,
    forgedInternalDigest,
    { nextValidationContext: validationContext() },
  ],
  [internal, normalizedUrl, undefined],
  [normalizedUrl, internal, undefined],
  [
    internal,
    normalizedUrl,
    { previousValidationContext: validationContext(OTHER_JOB_ID) },
  ],
  [
    normalizedUrl,
    internal,
    { nextValidationContext: validationContext(OTHER_JOB_ID) },
  ],
  [
    internal,
    otherJobInternal,
    { nextValidationContext: validationContext(OTHER_JOB_ID) },
  ],
  [
    internal,
    otherJobInternal,
    { previousValidationContext: validationContext() },
  ],
  [
    internal,
    otherJobInternal,
    {
      previousValidationContext: validationContext(OTHER_JOB_ID),
      nextValidationContext: validationContext(),
    },
  ],
  [
    internal,
    otherJobInternal,
    {
      previousValidationContext: validationContext(OTHER_JOB_ID),
      nextValidationContext: validationContext(OTHER_JOB_ID),
    },
  ],
  [
    internal,
    otherJobInternal,
    {
      previousValidationContext: validationContext(),
      nextValidationContext: validationContext(),
    },
  ],
  [internal, normalizedUrl, { nextValidationContext: validationContext() }],
  [normalizedUrl, internal, { previousValidationContext: validationContext() }],
]) {
  throwsCode(
    () =>
      classifyApplicationDestinationChange(
        previousEvidence,
        nextEvidence,
        contexts
      ),
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT,
    [JOB_ID, OTHER_JOB_ID, forgedInternalDigest.targetDigest]
  );
}

throwsCode(
  () =>
    classifyApplicationDestinationChange(normalizedUrl, {
      ...normalizedUrl,
      trustClassification: 'ADMIN_APPROVED_FOR_PUBLICATION',
      classifiedByActorType: 'staff',
      classifiedByActorId: OTHER_JOB_ID,
    }),
  APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
);

// Runtime/import isolation: only this test and the dormant module reference it.
const runtimeReferences = [
  ...listSourceFiles(SERVER_SRC),
  ...listSourceFiles(CLIENT_SRC),
].filter(
  (path) =>
    path !== CONTRACT_PATH &&
    path !== fileURLToPath(import.meta.url) &&
    /ApplicationDestinationContract|buildApplicationDestinationEvidence|classifyApplicationDestinationChange/u.test(
      readFileSync(path, 'utf8')
    )
);
deepEqual(runtimeReferences, []);
doesNotContain(CONTRACT_SOURCE, "from '../../../");
doesNotContain(CONTRACT_SOURCE, "from '../../");
doesNotContain(CONTRACT_SOURCE, "from '../");
doesNotContain(CONTRACT_SOURCE, 'mongodb');
doesNotContain(CONTRACT_SOURCE, 'connect(');
doesNotContain(CONTRACT_SOURCE, 'listen(');
doesNotContain(CONTRACT_SOURCE, 'request(');
doesNotContain(CONTRACT_SOURCE, 'sendMail');
doesNotContain(CONTRACT_SOURCE, 'sourceUrl');
doesNotContain(CONTRACT_SOURCE, 'applicationLink');
doesNotContain(CONTRACT_SOURCE, 'applyEmail');

console.log(
  `applicationDestinationContract.test.js: ${assertions} assertions passed`
);
