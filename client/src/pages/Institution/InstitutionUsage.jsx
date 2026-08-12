import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ADMISSION_STATES } from '@shared/institution/institutionPortal.js';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { ROUTES } from '../../constants';
import { PageState, Panel, humanize } from './InstitutionUi';

const PIPELINE_ORDER = [
  ADMISSION_STATES.RECEIVED,
  ADMISSION_STATES.UNDER_REVIEW,
  ADMISSION_STATES.NEEDS_INFORMATION,
  ADMISSION_STATES.SHORTLISTED,
  ADMISSION_STATES.INTERVIEW,
  ADMISSION_STATES.OFFER,
  ADMISSION_STATES.ADMITTED,
  ADMISSION_STATES.REJECTED,
  ADMISSION_STATES.WITHDRAWN,
];

export default function InstitutionUsage() {
  const { organizationId } = useInstitutionAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    institutionPortalApi.dashboard(organizationId)
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.error || 'Unable to load usage.'));
  }, [organizationId]);

  if (!data && !error) return <PageState>Loading analytics / usage…</PageState>;

  const dist = data?.applicationStatusDistribution || {};
  const pipelineTotal = PIPELINE_ORDER.reduce((sum, key) => sum + (dist[key] || 0), 0);
  const activeReviewTotal = (dist[ADMISSION_STATES.RECEIVED] || 0)
    + (dist[ADMISSION_STATES.UNDER_REVIEW] || 0)
    + (dist[ADMISSION_STATES.NEEDS_INFORMATION] || 0)
    + (dist[ADMISSION_STATES.SHORTLISTED] || 0)
    + (dist[ADMISSION_STATES.INTERVIEW] || 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Analytics / Usage</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Only actually tracked metrics. External-application traffic is not tracked.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Panel><p className="text-sm text-gray-500 dark:text-gray-400">Programs published</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.publishedPrograms ?? 0}</p></Panel>
        <Panel><p className="text-sm text-gray-500 dark:text-gray-400">Internal applications</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.internalApplications ?? 0}</p></Panel>
        <Panel><p className="text-sm text-gray-500 dark:text-gray-400">In active review</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{activeReviewTotal}</p></Panel>
        <Panel><p className="text-sm text-gray-500 dark:text-gray-400">Data-quality issues</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{(data?.openConflicts || 0) + (data?.staleFacts || 0) + (data?.reviewDueFacts || 0)}</p></Panel>
        <Panel><p className="text-sm text-gray-500 dark:text-gray-400">Test Acceptance</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.testAcceptanceRecords ?? 0}</p></Panel>
        <Panel><p className="text-sm text-gray-500 dark:text-gray-400">Own scholarships</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.institutionOwnedScholarships ?? 0}</p></Panel>
        <Panel><p className="text-sm text-gray-500 dark:text-gray-400">External traffic</p><p className="text-lg font-semibold text-gray-900 dark:text-white">{data?.externalApplicationTraffic || 'not_tracked'}</p></Panel>
      </div>

      <Panel title="Internal admissions pipeline">
        {pipelineTotal === 0 ? (
          <PageState>No internal applications yet. Counts use canonical admission states only.</PageState>
        ) : (
          <div className="space-y-3">
            {PIPELINE_ORDER.map((state) => {
              const count = dist[state] || 0;
              const width = pipelineTotal ? Math.max(4, Math.round((count / pipelineTotal) * 100)) : 0;
              const filterHref = `${ROUTES.INSTITUTION_APPLICATIONS}?status=${encodeURIComponent(state)}`;
              return (
                <Link
                  key={state}
                  to={filterHref}
                  className="block rounded-lg p-1 -mx-1 transition hover:bg-gray-50 dark:hover:bg-gray-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label={`View ${humanize(state)} applications (${count})`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800 dark:text-gray-200 underline decoration-primary/40 underline-offset-2">{humanize(state)}</span>
                    <span className="tabular-nums text-gray-600 dark:text-gray-400">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <Link className="mt-4 inline-block text-sm text-primary underline" to={ROUTES.INSTITUTION_APPLICATIONS}>Open admissions inbox</Link>
      </Panel>

      <Link className="text-sm text-primary underline" to={ROUTES.INSTITUTION_BILLING}>Billing</Link>
    </div>
  );
}
