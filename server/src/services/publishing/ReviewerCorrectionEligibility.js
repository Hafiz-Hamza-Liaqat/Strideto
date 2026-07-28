export const REVIEWER_CORRECTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const CORRECTION_CONTENT_FIELDS = Object.freeze([
  'title',
  'companyName',
  'description',
  'requirements',
  'responsibilities',
  'skillsRequired',
  'salaryRange',
  'salaryCurrency',
  'location',
  'province',
  'city',
  'category',
  'employmentType',
  'jobType',
  'educationRequirement',
  'experience',
  'applicationMode',
  'applicationDomain',
  'workMode',
  'deadline',
  'totalSeats',
]);

const CORE_VACANCY_FIELDS = new Set([
  'title',
  'companyName',
  'description',
  'requirements',
  'responsibilities',
  'applicationMode',
  'applicationDomain',
  'category',
  'location',
  'province',
  'city',
  'workMode',
]);

function identifier(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
}

function normalizedModerationCycleIdentifier(value) {
  if (value === undefined || value === null) {
    return null;
  }

  let raw;
  try {
    raw =
      typeof value?.toHexString === 'function'
        ? value.toHexString()
        : String(value);
  } catch {
    return null;
  }

  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  return /^[a-f0-9]{24}$/.test(normalized) ? normalized : null;
}

function sameIdentifier(left, right) {
  const leftId = identifier(left);
  const rightId = identifier(right);
  return leftId !== null && leftId === rightId;
}

function plainSnapshot(value) {
  const source =
    value && typeof value.toObject === 'function' ? value.toObject() : value;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }

  const allowed = new Set(['contentHash', ...CORRECTION_CONTENT_FIELDS]);
  if (
    typeof source.contentHash !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(source.contentHash) ||
    Object.keys(source).some((key) => !allowed.has(key))
  ) {
    return null;
  }
  return source;
}

function canonical(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value ?? null;
}

function valuesEqual(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function validDate(value) {
  const result = value instanceof Date ? value : new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
}

function pushUnique(target, code) {
  if (!target.includes(code)) {
    target.push(code);
  }
}

export function evaluateReviewerCorrectionExemption({
  previousSubmission,
  latestModerationEvent,
  correctionOfSubmissionId,
  currentJobId,
  currentContentSnapshot,
  previousContentSnapshot,
  existingCycleSubmissions = [],
  now = new Date(),
}) {
  const blockers = [];
  const moderationCycleId = previousSubmission?.moderationCycleId ?? null;
  const previousState = previousSubmission?.state;
  const moderationAction = latestModerationEvent?.action;

  if (
    !previousSubmission ||
    previousState !== 'rejected' ||
    !['rejected', 'changes_requested'].includes(moderationAction)
  ) {
    pushUnique(blockers, 'NO_PREVIOUS_REJECTION');
  }

  if (
    !sameIdentifier(correctionOfSubmissionId, previousSubmission?._id) ||
    !sameIdentifier(
      latestModerationEvent?.submissionId,
      previousSubmission?._id
    )
  ) {
    pushUnique(blockers, 'NOT_IMMEDIATE_PREDECESSOR');
  }

  if (!sameIdentifier(currentJobId, previousSubmission?.jobId)) {
    pushUnique(blockers, 'DIFFERENT_JOB');
  }

  const normalizedSubmissionCycleId =
    normalizedModerationCycleIdentifier(moderationCycleId);
  const normalizedEventCycleId = normalizedModerationCycleIdentifier(
    latestModerationEvent?.metadata?.moderationCycleId
  );
  if (!normalizedSubmissionCycleId || !normalizedEventCycleId) {
    pushUnique(blockers, 'MODERATION_CYCLE_MISSING');
  } else if (normalizedEventCycleId !== normalizedSubmissionCycleId) {
    pushUnique(blockers, 'MODERATION_CYCLE_MISMATCH');
  }

  const decisionAt = validDate(
    latestModerationEvent?.createdAt || previousSubmission?.reviewedAt
  );
  const evaluatedAt = validDate(now);
  if (
    !decisionAt ||
    !evaluatedAt ||
    evaluatedAt.getTime() > decisionAt.getTime() + REVIEWER_CORRECTION_WINDOW_MS
  ) {
    pushUnique(blockers, 'CORRECTION_WINDOW_EXPIRED');
  }

  if (
    existingCycleSubmissions.some(
      (submission) =>
        sameIdentifier(submission?.moderationCycleId, moderationCycleId) &&
        submission?.submissionKind === 'correction' &&
        submission?.quotaCharged === false
    )
  ) {
    pushUnique(blockers, 'EXEMPT_CORRECTION_ALREADY_USED');
  }

  const requestedFields = latestModerationEvent?.requestedFieldPaths;
  const validRequestedFields = Array.isArray(requestedFields)
    ? requestedFields.filter((field) =>
        CORRECTION_CONTENT_FIELDS.includes(field)
      )
    : [];
  if (
    validRequestedFields.length === 0 ||
    validRequestedFields.length !== requestedFields?.length
  ) {
    pushUnique(blockers, 'NO_REQUESTED_CORRECTION_FIELDS');
  }

  const current = plainSnapshot(currentContentSnapshot);
  const previous = plainSnapshot(previousContentSnapshot);
  const changedFields = [];

  if (!current || !previous) {
    pushUnique(blockers, 'INVALID_CONTENT_SNAPSHOT');
  } else {
    for (const field of CORRECTION_CONTENT_FIELDS) {
      if (!valuesEqual(current[field], previous[field])) {
        changedFields.push(field);
      }
    }

    if (changedFields.some((field) => !validRequestedFields.includes(field))) {
      pushUnique(blockers, 'UNREQUESTED_FIELD_CHANGED');
    }

    if (changedFields.some((field) => CORE_VACANCY_FIELDS.has(field))) {
      pushUnique(blockers, 'CORE_VACANCY_CHANGED');
    }

    if (
      validRequestedFields.length > 0 &&
      !changedFields.some((field) => validRequestedFields.includes(field))
    ) {
      pushUnique(blockers, 'NO_REQUESTED_FIELD_CHANGED');
    }
  }

  const eligibleForExemption = blockers.length === 0;
  return Object.freeze({
    eligibleForExemption,
    quotaCharged: !eligibleForExemption,
    quotaExemptionReason: eligibleForExemption
      ? 'reviewer_requested_correction'
      : null,
    moderationCycleId,
    blockerCodes: Object.freeze(blockers),
    changedFields: Object.freeze(changedFields),
  });
}
