import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { assessmentsApi } from '../../services/assessmentsApi';
import { isAssessmentsEnabled } from '../../config/careerFeatureFlags';

export default function AssessmentTake() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation(['assessments']);
  const [session, setSession] = useState(location.state || null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState(null);
  const autoSubmitRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    if (!isAssessmentsEnabled()) return;
    if (session?.attempt && session?.questions) return;
    assessmentsApi.startAttempt({ slug })
      .then(({ data }) => setSession(data))
      .catch((err) => setError(err.response?.data?.error || t('assessments:startError')));
  }, [slug, session, t]);

  const durationMinutes = session?.assessment?.durationMinutes || 30;

  useEffect(() => {
    if (!session?.questions?.length || result) return;
    setSecondsLeft(durationMinutes * 60);
  }, [session?.questions?.length, durationMinutes, result]);

  async function submit(fromTimer = false) {
    if (!session?.attempt?._id || busy) return;
    setBusy(true);
    setError('');
    try {
      const currentAnswers = answersRef.current;
      const payload = {
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
        timedOut: Boolean(fromTimer),
        answers: (session.questions || []).map((q, idx) => ({
          questionId: q.questionId || q.legacyMcqId || q.id,
          selectedIndex: currentAnswers[idx] ?? currentAnswers[q.id] ?? null,
        })),
      };
      const { data } = await assessmentsApi.submitAttempt(session.attempt._id, payload);
      setResult(data.result);
    } catch (err) {
      setError(err.response?.data?.error || t('assessments:submitError'));
      autoSubmitRef.current = false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (secondsLeft == null || result) return undefined;
    if (secondsLeft <= 0) {
      if (!autoSubmitRef.current) {
        autoSubmitRef.current = true;
        void submit(true);
      }
      return undefined;
    }
    const id = setTimeout(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, result]); // eslint-disable-line react-hooks/exhaustive-deps -- timer tick

  const questions = session?.questions || [];
  const timerLabel = useMemo(() => {
    if (secondsLeft == null) return '';
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [secondsLeft]);

  if (!isAssessmentsEnabled()) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="sr-only">{t('assessments:title')}</h1>
        <p>{t('assessments:featureDisabled')}</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <SeoHead title={t('assessments:resultTitle')} noindex />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('assessments:resultTitle')}</h1>
        <p className="text-lg">
          {t('assessments:yourScore', { score: result.score })}
          {' — '}
          {result.passed ? t('assessments:passed') : t('assessments:failed')}
        </p>
        {result.credentialId ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('assessments:credentialIssued')}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Link to={ROUTES.ASSESSMENTS} className="text-primary dark:text-mint hover:underline">{t('assessments:back')}</Link>
          <Link to={ROUTES.DASHBOARD} className="text-primary dark:text-mint hover:underline">{t('assessments:toDashboard')}</Link>
        </div>
      </div>
    );
  }

  const q = questions[current];

  return (
    <>
      <SeoHead title={session?.assessment?.title || t('assessments:title')} noindex />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <button type="button" onClick={() => navigate(`${ROUTES.ASSESSMENTS}/${slug}`)} className="text-sm text-primary dark:text-mint hover:underline">
          {t('assessments:back')}
        </button>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{session?.assessment?.title}</h1>
          {secondsLeft != null ? (
            <p className={`text-sm font-medium tabular-nums ${secondsLeft < 60 ? 'text-red-600' : 'text-gray-600 dark:text-gray-300'}`} role="timer">
              {t('assessments:timeLeft', { defaultValue: 'Time left' })}: {timerLabel}
            </p>
          ) : null}
        </div>
        {error ? <p className="mt-2 text-red-600" role="alert">{error}</p> : null}
        {!session ? (
          <p className="mt-6 text-gray-500">{t('assessments:loading')}</p>
        ) : !q ? (
          <p className="mt-6 text-gray-500">{t('assessments:noQuestions', { defaultValue: 'No questions available.' })}</p>
        ) : (
          <div className="mt-6 space-y-6">
            <p className="text-sm text-gray-500">
              {t('assessments:questionProgress', {
                defaultValue: 'Question {{current}} of {{total}}',
                current: current + 1,
                total: questions.length,
              })}
            </p>
            <fieldset className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <legend className="font-medium text-gray-900 dark:text-white mb-2">
                {current + 1}. {q.prompt}
              </legend>
              <div className="space-y-2">
                {(q.options || []).map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name={`q-${current}`}
                      checked={answers[current] === oi}
                      onChange={() => setAnswers((prev) => ({ ...prev, [current]: oi }))}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={current === 0}
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50 min-h-[44px]"
              >
                {t('assessments:previous', { defaultValue: 'Previous' })}
              </button>
              {current < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
                  className="px-4 py-2 rounded-lg border text-sm min-h-[44px]"
                >
                  {t('assessments:next', { defaultValue: 'Next' })}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !questions.length}
                  onClick={() => submit(false)}
                  className="inline-flex items-center px-4 py-2.5 rounded-lg bg-primary text-white font-medium min-h-[44px] disabled:opacity-60"
                >
                  {busy ? t('assessments:submitting') : t('assessments:submit')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
