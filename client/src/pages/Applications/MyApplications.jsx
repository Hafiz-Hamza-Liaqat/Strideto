import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { applicationsApi } from '../../services/applicationsApi';
import { ApplicationCard } from '../../components/applications/ApplicationCard';
import { ApplicationKanbanBoard } from '../../components/applications/ApplicationKanbanBoard';
import { ApplicationTable } from '../../components/applications/ApplicationTable';
import { ApplicationCalendarView } from '../../components/applications/ApplicationCalendarView';
import { ApplicationMetricsStrip } from '../../components/applications/ApplicationMetricsStrip';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { isOpportunityApplicationEnabled } from '../../config/careerFeatureFlags';
import { PIPELINE_STAGES } from '@shared/career/constants.js';
import {
  OPPORTUNITY_TYPE_FILTERS,
  CHANNEL_FILTERS,
  SORT_OPTIONS,
  filterApplications,
  sortApplications,
} from '../../utils/applicationUi';
import { EmptyState } from '../../components/common/EmptyState';

const VIEWS = ['list', 'kanban', 'table', 'calendar'];

export default function MyApplications() {
  const { t } = useTranslation(['applications', 'common']);
  const [applications, setApplications] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortId, setSortId] = useState('updated_desc');
  const [view, setView] = useState('kanban');

  const reload = useCallback(() => {
    return Promise.all([
      applicationsApi.list().then(({ data }) => setApplications(data.data || [])),
      applicationsApi.getMetrics().then(({ data }) => setMetrics(data)).catch(() => setMetrics(null)),
    ]);
  }, []);

  useEffect(() => {
    if (!isOpportunityApplicationEnabled()) {
      setLoading(false);
      return;
    }
    reload()
      .catch((err) => setError(err.response?.data?.error || t('applications:loadError')))
      .finally(() => setLoading(false));
  }, [t, reload]);

  const visible = useMemo(() => {
    let list = filterApplications(applications, { type: typeFilter, query: search, channel: channelFilter });
    if (stageFilter !== 'all') {
      list = list.filter((a) => a.pipelineStage === stageFilter);
    }
    return sortApplications(list, sortId);
  }, [applications, typeFilter, channelFilter, stageFilter, search, sortId]);

  async function handleMoveStage(app, toStage) {
    try {
      await applicationsApi.transitionStage(app._id, { toStage });
      await reload();
    } catch (err) {
      setError(err.response?.data?.error || t('applications:tracker.stageError'));
    }
  }

  if (!isOpportunityApplicationEnabled()) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <SeoHead title={t('applications:title')} noindex />
        <p className="text-gray-600 dark:text-gray-400" role="alert">{t('applications:featureDisabled')}</p>
      </div>
    );
  }

  return (
    <>
      <SeoHead title={t('applications:title')} description={t('applications:subtitle')} noindex />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 min-w-0 w-full">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{t('applications:title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{t('applications:subtitle')}</p>
          </div>
          <Link
            to={ROUTES.APPLICATIONS_NEW}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary text-white font-medium text-sm min-h-[44px] hover:bg-primary-hover"
          >
            {t('applications:createApplication')}
          </Link>
        </header>

        {!loading && <ApplicationMetricsStrip metrics={metrics} className="mb-6" />}

        <div className="flex flex-col lg:flex-row gap-3 mb-4">
          <div className="flex-1">
            <label htmlFor="app-search" className="sr-only">{t('applications:searchLabel')}</label>
            <input
              id="app-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('applications:searchPlaceholder')}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
          <select
            value={sortId}
            onChange={(e) => setSortId(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm min-h-[44px]"
            aria-label={t('applications:sortLabel')}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{t(`applications:sort.${opt.id}`)}</option>
            ))}
          </select>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm min-h-[44px]"
            aria-label={t('applications:filters.channelLabel')}
          >
            {CHANNEL_FILTERS.map((ch) => (
              <option key={ch} value={ch}>
                {ch === 'all' ? t('applications:filters.all') : t(`applications:filters.${ch}`)}
              </option>
            ))}
          </select>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm min-h-[44px]"
            aria-label={t('applications:stageFilterLabel')}
          >
            <option value="all">{t('applications:filters.allStages')}</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>{t(`applications:stages.${s}`)}</option>
            ))}
          </select>
        </div>

        <nav aria-label={t('applications:filterLabel')} className="flex flex-wrap gap-2 mb-4">
          {OPPORTUNITY_TYPE_FILTERS.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              aria-pressed={typeFilter === type}
              className={`px-3 py-2 rounded-lg text-sm font-medium min-h-[44px] ${
                typeFilter === type
                  ? 'bg-primary text-white'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t(`applications:filters.${type}`)}
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label={t('applications:views.label')}>
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`px-3 py-2 rounded-lg text-sm font-medium min-h-[44px] ${
                view === v
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'border border-gray-300 dark:border-gray-600'
              }`}
            >
              {t(`applications:views.${v}`)}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-3" aria-busy="true">
            <ListingCardSkeleton />
            <ListingCardSkeleton />
          </div>
        )}

        {error && !loading && (
          <p className="text-red-600 dark:text-red-400 mb-4" role="alert">{error}</p>
        )}

        {!loading && visible.length === 0 && (
          <EmptyState
            icon="📋"
            title="You haven't applied yet"
            description="Start exploring opportunities today and track every application in one place."
            actionLabel="Explore Opportunities"
            actionTo={ROUTES.JOBS}
          />
        )}

        {!loading && visible.length > 0 && view === 'list' && (
          <ul className="space-y-3" role="list">
            {visible.map((app) => (
              <li key={app._id}><ApplicationCard application={app} /></li>
            ))}
          </ul>
        )}

        {!loading && visible.length > 0 && view === 'kanban' && (
          <ApplicationKanbanBoard applications={visible} onMoveStage={handleMoveStage} />
        )}

        {!loading && visible.length > 0 && view === 'table' && (
          <ApplicationTable applications={visible} />
        )}

        {!loading && view === 'calendar' && (
          <ApplicationCalendarView applications={visible} />
        )}
      </div>
    </>
  );
}
