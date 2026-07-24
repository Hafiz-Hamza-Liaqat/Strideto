import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { savedApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { formatDate } from '../../utils/formatDate';
import { Alert } from '../../components/ui/Alerts';
import { SeoHead } from '../../components/seo';
import { EmptyState } from '../../components/common/EmptyState';

export default function SavedJobs() {
  const { t } = useTranslation(['dashboard', 'seo', 'common']);
  const [savedJobs, setSavedJobs] = useState([]);
  const [savedScholarships, setSavedScholarships] = useState([]);
  const [savedAdmissions, setSavedAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    savedApi
      .get()
      .then(({ data }) => {
        setSavedJobs(data.savedJobs || []);
        setSavedScholarships(data.savedScholarships || []);
        setSavedAdmissions(data.savedAdmissions || []);
      })
      .catch((err) => setError(err.response?.data?.error || t('dashboard:savedFailedLoad')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) {
    return (
      <>
        <SeoHead title={t('seo:savedListingsTitle')} description={t('seo:savedListingsDescription')} noindex />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse text-gray-500 dark:text-gray-400">{t('dashboard:savedLoading')}</div>
        </div>
      </>
    );
  }

  const total = savedJobs.length + savedScholarships.length + savedAdmissions.length;

  return (
    <>
      <SeoHead title={t('seo:savedListingsTitle')} description={t('seo:savedListingsDescription')} noindex />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('dashboard:savedPageTitle')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('dashboard:savedPageSubtitle')}</p>

        {error && <Alert variant="error" className="mb-6">{error}</Alert>}

        {total === 0 ? (
          <EmptyState
            icon="⭐"
            title="Save interesting jobs"
            description="Save interesting jobs to access them later. You can also bookmark scholarships and admissions."
            actionLabel="Browse Jobs"
            actionTo={ROUTES.JOBS}
          />
        ) : (
          <div className="space-y-8">
            {savedJobs.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard:savedJobsSection')}</h2>
                <ul className="space-y-3">
                  {savedJobs.map((j) => (
                    <li key={j._id}>
                      <Link to={`${ROUTES.JOBS}/${j.slug || j._id}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition">
                        <span className="font-semibold text-gray-900 dark:text-white">{j.title}</span>
                        <span className="text-gray-600 dark:text-gray-400"> · {j.organization || j.company}</span>
                        {j.deadline && <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">{t('dashboard:savedDeadline', { date: formatDate(j.deadline) })}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {savedScholarships.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard:savedScholarshipsSection')}</h2>
                <ul className="space-y-3">
                  {savedScholarships.map((s) => (
                    <li key={s._id}>
                      <Link to={`${ROUTES.SCHOLARSHIPS}/${s.slug || s._id}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition">
                        <span className="font-semibold text-gray-900 dark:text-white">{s.title}</span>
                        <span className="text-gray-600 dark:text-gray-400"> · {s.provider}</span>
                        {s.deadline && <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">{t('dashboard:savedDeadline', { date: formatDate(s.deadline) })}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {savedAdmissions.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard:savedAdmissionsSection')}</h2>
                <ul className="space-y-3">
                  {savedAdmissions.map((a) => (
                    <li key={a._id}>
                      <Link to={`${ROUTES.ADMISSIONS}/${a.slug || a._id}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition">
                        <span className="font-semibold text-gray-900 dark:text-white">{a.program}</span>
                        <span className="text-gray-600 dark:text-gray-400"> · {a.institution}</span>
                        {a.deadline && <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">{t('dashboard:savedDeadline', { date: formatDate(a.deadline) })}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
