import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '@shared/international/dateDisplay.js';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, fieldClass, primaryButton, secondaryButton } from './InstitutionUi';

export default function InstitutionPrograms() {
  const { organizationId } = useInstitutionAuth();
  const [programs, setPrograms] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [authority, setAuthority] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = (query = q) => Promise.all([
    institutionPortalApi.programs(organizationId, { q: query, page: 1, limit: 20 }),
    institutionPortalApi.dashboard(organizationId),
  ]).then(([programResponse, dashboardResponse]) => {
    setPrograms(programResponse.data.programs || []);
    setPagination(programResponse.data.pagination || null);
    setMessage(programResponse.data.message || '');
    setAuthority(dashboardResponse.data);
    setError('');
  }).catch((requestError) => setError(requestError.response?.data?.error || 'Programs are unavailable.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(''); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const canManage = authority?.verificationStatus === 'approved' && authority?.claimState === 'approved' && ['owner', 'admin', 'editor'].includes(authority?.membership?.role);

  if (loading) return <PageState>Loading Institution Programs…</PageState>;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Canonical education data</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Programs</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">Only Programs owned through this Institution’s approved canonical claim may be managed.</p>
        </div>
        {canManage ? <Link className={primaryButton} to={ROUTES.INSTITUTION_PROGRAM_NEW}>Create Program draft</Link> : null}
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <input className={`${fieldClass} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search programs" aria-label="Search programs" />
        <button className={secondaryButton} type="submit">Search</button>
        <button className={secondaryButton} type="button" onClick={() => { setQ(''); load(''); }}>Reset</button>
      </form>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {message ? <PageState tone="warning">{message}. Complete verification and canonical claim review before creating Programs.</PageState> : null}
      {!programs.length ? (
        <Panel><h2 className="font-semibold text-gray-900 dark:text-white">No Programs yet</h2><p className="mt-2 text-sm text-gray-600 dark:text-gray-400">No fake rows are shown. {canManage ? 'Create a source-backed draft when ready.' : 'Program creation is unavailable until authority is approved.'}</p></Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {programs.map((program) => (
            <article key={program._id} className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="min-w-0 break-words text-lg font-semibold text-gray-900 dark:text-white">{program.name}</h2>
                <StatusBadge value={program.status} />
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{program.degreeLevel || 'Degree level unknown'} · {program.studyMode || 'Study mode unknown'} · {program.country || 'Country unknown'}</p>
              <div className="mt-3 flex flex-wrap gap-2"><StatusBadge label="Freshness" value={program.freshnessState || 'unknown'} /></div>
              {program.tuition?.currency && Number.isInteger(program.tuition.amountMinor)
                ? <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-200">Tuition: {formatMoney(program.tuition)} {program.tuition.currency.toUpperCase()}</p>
                : <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Tuition amount: unknown</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {canManage ? <Link className={secondaryButton} to={`/institution/programs/${program._id}/edit`}>Edit Program</Link> : null}
                {canManage && program.status === 'draft' ? <button className={primaryButton} onClick={() => institutionPortalApi.submitProgram(organizationId, program._id).then(() => load(q)).catch((err) => setError(err.response?.data?.error || 'Submit failed'))}>Submit for review</button> : null}
              </div>
            </article>
          ))}
        </div>
      )}
      {pagination ? <p className="text-xs text-gray-500">Page {pagination.page} of {pagination.pages || 1} · {pagination.total} total</p> : null}
    </div>
  );
}
