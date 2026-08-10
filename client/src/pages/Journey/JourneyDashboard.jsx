import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDashboard } from '../../services/actionEngineService';
import { ROUTES } from '../../constants';

const URGENCY_COLORS = {
  overdue: 'text-red-600 dark:text-red-400',
  urgent: 'text-orange-600 dark:text-orange-400',
  soon: 'text-yellow-600 dark:text-yellow-400',
  upcoming: 'text-blue-600 dark:text-blue-400',
};

function UrgencyBadge({ urgency }) {
  const color = URGENCY_COLORS[urgency] || 'text-gray-500';
  return <span className={`text-xs font-medium uppercase ${color}`}>{urgency}</span>;
}

function NextBestActionCard({ nba }) {
  const { t } = useTranslation('common');
  if (!nba) return null;
  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5">
      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase mb-1">{t('journey.nextBestAction', 'Next Best Action')}</p>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{nba.action}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{nba.reason}</p>
      <div className="flex items-center gap-3">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${nba.priority === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : nba.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
          {nba.priority}
        </span>
        {nba.dueDate && <span className="text-xs text-gray-500 dark:text-gray-400">Due: {new Date(nba.dueDate).toLocaleDateString()}</span>}
        {nba.freshnessWarning && <span className="text-xs text-yellow-600 dark:text-yellow-400" title={nba.freshnessWarning}>⚠ Source may be outdated</span>}
        {nba.ctaRoute && (
          <Link to={nba.ctaRoute} className="ml-auto text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
            {t('journey.takeAction', 'Take action →')}
          </Link>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">{children}</h2>;
}

export default function JourneyDashboard() {
  const { t } = useTranslation('common');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => setError(t('journey.loadError', 'Could not load your journey dashboard.')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">{t('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  const { nextBestAction, pendingActions = [], upcomingDeadlines = [], overdueDeadlines = [], activeApplications = [], savedOpportunities = [] } = data || {};

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('journey.dashboard', 'My Journey')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('journey.dashboardSubtitle', 'Your personalized action plan and progress tracker.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={ROUTES.JOURNEY_TASKS} className="inline-flex min-h-[44px] items-center text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
            {t('journey.tasks', 'Tasks')}
          </Link>
          <Link to={ROUTES.JOURNEY_DEADLINES} className="inline-flex min-h-[44px] items-center text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
            {t('journey.deadlines', 'Deadlines')}
          </Link>
          <Link to={ROUTES.JOURNEY_APPLICATIONS} className="inline-flex min-h-[44px] items-center text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
            {t('journey.applications', 'Applications')}
          </Link>
        </div>
      </div>

      {/* Next Best Action */}
      {nextBestAction && <NextBestActionCard nba={nextBestAction} />}
      {!nextBestAction && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-center text-gray-500 dark:text-gray-400">
          {t('journey.nbaEmpty', 'No priority actions right now. Explore opportunities or review your profile.')}
        </div>
      )}

      {/* Overdue */}
      {overdueDeadlines.length > 0 && (
        <section>
          <SectionTitle>{t('journey.overdue', 'Overdue')}</SectionTitle>
          <ul className="space-y-2">
            {overdueDeadlines.map((d) => (
              <li key={d._id} className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-3">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{d.title}</span>
                <div className="flex items-center gap-2">
                  {d.deadlineAt && <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(d.deadlineAt).toLocaleDateString()}</span>}
                  <UrgencyBadge urgency="overdue" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Upcoming deadlines */}
      {upcomingDeadlines.length > 0 && (
        <section>
          <SectionTitle>{t('journey.upcomingDeadlines', 'Upcoming Deadlines')}</SectionTitle>
          <ul className="space-y-2">
            {upcomingDeadlines.map((d) => (
              <li key={d._id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{d.title}</span>
                <div className="flex items-center gap-2">
                  {d.deadlineAt && <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(d.deadlineAt).toLocaleDateString()}{d.isDateOnly && ' (date only)'}</span>}
                  {d.urgency && <UrgencyBadge urgency={d.urgency} />}
                </div>
              </li>
            ))}
          </ul>
          <Link to={ROUTES.JOURNEY_DEADLINES} className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {t('journey.viewAll', 'View all deadlines →')}
          </Link>
        </section>
      )}

      {/* Pending tasks */}
      {pendingActions.length > 0 && (
        <section>
          <SectionTitle>{t('journey.pendingTasks', 'Pending Tasks')}</SectionTitle>
          <ul className="space-y-2">
            {pendingActions.slice(0, 5).map((a) => (
              <li key={a._id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.title}</span>
                <div className="flex items-center gap-2">
                  {a.dueAt && <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(a.dueAt).toLocaleDateString()}</span>}
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{a.status}</span>
                </div>
              </li>
            ))}
          </ul>
          <Link to={ROUTES.JOURNEY_TASKS} className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {t('journey.viewAllTasks', 'View all tasks →')}
          </Link>
        </section>
      )}

      {/* Active applications */}
      {activeApplications.length > 0 && (
        <section>
          <SectionTitle>{t('journey.activeApplications', 'Active Applications')}</SectionTitle>
          <ul className="space-y-2">
            {activeApplications.map((app) => (
              <li key={app._id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{app.targetTitle || app.targetType}</p>
                  {app.targetInstitution && <p className="text-xs text-gray-500 dark:text-gray-400">{app.targetInstitution}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{app.status.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
          <Link to={ROUTES.JOURNEY_APPLICATIONS} className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {t('journey.viewAllApplications', 'View all applications →')}
          </Link>
        </section>
      )}

      {/* Saved opportunities */}
      {savedOpportunities.length > 0 && (
        <section>
          <SectionTitle>{t('journey.savedOpportunities', 'Saved Opportunities')}</SectionTitle>
          <ul className="space-y-2">
            {savedOpportunities.slice(0, 4).map((s) => (
              <li key={s._id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{s.entityType.replace(/_/g, ' ')}</span>
                <span className="text-xs text-gray-400">{s.entityId}</span>
              </li>
            ))}
          </ul>
          <Link to={ROUTES.JOURNEY_SAVED} className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {t('journey.viewAllSaved', 'View all saved →')}
          </Link>
        </section>
      )}

      {/* Empty state */}
      {pendingActions.length === 0 && upcomingDeadlines.length === 0 && activeApplications.length === 0 && savedOpportunities.length === 0 && !nextBestAction && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium mb-2">{t('journey.emptyTitle', 'Your journey starts here')}</p>
          <p className="text-sm">{t('journey.emptyBody', 'Complete your profile and explore programs and scholarships to get personalized guidance.')}</p>
          <Link to="/talent-profile" className="mt-4 inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">
            {t('journey.completeProfile', 'Complete Profile')}
          </Link>
        </div>
      )}
    </div>
  );
}
