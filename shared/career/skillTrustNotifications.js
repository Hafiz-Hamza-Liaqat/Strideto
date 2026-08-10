/**
 * Skill-trust notification contract.
 *
 * Pure mapping from an AUTHORITATIVE claim state transition to the in-app
 * notification(s) it justifies. No I/O, no models — the server bridge does the
 * writing, this decides what is truthful to say.
 *
 * The rule this module exists to defend, in COPY as well as in state:
 *
 *     CLAIMED != EVIDENCE_BACKED != VERIFIED
 *
 * An `evidence_backed` outcome is described as evidence-backed and never as
 * "verified". `assertTruthfulCopy` re-checks that at build time so a future
 * copy edit cannot quietly promote a claim in the user's inbox that the trust
 * engine never promoted in the database.
 *
 * Recipients are derived here from the transition alone — never from a request
 * body. Employers are deliberately NOT reachable from this module: a candidate
 * editing skills on their profile is private activity, and employer-facing
 * signals belong to the application workflow, not to skill review.
 */
import {
  SKILL_CLAIM_STATUSES,
  validateApplicantVisibleRequest,
} from './skillVerification.js';

const S = SKILL_CLAIM_STATUSES;

/**
 * Inbox category. Reuses the existing `UserNotification.category` vocabulary —
 * `verification` already exists for exactly this kind of trust event, so no new
 * category (and no second notification system) is introduced.
 */
export const SKILL_TRUST_NOTIFICATION_CATEGORY = 'verification';

/** Namespaced notification types. Never rename stored values. */
export const SKILL_TRUST_NOTIFICATION_TYPES = Object.freeze({
  EVIDENCE_SUBMITTED: 'skill_trust.evidence_submitted',
  REVIEW_REQUESTED: 'skill_trust.review_requested',
  EVIDENCE_BACKED: 'skill_trust.evidence_backed',
  VERIFIED: 'skill_trust.verified',
  NEEDS_INFORMATION: 'skill_trust.needs_information',
  REJECTED: 'skill_trust.rejected',
  EXPIRED: 'skill_trust.expired',
  REVOKED: 'skill_trust.revoked',
  // Reviewer-facing
  REVIEW_QUEUED: 'skill_trust.review_queued',
  INFORMATION_SUPPLIED: 'skill_trust.information_supplied',
});

const N = SKILL_TRUST_NOTIFICATION_TYPES;

const TYPE_SET = new Set(Object.values(N));

export function isSkillTrustNotificationType(value) {
  return typeof value === 'string' && TYPE_SET.has(value);
}

/** Recipient classes this module may ever target. Employer is absent by design. */
export const SKILL_TRUST_RECIPIENTS = Object.freeze({
  APPLICANT: 'applicant',
  STAFF: 'staff',
});

/**
 * Deep-link targets. Both are existing, mounted routes and both are same-app
 * absolute paths, so `isSafeInternalLink` on the client accepts them.
 *
 * The applicant link points at the Talent Profile editor (which mounts
 * SkillClaimManager); the staff link at the Admin Trust Center (which mounts
 * SkillVerificationReviewPanel). An applicant is never linked into the admin
 * realm, and a reviewer link is never handed to an applicant.
 */
export const SKILL_TRUST_DEEP_LINKS = Object.freeze({
  [SKILL_TRUST_RECIPIENTS.APPLICANT]: '/talent-profile',
  [SKILL_TRUST_RECIPIENTS.STAFF]: '/admin/sc/trust',
});

/**
 * Assertions that may appear ONLY when the resulting state is `verified`.
 * Checked against the rendered title+body of every non-verified notification.
 */
const VERIFIED_ONLY_PATTERNS = [/\bis verified\b/i, /\bverification approved\b/i];

/**
 * Guard: a notification for a non-VERIFIED outcome must not read as verified.
 * Throws rather than returning false — a truthful-copy violation is a defect,
 * not a runtime condition to branch on.
 */
export function assertTruthfulCopy({ trustState, title, body }) {
  if (trustState === S.VERIFIED) return true;
  const text = `${title || ''} ${body || ''}`;
  for (const pattern of VERIFIED_ONLY_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `Skill-trust notification copy claims verification for a "${trustState}" outcome: ${text.trim()}`
      );
    }
  }
  return true;
}

/**
 * Applicant-facing copy per resulting status.
 *
 * `evidence_backed` is the load-bearing one: a reviewer read the applicant's
 * self-published links and found them credible. That is NOT verification, and
 * the copy says so in the words the trust model uses.
 */
function applicantCopy(toStatus, skillName, applicantVisibleRequest = '') {
  const skill = skillName || 'your skill';
  switch (toStatus) {
    case S.EVIDENCE_SUBMITTED:
      return {
        type: N.EVIDENCE_SUBMITTED,
        title: `Evidence submitted for ${skill}`,
        body: 'Your evidence was attached to this skill claim. It has not been reviewed yet.',
      };
    case S.VERIFICATION_PENDING:
      return {
        type: N.REVIEW_REQUESTED,
        title: `${skill} sent for review`,
        body: 'Your skill claim is queued for review. We will let you know the outcome.',
      };
    case S.EVIDENCE_BACKED:
      return {
        type: N.EVIDENCE_BACKED,
        title: `Your ${skill} evidence was reviewed`,
        body: `Your ${skill} evidence was reviewed and is now evidence-backed. This is not a verification.`,
      };
    case S.VERIFIED:
      return {
        type: N.VERIFIED,
        title: `Your ${skill} verification was approved`,
        body: `A reviewer approved verification for ${skill} using an approved verification method.`,
      };
    case S.NEEDS_INFORMATION: {
      const request = validateApplicantVisibleRequest(applicantVisibleRequest);
      if (!request.ok) {
        throw new Error(`Invalid applicant-visible request (${request.reason})`);
      }
      return {
        type: N.NEEDS_INFORMATION,
        title: `More information needed for ${skill}`,
        body: `A reviewer needs this before the claim can proceed: ${request.value} Open your skills to respond.`,
      };
    }
    case S.REJECTED:
      return {
        type: N.REJECTED,
        title: `${skill} claim was not approved`,
        body: 'A reviewer did not approve this skill claim. You can attach new evidence and submit it again.',
      };
    case S.EXPIRED:
      return {
        type: N.EXPIRED,
        title: `${skill} verification expired`,
        body: `The verification for ${skill} reached the end of its validity period and is no longer current.`,
      };
    case S.REVOKED:
      return {
        type: N.REVOKED,
        title: `${skill} verification was revoked`,
        body: `The trust state for ${skill} was revoked by a reviewer and no longer appears on your profile.`,
      };
    default:
      return null;
  }
}

/**
 * Reviewer-facing copy. Operational only — it names the skill and the queue,
 * never the reviewer's private reasoning.
 */
function staffCopy(fromStatus, toStatus, skillName) {
  if (toStatus !== S.VERIFICATION_PENDING) return null;
  const skill = skillName || 'a skill';
  // A claim arriving from needs_information is a RESPONSE to a reviewer
  // request, which is operationally different from a first-time submission.
  if (fromStatus === S.NEEDS_INFORMATION) {
    return {
      type: N.INFORMATION_SUPPLIED,
      title: `Additional information supplied for ${skill}`,
      body: 'An applicant responded to a request for more information. This claim is back in the review queue.',
    };
  }
  return {
    type: N.REVIEW_QUEUED,
    title: `${skill} claim awaiting review`,
    body: 'A skill claim entered the verification review queue.',
  };
}

/**
 * Build the deduplication key for one notification.
 *
 * Keyed on the SkillVerificationHistory row, which is the canonical identity of
 * a single authoritative transition — exactly one history row exists per
 * transition, so a retried request, a duplicated API call or a re-entered event
 * handler all resolve to the same key and collapse to one notification. A later
 * legitimate transition writes a new history row and therefore a new key.
 */
export function buildNotificationDedupeKey({ historyId, recipientKind }) {
  if (!historyId || !recipientKind) return null;
  return `skill_trust:${String(historyId)}:${recipientKind}`;
}

/**
 * Metadata carried on the notification record.
 *
 * Safe references ONLY. Deliberately absent: the reviewer's `reason`, reviewer
 * identity, evidence URLs, evidence descriptions, verification method internals,
 * rubric ids and proficiency scores. A notification is an inbox row, not an
 * audit record — the audit trail lives in SkillVerificationHistory behind
 * permissioned reads.
 */
export function buildNotificationMetadata({ claimId, skillName, normalizedSkillName, trustState, historyId, occurredAt }) {
  return {
    claimId: claimId ? String(claimId) : null,
    skillName: skillName || null,
    skillId: normalizedSkillName || null,
    trustState: trustState || null,
    transitionId: historyId ? String(historyId) : null,
    occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
  };
}

/**
 * The whole contract: one authoritative transition in, the notifications it
 * justifies out.
 *
 * Returns [] for transitions that warrant no inbox row — notably claim
 * creation, which the profile UI already reflects immediately and which would
 * otherwise notify a user about their own keystroke.
 *
 * @param {object} args
 * @param {string} args.fromStatus  status BEFORE the transition
 * @param {string} args.toStatus    status AFTER the transition (authoritative)
 * @param {object} args.claim       the persisted claim (post-transition)
 * @param {string} args.historyId   id of the SkillVerificationHistory row
 * @param {Date}   [args.occurredAt]
 */
export function buildSkillTrustNotifications({
  fromStatus,
  toStatus,
  claim,
  historyId,
  applicantVisibleRequest = '',
  occurredAt = new Date(),
}) {
  if (!claim || !historyId) return [];
  // A no-op transition (claim creation records claimed -> claimed) is not news.
  if (fromStatus === toStatus) return [];

  const skillName = claim.skillName || '';
  const out = [];

  const base = {
    category: SKILL_TRUST_NOTIFICATION_CATEGORY,
    metadata: buildNotificationMetadata({
      claimId: claim._id,
      skillName,
      normalizedSkillName: claim.normalizedSkillName,
      trustState: toStatus,
      historyId,
      occurredAt,
    }),
  };

  const forApplicant = applicantCopy(toStatus, skillName, applicantVisibleRequest);
  if (forApplicant) {
    assertTruthfulCopy({ trustState: toStatus, ...forApplicant });
    out.push({
      ...base,
      recipientKind: SKILL_TRUST_RECIPIENTS.APPLICANT,
      ...forApplicant,
      link: SKILL_TRUST_DEEP_LINKS[SKILL_TRUST_RECIPIENTS.APPLICANT],
      dedupeKey: buildNotificationDedupeKey({
        historyId,
        recipientKind: SKILL_TRUST_RECIPIENTS.APPLICANT,
      }),
    });
  }

  const forStaff = staffCopy(fromStatus, toStatus, skillName);
  if (forStaff) {
    assertTruthfulCopy({ trustState: toStatus, ...forStaff });
    out.push({
      ...base,
      recipientKind: SKILL_TRUST_RECIPIENTS.STAFF,
      ...forStaff,
      link: SKILL_TRUST_DEEP_LINKS[SKILL_TRUST_RECIPIENTS.STAFF],
      dedupeKey: buildNotificationDedupeKey({
        historyId,
        recipientKind: SKILL_TRUST_RECIPIENTS.STAFF,
      }),
    });
  }

  return out;
}

/**
 * External delivery posture for this domain, stated truthfully.
 *
 * The platform has no email/SMS/push delivery wired for skill trust, and the
 * worker is not running during QA. Callers surfacing delivery status must
 * report NOT_CONFIGURED rather than implying anything was delivered.
 */
export const SKILL_TRUST_EXTERNAL_DELIVERY = Object.freeze({
  IN_APP: 'in_app',
  EXTERNAL_STATUS: 'NOT_CONFIGURED',
});
