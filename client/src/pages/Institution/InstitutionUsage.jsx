import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { ROUTES } from '../../constants';
import { PageState, Panel } from './InstitutionUi';

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Analytics / Usage</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Only actually tracked metrics. External-application traffic is not tracked.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Panel><p className="text-sm text-gray-500">Programs published</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.publishedPrograms ?? 0}</p></Panel>
        <Panel><p className="text-sm text-gray-500">Internal applications</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.internalApplications ?? 0}</p></Panel>
        <Panel><p className="text-sm text-gray-500">Data-quality issues</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{(data?.openConflicts || 0) + (data?.staleFacts || 0) + (data?.reviewDueFacts || 0)}</p></Panel>
        <Panel><p className="text-sm text-gray-500">Test Acceptance</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.testAcceptanceRecords ?? 0}</p></Panel>
        <Panel><p className="text-sm text-gray-500">Own scholarships</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.institutionOwnedScholarships ?? 0}</p></Panel>
        <Panel><p className="text-sm text-gray-500">External traffic</p><p className="text-lg font-semibold text-gray-900 dark:text-white">{data?.externalApplicationTraffic || 'not_tracked'}</p></Panel>
      </div>
      <Panel title="Internal application status distribution">
        {Object.entries(dist).map(([k, v]) => <p key={k} className="text-sm text-gray-800 dark:text-gray-200">{k}: {v}</p>)}
      </Panel>
      <Link className="text-sm text-primary underline" to={ROUTES.INSTITUTION_BILLING}>Billing</Link>
    </div>
  );
}
