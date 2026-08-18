import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { assessmentsApi } from '../../services/assessmentsApi';
import { isAssessmentsEnabled } from '../../config/careerFeatureFlags';

export default function AssessmentDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['assessments']);
  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAssessmentsEnabled()) return;
    assessmentsApi.getBySlug(slug)
      .then(({ data }) => setAssessment(data))
      .catch((err) => setError(err.response?.data?.error || t('assessments:loadError')));
  }, [slug, t]);

  async function start() {
    setBusy(true);
    setError('');
    try {
      const { data } = await assessmentsApi.startAttempt({ slug });
      navigate(`${ROUTES.ASSESSMENTS}/${slug}/take`, { state: data });
    } catch (err) {
      setError(err.response?.data?.error || t('assessments:startError'));
    } finally {
      setBusy(false);
    }
  }

  if (!isAssessmentsEnabled()) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="sr-only">{t('assessments:title')}</h1>
        <p>{t('assessments:featureDisabled')}</p>
      </div>
    );
  }

  return (
    <>
      <SeoHead title={assessment?.title || t('assessments:title')} noindex />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link to={ROUTES.ASSESSMENTS} className="text-sm text-primary dark:text-mint hover:underline">{t('assessments:back')}</Link>
        {error ? <p className="mt-4 text-red-600" role="alert">{error}</p> : null}
        {!assessment ? (
          <p className="mt-6 text-gray-500">{t('assessments:loading')}</p>
        ) : (
          <div className="mt-4 space-y-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{assessment.title}</h1>
            <p className="text-gray-600 dark:text-gray-300">{assessment.description}</p>
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">{t('assessments:duration')}</dt>
                <dd className="font-medium">{assessment.durationMinutes} {t('assessments:minutes')}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('assessments:passing')}</dt>
                <dd className="font-medium">{assessment.passingScore}%</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('assessments:maxAttempts')}</dt>
                <dd className="font-medium">{assessment.maxAttempts}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('assessments:skill')}</dt>
                <dd className="font-medium">{assessment.skillName || assessment.title}</dd>
              </div>
            </dl>
            <button
              type="button"
              disabled={busy}
              onClick={start}
              className="inline-flex items-center px-4 py-2.5 rounded-lg bg-primary text-white font-medium min-h-[44px] disabled:opacity-60"
            >
              {busy ? t('assessments:starting') : t('assessments:start')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
