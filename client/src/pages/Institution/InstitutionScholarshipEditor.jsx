import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ACADEMIC_FIELDS, DEGREE_LEVELS, STUDY_MODES, PUB_STATUSES } from '@shared/education/taxonomy.js';
import { FUNDING_TYPES, fundingTypeLabel } from '@shared/education/scholarshipIntelligence.js';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, fieldClass, humanize, primaryButton, secondaryButton } from './InstitutionUi';
import InstitutionPublishingGate, { canSubmitOrPublish, PublishingActionButton } from './InstitutionPublishingGate';

const initialForm = {
  title: '',
  summary: '',
  amountMinor: '',
  currency: '',
  fundingType: FUNDING_TYPES.FIXED_AMOUNT,
  deadlineDate: '',
  cycleLabel: '',
  sourceUrl: '',
  nationalityScope: '',
  eligibility: '',
  applicationUrl: '',
  degreeLevel: '',
  field: '',
  studyMode: '',
  applicableProgramIds: [],
  status: PUB_STATUSES.DRAFT,
  reviewFeedback: '',
};

export default function InstitutionScholarshipEditor() {
  const { scholarshipId } = useParams();
  const editing = Boolean(scholarshipId);
  const { organizationId } = useInstitutionAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [authority, setAuthority] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const requests = [
        institutionPortalApi.dashboard(organizationId),
        institutionPortalApi.programs(organizationId, { limit: 50 }),
      ];
      if (editing) requests.push(institutionPortalApi.scholarship(organizationId, scholarshipId));
      const [dashboard, programsRes, detail] = await Promise.all(requests);
      setAuthority(dashboard.data);
      setPrograms(programsRes.data.programs || []);
      if (detail?.data?.scholarship) {
        const item = detail.data.scholarship;
        setForm({
          ...initialForm,
          title: item.title || '',
          summary: item.summary || '',
          amountMinor: item.funding?.amountMinor ?? '',
          currency: item.funding?.currency || '',
          fundingType: item.funding?.type || FUNDING_TYPES.FIXED_AMOUNT,
          deadlineDate: item.deadlineDate || '',
          cycleLabel: item.cycleLabel || '',
          sourceUrl: item.sources?.[0]?.sourceUrl || '',
          nationalityScope: Array.isArray(item.nationalityScope) ? item.nationalityScope.join(', ') : '',
          eligibility: Array.isArray(item.criteria)
            ? item.criteria.map((c) => c.value || c.notes).filter(Boolean).join('\n')
            : '',
          applicationUrl: item.applicationUrl || '',
          degreeLevel: item.degreeLevels?.[0] || '',
          field: item.fields?.[0] || '',
          studyMode: item.studyModes?.[0] || '',
          applicableProgramIds: (item.applicableProgramIds || []).map((id) => String(id)),
          status: item.status || PUB_STATUSES.DRAFT,
          reviewFeedback: item.reviewFeedback || '',
        });
      }
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Scholarship editor is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [organizationId, scholarshipId]); // eslint-disable-line react-hooks/exhaustive-deps

  const canPublish = canSubmitOrPublish(authority);
  const canEditRole = authority?.claimState === 'approved' && ['owner', 'admin', 'editor'].includes(authority?.membership?.role);
  const editableStatus = !editing || form.status === PUB_STATUSES.DRAFT || form.status === PUB_STATUSES.NEEDS_CHANGES;
  const canEdit = canEditRole && editableStatus;

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const payload = () => ({
    title: form.title.trim(),
    summary: form.summary.trim(),
    funding: form.amountMinor !== ''
      ? { type: form.fundingType || FUNDING_TYPES.FIXED_AMOUNT, amountMinor: Number(form.amountMinor), currency: form.currency.toUpperCase() }
      : { type: form.fundingType || FUNDING_TYPES.UNKNOWN },
    deadlineDate: form.deadlineDate || undefined,
    cycleLabel: form.cycleLabel.trim(),
    sourceUrl: form.sourceUrl.trim(),
    nationalityScope: form.nationalityScope
      ? form.nationalityScope.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    eligibility: form.eligibility,
    applicationUrl: form.applicationUrl.trim(),
    degreeLevels: form.degreeLevel ? [form.degreeLevel] : [],
    fields: form.field ? [form.field] : [],
    studyModes: form.studyMode ? [form.studyMode] : [],
    applicableProgramIds: form.applicableProgramIds,
    scholarshipType: 'institutional',
  });

  const save = async (event) => {
    event.preventDefault();
    setNotice('');
    setError('');
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.sourceUrl.trim()) {
      setError('Source URL is required.');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await institutionPortalApi.updateScholarship(organizationId, scholarshipId, payload());
        setNotice('Draft saved on the same scholarship record. Submit for Admin review when ready.');
        await load();
      } else {
        const created = await institutionPortalApi.createScholarship(organizationId, payload());
        const id = created.data.scholarship?._id || created.data.scholarship?.id;
        setNotice('Draft created. Continue editing, then submit for review.');
        navigate(`/institution/scholarships/${id}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Scholarship could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const submitForReview = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await institutionPortalApi.submitScholarship(organizationId, scholarshipId);
      setNotice('Submitted for Admin review. You cannot self-publish.');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Scholarship could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  const toggleProgram = (programId) => {
    const id = String(programId);
    setForm((prev) => {
      const next = new Set(prev.applicableProgramIds.map(String));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, applicableProgramIds: [...next] };
    });
  };

  if (loading) return <PageState>Loading scholarship editor…</PageState>;

  if (!canEditRole) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scholarship authority unavailable</h1>
        <InstitutionPublishingGate authority={authority} action="scholarship create or edit" />
        <Link className={secondaryButton} to={ROUTES.INSTITUTION_SCHOLARSHIPS}>Back to Scholarships</Link>
      </div>
    );
  }

  if (editing && !editableStatus) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scholarship locked</h1>
        <PageState tone="warning">
          Status is <StatusBadge value={form.status} />. Edit is allowed only for draft or needs_changes. Wait for Admin decision or correct after a needs_changes return.
        </PageState>
        {form.reviewFeedback ? (
          <Panel title="Admin feedback">
            <p className="text-sm text-gray-800 dark:text-gray-200">{form.reviewFeedback}</p>
          </Panel>
        ) : null}
        <Link className={secondaryButton} to={ROUTES.INSTITUTION_SCHOLARSHIPS}>Back to Scholarships</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary">Institution-owned scholarship</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {editing ? 'Edit scholarship draft' : 'Create scholarship draft'}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Ownership is enforced by your approved canonical claim. Corrections update the same record — no duplicates.
        </p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {notice ? <PageState tone="success">{notice}</PageState> : null}
      <InstitutionPublishingGate authority={authority} action="scholarship submit" />

      {form.reviewFeedback && form.status === PUB_STATUSES.NEEDS_CHANGES ? (
        <Panel title="Changes requested">
          <p className="text-sm text-gray-800 dark:text-gray-200">{form.reviewFeedback}</p>
          <p className="text-xs text-gray-500 mt-2">Correct this scholarship, save, then resubmit for review.</p>
        </Panel>
      ) : null}

      {editing ? <StatusBadge value={form.status} /> : null}

      <Panel title="Scholarship details">
        <form className="grid min-w-0 gap-4 sm:grid-cols-2" onSubmit={save}>
          <label className="sm:col-span-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            Title
            <input required className={`${fieldClass} mt-1`} value={form.title} onChange={set('title')} disabled={!canEdit} />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Funding type
            <select className={`${fieldClass} mt-1`} value={form.fundingType} onChange={set('fundingType')} disabled={!canEdit}>
              {Object.values(FUNDING_TYPES).map((v) => <option key={v} value={v}>{fundingTypeLabel(v)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Amount (minor units)
            <input type="number" min="0" step="1" className={`${fieldClass} mt-1`} value={form.amountMinor} onChange={set('amountMinor')} disabled={!canEdit} />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Currency
            <input maxLength={3} className={`${fieldClass} mt-1`} value={form.currency} onChange={set('currency')} disabled={!canEdit} />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Cycle / term
            <input className={`${fieldClass} mt-1`} value={form.cycleLabel} onChange={set('cycleLabel')} placeholder="Fall 2027" disabled={!canEdit} />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Deadline
            <input type="date" className={`${fieldClass} mt-1`} value={form.deadlineDate} onChange={set('deadlineDate')} disabled={!canEdit} />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Degree level
            <select className={`${fieldClass} mt-1`} value={form.degreeLevel} onChange={set('degreeLevel')} disabled={!canEdit}>
              <option value="">—</option>
              {Object.values(DEGREE_LEVELS).map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Field
            <select className={`${fieldClass} mt-1`} value={form.field} onChange={set('field')} disabled={!canEdit}>
              <option value="">—</option>
              {Object.values(ACADEMIC_FIELDS).map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Study mode
            <select className={`${fieldClass} mt-1`} value={form.studyMode} onChange={set('studyMode')} disabled={!canEdit}>
              <option value="">—</option>
              {Object.values(STUDY_MODES).map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            Source URL
            <input required type="url" className={`${fieldClass} mt-1`} value={form.sourceUrl} onChange={set('sourceUrl')} disabled={!canEdit} />
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            Application URL
            <input type="url" className={`${fieldClass} mt-1`} value={form.applicationUrl} onChange={set('applicationUrl')} disabled={!canEdit} />
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            Nationality / residence scope
            <input className={`${fieldClass} mt-1`} value={form.nationalityScope} onChange={set('nationalityScope')} disabled={!canEdit} />
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            Eligibility
            <textarea className={`${fieldClass} mt-1`} rows={3} value={form.eligibility} onChange={set('eligibility')} disabled={!canEdit} />
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            Summary
            <textarea className={`${fieldClass} mt-1`} rows={3} value={form.summary} onChange={set('summary')} disabled={!canEdit} />
          </label>

          <div className="sm:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-sm font-medium mb-2">Applicable programs (canonical)</p>
            <p className="text-xs text-gray-500 mb-2">Select from your Institution programs. IDs persist on save.</p>
            {!programs.length ? (
              <p className="text-sm text-gray-500">No Institution programs yet.</p>
            ) : (
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {programs.map((p) => (
                  <li key={p._id}>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={form.applicableProgramIds.map(String).includes(String(p._id))}
                        onChange={() => toggleProgram(p._id)}
                      />
                      {p.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button className={primaryButton} disabled={!canEdit || busy} type="submit">
              {busy ? 'Saving…' : 'Save draft'}
            </button>
            {editing && (form.status === PUB_STATUSES.DRAFT || form.status === PUB_STATUSES.NEEDS_CHANGES) ? (
              <PublishingActionButton authority={authority} busy={busy} onClick={submitForReview}>
                Submit for review
              </PublishingActionButton>
            ) : null}
            <Link className={secondaryButton} to={ROUTES.INSTITUTION_SCHOLARSHIPS}>Back</Link>
          </div>
        </form>
      </Panel>
      {!canPublish ? (
        <PageState tone="warning">Submit stays locked until verification and canonical claim are approved.</PageState>
      ) : null}
    </div>
  );
}
