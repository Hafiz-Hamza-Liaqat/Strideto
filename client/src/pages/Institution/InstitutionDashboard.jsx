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
    ['Profile completeness', `${data.profileCompleteness}%`, 'Completeness is not verification.'],
    ['Published Programs', data.publishedPrograms, 'Canonical published records.'],
    ['Draft Programs', data.draftPrograms, 'Institution-owned drafts.'],
    ['Open conflicts', data.openConflicts, 'Records awaiting data review.'],
  ];

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-blue-700">Institution dashboard</p>
        <h1 className="mt-1 break-words text-2xl font-bold text-slate-900 sm:text-3xl">{profile?.officialDisplayName || profile?.legalName || 'Your Institution'}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Manage source-backed Institution information. Server-side membership, verification, claim authority, and ownership checks remain authoritative.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge label="Organization verification" value={data.verificationStatus} />
        <StatusBadge label="Canonical claim" value={data.claimState || 'not_started'} />
        <StatusBadge label="Portal role" value={data.membership?.role} />
      </div>
      {data.verificationStatus !== 'approved' || data.claimState !== 'approved' ? (
        <PageState tone="warning"><strong>Publishing authority is not active.</strong> Verification is {humanize(data.verificationStatus)} and the canonical claim is {humanize(data.claimState || 'not started')}. You may prepare profile information, but privileged canonical publication remains server-blocked.</PageState>
      ) : <PageState tone="success">Approved verification and canonical claim authority are active. Program changes still follow review and provenance controls.</PageState>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, note]) => <Panel key={label}><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></Panel>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Next actions"><div className="flex flex-wrap gap-3"><Link className="font-semibold text-blue-700 underline" to={ROUTES.INSTITUTION_ONBOARDING}>Review verification</Link><Link className="font-semibold text-blue-700 underline" to={ROUTES.INSTITUTION_PROFILE}>Complete profile</Link><Link className="font-semibold text-blue-700 underline" to={ROUTES.INSTITUTION_PROGRAMS}>Manage Programs</Link></div></Panel>
        <Panel title="Capability boundaries"><ul className="space-y-2 text-sm text-slate-700"><li>Scholarship management: unavailable — no Institution route exists.</li><li>Institution commerce: not configured.</li><li>Student private data and Vault access: never available in this portal.</li></ul></Panel>
      </div>
    </div>
  );
}
