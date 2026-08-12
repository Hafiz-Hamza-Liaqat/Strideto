import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { ADMISSION_STATES } from '../../../../shared/institution/institutionPortal.js';
import { PageState, Panel, StatusBadge, fieldClass, humanize, primaryButton, secondaryButton } from './InstitutionUi';
import { ROUTES } from '../../constants';

export default function InstitutionApplications() {
  const { organizationId } = useInstitutionAuth();
  const { applicationId } = useParams();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
  const [nextStatus, setNextStatus] = useState('under_review');
  const [note, setNote] = useState('');

  const load = (query = q, st = status) => institutionPortalApi.applications(organizationId, { q: query, status: st, page: 1, limit: 20 })
    .then(({ data }) => { setItems(data.applications || []); setPagination(data.pagination); setError(''); })
    .catch((err) => setError(err.response?.data?.error || 'Applications unavailable.'))
    .finally(() => setLoading(false));

  useEffect(() => {
    const st = searchParams.get('status') || '';
    setStatus(st);
    load('', st);
  }, [organizationId, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!applicationId) { setDetail(null); return; }
    institutionPortalApi.application(organizationId, applicationId)
      .then(({ data }) => setDetail(data.application))
      .catch((err) => setError(err.response?.data?.error || 'Application not found.'));
  }, [applicationId, organizationId]);

  const transition = async () => {
    try {
      const { data } = await institutionPortalApi.transitionApplication(organizationId, applicationId, {
        status: nextStatus,
        note,
        missingInformation: nextStatus === 'needs_information' ? note.split(',').map((s) => s.trim()).filter(Boolean) : [],
        version: detail?.version,
      });
      setDetail(data.application);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Transition failed.');
    }
  };

  if (loading) return <PageState>Loading admission applications…</PageState>;

  if (applicationId && detail) {
    return (
      <div className="space-y-6">
        <Link className="text-sm text-primary underline" to={ROUTES.INSTITUTION_APPLICATIONS}>Back to inbox</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Application</h1>
        {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
        <StatusBadge value={detail.status} />
        <Panel title="Applicant (consented snapshot only)">
          <p className="text-sm text-gray-800 dark:text-gray-200">{detail.snapshot?.displayName} · {detail.snapshot?.email}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Nationality {detail.snapshot?.nationality || '—'} · Residence {detail.snapshot?.countryOfResidence || '—'}</p>
          <p className="text-xs mt-2 text-gray-500">Consent scope: {detail.consentScope}. This is not a whole Student profile or Vault grant.</p>
        </Panel>
        <Panel title="Update status">
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Next state
            <select className={`${fieldClass} mt-1`} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
              {Object.values(ADMISSION_STATES).map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium text-gray-800 dark:text-gray-200">Note / missing information
            <textarea className={`${fieldClass} mt-1`} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button className={`${primaryButton} mt-3`} type="button" onClick={transition}>Apply Institution state</button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admission applications</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Internal Strideto submissions only. External-mode intakes do not fabricate applicant counts.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(q, status); }}>
        <input className={`${fieldClass} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search applicant name or email" aria-label="Search applications" />
        <select className={`${fieldClass} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
          <option value="">All statuses</option>
          {Object.values(ADMISSION_STATES).map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <button className={secondaryButton} type="submit">Filter</button>
        <button className={secondaryButton} type="button" onClick={() => { setQ(''); setStatus(''); load('', ''); }}>Reset</button>
      </form>
      {!items.length ? <PageState>No internal applications.</PageState> : (
        <ul className="space-y-3">
          {items.map((app) => (
            <li key={app._id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold text-gray-900 dark:text-white">{app.snapshot?.displayName || 'Applicant'}</p>
                <StatusBadge value={app.status} />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{app.snapshot?.email} · {app.intakeCycleLabel || 'Intake not specified'}</p>
              <Link className="text-sm text-primary underline" to={`/institution/applications/${app._id}`}>Open</Link>
            </li>
          ))}
        </ul>
      )}
      {pagination ? <p className="text-xs text-gray-500">Page {pagination.page} · {pagination.total} total</p> : null}
    </div>
  );
}
