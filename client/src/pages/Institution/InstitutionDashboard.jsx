import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, humanize } from './InstitutionUi';

export default function InstitutionDashboard() {
  const { organizationId } = useInstitutionAuth();
  const [state, setState] = useState({ loading: true, data: null, profile: null, error: '' });

  useEffect(() => {
    let active = true;
    Promise.all([institutionPortalApi.dashboard(organizationId), institutionPortalApi.profile(organizationId)])
      .then(([dashboard, profile]) => active && setState({ loading: false, data: dashboard.data, profile: profile.data.profile, error: '' }))
      .catch((error) => active && setState({ loading: false, data: null, profile: null, error: error.response?.data?.error || 'Dashboard data is unavailable.' }));
    return () => { active = false; };
  }, [organizationId]);

  if (state.loading) return <PageState>Loading Institution dashboard…</PageState>;
  if (state.error) return <PageState tone="error" role="alert">{state.error} Refresh the page to retry.</PageState>;

  const { data, profile } = state;
  const cards = [
    ['Profile completeness', `${data.profileCompleteness}%`, 'Completeness is not verification.', ROUTES.INSTITUTION_PROFILE],
    ['Published Programs', data.publishedPrograms ?? 0, 'Canonical published records.', ROUTES.INSTITUTION_PROGRAMS],
    ['Draft Programs', data.draftPrograms ?? 0, 'Institution-owned drafts.', ROUTES.INSTITUTION_PROGRAMS],
    ['Internal applications', data.internalApplications ?? 0, 'Strideto-internal submissions only.', ROUTES.INSTITUTION_APPLICATIONS],
    ['Open conflicts', data.openConflicts ?? 0, 'Records awaiting data review.', ROUTES.INSTITUTION_DATA_QUALITY],
    ['Test Acceptance', data.testAcceptanceRecords ?? 0, 'Institution/program scope only.', ROUTES.INSTITUTION_TEST_ACCEPTANCE],
    ['Own scholarships', data.institutionOwnedScholarships ?? 0, 'Institution-owned awards only.', ROUTES.INSTITUTION_SCHOLARSHIPS],
    ['Launch plan', data.launchPlan || 'Free', 'Basic capabilities are free at launch.', ROUTES.INSTITUTION_BILLING],
  ];

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary">Institution dashboard</p>
        <h1 className="mt-1 break-words text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">{profile?.officialDisplayName || profile?.legalName || 'Your Institution'}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">Manage source-backed Institution information. Completeness is not verification. Canonical claim is separate from organization verification.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge label="Organization verification" value={data.verificationStatus} />
        <StatusBadge label="Canonical claim" value={data.claimState || 'not_started'} />
        <StatusBadge label="Portal role" value={data.membership?.role} />
      </div>
      {data.verificationStatus !== 'approved' || data.claimState !== 'approved' ? (
        <PageState tone="warning"><strong>Publishing authority is not active.</strong> Verification is {humanize(data.verificationStatus)} and the canonical claim is {humanize(data.claimState || 'not started')}. Privileged canonical publication remains server-blocked.</PageState>
      ) : <PageState tone="success">Approved verification and canonical claim authority are active. Program changes still follow review and provenance controls.</PageState>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, note, to]) => (
          <Panel key={label}>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{note}</p>
            {to ? <Link className="mt-2 inline-block text-sm text-primary underline" to={to}>Open</Link> : null}
          </Panel>
        ))}
      </div>
      <Panel title="Capability boundaries">
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>External application traffic: {data.externalApplicationTraffic || 'not_tracked'}.</li>
          <li>Student private data and Vault access: never available in this portal.</li>
          <li>Commerce provider: not configured. No wallet.</li>
        </ul>
      </Panel>
    </div>
  );
}
