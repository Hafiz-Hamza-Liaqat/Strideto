import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminSelectBare, adminFieldClass } from '../../components/admin/AdminFormFields';
import { AdminViewPublicLink } from '../../components/admin/AdminViewPublicLink';
import { CanonicalInstitutionPicker } from '../../components/admin/CanonicalInstitutionPicker';
import { adminEducationScholarshipsApi } from '../../services/adminEducationScholarshipsApi';
import { adminEducationProgramsApi } from '../../services/adminEducationProgramsApi';
import { ROUTES } from '../../constants';
import { EscapeWhen } from '../../a11y/EscapeWhen';
import {
  DEGREE_LEVELS,
  ACADEMIC_FIELDS,
  PUB_STATUSES,
} from '@shared/education/taxonomy.js';
import {
  SCHOLARSHIP_TYPES,
  FUNDING_TYPES,
  fundingTypeLabel,
} from '@shared/education/scholarshipIntelligence.js';
import { isInstitutionCanonicalScholarshipPublicReady } from '@shared/cms/publicReadiness.js';

const EMPTY = {
  institutionId: '',
  title: '',
  slug: '',
  scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL,
  providerName: '',
  fundingType: FUNDING_TYPES.UNKNOWN,
  amountMinor: '',
  currency: '',
  degreeLevels: [],
  fields: [],
  summary: '',
  eligibility: '',
  cycleLabel: '',
  deadlineDate: '',
  applicationUrl: '',
  sourceUrl: '',
  sourceType: 'institution_official',
  sourcePublisher: '',
  applicableProgramIds: [],
  status: PUB_STATUSES.DRAFT,
  reviewFeedback: '',
  adminNotes: '',
};

function institutionFromRow(row) {
  return row?.institutionId && typeof row.institutionId === 'object' ? row.institutionId : null;
}

function toForm(doc) {
  const sources = Array.isArray(doc.sources) ? doc.sources : [];
  const first = sources[0] || {};
  const funding = doc.funding || {};
  const criteria = Array.isArray(doc.criteria) ? doc.criteria : [];
  return {
    ...EMPTY,
    institutionId: doc.institutionId?._id || doc.institutionId || '',
    title: doc.title || '',
    slug: doc.slug || '',
    scholarshipType: doc.scholarshipType || SCHOLARSHIP_TYPES.INSTITUTIONAL,
    providerName: doc.provider?.name || '',
    fundingType: funding.type || FUNDING_TYPES.UNKNOWN,
    amountMinor: funding.amountMinor ?? '',
    currency: funding.currency || '',
    degreeLevels: Array.isArray(doc.degreeLevels) ? doc.degreeLevels : [],
    fields: Array.isArray(doc.fields) ? doc.fields : [],
    summary: doc.summary || '',
    eligibility: criteria.map((c) => c.value || c.notes).filter(Boolean).join('\n'),
    cycleLabel: doc.cycleLabel || '',
    deadlineDate: doc.deadlineDate || '',
    applicationUrl: doc.applicationUrl || '',
    sourceUrl: first.sourceUrl || '',
    sourceType: first.sourceType || 'institution_official',
    sourcePublisher: first.publisher || '',
    applicableProgramIds: (doc.applicableProgramIds || []).map((id) => String(id._id || id)),
    status: doc.status || PUB_STATUSES.DRAFT,
    reviewFeedback: doc.reviewFeedback || '',
    adminNotes: doc.adminNotes || '',
  };
}

function buildPayload(form, { status } = {}) {
  const sources = form.sourceUrl?.trim()
    ? [{
      sourceType: form.sourceType || 'institution_official',
      sourceUrl: form.sourceUrl.trim(),
      publisher: form.sourcePublisher || '',
    }]
    : [];
  const criteria = String(form.eligibility || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => ({ criteriaType: 'other', value, notes: value }));
  return {
    institutionId: form.institutionId || undefined,
    title: form.title,
    slug: form.slug || undefined,
    scholarshipType: form.scholarshipType,
    providerName: form.providerName,
    funding: {
      type: form.fundingType,
      amountMinor: form.amountMinor === '' ? null : Number(form.amountMinor),
      currency: form.currency,
    },
    degreeLevels: form.degreeLevels,
    fields: form.fields,
    summary: form.summary,
    criteria,
    cycleLabel: form.cycleLabel,
    deadlineDate: form.deadlineDate,
    applicationUrl: form.applicationUrl,
    applicableProgramIds: form.applicableProgramIds,
    sources,
    status: status || form.status,
    reviewFeedback: form.reviewFeedback,
    adminNotes: form.adminNotes,
  };
}

function scopeLabel(row) {
  const programs = Array.isArray(row.applicableProgramIds) ? row.applicableProgramIds.length : 0;
  if (programs > 0) return `Program-scoped (${programs})`;
  if (row.cycleLabel) return `Cycle: ${row.cycleLabel}`;
  return 'Institution-wide';
}

export default function AdminEducationScholarships() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_UNIVERSITIES);

  const {
    data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch,
  } = useAdminList('/admin/education/scholarships', {
    initialFilters: {
      search: '',
      status: '',
      institutionId: '',
      country: '',
      scholarshipType: '',
      degreeLevel: '',
      field: '',
    },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [programOptions, setProgramOptions] = useState([]);
  const [programSearch, setProgramSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const filterFields = useMemo(() => [
    { key: 'search', type: 'search', label: t('admin:filterSearch'), placeholder: t('admin:filterSearch') },
    {
      key: 'status',
      type: 'select',
      label: t('status'),
      options: [
        { value: '', label: t('admin:filterAll') },
        ...Object.values(PUB_STATUSES).map((v) => ({ value: v, label: v })),
      ],
    },
    {
      key: 'institutionId',
      type: 'text',
      label: t('admin:colInstitution', { defaultValue: 'Institution' }),
      placeholder: t('admin:institutionIdFilter', { defaultValue: 'Canonical institution ID' }),
    },
    { key: 'country', type: 'text', label: t('admin:colCountry'), placeholder: 'ISO or name' },
    {
      key: 'scholarshipType',
      type: 'select',
      label: t('admin:colScholarshipType', { defaultValue: 'Type' }),
      options: [
        { value: '', label: t('admin:filterAll') },
        ...Object.values(SCHOLARSHIP_TYPES).map((v) => ({ value: v, label: v })),
      ],
    },
    {
      key: 'degreeLevel',
      type: 'select',
      label: t('admin:colDegree', { defaultValue: 'Degree' }),
      options: [
        { value: '', label: t('admin:filterAll') },
        ...Object.values(DEGREE_LEVELS).map((v) => ({ value: v, label: v })),
      ],
    },
    {
      key: 'field',
      type: 'select',
      label: t('admin:colField', { defaultValue: 'Field' }),
      options: [
        { value: '', label: t('admin:filterAll') },
        ...Object.values(ACADEMIC_FIELDS).map((v) => ({ value: v, label: v })),
      ],
    },
  ], [t]);

  const loadPrograms = async (institutionId, search = '') => {
    if (!institutionId) {
      setProgramOptions([]);
      return;
    }
    try {
      const res = await adminEducationProgramsApi.list({
        institutionId,
        search: search || undefined,
        limit: 20,
        status: PUB_STATUSES.PUBLISHED,
      });
      setProgramOptions(res.data?.data || []);
    } catch {
      setProgramOptions([]);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setSelectedInstitution(null);
    setProgramOptions([]);
    setFormOpen(true);
  };

  const openEdit = async (id, { startReview = false } = {}) => {
    try {
      const res = await adminEducationScholarshipsApi.get(id);
      const doc = res.data?.data || res.data;
      setForm(toForm(doc));
      setEditingId(id);
      const inst = institutionFromRow(doc);
      setSelectedInstitution(inst);
      const institutionId = inst?._id || doc.institutionId;
      if (institutionId) await loadPrograms(institutionId);
      if (startReview && doc.status === PUB_STATUSES.SUBMITTED) {
        await adminEducationScholarshipsApi.update(id, { startReview: true });
        setForm((prev) => ({ ...prev, status: PUB_STATUSES.UNDER_REVIEW }));
        refetch();
      }
      setFormOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const onInstitutionPick = ({ institutionId, institution }) => {
    setSelectedInstitution(institution);
    setForm((prev) => ({ ...prev, institutionId: institutionId || '', applicableProgramIds: [] }));
    loadPrograms(institutionId);
  };

  const save = async ({ status } = {}) => {
    if (!form.title?.trim()) {
      toast.error(t('admin:titleRequired'));
      return;
    }
    if ((status === PUB_STATUSES.PUBLISHED || form.status === PUB_STATUSES.PUBLISHED) && !form.sourceUrl?.trim()) {
      toast.error(t('admin:sourceRequired', { defaultValue: 'A valid source URL is required to publish' }));
      return;
    }
    if (
      (status === PUB_STATUSES.NEEDS_CHANGES || status === PUB_STATUSES.DISCONTINUED)
      && !form.reviewFeedback?.trim()
    ) {
      toast.error(t('admin:reviewFeedbackRequired', { defaultValue: 'Provider-facing review feedback is required' }));
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form, { status });
      if (editingId) await adminEducationScholarshipsApi.update(editingId, payload);
      else await adminEducationScholarshipsApi.create(payload);
      toast.success(t('admin:saved'));
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const runStatusAction = async (action, id) => {
    try {
      if (action === 'publish') {
        const res = await adminEducationScholarshipsApi.get(id);
        const doc = res.data?.data || res.data;
        await adminEducationScholarshipsApi.update(id, {
          status: PUB_STATUSES.PUBLISHED,
          sources: doc.sources || [],
          institutionId: doc.institutionId?._id || doc.institutionId,
        });
      } else if (action === 'archive') {
        await adminEducationScholarshipsApi.update(id, { status: PUB_STATUSES.ARCHIVED });
      } else if (action === 'under_review') {
        await adminEducationScholarshipsApi.update(id, { startReview: true });
      }
      toast.success(t('admin:actionDone'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const columns = [
    {
      key: 'title',
      label: t('admin:colScholarship', { defaultValue: 'Scholarship' }),
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium break-words">{row.title}</div>
          <div className="text-xs text-gray-500">{row.slug}</div>
        </div>
      ),
    },
    {
      key: 'institution',
      label: t('admin:colInstitution', { defaultValue: 'Institution' }),
      render: (row) => institutionFromRow(row)?.officialName || '—',
    },
    {
      key: 'country',
      label: t('admin:colCountry'),
      render: (row) => institutionFromRow(row)?.countryCode
        || (Array.isArray(row.destinationCountries) ? row.destinationCountries.filter((c) => c !== '*').join(', ') : '—')
        || '—',
    },
    {
      key: 'scope',
      label: t('admin:colScope', { defaultValue: 'Scope' }),
      render: (row) => scopeLabel(row),
    },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'deadline',
      label: t('admin:colDeadlineCycle', { defaultValue: 'Deadline / Cycle' }),
      render: (row) => [row.deadlineDate, row.cycleLabel].filter(Boolean).join(' · ') || '—',
    },
    { key: 'updatedAt', label: t('admin:colUpdated', { defaultValue: 'Updated' }), type: 'date', sortable: true },
    {
      key: 'source',
      label: t('admin:colSource', { defaultValue: 'Source' }),
      render: (row) => {
        const url = row.sources?.[0]?.sourceUrl;
        return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all">Source</a> : '—';
      },
    },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => {
        const publicReady = isInstitutionCanonicalScholarshipPublicReady(row);
        const reviewStatuses = [PUB_STATUSES.SUBMITTED, PUB_STATUSES.UNDER_REVIEW, PUB_STATUSES.NEEDS_CHANGES];
        return (
          <div className="flex flex-wrap gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={() => openEdit(row._id, { startReview: row.status === PUB_STATUSES.SUBMITTED })}
                className="text-xs text-primary underline"
              >
                {reviewStatuses.includes(row.status)
                  ? t('admin:review', { defaultValue: 'Review' })
                  : t('common:edit')}
              </button>
            )}
            <AdminViewPublicLink
              type="canonical-scholarship"
              record={row}
              ready={publicReady}
              href={row.slug ? `${ROUTES.CANONICAL_SCHOLARSHIPS}/${row.slug}` : undefined}
              label={t('admin:viewPublic')}
            />
            {canEdit && row.status === PUB_STATUSES.SUBMITTED && (
              <button type="button" onClick={() => setConfirm({ id: row._id, action: 'under_review' })} className="text-xs text-blue-700 dark:text-blue-400">
                {t('admin:startReview', { defaultValue: 'Start review' })}
              </button>
            )}
            {canEdit && row.status !== PUB_STATUSES.PUBLISHED && (
              <button type="button" onClick={() => setConfirm({ id: row._id, action: 'publish' })} className="text-xs text-green-700 dark:text-green-400">
                {t('admin:publish', { defaultValue: 'Publish' })}
              </button>
            )}
            {canEdit && row.status !== PUB_STATUSES.ARCHIVED && (
              <button type="button" onClick={() => setConfirm({ id: row._id, action: 'archive' })} className="text-xs text-amber-700 dark:text-amber-400">
                {t('admin:archive', { defaultValue: 'Archive' })}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const toggleProgram = (programId) => {
    const id = String(programId);
    setForm((prev) => {
      const set = new Set(prev.applicableProgramIds.map(String));
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, applicableProgramIds: [...set] };
    });
  };

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_UNIVERSITIES}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('admin:manageEducationScholarships', { defaultValue: 'Education Scholarships' })}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('admin:manageEducationScholarshipsHint', {
                defaultValue: 'Canonical Institution scholarships (Mission 7). CMS Scholarships and International Scholarships remain separate.',
              })}
            </p>
          </div>
          {canEdit && (
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">
              {t('admin:addEducationScholarship', { defaultValue: 'Add scholarship' })}
            </button>
          )}
        </div>

        <AdminDataTable
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          emptyMessage={t('admin:noData')}
          pagination={pagination}
          onPageChange={setPage}
          sort={sort}
          onSort={setSort}
          filters={filters}
          onFiltersChange={(f) => { setFilters(f); setPage(1); }}
          filterFields={filterFields}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-2xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">
                {editingId
                  ? t('admin:reviewEducationScholarship', { defaultValue: 'Review / edit scholarship' })
                  : t('admin:addEducationScholarship', { defaultValue: 'Add scholarship' })}
              </h3>
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto mt-3">
                <label className="text-sm font-medium">
                  {t('admin:colInstitution', { defaultValue: 'Institution' })} *
                  <div className="mt-1">
                    <CanonicalInstitutionPicker
                      value={form.institutionId}
                      selectedMeta={selectedInstitution}
                      selectedLabel={selectedInstitution?.officialName || ''}
                      onChange={onInstitutionPick}
                      disabled={Boolean(editingId && form.institutionId)}
                      placeholder={t('admin:searchInstitutions', { defaultValue: 'Search institutions...' })}
                    />
                  </div>
                </label>
                {selectedInstitution && (
                  <p className="text-xs text-gray-500">
                    {selectedInstitution.officialName} · {selectedInstitution.countryCode || '—'} · {selectedInstitution.status}
                  </p>
                )}
                <input className={adminFieldClass} placeholder={t('admin:fieldTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <AdminSelectBare value={form.scholarshipType} onChange={(e) => setForm({ ...form, scholarshipType: e.target.value })}>
                  {Object.values(SCHOLARSHIP_TYPES).map((v) => <option key={v} value={v}>{v}</option>)}
                </AdminSelectBare>
                <input className={adminFieldClass} placeholder={t('admin:organizationPlaceholder')} value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} />
                <div className="grid sm:grid-cols-3 gap-2">
                  <AdminSelectBare value={form.fundingType} onChange={(e) => setForm({ ...form, fundingType: e.target.value })}>
                    {Object.values(FUNDING_TYPES).map((v) => <option key={v} value={v}>{fundingTypeLabel(v)}</option>)}
                  </AdminSelectBare>
                  <input className={adminFieldClass} placeholder="Amount (minor)" value={form.amountMinor} onChange={(e) => setForm({ ...form, amountMinor: e.target.value })} />
                  <input className={adminFieldClass} placeholder="Currency" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <AdminSelectBare value={form.degreeLevels[0] || ''} onChange={(e) => setForm({ ...form, degreeLevels: e.target.value ? [e.target.value] : [] })}>
                    <option value="">Degree level</option>
                    {Object.values(DEGREE_LEVELS).map((v) => <option key={v} value={v}>{v}</option>)}
                  </AdminSelectBare>
                  <AdminSelectBare value={form.fields[0] || ''} onChange={(e) => setForm({ ...form, fields: e.target.value ? [e.target.value] : [] })}>
                    <option value="">Field</option>
                    {Object.values(ACADEMIC_FIELDS).map((v) => <option key={v} value={v}>{v}</option>)}
                  </AdminSelectBare>
                </div>
                <textarea className={adminFieldClass} rows={2} placeholder="Summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                <textarea className={adminFieldClass} rows={3} placeholder="Eligibility (one criterion per line)" value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} />
                <div className="grid sm:grid-cols-2 gap-2">
                  <input className={adminFieldClass} placeholder="Cycle label" value={form.cycleLabel} onChange={(e) => setForm({ ...form, cycleLabel: e.target.value })} />
                  <input type="date" className={adminFieldClass} value={form.deadlineDate} onChange={(e) => setForm({ ...form, deadlineDate: e.target.value })} />
                </div>
                <input className={adminFieldClass} placeholder="Application URL" value={form.applicationUrl} onChange={(e) => setForm({ ...form, applicationUrl: e.target.value })} />
                <input className={adminFieldClass} placeholder="Source URL *" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-sm font-medium mb-2">{t('admin:applicablePrograms', { defaultValue: 'Applicable programs (canonical IDs)' })}</p>
                  <input
                    className={adminFieldClass}
                    placeholder="Search programs…"
                    value={programSearch}
                    onChange={(e) => {
                      setProgramSearch(e.target.value);
                      loadPrograms(form.institutionId, e.target.value);
                    }}
                  />
                  <ul className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {programOptions.map((p) => (
                      <li key={p._id}>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={form.applicableProgramIds.map(String).includes(String(p._id))}
                            onChange={() => toggleProgram(p._id)}
                          />
                          {p.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                  {form.applicableProgramIds.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{form.applicableProgramIds.length} program(s) selected</p>
                  )}
                </div>

                <label className="text-sm font-medium">
                  {t('admin:reviewFeedback', { defaultValue: 'Provider-facing review feedback' })}
                  <textarea
                    className={`${adminFieldClass} mt-1`}
                    rows={2}
                    value={form.reviewFeedback}
                    onChange={(e) => setForm({ ...form, reviewFeedback: e.target.value })}
                    placeholder="Shown to Institution on needs_changes / discontinued"
                  />
                </label>
                <label className="text-sm font-medium">
                  {t('admin:adminNotes', { defaultValue: 'Internal admin notes' })}
                  <textarea
                    className={`${adminFieldClass} mt-1`}
                    rows={2}
                    value={form.adminNotes}
                    onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
                    placeholder="Never shown to Institution or public"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={saving} onClick={() => save()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">
                  {t('admin:saveDraft', { defaultValue: 'Save' })}
                </button>
                {canEdit && (
                  <button type="button" disabled={saving} onClick={() => save({ status: PUB_STATUSES.PUBLISHED })} className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm">
                    {t('admin:publish', { defaultValue: 'Publish' })}
                  </button>
                )}
                {canEdit && editingId && (
                  <button type="button" disabled={saving} onClick={() => save({ status: PUB_STATUSES.NEEDS_CHANGES })} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm">
                    {t('admin:requestChanges', { defaultValue: 'Request changes' })}
                  </button>
                )}
                {canEdit && editingId && (
                  <button type="button" disabled={saving} onClick={() => save({ status: PUB_STATUSES.DISCONTINUED })} className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm">
                    {t('admin:discontinue', { defaultValue: 'Discontinue' })}
                  </button>
                )}
                {canEdit && editingId && (
                  <button type="button" disabled={saving} onClick={() => save({ status: PUB_STATUSES.ARCHIVED })} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">
                    {t('admin:archive', { defaultValue: 'Archive' })}
                  </button>
                )}
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">
                  {t('common:cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        <AdminConfirmDialog
          open={Boolean(confirm)}
          title={t('admin:confirmAction', { defaultValue: 'Confirm action' })}
          message={confirm?.action === 'publish'
            ? t('admin:confirmPublishScholarship', { defaultValue: 'Publish this canonical scholarship? Source and institution authority will be enforced by the server.' })
            : t('admin:confirmGeneric', { defaultValue: 'Continue with this action?' })}
          onConfirm={() => runStatusAction(confirm.action, confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      </div>
    </AdminRouteGuard>
  );
}
