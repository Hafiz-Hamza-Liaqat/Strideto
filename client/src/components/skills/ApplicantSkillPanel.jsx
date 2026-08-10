import { useCallback, useEffect, useId, useState } from 'react';
import {
  EMPLOYER_TRUST_FILTERS,
  getTrustStateDisplay,
  SKILL_CLAIM_STATUSES,
} from '@shared/career/skillVerification.js';
import { employerApi } from '../../services/employerService';
import { SkillTrustBadge } from './SkillTrustBadge';

/**
 * Employer-facing view of one applicant's skills.
 *
 * Two things this panel is careful about:
 *
 *  1. It never collapses trust states into one checkmark. "Claimed" and
 *     "Verified" are visually and textually different, and an expired or
 *     revoked verification is shown as such rather than quietly dropped.
 *  2. Filtering by trust is offered, but "Any" is the default and the empty
 *     state says plainly that unverified is not the same as unqualified —
 *     the filter is a lens, not a judgement.
 *
 * All trust state shown here is computed by the server; this component never
 * derives verified standing itself.
 */
const FILTER_LABELS = {
  [EMPLOYER_TRUST_FILTERS.ANY]: 'Any',
  [EMPLOYER_TRUST_FILTERS.CLAIMED]: 'Claimed',
  [EMPLOYER_TRUST_FILTERS.EVIDENCE_BACKED]: 'Evidence-backed or better',
  [EMPLOYER_TRUST_FILTERS.VERIFIED]: 'Verified only',
};

export function ApplicantSkillPanel({ applicantId, applicantName = 'This applicant', applicationSnapshot = null }) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trust, setTrust] = useState(EMPLOYER_TRUST_FILTERS.ANY);

  const headingId = useId();
  const filterId = useId();

  const load = useCallback(async () => {
    if (!applicantId) return;
    setLoading(true);
    setError('');
    try {
      const res = await employerApi.applicantSkills(applicantId, { trust });
      setSkills(res.data?.data ?? []);
    } catch (err) {
      setError(
        err?.response?.status === 404
          ? 'These skills are not available to you.'
          : err?.response?.data?.error || 'Could not load skills.'
      );
    } finally {
      setLoading(false);
    }
  }, [applicantId, trust]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section aria-labelledby={headingId} data-skill-surface="employer" className="w-full max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-base font-semibold text-gray-900 dark:text-white">
          Skills &amp; evidence
        </h3>
        <div className="flex items-center gap-2 min-w-0">
          <label htmlFor={filterId} className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Trust
          </label>
          <select
            id={filterId}
            value={trust}
            onChange={(e) => setTrust(e.target.value)}
            className="min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
          >
            {Object.values(EMPLOYER_TRUST_FILTERS).map((value) => (
              <option key={value} value={value}>{FILTER_LABELS[value]}</option>
            ))}
          </select>
        </div>
      </div>

      {/*
        The frozen application-time view, shown above the live one and labelled
        as such. An employer decided on what was true when the person applied;
        if that has since changed, both facts are visible rather than the newer
        one quietly replacing the older.
      */}
      {applicationSnapshot?.skills?.length ? (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
            At time of application
            {applicationSnapshot.capturedAt
              ? ` · ${new Date(applicationSnapshot.capturedAt).toLocaleDateString()}`
              : ''}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {applicationSnapshot.skills.map((s, i) => (
              <li key={`${s.skillName}-${i}`} className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
                <span className="break-words text-xs text-gray-700 dark:text-gray-300">{s.skillName}</span>
                <SkillTrustBadge
                  trustState={s.trustState}
                  verificationMethod={s.verificationMethod}
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            A historical record. It does not change when the applicant edits their profile.
          </p>
        </div>
      ) : null}

      {loading ? (
        <p role="status" aria-busy="true" className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Loading skills…
        </p>
      ) : error ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : skills.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:text-gray-400">
          {trust === EMPLOYER_TRUST_FILTERS.ANY
            ? `${applicantName} has not listed any skills.`
            : 'No skills match this trust filter. A skill without verification is not evidence that the applicant lacks it.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {applicationSnapshot?.skills?.length ? (
            <li className="text-xs font-medium text-gray-700 dark:text-gray-300">Current profile</li>
          ) : null}
          {skills.map((skill) => (
            <li
              key={skill.id || skill.skillName}
              className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 min-w-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-white break-words">
                    {skill.skillName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 break-words">
                    {skill.skillCategory}
                    {/*
                      Always "self-reported", never a bare level. A level is
                      the applicant's own estimate unless an assessment
                      measured it — and where one did, the measured result is
                      shown below instead of this.
                    */}
                    {skill.claimedLevel && !skill.proficiencyEvidenced
                      ? ` · self-reported: ${skill.claimedLevel}`
                      : ''}
                    {skill.evidenceCount ? ` · ${skill.evidenceCount} evidence link(s)` : ' · no evidence attached'}
                  </p>
                </div>
                <SkillTrustBadge
                  trustState={skill.trustState}
                  verificationMethod={skill.verificationMethod}
                />
              </div>

              {/* Spell out what the state means, so no employer over-reads a label. */}
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 break-words">
                {getTrustStateDisplay(skill.trustState, skill.verificationMethod).description}
              </p>

              {skill.trustState === SKILL_CLAIM_STATUSES.VERIFIED && skill.verifiedAt ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                  Verified {new Date(skill.verifiedAt).toLocaleDateString()}
                  {skill.verificationMethod ? ` · ${String(skill.verificationMethod).replace(/_/g, ' ')}` : ''}
                </p>
              ) : null}

              {/*
                A number appears only when an assessment actually produced one.
                No score is shown for evidence-backed, and none is derived from
                how many links were attached.
              */}
              {skill.proficiencyEvidenced && typeof skill.proficiencyScore === 'number' ? (
                <p className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                  Assessed proficiency: {skill.proficiencyScore}/100
                </p>
              ) : null}

              {skill.evidence?.length ? (
                <ul className="mt-2 space-y-1">
                  {skill.evidence.map((item, index) => (
                    <li key={`${item.hostname}-${index}`} className="text-xs text-gray-600 dark:text-gray-400 min-w-0">
                      <span className="font-medium">{String(item.evidenceType).replace(/_/g, ' ')}</span>
                      {' — '}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-primary dark:text-mint hover:underline break-all"
                      >
                        {item.hostname}
                      </a>
                      {item.description ? <span className="break-words"> · {item.description}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ApplicantSkillPanel;
