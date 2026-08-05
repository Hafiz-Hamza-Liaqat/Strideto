import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';
import { PIPELINE_STAGES } from '@shared/career/constants.js';
import { ScoreExplainPanel } from '../../components/career/ScoreExplainPanel';
import { isEmployerIntelligenceEnabled } from '../../config/careerFeatureFlags';

export default function EmployerCandidateDetail() {
  const { id } = useParams();
  const { t } = useTranslation(['employer', 'common']);
  const enabled = isEmployerIntelligenceEnabled();
  const [candidate, setCandidate] = useState(null);
  const [note, setNote] = useState('');
  const [interviewAt, setInterviewAt] = useState('');
  const [stage, setStage] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const recordedEntryForId = useRef(null);

  const refresh = ({ recordView = false } = {}) =>
    employerApi.intelligenceCandidate(id, { recordView }).then(({ data }) => {
      setCandidate(data.data);
      setStage(data.data?.pipelineStage || '');
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

  const onInterview = async () => {
    if (!interviewAt) return;
    setSaving(true);
    try {
      await employerApi.intelligenceScheduleInterview(id, { scheduledAt: interviewAt, mode: 'video' });
      await refresh({ recordView: false });
    } catch (err) {
      setError(err.response?.data?.error || t('employer:saveFailed'));
    } finally {
      setSaving(false);
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
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm">
            <span className="block text-gray-500 mb-1">{t('employer:scheduleInterview')}</span>
            <input type="datetime-local" value={interviewAt} onChange={(e) => setInterviewAt(e.target.value)} className="w-full max-w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700" />
          </label>
          <button type="button" disabled={saving} onClick={onInterview} className="px-4 py-2 rounded-lg border text-sm min-h-[44px]">{t('employer:saveInterview')}</button>
        </div>
        <p className="text-sm text-gray-500">
          {t('employer:interviewStatus')}: {candidate?.interviewStatus?.status || 'none'}
          {candidate?.interviewStatus?.scheduledAt
            ? ` · ${new Date(candidate.interviewStatus.scheduledAt).toLocaleString()}`
            : ''}
        </p>
      </section>
    </div>
  );
}
