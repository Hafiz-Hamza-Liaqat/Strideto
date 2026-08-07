import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';
import { PIPELINE_STAGES } from '@shared/career/constants.js';
import { ScoreExplainPanel } from '../../components/career/ScoreExplainPanel';
import { isEmployerIntelligenceEnabled } from '../../config/careerFeatureFlags';

/** Modes the interview subdocument already supports (mirrors the User-side panel). */
const INTERVIEW_MODES = ['video', 'phone', 'in_person', 'other'];
const MODES_WITH_LINK = new Set(['video', 'other']);
const MODES_WITH_LOCATION = new Set(['in_person', 'other']);

/**
 * PF-EMP-INT-B3: render a stored instant as a `datetime-local` value in the viewer's
 * own zone, so reopening the form shows the same wall clock that was chosen. The
 * inverse of the `new Date(value).toISOString()` performed on submit.
 */
function toLocalInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * PF-EMP-INT-B3B: the zone this browser resolves times in. This is the appointment's
 * timezone identity — the server stores what we state here and renders every
 * candidate-facing message with it, rather than falling back to its own container zone.
 */
function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

/**
 * Same instant, spelled out with a named zone so the wall clock is unambiguous.
 *
 * PF-EMP-INT-B3B: render in the appointment's *stored* zone when it has one, so the
 * summary shows the wall clock the candidate is being told — not this viewer's
 * reinterpretation of it. Pre-B3B appointments carry no zone and keep rendering in the
 * viewer's own, which is exactly as much as is truthfully known about them.
 */
function formatAppointment(value, timeZone) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // Explicit components, not dateStyle/timeStyle: ECMA-402 forbids combining those
  // shorthands with `timeZoneName`, so the shorthand form threw and silently dropped
  // the zone label the summary is supposed to show.
  const opts = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  };
  try {
    if (timeZone) return d.toLocaleString(undefined, { ...opts, timeZone });
  } catch {
    /* stored zone unknown to this browser — fall through to the viewer's own */
  }
  try {
    return d.toLocaleString(undefined, opts);
  } catch {
    return d.toLocaleString();
  }
}

export default function EmployerCandidateDetail() {
  const { id } = useParams();
  const { t } = useTranslation(['employer', 'common']);
  const enabled = isEmployerIntelligenceEnabled();
  const [candidate, setCandidate] = useState(null);
  const [note, setNote] = useState('');
  const [interviewAt, setInterviewAt] = useState('');
  const [interviewMode, setInterviewMode] = useState('video');
  const [interviewUrl, setInterviewUrl] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewOutcome, setInterviewOutcome] = useState('');
  const [interviewBusy, setInterviewBusy] = useState(false);
  const [interviewError, setInterviewError] = useState(null);
  const [interviewMessage, setInterviewMessage] = useState(null);
  const [stage, setStage] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const recordedEntryForId = useRef(null);

  const applyInterview = (next) => {
    setInterviewAt(toLocalInputValue(next?.scheduledAt));
    setInterviewMode(next?.mode || 'video');
    setInterviewUrl(next?.meetingUrl || '');
    setInterviewLocation(next?.location || '');
  };

  const refresh = ({ recordView = false } = {}) =>
    employerApi.intelligenceCandidate(id, { recordView }).then(({ data }) => {
      setCandidate(data.data);
      setStage(data.data?.pipelineStage || '');
      applyInterview(data.data?.interviewStatus);
    });

  useEffect(() => {
    if (!enabled || !id) return;
    const recordView = recordedEntryForId.current !== id;
    recordedEntryForId.current = id;
    refresh({ recordView }).catch((err) =>
      setError(err.response?.data?.error || t('employer:intelligenceLoadFailed'))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled]);

  if (!enabled) {
    return <div className="p-6 text-sm text-gray-600">{t('employer:intelligenceDisabled')}</div>;
  }

  const onStage = async () => {
    setSaving(true);
    try {
      const { data } = await employerApi.intelligenceTransitionStage(id, { toStage: stage });
      setCandidate(data.data);
    } catch (err) {
      setError(err.response?.data?.error || t('employer:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await employerApi.intelligenceAddNote(id, { text: note });
      setNote('');
      await refresh({ recordView: false });
    } catch (err) {
      setError(err.response?.data?.error || t('employer:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const current = candidate?.interviewStatus || null;
  const hasAppointment = Boolean(current?.scheduledAt);
  const isCompleted = current?.status === 'completed';

  // The form owns mode/link/location, so it always states all three — an irrelevant
  // one is sent empty rather than omitted, otherwise a stale link would survive a
  // switch to an in-person interview. `notes` and `outcome` are never sent from here,
  // so the field-scoped patch leaves them exactly as they are.
  const buildPayload = () => ({
    scheduledAt: new Date(interviewAt).toISOString(),
    // The instant alone cannot be re-rendered truthfully later, so the zone that
    // resolved it travels with it (PF-EMP-INT-B3B).
    timeZone: browserTimeZone(),
    mode: interviewMode,
    meetingUrl: MODES_WITH_LINK.has(interviewMode) ? interviewUrl.trim() : '',
    location: MODES_WITH_LOCATION.has(interviewMode) ? interviewLocation.trim() : '',
  });

  const isSameAppointment = () => {
    if (!hasAppointment || !interviewAt) return false;
    const payload = buildPayload();
    return (
      new Date(current.scheduledAt).getTime() === new Date(payload.scheduledAt).getTime()
      // A stored zone that differs from this browser's is a real change to what the
      // candidate is told, so it is not an identical save. A pre-B3B appointment has
      // no stored zone, and adopting one does change the message.
      && (current.timeZone || '') === payload.timeZone
      && (current.mode || 'video') === payload.mode
      && (current.meetingUrl || '') === payload.meetingUrl
      && (current.location || '') === payload.location
    );
  };

  const onInterview = async () => {
    if (!interviewAt) return;
    const appointmentChanged = !isSameAppointment();
    setInterviewBusy(true);
    setInterviewError(null);
    setInterviewMessage(null);
    try {
      // The instant is resolved here, in the Employer's own browser, so the wall
      // clock they picked is what is stored — the server no longer has to guess a
      // zone for a bare `datetime-local` string.
      const { data } = await employerApi.intelligenceScheduleInterview(id, buildPayload());
      await refresh({ recordView: false });
      if (!data?.data?.changed) {
        setInterviewMessage(t('employer:interviewUnchanged'));
      } else if (appointmentChanged) {
        setInterviewMessage(hasAppointment ? t('employer:interviewRescheduled') : t('employer:interviewScheduled'));
      } else {
        setInterviewMessage(t('employer:interviewStageOnlySaved'));
      }
    } catch (err) {
      setInterviewError(err.response?.data?.error || t('employer:saveFailed'));
    } finally {
      setInterviewBusy(false);
    }
  };

  const onCompleteInterview = async () => {
    setInterviewBusy(true);
    setInterviewError(null);
    setInterviewMessage(null);
    try {
      // `outcome` is free text server-side and defaults to 'completed' when blank.
      await employerApi.intelligenceCompleteInterview(id, { outcome: interviewOutcome.trim() });
      setInterviewOutcome('');
      await refresh({ recordView: false });
      setInterviewMessage(t('employer:interviewCompletedSaved'));
    } catch (err) {
      setInterviewError(err.response?.data?.error || t('employer:saveFailed'));
    } finally {
      setInterviewBusy(false);
    }
  };

  if (!candidate && !error) {
    return <div className="p-6 text-sm text-gray-500">{t('common:loading')}</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Helmet>
        <title>{candidate?.basic?.displayName || t('employer:candidateDetail')}</title>
      </Helmet>

      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <Link to={ROUTES.EMPLOYER_INTELLIGENCE_CANDIDATES} className="text-sm text-primary dark:text-mint hover:underline">
            ← {t('employer:candidateList')}
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mt-2">
            {candidate?.basic?.displayName || t('employer:unnamedCandidate')}
          </h1>
          <p className="text-sm text-gray-500">{candidate?.headline} · {candidate?.location}</p>
          <p className="text-sm text-gray-500">{t('employer:workPreference')}: {candidate?.workPreference || '—'}</p>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold">{t('employer:rankScore')}: {candidate?.ranking?.percent ?? '—'}%</div>
          <div className="text-gray-500">{t('employer:readinessShort')}: {candidate?.readiness?.overall ?? '—'}</div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
        <h2 className="font-semibold mb-2">{t('employer:rankingExplanation')}</h2>
        <ul className="space-y-1 text-sm">
          {(candidate?.ranking?.factors || []).map((f) => (
            <li key={f.key} className="flex justify-between gap-2">
              <span>{f.key} ({Math.round((f.weight || 0) * 100)}%)</span>
              <span>{Math.round((f.contribution || 0) * 100)} pts</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500 mt-2">{t('employer:rankingDeterministicHint')}</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {candidate?.jobMatch && (
          <ScoreExplainPanel
            title={t('employer:jobMatchShort', { defaultValue: 'Job Match' })}
            overall={candidate.jobMatch.overall}
            explanation={candidate.jobMatch.explanation}
            strengths={candidate.jobMatch.strengths}
            missing={candidate.jobMatch.missing}
          />
        )}
        {candidate?.resumeStrength && (
          <ScoreExplainPanel
            title={t('employer:resumeShort', { defaultValue: 'Resume Quality' })}
            overall={candidate.resumeStrength.overall}
          />
        )}
      </div>

      {(candidate?.hiringRecommendations || []).length > 0 && (
        <section className="rounded-xl border border-amber-200 dark:border-amber-900/50 p-4 bg-amber-50/50 dark:bg-amber-950/20">
          <h2 className="font-semibold mb-2">{t('employer:hiringRecommendations', { defaultValue: 'Advisory recommendations' })}</h2>
          <ul className="space-y-2 text-sm">
            {candidate.hiringRecommendations.map((r) => (
              <li key={r.actionKey}>
                <span className="font-medium">{r.action.replace(/_/g, ' ')}</span>
                <span className="text-gray-600 dark:text-gray-400"> — {r.reason}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-2">{t('employer:advisoryOnly', { defaultValue: 'Suggestions only — you decide all hiring actions.' })}</p>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border p-4 bg-white dark:bg-gray-900 dark:border-gray-700">
          <h2 className="font-semibold mb-2">{t('employer:verifiedSkills')}</h2>
          <ul className="text-sm space-y-1">
            {(candidate?.verifiedSkills || []).map((s, i) => (
              <li key={s.attemptId || i}>{s.skillName || s.title || t('employer:skill')} · {s.score ?? '—'}</li>
            ))}
            {!candidate?.verifiedSkills?.length && <li className="text-gray-500">{t('employer:noVerifiedSkills')}</li>}
          </ul>
        </section>

        <section className="rounded-xl border p-4 bg-white dark:bg-gray-900 dark:border-gray-700">
          <h2 className="font-semibold mb-2">{t('employer:credentialViewer')}</h2>
          <ul className="text-sm space-y-1">
            {(candidate?.credentials || []).map((c) => (
              <li key={c._id}>{c.title || c.skillName} · {c.verificationStatus}</li>
            ))}
            {!candidate?.credentials?.length && <li className="text-gray-500">{t('employer:noCredentials')}</li>}
          </ul>
        </section>

        <section className="rounded-xl border p-4 bg-white dark:bg-gray-900 dark:border-gray-700">
          <h2 className="font-semibold mb-2">{t('employer:documentViewer')}</h2>
          <p className="text-sm text-gray-500 mb-2">
            {t('employer:resumeVersion')}: {candidate?.resumeVersion?.title || candidate?.resumeVersion?.id || '—'}
          </p>
          <ul className="text-sm space-y-1">
            {(candidate?.documents || []).map((d) => (
              <li key={d._id}>{d.title || d.documentType}</li>
            ))}
            {!candidate?.documents?.length && <li className="text-gray-500">{t('employer:noDocuments')}</li>}
          </ul>
        </section>

        <section className="rounded-xl border p-4 bg-white dark:bg-gray-900 dark:border-gray-700">
          <h2 className="font-semibold mb-2">{t('employer:timelineViewer')}</h2>
          <ul className="text-sm space-y-1">
            {(candidate?.timelineSummary || []).map((e, i) => (
              <li key={`${e.verb}-${i}`}>
                {e.verb} · {e.occurredAt ? new Date(e.occurredAt).toLocaleString() : ''}
              </li>
            ))}
            {!candidate?.timelineSummary?.length && <li className="text-gray-500">{t('employer:noTimeline')}</li>}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border p-4 bg-white dark:bg-gray-900 dark:border-gray-700 space-y-3">
        <h2 className="font-semibold">{t('employer:hiringActions')}</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm">
            <span className="block text-gray-500 mb-1">{t('employer:pipelineStage')}</span>
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700">
              {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button
            type="button"
            disabled={saving || !stage || stage === candidate?.pipelineStage}
            onClick={onStage}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('employer:updateStage')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
            <span className="block text-gray-500 mb-1">{t('employer:candidateNotes')}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-900 dark:border-gray-700" />
          </label>
          <button type="button" disabled={saving} onClick={onNote} className="px-4 py-2 rounded-lg border text-sm min-h-[44px]">{t('employer:addNote')}</button>
        </div>
      </section>

      <section className="rounded-xl border p-4 bg-white dark:bg-gray-900 dark:border-gray-700 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {hasAppointment ? t('employer:rescheduleInterview') : t('employer:scheduleInterview')}
          </h2>
          <span className="text-xs uppercase tracking-wide text-gray-500">
            {t('employer:interviewStatus')}: {current?.status || 'none'}
          </span>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3 text-sm space-y-1">
          {hasAppointment ? (
            <>
              <p className="font-medium text-gray-900 dark:text-white">
                {t('employer:currentAppointment')}: {formatAppointment(current.scheduledAt, current.timeZone)}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                {t('employer:interviewMode')}: {t(`employer:interviewMode_${current.mode || 'video'}`, { defaultValue: current.mode || 'video' })}
              </p>
              {current.meetingUrl && (
                <p className="break-words">
                  <span className="text-gray-600 dark:text-gray-300">{t('employer:interviewMeetingUrl')}: </span>
                  <a href={current.meetingUrl} target="_blank" rel="noreferrer" className="text-primary dark:text-mint hover:underline">
                    {current.meetingUrl}
                  </a>
                </p>
              )}
              {current.location && (
                <p className="text-gray-600 dark:text-gray-300">{t('employer:interviewLocation')}: {current.location}</p>
              )}
              {current.outcome && (
                <p className="text-gray-600 dark:text-gray-300">{t('employer:interviewOutcome')}: {current.outcome}</p>
              )}
            </>
          ) : (
            <p className="text-gray-500">{t('employer:noAppointmentYet')}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-gray-500 mb-1">{t('employer:interviewDateTime')}</span>
            <input
              type="datetime-local"
              value={interviewAt}
              onChange={(e) => setInterviewAt(e.target.value)}
              className="w-full max-w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-500 mb-1">{t('employer:interviewMode')}</span>
            <select
              value={interviewMode}
              onChange={(e) => setInterviewMode(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700"
            >
              {INTERVIEW_MODES.map((m) => (
                <option key={m} value={m}>{t(`employer:interviewMode_${m}`, { defaultValue: m })}</option>
              ))}
            </select>
          </label>
          {MODES_WITH_LINK.has(interviewMode) && (
            <label className="text-sm sm:col-span-2">
              <span className="block text-gray-500 mb-1">{t('employer:interviewMeetingUrl')}</span>
              <input
                type="url"
                value={interviewUrl}
                onChange={(e) => setInterviewUrl(e.target.value)}
                placeholder="https://"
                className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700"
              />
            </label>
          )}
          {MODES_WITH_LOCATION.has(interviewMode) && (
            <label className="text-sm sm:col-span-2">
              <span className="block text-gray-500 mb-1">{t('employer:interviewLocation')}</span>
              <input
                value={interviewLocation}
                onChange={(e) => setInterviewLocation(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700"
              />
            </label>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            disabled={interviewBusy || !interviewAt}
            onClick={onInterview}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {interviewBusy
              ? t('common:saving', { defaultValue: 'Saving…' })
              : hasAppointment ? t('employer:rescheduleInterview') : t('employer:saveInterview')}
          </button>
          <p className="text-xs text-gray-500">
            {browserTimeZone()
              ? t('employer:interviewTimezoneNamed', { zone: browserTimeZone() })
              : t('employer:interviewTimezoneHint')}
          </p>
        </div>

        {hasAppointment && !isCompleted && (
          <div className="flex flex-wrap gap-2 items-end border-t border-gray-200 dark:border-gray-700 pt-3">
            <label className="text-sm w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
              <span className="block text-gray-500 mb-1">{t('employer:interviewOutcome')}</span>
              <input
                value={interviewOutcome}
                onChange={(e) => setInterviewOutcome(e.target.value)}
                placeholder={t('employer:interviewOutcomePlaceholder')}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700"
              />
            </label>
            <button
              type="button"
              disabled={interviewBusy}
              onClick={onCompleteInterview}
              className="px-4 py-2 rounded-lg border text-sm min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('employer:markInterviewCompleted')}
            </button>
          </div>
        )}

        {interviewError && <p className="text-sm text-red-600">{interviewError}</p>}
        {interviewMessage && <p className="text-sm text-green-700 dark:text-green-400">{interviewMessage}</p>}
      </section>
    </div>
  );
}
