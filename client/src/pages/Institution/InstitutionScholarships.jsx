import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PUB_STATUSES } from '@shared/education/taxonomy.js';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { ROUTES } from '../../constants';
import { PageState, Panel, StatusBadge, fieldClass, primaryButton, secondaryButton } from './InstitutionUi';
import InstitutionPublishingGate, { canSubmitOrPublish, PublishingActionButton } from './InstitutionPublishingGate';

export default function InstitutionScholarships() {
  const { organizationId } = useInstitutionAuth();
  const [items, setItems] = useState([]);
  const [authority, setAuthority] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [q, setQ] = useState('');

  const load = (query = q) => Promise.all([
    institutionPortalApi.scholarships(organizationId, { q: query }),
    institutionPortalApi.dashboard(organizationId),
  ])
    .then(([scholarshipRes, dashboardRes]) => {
      setItems(scholarshipRes.data.scholarships || []);
      setAuthority(dashboardRes.data);
      setError('');
    })
    .catch((err) => setError(err.response?.data?.error || 'Unable to load scholarships.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(''); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitForReview = async (scholarshipId) => {
    setError(''); setNotice(''); setSubmittingId(scholarshipId);
    try {
      await institutionPortalApi.submitScholarship(organizationId, scholarshipId);
      setNotice('Scholarship submitted for Admin review. It appears on /scholarships only after Admin publishes it.');
      await load(q);
    } catch (err) {
      setError(err.response?.data?.error || 'Scholarship could not be submitted.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) return <PageState>Loading scholarships…</PageState>;
  const canCreate = canSubmitOrPublish(authority);
  const canEdit = authority?.claimState === 'approved' && ['owner', 'admin', 'editor'].includes(authority?.membership?.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scholarships & funding</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Verified + canonically claimed Institutions manage their own scholarships. Draft → submit → Admin publish. No self-publish.
          </p>
        </div>
        {canEdit ? (
          <Link className={primaryButton} to={`${ROUTES.INSTITUTION_SCHOLARSHIPS}/new`}>
            {canCreate ? 'Create scholarship' : 'Prepare draft'}
          </Link>
        ) : null}
      </div>
      <InstitutionPublishingGate authority={authority} action="scholarship create or submit" />
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {notice ? <PageState tone="success">{notice}</PageState> : null}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <input className={`${fieldClass} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search scholarships" aria-label="Search scholarships" />
        <button className={secondaryButton} type="submit">Search</button>
        <button className={secondaryButton} type="button" onClick={() => { setQ(''); load(''); }}>Reset</button>
      </form>
      {!items.length ? <PageState>No Institution-owned scholarships.</PageState> : items.map((s) => {
        const canOpenEditor = s.status === PUB_STATUSES.DRAFT || s.status === PUB_STATUSES.NEEDS_CHANGES;
        return (
          <Panel key={s._id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{s.title}</p>
                <StatusBadge value={s.status} />
                <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                  {s.cycleLabel || 'Cycle not specified'} · Deadline {s.deadlineDate || '—'}
                </p>
                {s.reviewFeedback && s.status === PUB_STATUSES.NEEDS_CHANGES ? (
                  <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">Admin feedback: {s.reviewFeedback}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit && canOpenEditor ? (
                  <Link className={secondaryButton} to={`${ROUTES.INSTITUTION_SCHOLARSHIPS}/${s._id}/edit`}>Edit</Link>
                ) : null}
                {canEdit && (s.status === PUB_STATUSES.DRAFT || s.status === PUB_STATUSES.NEEDS_CHANGES) ? (
                  <PublishingActionButton
                    authority={authority}
                    busy={submittingId === s._id}
                    onClick={() => submitForReview(s._id)}
                  >
                    Submit for review
                  </PublishingActionButton>
                ) : null}
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
