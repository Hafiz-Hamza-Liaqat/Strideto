import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { studentCaseApi, studentConsultationApi } from '../../services/agentService';

export default function StudentMessages() {
  const { t } = useTranslation(['student']);
  const [consultations, setConsultations] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      studentConsultationApi.list().then((r) => r.data.consultations || []).catch(() => []),
      studentCaseApi.list().then((r) => r.data.cases || []).catch(() => []),
    ])
      .then(([c, k]) => {
        setConsultations(c);
        setCases(k);
      })
      .catch((err) => setError(err.response?.data?.error || 'Unable to load messages'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SeoHead title={t('student:messages.title')} noindex />
      <div className="max-w-3xl mx-auto px-4 py-8 min-w-0 w-full space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('student:messages.title')}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t('student:messages.intro')}</p>
        </header>
        {loading ? <p role="status">{t('common:loading', { defaultValue: 'Loading…' })}</p> : null}
        {error ? <p className="text-red-600 dark:text-red-400" role="alert">{error}</p> : null}

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('student:messages.consultations')}</h2>
          {consultations.length === 0 && !loading ? (
            <p className="mt-2 text-sm text-gray-500">{t('student:messages.emptyConsultations')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {consultations.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`${ROUTES.CONSULTATIONS}/${item.id}`}
                    className="flex min-h-[44px] items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <span className="truncate">{item.purpose || item.id}</span>
                    <span>{t('student:messages.open')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('student:messages.cases')}</h2>
          {cases.length === 0 && !loading ? (
            <p className="mt-2 text-sm text-gray-500">{t('student:messages.emptyCases')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {cases.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`${ROUTES.CASES}/${item.id}`}
                    className="flex min-h-[44px] items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <span className="truncate">{item.title || item.id}</span>
                    <span>{t('student:messages.open')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
