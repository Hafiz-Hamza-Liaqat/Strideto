import { useCallback, useEffect, useId, useState } from 'react';
import {
  SKILL_EVIDENCE_TYPES,
  SKILL_CLAIM_LIMITS,
  SKILL_CLAIM_STATUSES,
  getSuggestedEvidenceTypes,
  validateEvidenceUrl,
} from '@shared/career/skillVerification.js';
import { SKILL_CATEGORIES, SKILL_LEVELS } from '@shared/career/constants.js';
import { skillClaimsApi } from '../../services/skillClaimsApi';
import { SkillTrustBadge } from './SkillTrustBadge';

/**
 * Student-facing skill claim + evidence manager.
 *
 * The applicant can claim a skill, attach evidence links and request review.
 * They cannot set a status, score, verifier or badge — the UI offers no such
 * control, and the server would refuse it anyway.
 *
 * The URL is validated client-side purely for fast feedback; the server
 * revalidates every field and is the only authority.
 *
 * Layout is single-column and wrapping throughout so it holds at 320px.
 */
const EVIDENCE_TYPE_LABELS = {
  [SKILL_EVIDENCE_TYPES.CODE_REPOSITORY]: 'Code repository',
  [SKILL_EVIDENCE_TYPES.LIVE_PROJECT]: 'Live/deployed project',
  [SKILL_EVIDENCE_TYPES.DESIGN_PORTFOLIO]: 'Design portfolio',
  [SKILL_EVIDENCE_TYPES.PORTFOLIO_SITE]: 'Portfolio site',
  [SKILL_EVIDENCE_TYPES.PROFESSIONAL_PROFILE]: 'Professional profile',
  [SKILL_EVIDENCE_TYPES.CREDENTIAL_CERTIFICATE]: 'Credential / certificate',
  [SKILL_EVIDENCE_TYPES.PUBLICATION]: 'Publication',
  [SKILL_EVIDENCE_TYPES.CASE_STUDY]: 'Case study',
  [SKILL_EVIDENCE_TYPES.WORK_SAMPLE]: 'Work sample',
  [SKILL_EVIDENCE_TYPES.OTHER_EVIDENCE]: 'Other evidence',
};

function readError(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

export function SkillClaimManager() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ skillName: '', skillCategory: 'technical', claimedLevel: 'intermediate' });
  const [openClaimId, setOpenClaimId] = useState(null);

  const headingId = useId();
  const nameId = useId();
  const categoryId = useId();
  const levelId = useId();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await skillClaimsApi.listMine();
      setClaims(res.data?.data ?? []);
    } catch (err) {
      setError(readError(err, 'Could not load your skills.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addClaim = async (event) => {
    event.preventDefault();
    if (!form.skillName.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await skillClaimsApi.create(form);
      setForm({ skillName: '', skillCategory: 'technical', claimedLevel: 'intermediate' });
      await load();
    } catch (err) {
      setError(readError(err, 'Could not add that skill.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={headingId} data-skill-surface="student" className="w-full max-w-full">
      <h2 id={headingId} className="text-lg font-semibold text-gray-900 dark:text-white">
        Skills &amp; evidence
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Add the skills you have and link evidence for them. Links you publish
        yourself — a repository, a design file, a portfolio, a profile — can get
        a skill to <strong>evidence-backed</strong>, meaning a reviewer opened
        them and found the work real. Going further, to <strong>verified</strong>,
        needs something from outside your own links: a credential, a reference we
        contact, or an assessment.
      </p>

      <form onSubmit={addClaim} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 min-w-0">
          <label htmlFor={nameId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Skill
          </label>
          <input
            id={nameId}
            type="text"
            value={form.skillName}
            maxLength={SKILL_CLAIM_LIMITS.MAX_SKILL_NAME_LENGTH}
            onChange={(e) => setForm((f) => ({ ...f, skillName: e.target.value }))}
            className="w-full min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            placeholder="e.g. React, Figma, Financial modelling"
            required
          />
        </div>

        <div className="flex flex-col gap-1 min-w-0">
          <label htmlFor={categoryId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Category
          </label>
          <select
            id={categoryId}
            value={form.skillCategory}
            onChange={(e) => setForm((f) => ({ ...f, skillCategory: e.target.value }))}
            className="w-full min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            {SKILL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-0">
          <label htmlFor={levelId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Level you claim
          </label>
          <select
            id={levelId}
            value={form.claimedLevel}
            onChange={(e) => setForm((f) => ({ ...f, claimedLevel: e.target.value }))}
            className="w-full min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            {SKILL_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving || !form.skillName.trim()}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add skill'}
          </button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p role="status" aria-busy="true" className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Loading your skills…
        </p>
      ) : claims.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:text-gray-400">
          You have not added any skills yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {claims.map((claim) => (
            <li
              key={claim.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 min-w-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-white break-words">
                    {claim.skillName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 break-words">
                    {claim.skillCategory} · self-reported: {claim.claimedLevel}
                    {claim.evidenceCount ? ` · ${claim.evidenceCount} evidence link(s)` : ''}
                  </p>
                </div>
                <SkillTrustBadge
                  trustState={claim.trustState}
                  verificationMethod={claim.verificationMethod}
                />
              </div>

              {claim.evidence?.length ? (
                <ul className="mt-3 space-y-1">
                  {claim.evidence.map((item) => (
                    <li key={item.id} className="text-xs text-gray-600 dark:text-gray-400 min-w-0">
                      <span className="font-medium">{EVIDENCE_TYPE_LABELS[item.evidenceType] ?? item.evidenceType}</span>
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

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOpenClaimId(openClaimId === claim.id ? null : claim.id)}
                  aria-expanded={openClaimId === claim.id}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium"
                >
                  {openClaimId === claim.id ? 'Cancel' : 'Add evidence'}
                </button>
                {claim.evidenceCount > 0
                  && claim.trustState !== SKILL_CLAIM_STATUSES.VERIFICATION_PENDING
                  && claim.trustState !== SKILL_CLAIM_STATUSES.VERIFIED ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await skillClaimsApi.submitForReview(claim.id);
                          await load();
                        } catch (err) {
                          setError(readError(err, 'Could not request review.'));
                        }
                      }}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-gray-900"
                    >
                      Request review
                    </button>
                  ) : null}
              </div>

              {openClaimId === claim.id ? (
                <EvidenceForm
                  claim={claim}
                  onAdded={async () => {
                    setOpenClaimId(null);
                    await load();
                  }}
                  onError={setError}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Evidence sub-form. Kept separate so each claim has its own field state. */
function EvidenceForm({ claim, onAdded, onError }) {
  const suggested = getSuggestedEvidenceTypes(claim.skillCategory);
  const [values, setValues] = useState({
    evidenceType: suggested[0] ?? SKILL_EVIDENCE_TYPES.OTHER_EVIDENCE,
    url: '',
    description: '',
  });
  const [busy, setBusy] = useState(false);
  const [urlProblem, setUrlProblem] = useState('');

  const typeId = useId();
  const urlId = useId();
  const descId = useId();
  const errId = useId();

  const atLimit = (claim.evidenceCount ?? 0) >= SKILL_CLAIM_LIMITS.MAX_EVIDENCE_PER_CLAIM;

  const submit = async (event) => {
    event.preventDefault();
    if (busy || atLimit) return;
    // Fast local feedback only — the server revalidates and is authoritative.
    const check = validateEvidenceUrl(values.url);
    if (!check.ok) {
      setUrlProblem(
        check.reason === 'private_network'
          ? 'Use a publicly reachable link — local or private addresses cannot be checked by anyone else.'
          : 'Enter a valid https:// link.'
      );
      return;
    }
    setUrlProblem('');
    setBusy(true);
    try {
      await skillClaimsApi.addEvidence(claim.id, values);
      setValues({ evidenceType: suggested[0] ?? SKILL_EVIDENCE_TYPES.OTHER_EVIDENCE, url: '', description: '' });
      await onAdded();
    } catch (err) {
      onError(readError(err, 'Could not add that evidence link.'));
    } finally {
      setBusy(false);
    }
  };

  if (atLimit) {
    return (
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
        You have reached the limit of {SKILL_CLAIM_LIMITS.MAX_EVIDENCE_PER_CLAIM} evidence links for this skill.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 border-t border-gray-200 pt-3 dark:border-gray-700 sm:grid-cols-2">
      <div className="flex flex-col gap-1 min-w-0">
        <label htmlFor={typeId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Evidence type
        </label>
        <select
          id={typeId}
          value={values.evidenceType}
          onChange={(e) => setValues((v) => ({ ...v, evidenceType: e.target.value }))}
          className="w-full min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
        >
          {Object.values(SKILL_EVIDENCE_TYPES).map((type) => (
            <option key={type} value={type}>
              {EVIDENCE_TYPE_LABELS[type] ?? type}
              {suggested.includes(type) ? ' (suggested)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <label htmlFor={urlId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Link
        </label>
        <input
          id={urlId}
          type="url"
          inputMode="url"
          value={values.url}
          maxLength={SKILL_CLAIM_LIMITS.MAX_URL_LENGTH}
          onChange={(e) => setValues((v) => ({ ...v, url: e.target.value }))}
          aria-invalid={urlProblem ? 'true' : undefined}
          aria-describedby={urlProblem ? errId : undefined}
          placeholder="https://github.com/you/project"
          className="w-full min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          required
        />
        {urlProblem ? (
          <span id={errId} role="alert" className="text-xs text-red-700 dark:text-red-300 break-words">
            {urlProblem}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 min-w-0 sm:col-span-2">
        <label htmlFor={descId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
          What does this show? (optional)
        </label>
        <input
          id={descId}
          type="text"
          value={values.description}
          maxLength={SKILL_CLAIM_LIMITS.MAX_DESCRIPTION_LENGTH}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          className="w-full min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
        />
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Attach evidence'}
        </button>
      </div>
    </form>
  );
}

export default SkillClaimManager;
