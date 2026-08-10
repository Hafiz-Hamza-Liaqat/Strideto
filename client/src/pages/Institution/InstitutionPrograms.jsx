import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '@shared/international/dateDisplay.js';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, primaryButton, secondaryButton } from './InstitutionUi';

export default function InstitutionPrograms() {
  const { organizationId } = useInstitutionAuth();
  const [programs, setPrograms] = useState([]);
  const [authority, setAuthority] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => Promise.all([institutionPortalApi.programs(organizationId), institutionPortalApi.dashboard(organizationId)])
    .then(([programResponse, dashboardResponse]) => { setPrograms(programResponse.data.programs || []); setMessage(programResponse.data.message || ''); setAuthority(dashboardResponse.data); setError(''); })
    .catch((requestError) => setError(requestError.response?.data?.error || 'Programs are unavailable.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const canManage = authority?.verificationStatus === 'approved' && authority?.claimState === 'approved' && ['owner', 'admin', 'editor'].includes(authority?.membership?.role);

  const submit = async (programId) => {
    try { await institutionPortalApi.submitProgram(organizationId, programId); await load(); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Program could not be submitted.'); }
  };

  if (loading) return <PageState>Loading Institution Programs…</PageState>;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-blue-700">Canonical education data</p><h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Programs</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Only Programs owned through this Institution’s approved canonical claim may be managed.</p></div>{canManage ? <Link className={primaryButton} to={ROUTES.INSTITUTION_PROGRAM_NEW}>Create Program draft</Link> : null}</div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}{message ? <PageState tone="warning">{message}. Complete verification and canonical claim review before creating Programs.</PageState> : null}
      {!programs.length ? <Panel><h2 className="font-semibold text-slate-900">No Programs yet</h2><p className="mt-2 text-sm text-slate-600">No fake rows are shown. {canManage ? 'Create a source-backed draft when ready.' : 'Program creation is unavailable until authority is approved.'}</p></Panel> : (
        <div className="grid gap-4 lg:grid-cols-2">{programs.map((program) => <article key={program._id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-semibold text-slate-900">{program.name}</h2><StatusBadge value={program.status} /></div><p className="mt-2 text-sm text-slate-600">{program.degreeLevel || 'Degree level unknown'} · {program.studyMode || 'Study mode unknown'} · {program.country || 'Country unknown'}</p><div className="mt-3 flex flex-wrap gap-2"><StatusBadge label="Freshness" value={program.freshnessState || 'unknown'} /><StatusBadge label="Source" value={program.sources?.[0]?.sourceType || 'institution_official'} /></div>{program.tuition?.currency && Number.isInteger(program.tuition.amountMinor) ? <p className="mt-3 break-words text-sm font-semibold text-slate-800">Tuition: {formatMoney(program.tuition)} {program.tuition.currency.toUpperCase()} {program.tuition.per ? `per ${program.tuition.per}` : ''}</p> : <p className="mt-3 text-sm text-slate-600">Tuition amount: unknown</p>}<p className="mt-2 text-sm text-slate-600">Intakes: {program.intakes?.length ? program.intakes.map((intake) => intake.cycleLabel).filter(Boolean).join(', ') : 'None recorded'}</p><div className="mt-4 flex flex-wrap gap-2">{canManage ? <Link className={secondaryButton} to={`/institution/programs/${program._id}/edit`}>Edit Program</Link> : null}{canManage && program.status === 'draft' ? <button className={primaryButton} onClick={() => submit(program._id)}>Submit for review</button> : null}</div></article>)}</div>
      )}
      <Panel title="Scholarships"><PageState role="note">Institution scholarship management is unavailable because Mission 18 exposes no Institution scholarship route. No fake create/edit control is shown.</PageState></Panel>
    </div>
  );
}
