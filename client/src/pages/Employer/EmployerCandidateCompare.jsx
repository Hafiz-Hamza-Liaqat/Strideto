import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';

import { isEmployerIntelligenceEnabled } from '../../config/careerFeatureFlags';

export default function EmployerCandidateCompare() {
  const { t } = useTranslation(['employer', 'common']);
  const enabled = isEmployerIntelligenceEnabled();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (ids.length < 2) {
      setLoading(false);
      return;
    }
    employerApi
      .intelligenceCompareCandidates(ids)
      .then(({ data }) => setRows(data.data?.candidates || []))
      .catch((err) => setError(err.response?.data?.error || t('employer:intelligenceLoadFailed')))
      .finally(() => setLoading(false));
  }, [enabled, searchParams, t, ids.join(',')]);

  if (!enabled) {
    return <div className="p-6 text-sm text-gray-600 dark:text-gray-300">{t('employer:intelligenceDisabled')}</div>;
  }

  const metrics = [    { key: 'jobMatch', label: t('employer:jobMatchShort', { defaultValue: 'Job Match' }), fmt: (v) => (v != null ? `${v}%` : '—') },
    { key: 'resumeQuality', label: t('employer:resumeShort', { defaultValue: 'Resume Quality' }), fmt: (v) => v ?? '—' },
    { key: 'readiness', label: t('employer:readinessShort'), fmt: (v) => v ?? '—' },
    { key: 'communication', label: t('employer:communication', { defaultValue: 'Communication' }), fmt: (v) => v ?? '—' },
    { key: 'english', label: t('employer:english', { defaultValue: 'English' }), fmt: (v) => v ?? '—' },
    { key: 'iq', label: t('employer:iq', { defaultValue: 'IQ / Logic' }), fmt: (v) => v ?? '—' },
    { key: 'verifiedSkillsCount', label: t('employer:verifiedSkills', { defaultValue: 'Verified Skills' }), fmt: (v) => v ?? '—' },
    { key: 'experienceYears', label: t('employer:experience', { defaultValue: 'Experience' }), fmt: (v) => (v != null ? `${v} yrs` : '—') },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-x-auto">
      <Helmet>
        <title>{t('employer:compareTitle', { defaultValue: 'Compare candidates' })}</title>
      </Helmet>
      <Link to={ROUTES.EMPLOYER_INTELLIGENCE_CANDIDATES} className="text-sm text-primary dark:text-mint hover:underline">
        ← {t('employer:candidateList')}
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('employer:compareTitle', { defaultValue: 'Compare candidates' })}</h1>

      {ids.length < 2 && (
        <p className="text-sm text-amber-600">{t('employer:compareMinTwo', { defaultValue: 'Select at least 2 candidates from the list.' })}</p>
      )}
      {loading && <p className="text-sm text-gray-500">{t('common:loading')}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && rows.length >= 2 && (
        <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left p-3 font-medium">{t('employer:metric', { defaultValue: 'Metric' })}</th>
              {rows.map((r) => (
                <th key={r.legacyApplicationId} className="text-left p-3 font-medium">
                  <Link to={`${ROUTES.EMPLOYER_INTELLIGENCE_CANDIDATES}/${r.legacyApplicationId}`} className="text-primary dark:text-mint hover:underline">
                    {r.displayName || '—'}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.key} className="border-t border-gray-100 dark:border-gray-800">
                <td className="p-3 text-gray-600 dark:text-gray-400">{m.label}</td>
                {rows.map((r) => (
                  <td key={`${r.legacyApplicationId}-${m.key}`} className="p-3 font-medium tabular-nums">
                    {m.fmt(r[m.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
