import { createHash } from 'node:crypto';
import { URL, domainToASCII } from 'node:url';

export const APPLICATION_DESTINATION_SCHEMA_VERSION = 1;
export const APPLICATION_DESTINATION_VALIDATION_POLICY_VERSION =
  'free-beta-2026-01';

export const APPLICATION_DESTINATION_MODES = Object.freeze({
  INTERNAL_PLATFORM: 'internal_platform',
  EXTERNAL_URL: 'external_url',
  EXTERNAL_EMAIL: 'external_email',
});

export const APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS = Object.freeze({
  INTERNAL_PLATFORM: 'INTERNAL_PLATFORM',
  ADMIN_REVIEW_REQUIRED: 'ADMIN_REVIEW_REQUIRED',
  ADMIN_APPROVED_FOR_PUBLICATION: 'ADMIN_APPROVED_FOR_PUBLICATION',
  UNVERIFIED_REJECTED: 'UNVERIFIED_REJECTED',
});

export const APPLICATION_DESTINATION_EVIDENCE_SOURCES = Object.freeze({
  SERVER_DERIVED_INTERNAL_ROUTE: 'server_derived_internal_route',
  EMPLOYER_DECLARED_EXTERNAL_TARGET: 'employer_declared_external_target',
});

export const APPLICATION_DESTINATION_ACTOR_TYPES = Object.freeze({
  SYSTEM: 'system',
  STAFF: 'staff',
  SECURITY_OPERATOR: 'security_operator',
});

export const APPLICATION_DESTINATION_CHANGE_CLASSIFICATIONS = Object.freeze({
  NO_SCOPE_CHANGE: 'NO_SCOPE_CHANGE',
  MAJOR_SCOPE_CHANGE: 'MAJOR_SCOPE_CHANGE',
  REVIEWER_CORRECTION: 'REVIEWER_CORRECTION',
  NEW_VACANCY: 'NEW_VACANCY',
  FORBIDDEN: 'FORBIDDEN',
});

export const APPLICATION_DESTINATION_ERROR_CODES = Object.freeze({
  MODE_INVALID: 'DESTINATION_MODE_INVALID',
  OWNERSHIP_UNVERIFIED: 'DESTINATION_OWNERSHIP_UNVERIFIED',
  EVIDENCE_CONFLICT: 'DESTINATION_EVIDENCE_CONFLICT',
  CHANGED_BEYOND_CORRECTION_SCOPE:
    'DESTINATION_CHANGED_BEYOND_CORRECTION_SCOPE',
});

export const APPLICATION_DESTINATION_BOUNDS = Object.freeze({
  normalizedUrl: 2048,
  normalizedEmail: 254,
  hostname: 253,
  domainLabel: 63,
  emailLocalPart: 64,
  policyVersion: 64,
  objectFields: 16,
});

const DESTINATION_INPUT_FIELDS = Object.freeze(['mode', 'target']);
const SERVER_CONTEXT_FIELDS = Object.freeze([
  'jobId',
  'evaluatedAt',
  'validationPolicyVersion',
]);
const EVIDENCE_VALIDATION_CONTEXT_FIELDS = Object.freeze(['jobId']);
const COMPARISON_VALIDATION_CONTEXT_FIELDS = Object.freeze([
  'previousValidationContext',
  'nextValidationContext',
]);
const EVIDENCE_FIELDS = Object.freeze([
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
const FORBIDDEN_KEY_PATTERN = /^(?:__proto__|prototype|constructor)$/;
const ENCODED_CONTROL_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/iu;
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const POLICY_VERSION_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/u;
const EMAIL_LOCAL_PART_PATTERN = /^[^\s@<>,;:"()[\]\\]+$/u;
const CANONICAL_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const RESERVED_HOSTS = Object.freeze([
  'example.com',
  'example.net',
  'example.org',
  'localhost',
]);
const RESERVED_HOST_SUFFIXES = Object.freeze([
  '.example',
  '.invalid',
  '.internal',
  '.local',
  '.localhost',
  '.onion',
  '.test',
  '.home.arpa',
]);
const OPAQUE_REDIRECT_HOSTS = Object.freeze([
  'bit.ly',
  'buff.ly',
  'cutt.ly',
  'goo.gl',
  'is.gd',
  'lnkd.in',
  'ow.ly',
  'shorturl.at',
  't.co',
  'tiny.one',
  'tinyurl.com',
]);

const MODE_POLICY = Object.freeze({
  [APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM]: Object.freeze({
    trustClassification:
      APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.INTERNAL_PLATFORM,
    evidenceSource:
      APPLICATION_DESTINATION_EVIDENCE_SOURCES.SERVER_DERIVED_INTERNAL_ROUTE,
  }),
  [APPLICATION_DESTINATION_MODES.EXTERNAL_URL]: Object.freeze({
    trustClassification:
      APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.ADMIN_REVIEW_REQUIRED,
    evidenceSource:
      APPLICATION_DESTINATION_EVIDENCE_SOURCES.EMPLOYER_DECLARED_EXTERNAL_TARGET,
  }),
  [APPLICATION_DESTINATION_MODES.EXTERNAL_EMAIL]: Object.freeze({
    trustClassification:
      APPLICATION_DESTINATION_TRUST_CLASSIFICATIONS.ADMIN_REVIEW_REQUIRED,
    evidenceSource:
      APPLICATION_DESTINATION_EVIDENCE_SOURCES.EMPLOYER_DECLARED_EXTERNAL_TARGET,
  }),
});

const SAFE_MESSAGES = Object.freeze({
  [APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID]:
    'Application destination is invalid',
  [APPLICATION_DESTINATION_ERROR_CODES.OWNERSHIP_UNVERIFIED]:
    'Application destination requires review',
  [APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT]:
    'Application destination evidence is invalid',
  [APPLICATION_DESTINATION_ERROR_CODES.CHANGED_BEYOND_CORRECTION_SCOPE]:
    'Application destination changed beyond correction scope',
});
const APPROVED_ERROR_CODES = Object.freeze(
  Object.values(APPLICATION_DESTINATION_ERROR_CODES)
);

export class ApplicationDestinationContractError extends Error {
  constructor(code) {
    const canonicalCode = APPROVED_ERROR_CODES.includes(code)
      ? code
      : APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID;
    super(SAFE_MESSAGES[canonicalCode]);
    this.name = 'ApplicationDestinationContractError';
    this.code = canonicalCode;
    this.status =
      canonicalCode === APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
        ? 409
        : 422;
    Object.freeze(this);
  }

  toJSON() {
    return Object.freeze({
      status: this.status,
      code: this.code,
      message: this.message,
    });
  }
}

function destinationError(
  code = APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
) {
  return new ApplicationDestinationContractError(code);
}

function assertStrictRecord(value, allowedFields, errorCode) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw destinationError(errorCode);
  }

  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length > APPLICATION_DESTINATION_BOUNDS.objectFields ||
    ownKeys.some((key) => typeof key !== 'string')
  ) {
    throw destinationError(errorCode);
  }

  const enumerableKeys = Object.keys(value);
  if (ownKeys.length !== enumerableKeys.length) {
    throw destinationError(errorCode);
  }

  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      descriptor.get ||
      descriptor.set ||
      descriptor.enumerable !== true ||
      !Object.hasOwn(descriptor, 'value') ||
      FORBIDDEN_KEY_PATTERN.test(key) ||
      key.includes('.') ||
      key.startsWith('$') ||
      !allowedFields.includes(key)
    ) {
      throw destinationError(errorCode);
    }
  }

  return enumerableKeys;
}

function assertExactFields(value, exactFields, errorCode) {
  const keys = assertStrictRecord(value, exactFields, errorCode);
  if (
    keys.length !== exactFields.length ||
    exactFields.some((field) => !Object.hasOwn(value, field))
  ) {
    throw destinationError(errorCode);
  }
}

function assertValidDate(value, errorCode) {
  if (
    !(value instanceof Date) ||
    Object.getPrototypeOf(value) !== Date.prototype ||
    !Number.isFinite(Date.prototype.getTime.call(value))
  ) {
    throw destinationError(errorCode);
  }
}

function dateToCanonicalTimestamp(value, errorCode) {
  assertValidDate(value, errorCode);
  const timestamp = Date.prototype.toISOString.call(value);
  if (timestamp.length !== 24 || !CANONICAL_TIMESTAMP_PATTERN.test(timestamp)) {
    throw destinationError(errorCode);
  }
  return timestamp;
}

function assertCanonicalTimestamp(value, errorCode) {
  if (
    typeof value !== 'string' ||
    value.length !== 24 ||
    !CANONICAL_TIMESTAMP_PATTERN.test(value)
  ) {
    throw destinationError(errorCode);
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw destinationError(errorCode);
  }
}

function assertValidPolicyVersion(value, errorCode) {
  if (
    typeof value !== 'string' ||
    value.length > APPLICATION_DESTINATION_BOUNDS.policyVersion ||
    !POLICY_VERSION_PATTERN.test(value) ||
    value !== APPLICATION_DESTINATION_VALIDATION_POLICY_VERSION
  ) {
    throw destinationError(errorCode);
  }
}

function normalizeJobId(
  value,
  errorCode = APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
) {
  if (typeof value !== 'string') {
    throw destinationError(errorCode);
  }
  const normalized = value.toLowerCase();
  if (!OBJECT_ID_PATTERN.test(normalized)) {
    throw destinationError(errorCode);
  }
  return normalized;
}

function assertServerContext(serverContext) {
  assertExactFields(
    serverContext,
    SERVER_CONTEXT_FIELDS,
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
  );
  const jobId = normalizeJobId(
    serverContext.jobId,
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
  );
  const evaluatedAt = dateToCanonicalTimestamp(
    serverContext.evaluatedAt,
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
  );
  assertValidPolicyVersion(
    serverContext.validationPolicyVersion,
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
  );
  return Object.freeze({
    jobId,
    evaluatedAt,
    validationPolicyVersion: serverContext.validationPolicyVersion,
  });
}

function assertEvidenceValidationContext(validationContext, { required }) {
  if (validationContext === undefined && !required) {
    return null;
  }
  assertExactFields(
    validationContext,
    EVIDENCE_VALIDATION_CONTEXT_FIELDS,
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
  );
  return Object.freeze({
    jobId: normalizeJobId(
      validationContext.jobId,
      APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
    ),
  });
}

function resolveComparisonValidationContexts(validationContexts) {
  if (validationContexts === undefined) {
    return Object.freeze({
      previousValidationContext: undefined,
      nextValidationContext: undefined,
    });
  }
  assertStrictRecord(
    validationContexts,
    COMPARISON_VALIDATION_CONTEXT_FIELDS,
    APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT
  );
  return Object.freeze({
    previousValidationContext: Object.hasOwn(
      validationContexts,
      'previousValidationContext'
    )
      ? validationContexts.previousValidationContext
      : undefined,
    nextValidationContext: Object.hasOwn(
      validationContexts,
      'nextValidationContext'
    )
      ? validationContexts.nextValidationContext
      : undefined,
  });
}

function canonicalizeInternalTarget(
  jobId,
  errorCode = APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
) {
  return `job:${normalizeJobId(jobId, errorCode)}`;
}

function hasForbiddenCharacters(value) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
  });
}

function isReservedHost(hostname) {
  return (
    RESERVED_HOSTS.includes(hostname) ||
    RESERVED_HOST_SUFFIXES.some(
      (suffix) => hostname.endsWith(suffix) || hostname === suffix.slice(1)
    )
  );
}

function isOpaqueRedirectHost(hostname) {
  return OPAQUE_REDIRECT_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
}

function assertDomainShape(hostname) {
  if (
    typeof hostname !== 'string' ||
    hostname.length === 0 ||
    hostname.length > APPLICATION_DESTINATION_BOUNDS.hostname ||
    hostname.endsWith('.') ||
    !hostname.includes('.') ||
    isReservedHost(hostname) ||
    isOpaqueRedirectHost(hostname)
  ) {
    throw destinationError();
  }

  if (
    /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) ||
    hostname.includes(':') ||
    (hostname.startsWith('[') && hostname.endsWith(']'))
  ) {
    throw destinationError();
  }

  const labels = hostname.split('.');
  if (
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > APPLICATION_DESTINATION_BOUNDS.domainLabel ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label)
    )
  ) {
    throw destinationError();
  }
}

function normalizeExternalUrl(rawTarget) {
  if (
    typeof rawTarget !== 'string' ||
    rawTarget.length === 0 ||
    rawTarget.length > APPLICATION_DESTINATION_BOUNDS.normalizedUrl ||
    rawTarget !== rawTarget.trim() ||
    /\s/u.test(rawTarget) ||
    hasForbiddenCharacters(rawTarget) ||
    ENCODED_CONTROL_PATTERN.test(rawTarget) ||
    rawTarget.includes('#') ||
    rawTarget.includes('?')
  ) {
    throw destinationError();
  }

  let parsed;
  try {
    parsed = new URL(rawTarget);
  } catch {
    throw destinationError();
  }

  if (
    parsed.protocol !== 'https:' ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    parsed.search ||
    (parsed.port && parsed.port !== '443')
  ) {
    throw destinationError();
  }

  const normalizedDomain = parsed.hostname.toLowerCase();
  assertDomainShape(normalizedDomain);

  const normalizedTarget = parsed.href;
  if (normalizedTarget.length > APPLICATION_DESTINATION_BOUNDS.normalizedUrl) {
    throw destinationError();
  }

  return Object.freeze({
    normalizedTarget,
    normalizedDomain,
  });
}

function normalizeExternalEmail(rawTarget) {
  if (typeof rawTarget !== 'string') {
    throw destinationError();
  }

  const normalizedInput = rawTarget.trim().normalize('NFC');
  if (
    normalizedInput.length === 0 ||
    normalizedInput.length > APPLICATION_DESTINATION_BOUNDS.normalizedEmail ||
    hasForbiddenCharacters(normalizedInput) ||
    /\s/u.test(normalizedInput) ||
    /[<>,;]/u.test(normalizedInput)
  ) {
    throw destinationError();
  }

  const atIndex = normalizedInput.lastIndexOf('@');
  if (
    atIndex <= 0 ||
    atIndex !== normalizedInput.indexOf('@') ||
    atIndex === normalizedInput.length - 1
  ) {
    throw destinationError();
  }

  const localPart = normalizedInput.slice(0, atIndex);
  const rawDomain = normalizedInput.slice(atIndex + 1);
  if (
    localPart.length > APPLICATION_DESTINATION_BOUNDS.emailLocalPart ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    !EMAIL_LOCAL_PART_PATTERN.test(localPart) ||
    rawDomain.endsWith('.')
  ) {
    throw destinationError();
  }

  const normalizedDomain = domainToASCII(rawDomain.toLowerCase());
  if (!normalizedDomain) {
    throw destinationError();
  }
  assertDomainShape(normalizedDomain);

  const normalizedTarget = `${localPart}@${normalizedDomain}`;
  if (
    normalizedTarget.length > APPLICATION_DESTINATION_BOUNDS.normalizedEmail
  ) {
    throw destinationError();
  }

  return Object.freeze({
    normalizedTarget,
    normalizedDomain,
  });
}

function digestDestination(mode, canonicalTargetIdentity) {
  const descriptor = [
    'application_destination',
    `schema:${APPLICATION_DESTINATION_SCHEMA_VERSION}`,
    `mode:${mode}`,
    `target:${canonicalTargetIdentity}`,
  ].join('\u0000');
  return createHash('sha256').update(descriptor, 'utf8').digest('hex');
}

function freezeEvidence(evidence) {
  return Object.freeze(evidence);
}

/**
 * Build strict, immutable application-destination evidence from a client
 * declaration and already-authorized server-owned Job context.
 */
export function buildApplicationDestinationEvidence(
  destinationInput,
  serverContext
) {
  const keys = assertStrictRecord(
    destinationInput,
    DESTINATION_INPUT_FIELDS,
    APPLICATION_DESTINATION_ERROR_CODES.MODE_INVALID
  );
  const context = assertServerContext(serverContext);
  const mode = destinationInput.mode;

  if (!Object.hasOwn(MODE_POLICY, mode)) {
    throw destinationError();
  }

  let normalizedTarget = null;
  let normalizedDomain = null;
  let canonicalTargetIdentity;

  if (mode === APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM) {
    if (keys.length !== 1 || !Object.hasOwn(destinationInput, 'mode')) {
      throw destinationError();
    }
    canonicalTargetIdentity = canonicalizeInternalTarget(context.jobId);
  } else {
    if (
      keys.length !== 2 ||
      !Object.hasOwn(destinationInput, 'mode') ||
      !Object.hasOwn(destinationInput, 'target')
    ) {
      throw destinationError();
    }

    const normalized =
      mode === APPLICATION_DESTINATION_MODES.EXTERNAL_URL
        ? normalizeExternalUrl(destinationInput.target)
        : normalizeExternalEmail(destinationInput.target);
    normalizedTarget = normalized.normalizedTarget;
    normalizedDomain = normalized.normalizedDomain;
    canonicalTargetIdentity = normalizedTarget;
  }

  const modePolicy = MODE_POLICY[mode];
  return freezeEvidence({
    schemaVersion: APPLICATION_DESTINATION_SCHEMA_VERSION,
    mode,
    normalizedTarget,
    targetDigest: digestDestination(mode, canonicalTargetIdentity),
    normalizedDomain,
    trustClassification: modePolicy.trustClassification,
    evidenceSource: modePolicy.evidenceSource,
    evaluatedAt: context.evaluatedAt,
    validationPolicyVersion: context.validationPolicyVersion,
    classifiedByActorType: APPLICATION_DESTINATION_ACTOR_TYPES.SYSTEM,
    classifiedByActorId: null,
  });
}

/**
 * Validate the strict immutable submission-evidence shape. Staff approval and
 * rejection are separate future moderation events and are intentionally not
 * accepted as mutations of this evidence.
 */
export function validateApplicationDestinationEvidence(
  evidence,
  validationContext
) {
  const errorCode = APPLICATION_DESTINATION_ERROR_CODES.EVIDENCE_CONFLICT;
  assertExactFields(evidence, EVIDENCE_FIELDS, errorCode);

  if (
    evidence.schemaVersion !== APPLICATION_DESTINATION_SCHEMA_VERSION ||
    !Object.hasOwn(MODE_POLICY, evidence.mode) ||
    !DIGEST_PATTERN.test(evidence.targetDigest) ||
    evidence.classifiedByActorType !==
      APPLICATION_DESTINATION_ACTOR_TYPES.SYSTEM ||
    evidence.classifiedByActorId !== null
  ) {
    throw destinationError(errorCode);
  }

  assertCanonicalTimestamp(evidence.evaluatedAt, errorCode);
  assertValidPolicyVersion(evidence.validationPolicyVersion, errorCode);

  const modePolicy = MODE_POLICY[evidence.mode];
  if (
    evidence.trustClassification !== modePolicy.trustClassification ||
    evidence.evidenceSource !== modePolicy.evidenceSource
  ) {
    throw destinationError(errorCode);
  }

  if (evidence.mode === APPLICATION_DESTINATION_MODES.INTERNAL_PLATFORM) {
    if (
      evidence.normalizedTarget !== null ||
      evidence.normalizedDomain !== null
    ) {
      throw destinationError(errorCode);
    }
    const context = assertEvidenceValidationContext(validationContext, {
      required: true,
    });
    if (
      digestDestination(
        evidence.mode,
        canonicalizeInternalTarget(context.jobId, errorCode)
      ) !== evidence.targetDigest
    ) {
      throw destinationError(errorCode);
    }
  } else {
    if (validationContext !== undefined) {
      assertEvidenceValidationContext(validationContext, { required: false });
    }
    if (
      typeof evidence.normalizedTarget !== 'string' ||
      typeof evidence.normalizedDomain !== 'string'
    ) {
      throw destinationError(errorCode);
    }

    const normalized =
      evidence.mode === APPLICATION_DESTINATION_MODES.EXTERNAL_URL
        ? normalizeExternalUrl(evidence.normalizedTarget)
        : normalizeExternalEmail(evidence.normalizedTarget);
    if (
      normalized.normalizedTarget !== evidence.normalizedTarget ||
      normalized.normalizedDomain !== evidence.normalizedDomain ||
      digestDestination(evidence.mode, normalized.normalizedTarget) !==
        evidence.targetDigest
    ) {
      throw destinationError(errorCode);
    }
  }

  return true;
}

/**
 * Compare immutable destination identity only. This function never grants a
 * correction exemption or computes quota usage.
 */
export function classifyApplicationDestinationChange(
  previousEvidence,
  nextEvidence,
  validationContexts
) {
  const contexts = resolveComparisonValidationContexts(validationContexts);
  validateApplicationDestinationEvidence(
    previousEvidence,
    contexts.previousValidationContext
  );
  validateApplicationDestinationEvidence(
    nextEvidence,
    contexts.nextValidationContext
  );

  const unchanged =
    previousEvidence.mode === nextEvidence.mode &&
    previousEvidence.targetDigest === nextEvidence.targetDigest;

  return Object.freeze({
    classification: unchanged
      ? APPLICATION_DESTINATION_CHANGE_CLASSIFICATIONS.NO_SCOPE_CHANGE
      : APPLICATION_DESTINATION_CHANGE_CLASSIFICATIONS.MAJOR_SCOPE_CHANGE,
    requiresRenewedValidation: !unchanged,
    priorApprovalTransferAllowed: unchanged,
  });
}
