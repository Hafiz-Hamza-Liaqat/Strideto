import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';
import { isEmployerIntelligenceEnabled } from '../../config/careerFeatureFlags';
import { PIPELINE_STAGES } from '@shared/career/constants.js';

export default function EmployerPipeline() {
  const { t } = useTranslation(['employer', 'common']);
  const enabled = isEmployerIntelligenceEnabled();
  const [pipeline, setPipeline] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    employerApi
      .intelligencePipeline()
      .then(({ data }) => setPipeline(data))
      .catch((err) => setError(err.response?.data?.error || t('employer:intelligenceLoadFailed')));
  }, [enabled, t]);

  if (!enabled) {
    return <div className="p-6 text-sm text-gray-600">{t('employer:intelligenceDisabled')}</div>;
  }

  const columns = pipeline?.columns || {};
  // getPipeline (EmployerIntelligenceService.js) already returns the full
  // canonical stage list/order as `stages` — reuse it directly instead of
  // maintaining a second, duplicate stage list here. Before the response
  // arrives, fall back to the same canonical constant so columns are still
  // visible immediately (matching the existing pre-fetch render behavior).
  const stages = pipeline?.stages?.length ? pipeline.stages : PIPELINE_STAGES;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Helmet>
        <title>{t('employer:hiringPipeline')}</title>
      </Helmet>
      <div className="flex flex-wrap justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('employer:hiringPipeline')}</h1>
        <Link to={ROUTES.EMPLOYER_INTELLIGENCE_CANDIDATES} className="text-sm text-primary dark:text-mint hover:underline">
          {t('employer:candidateList')}
        </Link>
      </div>
      <p className="text-sm text-gray-500">{t('employer:pipelineReuseHint')}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col md:flex-row gap-3 md:overflow-x-auto pb-2">
        {stages.map((stage) => (
          <div key={stage} className="w-full md:min-w-[220px] md:max-w-[240px] md:shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              {stage} ({(columns[stage] || []).length})
            </div>
            <ul className="space-y-2">
              {(columns[stage] || []).map((c) => (
                <li key={c.legacyApplicationId}>
                  <Link
                    to={`${ROUTES.EMPLOYER_INTELLIGENCE_CANDIDATES}/${c.legacyApplicationId}`}
                    className="block rounded-lg border border-gray-100 dark:border-gray-800 p-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="text-sm font-medium truncate">{c.basic?.displayName || t('employer:unnamedCandidate')}</div>
                    <div className="text-xs text-gray-500">{c.ranking?.percent ?? '—'}% · {c.readiness?.overall ?? '—'}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
