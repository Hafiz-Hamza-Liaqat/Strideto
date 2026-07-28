import {
  FREE_BETA_POLICY_VERSION,
  JOB_PUBLICATION_STATE,
  PUBLISHING_POLICY_CODES,
  PUBLICATION_SUBMISSION_KINDS,
} from '../../config/freeBetaPublishingPolicy.js';
import { resolveEmployerPublishingQuotaOwner } from './QuotaOwnerResolver.js';
import {
  buildEmployerVerificationSnapshot,
  evaluateEmployerSubmissionEligibility,
} from './EmployerSubmissionEligibility.js';
import {
  CORRECTION_CONTENT_FIELDS,
  evaluateReviewerCorrectionExemption,
} from './ReviewerCorrectionEligibility.js';

const DISPLAY_TIMEZONE = 'Asia/Karachi';
const ALLOWED_COMMAND_FIELDS = new Set([
  'authenticatedEmployerId',
  'jobId',
  'submissionKind',
  'expectedPublicationVersion',
  'idempotencyKey',
  'postingRules',
  'correctionOfSubmissionId',
]);
const ALLOWED_POSTING_RULES_FIELDS = new Set(['accepted', 'version']);
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;
const HEX_DIGEST = /^[a-f0-9]{64}$/i;
// Fatal blockers mean the command cannot safely be accepted as a correction
// of the same owned vacancy. Every other known exemption blocker below is a
// valid correction that falls back to ordinary charged quota treatment.
const FATAL_CORRECTION_BLOCKERS = new Set([
  'NO_PREVIOUS_REJECTION',
  'NOT_IMMEDIATE_PREDECESSOR',
  'DIFFERENT_JOB',
  'INVALID_CONTENT_SNAPSHOT',
]);
const CHARGEABLE_CORRECTION_BLOCKERS = new Set([
  'MODERATION_CYCLE_MISSING',
  'MODERATION_CYCLE_MISMATCH',
  'CORRECTION_WINDOW_EXPIRED',
  'EXEMPT_CORRECTION_ALREADY_USED',
  'NO_REQUESTED_CORRECTION_FIELDS',
  'UNREQUESTED_FIELD_CHANGED',
  'CORE_VACANCY_CHANGED',
  'NO_REQUESTED_FIELD_CHANGED',
]);

export const TRANSACTIONAL_JOB_REPOSITORY_CONTRACT = Object.freeze({
  getOwnedJobForSubmission:
    'Returns an owned canonical job, or { found, owned, job } without exposing another employer.',
  compareAndSetPendingReview:
    'Atomically verifies owner, source state, publication version, and no pending submission before setting pending_review.',
});

export class PublishingSubmissionDomainError extends Error {
  constructor({ status, code, safeMessage, details }) {
    super(safeMessage);
    this.name = 'PublishingSubmissionDomainError';
    this.status = status;
    this.code = code;
    this.safeMessage = safeMessage;
    this.details = details ? Object.freeze({ ...details }) : undefined;
  }
}

function domainError(status, code, safeMessage, details) {
  return new PublishingSubmissionDomainError({
    status,
    code,
    safeMessage,
    details,
  });
}

function requireMethod(target, method, dependencyName) {
  if (!target || typeof target[method] !== 'function') {
    throw new TypeError(
      `${dependencyName}.${method} is required for the dormant submission service`
    );
  }
}

function canonicalIdentifier(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function sameIdentifier(left, right) {
  const leftId = canonicalIdentifier(left);
  return leftId.length > 0 && leftId === canonicalIdentifier(right);
}

function validateCommand(command) {
  if (
    !command ||
    typeof command !== 'object' ||
    Array.isArray(command) ||
    Object.keys(command).some((key) => !ALLOWED_COMMAND_FIELDS.has(key))
  ) {
    throw domainError(
      400,
      'INVALID_SUBMISSION_COMMAND',
      'The submission command is invalid.'
    );
  }

  if (
    !canonicalIdentifier(command.authenticatedEmployerId) ||
    !canonicalIdentifier(command.jobId) ||
    !PUBLICATION_SUBMISSION_KINDS.includes(command.submissionKind) ||
    !Number.isInteger(command.expectedPublicationVersion) ||
    command.expectedPublicationVersion < 0
  ) {
    throw domainError(
      400,
      'INVALID_SUBMISSION_COMMAND',
      'The submission command is invalid.'
    );
  }

  const postingRules = command.postingRules;
  if (
    !postingRules ||
    typeof postingRules !== 'object' ||
    Array.isArray(postingRules) ||
    Object.keys(postingRules).some(
      (key) => !ALLOWED_POSTING_RULES_FIELDS.has(key)
    ) ||
    typeof postingRules.version !== 'string' ||
    postingRules.version.trim().length === 0
  ) {
    throw domainError(
      400,
      'INVALID_SUBMISSION_COMMAND',
      'The posting-rules acknowledgement is invalid.'
    );
  }

  if (postingRules.accepted !== true) {
    throw domainError(
      422,
      'POSTING_RULES_NOT_ACCEPTED',
      'The current Employer Posting Rules must be accepted.'
    );
  }

  if (
    command.submissionKind === 'correction' &&
    !canonicalIdentifier(command.correctionOfSubmissionId)
  ) {
    throw domainError(
      400,
      'INVALID_SUBMISSION_COMMAND',
      'A correction must identify its preceding submission.'
    );
  }

  if (
    command.submissionKind !== 'correction' &&
    command.correctionOfSubmissionId !== undefined &&
    command.correctionOfSubmissionId !== null
  ) {
    throw domainError(
      400,
      'INVALID_SUBMISSION_COMMAND',
      'Only correction submissions may identify a preceding submission.'
    );
  }

  const idempotencyKey =
    typeof command.idempotencyKey === 'string'
      ? command.idempotencyKey.trim()
      : '';
  if (
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 128 ||
    !PRINTABLE_ASCII.test(idempotencyKey)
  ) {
    throw domainError(
      400,
      'INVALID_IDEMPOTENCY_KEY',
      'The idempotency key must be 16 to 128 printable ASCII characters.'
    );
  }

  return Object.freeze({
    ...command,
    idempotencyKey,
    postingRules: Object.freeze({
      accepted: true,
      version: postingRules.version.trim(),
    }),
  });
}

function normalizeOwnedJobResult(result) {
  if (!result) {
    throw domainError(404, 'JOB_NOT_FOUND', 'The requested job was not found.');
  }
  if (result.found === false) {
    throw domainError(404, 'JOB_NOT_FOUND', 'The requested job was not found.');
  }
  if (result.owned === false) {
    throw domainError(403, 'JOB_NOT_OWNED', 'The requested job is not owned.');
  }
  return result.job || result;
}

function assertJobState(job, command) {
  const state = job?.publicationState;
  if (state === JOB_PUBLICATION_STATE.PENDING_REVIEW) {
    throw domainError(
      409,
      'SUBMISSION_ALREADY_PENDING',
      'This job already has a submission pending review.'
    );
  }

  if (
    !Number.isInteger(job?.publicationVersion) ||
    job.publicationVersion !== command.expectedPublicationVersion
  ) {
    throw domainError(
      409,
      'JOB_VERSION_CONFLICT',
      'The job changed before this submission was accepted.'
    );
  }

  const validKindsByState = {
    [JOB_PUBLICATION_STATE.DRAFT]: ['initial'],
    [JOB_PUBLICATION_STATE.REJECTED]: ['correction'],
    [JOB_PUBLICATION_STATE.EXPIRED]: ['renewal', 'repost'],
    [JOB_PUBLICATION_STATE.CLOSED]: ['renewal', 'repost'],
    [JOB_PUBLICATION_STATE.ACTIVE]: ['major_edit'],
  };

  if (!validKindsByState[state]?.includes(command.submissionKind)) {
    throw domainError(
      409,
      'JOB_STATE_NOT_SUBMITTABLE',
      'The job cannot be submitted from its current state.'
    );
  }
}

function validateContentSnapshot(snapshot) {
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    Array.isArray(snapshot) ||
    typeof snapshot.contentHash !== 'string' ||
    !HEX_DIGEST.test(snapshot.contentHash) ||
    Object.keys(snapshot).some(
      (key) => key !== 'contentHash' && !CORRECTION_CONTENT_FIELDS.includes(key)
    )
  ) {
    throw domainError(
      422,
      'INVALID_SUBMISSION_COMMAND',
      'The canonical job content snapshot is invalid.'
    );
  }
  return snapshot;
}

function validateFingerprint(value) {
  if (typeof value !== 'string' || !HEX_DIGEST.test(value)) {
    throw new TypeError(
      'requestFingerprintBuilder must return a 64-character hexadecimal digest'
    );
  }
  return value.toLowerCase();
}

function validateRulesRecord(value) {
  if (
    !value ||
    typeof value.version !== 'string' ||
    typeof value.digest !== 'string' ||
    !HEX_DIGEST.test(value.digest)
  ) {
    throw new TypeError(
      'postingRulesRegistry must return a versioned SHA-256 rules record'
    );
  }
  return value;
}

function quotaLimitError(usage) {
  if (usage.daily.used >= usage.daily.limit) {
    return domainError(
      429,
      'ROLLING_24H_LIMIT',
      'The rolling 24-hour Free Beta submission limit has been reached.',
      {
        nextEligibleAt: usage.daily.nextEligibleAt,
        displayTimezone: DISPLAY_TIMEZONE,
      }
    );
  }
  if (usage.rolling30Days.used >= usage.rolling30Days.limit) {
    return domainError(
      429,
      'ROLLING_30D_LIMIT',
      'The rolling 30-day Free Beta submission limit has been reached.',
      {
        nextEligibleAt: usage.rolling30Days.nextSlotAt,
        displayTimezone: DISPLAY_TIMEZONE,
      }
    );
  }
  return null;
}

function usageProjection(usage, { chargedDelta = 0, activeDelta = 0 } = {}) {
  const dailyUsed = usage.daily.used + chargedDelta;
  const monthlyUsed = usage.rolling30Days.used + chargedDelta;
  const activeUsed = usage.activeFreeJobs.used + activeDelta;
  const dailyLimit = usage.daily.limit;
  const monthlyLimit = usage.rolling30Days.limit;
  const activeLimit = usage.activeFreeJobs.limit;

  return Object.freeze({
    daily: Object.freeze({
      used: dailyUsed,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - dailyUsed),
      nextEligibleAt: usage.daily.nextEligibleAt ?? null,
    }),
    rolling30Days: Object.freeze({
      used: monthlyUsed,
      limit: monthlyLimit,
      remaining: Math.max(0, monthlyLimit - monthlyUsed),
      nextSlotAt: usage.rolling30Days.nextSlotAt ?? null,
    }),
    activeFreeJobs: Object.freeze({
      planCode: PUBLISHING_POLICY_CODES.FREE_BETA,
      used: activeUsed,
      limit: activeLimit,
      remaining: Math.max(0, activeLimit - activeUsed),
      hasCapacity: activeUsed < activeLimit,
    }),
  });
}

function stableSubmissionResult(submission, { idempotentReplay }) {
  return Object.freeze({
    idempotentReplay,
    submission: Object.freeze({
      id: submission._id || submission.id,
      jobId: submission.jobId,
      state: submission.state,
      submissionKind: submission.submissionKind,
      planCode: submission.planCode,
      policyVersion: submission.policyVersion,
      acceptedAt: submission.acceptedAt,
      quotaCharged: submission.quotaCharged,
      quotaExemptionReason: submission.quotaExemptionReason ?? null,
      moderationCycleId: submission.moderationCycleId,
    }),
    publicationState: JOB_PUBLICATION_STATE.PENDING_REVIEW,
    usage: submission.quotaSnapshot?.after,
  });
}

function mappedCasError(result) {
  const code = result?.code;
  const supported = new Set([
    'JOB_NOT_OWNED',
    'JOB_VERSION_CONFLICT',
    'JOB_STATE_NOT_SUBMITTABLE',
    'SUBMISSION_ALREADY_PENDING',
  ]);
  const selected = supported.has(code) ? code : 'JOB_VERSION_CONFLICT';
  const statuses = {
    JOB_NOT_OWNED: 403,
    JOB_VERSION_CONFLICT: 409,
    JOB_STATE_NOT_SUBMITTABLE: 409,
    SUBMISSION_ALREADY_PENDING: 409,
  };
  return domainError(
    statuses[selected],
    selected,
    'The job changed before the submission transaction committed.'
  );
}

/**
 * All collaborators are provider-neutral and must preserve the supplied
 * transaction session. No production Job adapter is provided by this module.
 */
export function createTransactionalFreeBetaSubmissionService({
  transactionRunner,
  employerRepository,
  jobRepository,
  submissionRepository,
  acknowledgementRepository,
  moderationEventRepository,
  quotaUsageService,
  serializedQuotaGuard,
  notificationOutbox,
  postingRulesRegistry,
  contentSnapshotBuilder,
  requestFingerprintBuilder,
  idFactory,
  clock,
}) {
  if (
    !jobRepository ||
    typeof jobRepository.getOwnedJobForSubmission !== 'function' ||
    typeof jobRepository.compareAndSetPendingReview !== 'function'
  ) {
    throw domainError(
      503,
      'CANONICAL_JOB_REPOSITORY_REQUIRED',
      'A compatible canonical job repository is required.'
    );
  }

  requireMethod(transactionRunner, 'run', 'transactionRunner');
  requireMethod(employerRepository, 'getById', 'employerRepository');
  requireMethod(
    submissionRepository,
    'findByOwnerAndIdempotencyKey',
    'submissionRepository'
  );
  requireMethod(
    submissionRepository,
    'getCorrectionContext',
    'submissionRepository'
  );
  requireMethod(submissionRepository, 'create', 'submissionRepository');
  requireMethod(
    acknowledgementRepository,
    'create',
    'acknowledgementRepository'
  );
  requireMethod(
    moderationEventRepository,
    'getLatestForSubmission',
    'moderationEventRepository'
  );
  requireMethod(
    moderationEventRepository,
    'append',
    'moderationEventRepository'
  );
  requireMethod(quotaUsageService, 'getUsage', 'quotaUsageService');
  requireMethod(serializedQuotaGuard, 'acquire', 'serializedQuotaGuard');
  requireMethod(notificationOutbox, 'enqueueMany', 'notificationOutbox');
  requireMethod(postingRulesRegistry, 'getCurrent', 'postingRulesRegistry');
  requireMethod(contentSnapshotBuilder, 'build', 'contentSnapshotBuilder');
  requireMethod(
    requestFingerprintBuilder,
    'build',
    'requestFingerprintBuilder'
  );
  requireMethod(idFactory, 'next', 'idFactory');
  requireMethod(clock, 'now', 'clock');

  async function submitFreeBetaJob(command) {
    try {
      return await transactionRunner.run(async ({ session }) => {
        const validated = validateCommand(command);
        const acceptedAt = clock.now();
        if (
          !(acceptedAt instanceof Date) ||
          Number.isNaN(acceptedAt.getTime())
        ) {
          throw new TypeError('clock.now must return a valid Date');
        }

        const employer = await employerRepository.getById({
          employerId: validated.authenticatedEmployerId,
          session,
        });
        const eligibility = evaluateEmployerSubmissionEligibility(employer);
        if (!eligibility.eligible) {
          const first = eligibility.blockers[0];
          const status = first.code === 'EMPLOYER_NOT_FOUND' ? 404 : 403;
          throw domainError(status, first.code, first.message, {
            blockerCodes: eligibility.blockers.map(({ code }) => code),
          });
        }

        const ownedResult = await jobRepository.getOwnedJobForSubmission({
          employerId: validated.authenticatedEmployerId,
          jobId: validated.jobId,
          session,
        });
        const job = normalizeOwnedJobResult(ownedResult);
        if (
          !sameIdentifier(job.employerId, validated.authenticatedEmployerId)
        ) {
          throw domainError(
            403,
            'JOB_NOT_OWNED',
            'The requested job is not owned.'
          );
        }

        const quotaOwner = resolveEmployerPublishingQuotaOwner(employer);
        await serializedQuotaGuard.acquire(quotaOwner, { session });

        const contentSnapshot = validateContentSnapshot(
          await contentSnapshotBuilder.build({
            job,
            submissionKind: validated.submissionKind,
            session,
          })
        );
        const requestFingerprint = validateFingerprint(
          await requestFingerprintBuilder.build({
            jobId: validated.jobId,
            expectedPublicationVersion: validated.expectedPublicationVersion,
            submissionKind: validated.submissionKind,
            correctionOfSubmissionId:
              validated.correctionOfSubmissionId ?? null,
            policyVersion: FREE_BETA_POLICY_VERSION,
            rulesVersion: validated.postingRules.version,
            contentHash: contentSnapshot.contentHash,
          })
        );

        const existing =
          await submissionRepository.findByOwnerAndIdempotencyKey({
            quotaOwnerType: quotaOwner.ownerType,
            quotaOwnerId: quotaOwner.ownerId,
            idempotencyKey: validated.idempotencyKey,
            session,
          });
        if (existing) {
          if (existing.requestFingerprint !== requestFingerprint) {
            throw domainError(
              409,
              'IDEMPOTENCY_KEY_REUSED',
              'The idempotency key was already used for another submission.'
            );
          }
          return stableSubmissionResult(existing, { idempotentReplay: true });
        }

        assertJobState(job, validated);

        const currentRules = validateRulesRecord(
          await postingRulesRegistry.getCurrent({ session })
        );
        if (validated.postingRules.version !== currentRules.version) {
          throw domainError(
            409,
            'POSTING_RULES_VERSION_CHANGED',
            'The Employer Posting Rules changed before submission.',
            { currentVersion: currentRules.version }
          );
        }

        let correctionResult = null;
        let quotaCharged = true;
        let quotaExemptionReason = null;
        let moderationCycleId;

        if (validated.submissionKind === 'correction') {
          const correctionContext =
            await submissionRepository.getCorrectionContext({
              correctionOfSubmissionId: validated.correctionOfSubmissionId,
              jobId: validated.jobId,
              session,
            });
          const latestModerationEvent =
            await moderationEventRepository.getLatestForSubmission({
              submissionId: validated.correctionOfSubmissionId,
              session,
            });

          correctionResult = evaluateReviewerCorrectionExemption({
            previousSubmission: correctionContext?.previousSubmission,
            latestModerationEvent,
            correctionOfSubmissionId: validated.correctionOfSubmissionId,
            currentJobId: validated.jobId,
            currentContentSnapshot: contentSnapshot,
            previousContentSnapshot:
              correctionContext?.previousSubmission?.contentSnapshot,
            existingCycleSubmissions:
              correctionContext?.existingCycleSubmissions || [],
            now: acceptedAt,
          });

          if (
            correctionResult.blockerCodes.some((code) =>
              FATAL_CORRECTION_BLOCKERS.has(code)
            )
          ) {
            throw domainError(
              409,
              'CORRECTION_NOT_EXEMPT',
              'The correction does not match the required rejected submission.',
              { blockerCodes: correctionResult.blockerCodes }
            );
          }

          if (
            correctionResult.blockerCodes.some(
              (code) => !CHARGEABLE_CORRECTION_BLOCKERS.has(code)
            )
          ) {
            throw new TypeError(
              'Reviewer-correction blocker classification is incomplete'
            );
          }

          quotaCharged = correctionResult.quotaCharged;
          quotaExemptionReason = correctionResult.quotaExemptionReason;
          moderationCycleId = quotaCharged
            ? undefined
            : correctionResult.moderationCycleId;
        }

        const usage = await quotaUsageService.getUsage(quotaOwner, {
          now: acceptedAt,
          session,
        });
        if (quotaCharged) {
          const limitError = quotaLimitError(usage);
          if (limitError) {
            throw limitError;
          }
        }
        if (!moderationCycleId) {
          moderationCycleId = idFactory.next('moderationCycle');
        }

        const releaseActiveFreeSlot =
          job.publicationState === JOB_PUBLICATION_STATE.ACTIVE &&
          validated.submissionKind === 'major_edit';
        const slotsReleased = releaseActiveFreeSlot ? 1 : 0;
        const projectedActiveFreeJobs =
          usage.activeFreeJobs.used - slotsReleased;
        if (projectedActiveFreeJobs < 0) {
          throw new TypeError('Projected active Free Beta usage is invalid');
        }

        const acknowledgementId = idFactory.next('acknowledgement');
        const submissionId = idFactory.next('submission');
        const moderationEventId = idFactory.next('moderationEvent');
        const beforeUsage = usageProjection(usage);
        const afterUsage = usageProjection(usage, {
          chargedDelta: quotaCharged ? 1 : 0,
          activeDelta: -slotsReleased,
        });
        const quotaSnapshot = Object.freeze({
          policyCode: PUBLISHING_POLICY_CODES.FREE_BETA,
          policyVersion: FREE_BETA_POLICY_VERSION,
          capturedAt: acceptedAt,
          before: beforeUsage,
          after: afterUsage,
        });

        await acknowledgementRepository.create(
          {
            _id: acknowledgementId,
            employerId: validated.authenticatedEmployerId,
            jobId: validated.jobId,
            submissionId,
            policyVersion: FREE_BETA_POLICY_VERSION,
            rulesVersion: currentRules.version,
            rulesDigest: currentRules.digest.toLowerCase(),
            accepted: true,
            acceptedAt,
            createdAt: acceptedAt,
          },
          { session }
        );

        const submission = await submissionRepository.create(
          {
            _id: submissionId,
            jobId: validated.jobId,
            employerId: validated.authenticatedEmployerId,
            quotaOwnerType: quotaOwner.ownerType,
            quotaOwnerId: quotaOwner.ownerId,
            submissionKind: validated.submissionKind,
            planCode: PUBLISHING_POLICY_CODES.FREE_BETA,
            policyVersion: FREE_BETA_POLICY_VERSION,
            state: 'pending_review',
            acceptedAt,
            idempotencyKey: validated.idempotencyKey,
            requestFingerprint,
            correctionOfSubmissionId:
              validated.correctionOfSubmissionId ?? null,
            moderationCycleId,
            quotaCharged,
            quotaExemptionReason,
            jobRevision: validated.expectedPublicationVersion,
            contentSnapshot,
            rulesAcknowledgementId: acknowledgementId,
            verificationSnapshot: buildEmployerVerificationSnapshot(
              employer,
              eligibility
            ),
            quotaSnapshot,
            moderationSummary: null,
          },
          { session }
        );

        const casResult = await jobRepository.compareAndSetPendingReview({
          employerId: validated.authenticatedEmployerId,
          jobId: validated.jobId,
          expectedPublicationVersion: validated.expectedPublicationVersion,
          expectedSourceState: job.publicationState,
          submissionId,
          submissionKind: validated.submissionKind,
          contentSnapshot,
          releaseActiveFreeSlot,
          session,
        });
        if (!casResult || casResult.matched !== true) {
          throw mappedCasError(casResult);
        }

        await moderationEventRepository.append(
          {
            _id: moderationEventId,
            jobId: validated.jobId,
            submissionId,
            employerId: validated.authenticatedEmployerId,
            actorType: 'employer',
            actorId: validated.authenticatedEmployerId,
            action: 'submitted',
            fromState: job.publicationState,
            toState: JOB_PUBLICATION_STATE.PENDING_REVIEW,
            reasonCode: null,
            reasonTextInternal: null,
            reasonTextEmployer: null,
            contentHash: contentSnapshot.contentHash,
            metadata: {
              quotaCharged,
              quotaExemptionReason,
              moderationCycleId,
              submissionKind: validated.submissionKind,
              currentActiveFreeJobs: usage.activeFreeJobs.used,
              projectedActiveFreeJobs,
              slotsReleased,
              policyVersion: FREE_BETA_POLICY_VERSION,
            },
            createdAt: acceptedAt,
          },
          { session }
        );

        await notificationOutbox.enqueueMany(
          [
            {
              type: 'employer_submission_received',
              deduplicationKey: `${submissionId}:employer_submission_received`,
              aggregateId: submissionId,
              employerId: validated.authenticatedEmployerId,
              jobId: validated.jobId,
            },
            {
              type: 'admin_job_review_requested',
              deduplicationKey: `${submissionId}:admin_job_review_requested`,
              aggregateId: submissionId,
              jobId: validated.jobId,
            },
          ],
          { session }
        );

        return stableSubmissionResult(submission, {
          idempotentReplay: false,
        });
      });
    } catch (error) {
      if (error instanceof PublishingSubmissionDomainError) {
        throw error;
      }
      throw domainError(
        500,
        'TRANSACTION_FAILED',
        'The submission transaction could not be completed.'
      );
    }
  }

  return Object.freeze({
    submitFreeBetaJob,
  });
}
