import { useCallback, useEffect, useId, useState } from 'react';
import {
  SKILL_CLAIM_STATUSES,
  SKILL_CLAIM_LIMITS,
  VERIFICATION_METHODS,
  isEnabledVerificationMethod,
  getVerificationMethodPolicy,
  methodMayIssueVerified,
  isIssuerAnchoredEvidenceType,
} from '@shared/career/skillVerification.js';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { skillVerificationAdminApi } from '../../services/skillClaimsApi';
import { SkillTrustBadge } from './SkillTrustBadge';

/**
 * Manual skill review, mounted inside the existing Trust Center rather than as
 * a new admin system.
 *
 * What the reviewer sees is evidence *metadata* — type, platform, host, the
 * link, the applicant's own description. Nothing is fetched or previewed: the
 * link is opened by the reviewer, in their own browser, deliberately.
 *
 * Every decision here demands a method, a reason, and — for the two outcomes
 * that grant trust — the specific evidence it rests on. That is not UI
 * politeness: the server refuses the request without them, and the button is
 * disabled to match. The acting identity is never sent; the server takes it
 * from the session.
 *
 * Permissions are checked twice over, here and server-side. The client check
 * only decides what to render; it grants nothing.
 */
const OUTCOMES = [
  {
    value: SKILL_CLAIM_STATUSES.EVIDENCE_BACKED,
    label: 'Mark evidence-backed',
    permission: PERMISSIONS.SKILL_VERIFICATION_REVIEW,
    needsEvidence: true,
    hint: 'The evidence exists and is relevant. This is NOT a skill verification and NOT an assessment result.',
  },
  {
    value: SKILL_CLAIM_STATUSES.VERIFIED,
    label: 'Verify skill',
    permission: PERMISSIONS.SKILL_VERIFICATION_APPROVE,
    needsEvidence: true,
    // Offered only for methods whose policy reaches `verified` — reviewing a
    // link cannot get here, so the option is withheld rather than shown and
    // then refused by the server.
    requiresVerifiedCapableMethod: true,
    hint: 'Confirmed against something outside the applicant\'s own links. Requires the method\'s own evidence, plus a reason.',
  },
  {
    value: SKILL_CLAIM_STATUSES.NEEDS_INFORMATION,
    label: 'Request information',
    permission: PERMISSIONS.SKILL_VERIFICATION_REVIEW,
    needsEvidence: false,
    hint: 'Ask the applicant for more or better evidence.',
  },
  {
    value: SKILL_CLAIM_STATUSES.REJECTED,
    label: 'Reject',
    permission: PERMISSIONS.SKILL_VERIFICATION_REVIEW,
    needsEvidence: false,
    hint: 'The evidence does not support the claim.',
  },
  {
    value: SKILL_CLAIM_STATUSES.REVOKED,
    label: 'Revoke',
    permission: PERMISSIONS.SKILL_VERIFICATION_REVOKE,
    needsEvidence: false,
    hint: 'Withdraw trust. Terminal — the claim cannot move on from here.',
  },
];

const STATUS_FILTERS = [
  { value: '', label: 'Awaiting review' },
  { value: SKILL_CLAIM_STATUSES.EVIDENCE_SUBMITTED, label: 'Evidence submitted' },
  { value: SKILL_CLAIM_STATUSES.VERIFICATION_PENDING, label: 'Verification pending' },
  { value: SKILL_CLAIM_STATUSES.NEEDS_INFORMATION, label: 'Needs information' },
  { value: SKILL_CLAIM_STATUSES.EVIDENCE_BACKED, label: 'Evidence-backed' },
  { value: SKILL_CLAIM_STATUSES.VERIFIED, label: 'Verified' },
];

const ENABLED_METHODS = Object.values(VERIFICATION_METHODS).filter(isEnabledVerificationMethod);

const methodLabel = (m) => m.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function SkillVerificationReviewPanel() {
  const { can } = usePermissions();
  const [claims, setClaims] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const filterId = useId();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await skillVerificationAdminApi.listForReview({ status });
      setClaims(res.data?.data ?? []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load the skill review queue.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  if (!can(PERMISSIONS.SKILL_VERIFICATION_READ)) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        You do not have permission to review skill claims.
      </p>
    );
  }

  return (
    <div data-skill-surface="review" className="min-w-0">
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Evidence links are shown, never fetched or previewed. Marking a claim
        evidence-backed is not the same as verifying it, and both are recorded
        with your identity, method and reason in an append-only history.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor={filterId} className="text-xs text-gray-600 dark:text-gray-400">
          Queue
        </label>
        <select
          id={filterId}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900"
        >
          {STATUS_FILTERS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="my-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {loading ? (
        <p role="status" aria-busy="true" className="text-sm text-gray-600 dark:text-gray-400">
          Loading claims…
        </p>
      ) : claims.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:text-gray-400">
          Nothing in this queue.
        </p>
      ) : (
        <ul className="space-y-3">
          {claims.map((claim) => (
            <li
              key={claim.id}
              className="min-w-0 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium text-gray-900 dark:text-white">
                    {claim.skillName}
                  </p>
                  <p className="break-words text-xs text-gray-500 dark:text-gray-400">
                    {claim.skillCategory} · claims {claim.claimedLevel}
                    {claim.yearsOfExperience != null ? ` · ${claim.yearsOfExperience}y` : ''}
                    {' · '}applicant {claim.applicantUserId}
                  </p>
                </div>
                <SkillTrustBadge
                  trustState={claim.trustState}
                  verificationMethod={claim.verificationMethod}
                />
              </div>

              {claim.evidence?.length ? (
                <ul className="mt-2 space-y-1">
                  {claim.evidence.map((e) => (
                    <li key={e.id} className="min-w-0 text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{String(e.evidenceType).replace(/_/g, ' ')}</span>
                      {' — '}
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="break-all text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {e.hostname}
                      </a>
                      {e.description ? <span className="break-words"> · {e.description}</span> : null}
                      <span className="ml-1 text-gray-400">({e.status})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No evidence attached.</p>
              )}

              <button
                type="button"
                onClick={() => setOpenId(openId === claim.id ? null : claim.id)}
                aria-expanded={openId === claim.id}
                className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium dark:border-gray-600"
              >
                {openId === claim.id ? 'Close' : 'Record decision'}
              </button>

              {openId === claim.id && (
                <DecisionForm
                  claim={claim}
                  onDone={async () => {
                    setOpenId(null);
                    await load();
                  }}
                  onError={setError}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One claim's decision form. Kept per-claim so field state cannot leak across rows. */
function DecisionForm({ claim, onDone, onError }) {
  const { can } = usePermissions();
  const [method, setMethod] = useState(ENABLED_METHODS[0]);
  const [reason, setReason] = useState('');
  const [refs, setRefs] = useState([]);
  const [rubricId, setRubricId] = useState('');
  const [rubricVersion, setRubricVersion] = useState('');
  const [corroborationRef, setCorroborationRef] = useState('');
  const [score, setScore] = useState('');
  const [busy, setBusy] = useState(false);

  const outcomeId = useId();
  const methodId = useId();
  const reasonId = useId();
  const rubricIdField = useId();
  const rubricVersionField = useId();
  const corroborationId = useId();
  const scoreId = useId();

  const policy = getVerificationMethodPolicy(method);

  /*
   * The available outcomes depend on the METHOD, not just on permissions.
   * With manual evidence review selected, "Verify skill" is not in this list
   * at all — the reviewer cannot pick an outcome the method cannot support.
   */
  const available = OUTCOMES.filter(
    (o) => can(o.permission) && (!o.requiresVerifiedCapableMethod || methodMayIssueVerified(method))
  );
  const [preferredStatus, setPreferredStatus] = useState('');
  const toStatus = available.some((o) => o.value === preferredStatus)
    ? preferredStatus
    : available[0]?.value ?? '';

  const outcome = OUTCOMES.find((o) => o.value === toStatus);
  const needsEvidence = Boolean(outcome?.needsEvidence);
  const verifying = toStatus === SKILL_CLAIM_STATUSES.VERIFIED;
  const citedTypes = (claim.evidence ?? [])
    .filter((e) => refs.includes(e.id))
    .map((e) => e.evidenceType);

  // Every one of these mirrors a server-side refusal, so the disabled state
  // explains the rule rather than the reviewer discovering it as a 422.
  const needsIssuerAnchored = verifying && Boolean(policy?.requiresIssuerAnchoredEvidence);
  const issuerAnchoredCited = citedTypes.some(isIssuerAnchoredEvidenceType);
  const needsRubric = verifying && Boolean(policy?.requiresRubric);
  const needsCorroboration = verifying && Boolean(policy?.requiresCorroboration);

  const ready = Boolean(toStatus) && Boolean(method) && reason.trim().length > 0
    && (!needsEvidence || refs.length > 0)
    && (!needsIssuerAnchored || issuerAnchoredCited)
    && (!needsRubric || (rubricId.trim() && String(rubricVersion).trim()))
    && (!needsCorroboration || corroborationRef.trim());

  if (!available.length) {
    return (
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
        You can inspect this claim but hold no permission to decide it.
      </p>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      await skillVerificationAdminApi.recordDecision(claim.id, {
        toStatus,
        method,
        reason: reason.trim(),
        evidenceRefs: needsEvidence ? refs : [],
        // Sent only when the method actually measures or corroborates. A score
        // travels solely with an assessment; the server refuses one otherwise.
        assessment: needsRubric
          ? {
            rubricId: rubricId.trim(),
            rubricVersion: String(rubricVersion).trim(),
            ...(policy?.supportsProficiency && String(score).trim() !== ''
              ? { score: Number(score) }
              : {}),
          }
          : null,
        corroborationRef: needsCorroboration ? corroborationRef.trim() : '',
      });
      await onDone();
    } catch (err) {
      onError(err?.response?.data?.error || 'Could not record that decision.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 border-t border-gray-200 pt-3 dark:border-gray-700 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={outcomeId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Decision
        </label>
        <select
          id={outcomeId}
          value={toStatus}
          onChange={(e) => setPreferredStatus(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        >
          {available.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {outcome ? (
          <span className="break-words text-[11px] text-gray-500 dark:text-gray-400">{outcome.hint}</span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={methodId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Method (required)
        </label>
        <select
          id={methodId}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        >
          {ENABLED_METHODS.map((m) => (
            <option key={m} value={m}>
              {methodLabel(m)}
              {methodMayIssueVerified(m) ? '' : ' — evidence-backed only'}
            </option>
          ))}
        </select>
        {!methodMayIssueVerified(method) && (
          <span className="break-words text-[11px] text-gray-500 dark:text-gray-400">
            Reading the applicant&apos;s own links establishes that the work
            exists. It cannot conclude that they have the skill, so this method
            stops at evidence-backed.
          </span>
        )}
      </div>

      {needsRubric && (
        <>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={rubricIdField} className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Rubric (required)
            </label>
            <input
              id={rubricIdField}
              type="text"
              value={rubricId}
              maxLength={120}
              onChange={(e) => setRubricId(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={rubricVersionField} className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Rubric version (required)
            </label>
            <input
              id={rubricVersionField}
              type="text"
              value={rubricVersion}
              maxLength={40}
              onChange={(e) => setRubricVersion(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          {policy?.supportsProficiency && (
            <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
              <label htmlFor={scoreId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Assessed proficiency 0-100 (optional)
              </label>
              <input
                id={scoreId}
                type="number"
                min="0"
                max="100"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              />
              <span className="break-words text-[11px] text-gray-500 dark:text-gray-400">
                Only the result this assessment actually measured. Left blank, no
                score is shown anywhere — never a number inferred from evidence.
              </span>
            </div>
          )}
        </>
      )}

      {needsCorroboration && (
        <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
          <label htmlFor={corroborationId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Issuer or referee contacted (required)
          </label>
          <input
            id={corroborationId}
            type="text"
            value={corroborationRef}
            maxLength={200}
            onChange={(e) => setCorroborationRef(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
          <span className="break-words text-[11px] text-gray-500 dark:text-gray-400">
            Who confirmed this, outside the applicant. This is the part that
            makes it a verification rather than a reading of their own links.
          </span>
        </div>
      )}

      {needsIssuerAnchored && !issuerAnchoredCited && (
        <p className="sm:col-span-2 break-words text-xs text-red-600 dark:text-red-400">
          This method needs a credential or certificate among the cited evidence.
          Repository, portfolio, design and profile links are self-published, so
          they support evidence-backed but cannot establish verified.
        </p>
      )}

      {needsEvidence && (
        <fieldset className="min-w-0 sm:col-span-2">
          <legend className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Evidence this decision rests on (required)
          </legend>
          {claim.evidence?.length ? (
            <div className="mt-1 space-y-1">
              {claim.evidence.map((e) => (
                <label key={e.id} className="flex min-w-0 items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={refs.includes(e.id)}
                    onChange={(ev) =>
                      setRefs((prev) =>
                        ev.target.checked ? [...prev, e.id] : prev.filter((id) => id !== e.id)
                      )
                    }
                    className="mt-0.5 shrink-0"
                  />
                  <span className="min-w-0 break-all">
                    {String(e.evidenceType).replace(/_/g, ' ')} · {e.hostname}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              This claim has no evidence, so it cannot be marked evidence-backed or verified.
            </p>
          )}
        </fieldset>
      )}

      <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
        <label htmlFor={reasonId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Reason (required, recorded in history)
        </label>
        <textarea
          id={reasonId}
          value={reason}
          rows={2}
          maxLength={SKILL_CLAIM_LIMITS.MAX_REASON_LENGTH}
          onChange={(e) => setReason(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        />
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={!ready || busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Recording…' : 'Record decision'}
        </button>
        {!ready && (
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            {[
              'method',
              'reason',
              needsEvidence ? 'cited evidence' : null,
              needsIssuerAnchored ? 'a credential among the cited evidence' : null,
              needsRubric ? 'rubric and version' : null,
              needsCorroboration ? 'the issuer or referee contacted' : null,
            ].filter(Boolean).join(', ')} required.
          </span>
        )}
      </div>
    </form>
  );
}

export default SkillVerificationReviewPanel;
