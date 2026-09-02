import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminStatusBadge } from '../../components/admin/adminTableUtils';
import { AdminImageUrlField, linesToText, textToLines } from '../../components/admin/AdminImageUrlField';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { AdminSlugField } from '../../components/admin/AdminSlugField';
import { TranslationToolbar } from '../../components/admin/TranslationToolbar';
import { adminContentApi } from '../../services/adminContentApi';
import { ROUTES } from '../../constants';
import { normalizeJobSkills } from '@shared/jobs/jobSkills.js';
import { normalizeJobTextList } from '@shared/jobs/jobTextLists.js';
import axiosInstance from '../../services/axiosBase';
import { EscapeWhen } from '../../a11y/EscapeWhen';
import { AdminViewPublicLink, isAdminSlugPreviewReady } from '../../components/admin/AdminViewPublicLink';
import { formatJobPublicationStatus } from '@shared/cms/publicReadiness.js';
import { AdminLocationFields } from '../../components/admin/AdminLocationFields';
import { formatLocationDisplay } from '@shared/international/location.js';
import { JobDescriptionUploadPanel } from '../../components/jobs/JobDescriptionUploadPanel';
import { ADMIN_SUGGESTION_FIELD_MAP, ADMIN_FORM_DEFAULTS } from '../../components/jobs/jobDocumentSuggestionMerge';

const EMPTY_JOB = {
  title: '',
  company: '',
  category: '',
  type: 'full-time',
  jobType: 'Private',
  countryCode: '',
  province: '',
  region: '',
  city: '',
  location: '',
  workMode: 'unspecified',
  salaryRange: '',
  salaryCurrency: '',
  openingsCount: '',
  experience: '',
  educationRequirement: '',
  gender: '',
  description: '',
  requirements: '',
  responsibilities: '',
  benefits: '',
  locationEligibility: '',
  skillsRequired: '',
  applicationLink: '',
  applyEmail: '',
  sourceUrl: '',
  sourceWebsite: '',
  externalId: '',
  deadline: '',
  status: 'draft',
  approvalStatus: 'pending',
  remote: false,
  hybrid: false,
  urgent: false,
  isFeatured: false,
  logoUrl: '',
  gallery: '',
  slug: '',
  seoTitle: '',
  metaDescription: '',
};

export default function AdminContentJobs() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_JOBS);
  const canModerate = can(PERMISSIONS.MODERATE_JOBS);

  const {
    data,
    pagination,
    filters,
    setFilters,
    sort,
    setSort,
    loading,
    error,
    setPage,
    refetch,
  } = useAdminList('/admin/jobs');

  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_JOB);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [employerEntitlement, setEmployerEntitlement] = useState(null);
  const [touchedFields, setTouchedFields] = useState(() => new Set());
  const [initialFormSnapshot, setInitialFormSnapshot] = useState(EMPTY_JOB);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_JOB);
    setInitialFormSnapshot(EMPTY_JOB);
    setTouchedFields(new Set());
    setFormOpen(true);
  };

  const openEdit = async (id) => {
    try {
      const res = await axiosInstance.get(`/admin/jobs/${id}`);
      const job = res.data;
      setForm({
        ...EMPTY_JOB,
        ...job,
        requirements: linesToText(job.requirements),
        responsibilities: linesToText(job.responsibilities),
        benefits: normalizeJobTextList(job.benefits).join('\n'),
        locationEligibility: job.locationEligibility || '',
        skillsRequired: normalizeJobSkills(job.skillsRequired).join('\n'),
        gallery: linesToText(job.gallery),
        openingsCount: job.openingsCount == null ? '' : String(job.openingsCount),
        deadline: job.deadline ? job.deadline.slice(0, 10) : '',
      });
      setInitialFormSnapshot({
        ...EMPTY_JOB,
        ...job,
        requirements: linesToText(job.requirements),
        responsibilities: linesToText(job.responsibilities),
        benefits: normalizeJobTextList(job.benefits).join('\n'),
        locationEligibility: job.locationEligibility || '',
        skillsRequired: normalizeJobSkills(job.skillsRequired).join('\n'),
        gallery: linesToText(job.gallery),
        openingsCount: job.openingsCount == null ? '' : String(job.openingsCount),
        deadline: job.deadline ? job.deadline.slice(0, 10) : '',
      });
      setTouchedFields(new Set());
      setEmployerEntitlement(job.employerEntitlement || null);
      setEditingId(id);
      setFormOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const saveJob = async () => {
    if (!form.title?.trim() || !form.company?.trim()) {
      toast.error(t('admin:jobValidationRequired'));
      return;
    }
    if (form.workMode !== 'remote' && !form.countryCode?.trim()) {
      toast.error(t('admin:countryRequired'));
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      requirements: textToLines(form.requirements),
      responsibilities: textToLines(form.responsibilities),
      benefits: normalizeJobTextList(form.benefits),
      locationEligibility: String(form.locationEligibility || '').trim(),
      skillsRequired: normalizeJobSkills(form.skillsRequired),
      gallery: textToLines(form.gallery),
    };
    try {
      if (editingId) {
        await axiosInstance.put(`/admin/jobs/${editingId}`, payload);
        toast.success(t('admin:saved'));
      } else {
        await axiosInstance.post('/admin/jobs', payload);
        toast.success(t('admin:created'));
      }
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action, id) => {
    try {
      if (action === 'delete') {
        await axiosInstance.delete(`/admin/jobs/${id}`);
        toast.success(t('admin:deleted'));
      } else if (action === 'approve') {
        await axiosInstance.post(`/admin/jobs/${id}/approve`);
        toast.success(t('admin:approved'));
      } else if (action === 'reject') {
        await axiosInstance.post(`/admin/jobs/${id}/reject`);
        toast.success(t('admin:rejected'));
      } else if (action === 'duplicate') {
        await axiosInstance.post(`/admin/jobs/${id}/duplicate`);
        toast.success(t('admin:duplicated'));
      } else if (action === 'archive') {
        await axiosInstance.put(`/admin/jobs/${id}`, { status: 'closed' });
        toast.success(t('admin:archived'));
      } else if (action === 'publish') {
        await axiosInstance.put(`/admin/jobs/${id}`, { status: 'active', approvalStatus: 'approved' });
        toast.success(t('admin:published'));
      }
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const handleBulk = async (action, ids) => {
    try {
      await axiosInstance.post('/admin/jobs/bulk', { action, ids });
      toast.success(t('admin:bulkDone'));
      setSelectedIds([]);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  const columns = [
    { key: 'title', label: t('admin:colTitle'), sortable: true },
    { key: 'company', label: t('admin:colCompany'), sortable: true },
    { key: 'province', label: t('admin:colProvince'), render: (row) => formatLocationDisplay(row) || row.province || '—' },
    { key: 'status', label: t('status'), render: (row) => formatJobPublicationStatus(row) },
    {
      key: 'approvalStatus',
      label: t('admin:colApproval'),
      render: (row) => <AdminStatusBadge value={row.approvalStatus} />,
    },
    {
      key: 'employerEntitlement',
      label: 'Publishing',
      render: (row) => {
        const ent = row.employerEntitlement;
        if (!ent) return '—';
        const paid = ent.paidPublishingEnabled === true;
        const remaining = ent.activeFreeJobs?.remaining;
        const used = ent.activeFreeJobs?.used;
        const limit = ent.activeFreeJobs?.limit;
        return (
          <span
            className="inline-flex flex-col gap-0.5 text-[11px] leading-tight"
            title={`Verification ${ent.verification?.eligible ? 'eligible' : 'blocked'} · payment ${ent.payment?.state || 'not_configured'}`}
          >
            <span className={`font-semibold ${paid ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {paid ? 'PAID' : 'FREE BETA'}
            </span>
            {typeof remaining === 'number' ? (
              <span className="text-gray-500">{used}/{limit} active · {remaining} left</span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canEdit && (
            <button type="button" onClick={() => openEdit(row._id)} className="text-xs text-primary underline">
              {t('common:edit')}
            </button>
          )}
          {row.slug && (
            <AdminViewPublicLink type="job" record={row} href={`${ROUTES.JOBS}/${row.slug}`} label={t('admin:viewPublic')} />
          )}
          {canModerate && row.approvalStatus === 'pending' && (
            <>
              <button type="button" onClick={() => runAction('approve', row._id)} className="text-xs text-green-600">{t('admin:approve')}</button>
              <button type="button" onClick={() => runAction('reject', row._id)} className="text-xs text-amber-600">{t('admin:reject')}</button>
            </>
          )}
          {canEdit && (
            <>
              <button type="button" onClick={() => runAction('duplicate', row._id)} className="text-xs">{t('admin:duplicate')}</button>
              <button type="button" onClick={() => setConfirm({ action: 'delete', id: row._id, title: row.title })} className="text-xs text-red-600">{t('common:delete')}</button>
            </>
          )}
        </div>
      ),
    },
  ];

  const bulkActions = [
    ...(canModerate ? [{ id: 'approve', label: t('admin:bulkApprove') }, { id: 'reject', label: t('admin:bulkReject') }] : []),
    ...(canEdit ? [
      { id: 'publish', label: t('admin:bulkPublish') },
      { id: 'archive', label: t('admin:bulkArchive') },
      { id: 'feature', label: t('admin:bulkFeature') },
      { id: 'delete', label: t('admin:bulkDelete'), danger: true },
    ] : []),
  ];

  const fieldClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm';

  return (
    <AdminRouteGuard anyPermission={[PERMISSIONS.CONTENT_JOBS, PERMISSIONS.MODERATE_JOBS]}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageJobs')}</h1>
          {canEdit && (
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium min-h-[44px]">
              {t('admin:createJob')}
            </button>
          )}
        </div>

        <AdminDataTable
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          emptyMessage={t('admin:noJobsFound')}
          pagination={pagination}
          onPageChange={setPage}
          sort={sort}
          onSort={setSort}
          filters={filters}
          onFiltersChange={(f) => { setFilters(f); setPage(1); }}
          filterFields={['search', 'status', 'approvalStatus', 'country', 'province', 'city', 'category', 'employer', 'featured', 'from', 'to']}
          selectable={canEdit || canModerate}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          bulkActions={bulkActions}
          onBulkAction={(action, ids) => {
            if (action === 'delete' && !window.confirm(t('admin:bulkDeleteConfirm'))) return;
            handleBulk(action, ids);
          }}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'jobs' : undefined}
          onExport={(resource, format) => adminContentApi.exportData(resource, format).catch(() => toast.error(t('admin:exportFailed')))}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-3xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <h3 className="text-lg font-bold mb-4">{editingId ? t('admin:editJob') : t('admin:createJob')}</h3>
              {editingId ? (
                <>
                  <TranslationToolbar
                    entityType="job"
                    entityId={editingId}
                    currentLocale={form.locale || 'en'}
                    onOpenTranslation={(doc) => openEdit(doc._id)}
                  />
                  {employerEntitlement ? (
                    <div className="mt-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-gray-600 dark:text-gray-300 space-y-1">
                      <p>
                        Employer entitlement: <strong className="capitalize">{String(employerEntitlement.type || 'not_configured').replaceAll('_', ' ')}</strong>
                        {employerEntitlement.policyCode ? ` · ${employerEntitlement.policyCode} v${employerEntitlement.policyVersion || ''}` : ''}
                      </p>
                      <p>
                        Publishing: {employerEntitlement.paidPublishingEnabled ? 'PAID' : 'FREE BETA'}
                        {employerEntitlement.activeFreeJobs
                          ? ` · ${employerEntitlement.activeFreeJobs.used}/${employerEntitlement.activeFreeJobs.limit} active (${employerEntitlement.activeFreeJobs.remaining} remaining)`
                          : ''}
                      </p>
                      {employerEntitlement.rolling30Days ? (
                        <p>
                          Rolling 30-day submissions: {employerEntitlement.rolling30Days.used}/{employerEntitlement.rolling30Days.limit}
                          {employerEntitlement.nextReset ? ` · next window ${new Date(employerEntitlement.nextReset).toLocaleDateString()}` : ''}
                        </p>
                      ) : null}
                      <p>
                        Payment: {employerEntitlement.payment?.state || 'not_configured'}
                        {employerEntitlement.verification
                          ? ` · verification ${employerEntitlement.verification.eligible ? 'eligible' : 'blocked'}`
                          : ''}
                      </p>
                      {employerEntitlement.blockers?.length ? (
                        <p>Blockers: {employerEntitlement.blockers.join(', ')}</p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
              <JobDescriptionUploadPanel
                uploadFn={adminContentApi.extractJobFromDocument}
                fieldMap={ADMIN_SUGGESTION_FIELD_MAP}
                form={form}
                formDefaults={ADMIN_FORM_DEFAULTS}
                initialForm={initialFormSnapshot}
                touchedFields={touchedFields}
                replaceSupported
                onApply={(next) => setForm(next)}
                className="mt-3"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1 mt-3">
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">{t('admin:fieldTitle')} *</span>
                  <input className={fieldClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </label>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:fieldCompany')} *</span>
                  <input className={fieldClass} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </label>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:fieldCategory')}</span>
                  <input className={fieldClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </label>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:fieldType')}</span>
                  <AdminSelectBare className={fieldClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </AdminSelectBare>
                </label>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:fieldJobType')}</span>
                  <AdminSelectBare className={fieldClass} value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })}>
                    <option value="Government">Government</option>
                    <option value="Private">Private</option>
                    <option value="Internship">Internship</option>
                  </AdminSelectBare>
                </label>
                <div className="sm:col-span-2">
                  <AdminLocationFields
                    mode="code"
                    countryRequired={form.workMode !== 'remote'}
                    showWorkMode
                    value={form}
                    onChange={(loc) => {
                      const workMode = loc.workMode || form.workMode || 'unspecified';
                      setForm({
                        ...form,
                        ...loc,
                        workMode,
                        remote: workMode === 'remote',
                        hybrid: workMode === 'hybrid',
                      });
                    }}
                  />
                </div>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:fieldSalary')}</span>
                  <input className={fieldClass} value={form.salaryRange} onChange={(e) => setForm({ ...form, salaryRange: e.target.value })} />
                </label>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:fieldCurrency')}</span>
                  <input className={fieldClass} value={form.salaryCurrency} onChange={(e) => setForm({ ...form, salaryCurrency: e.target.value })} />
                </label>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:fieldExperience')}</span>
                  <input className={fieldClass} value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
                </label>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:fieldEducation')}</span>
                  <input className={fieldClass} value={form.educationRequirement} onChange={(e) => setForm({ ...form, educationRequirement: e.target.value })} />
                </label>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:fieldDeadline')}</span>
                  <input type="date" className={fieldClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </label>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:fieldOpeningsCount', { defaultValue: 'Number of openings' })}</span>
                  <input
                    type="number"
                    min={1}
                    className={fieldClass}
                    value={form.openingsCount}
                    onChange={(e) => setForm({ ...form, openingsCount: e.target.value })}
                    placeholder={t('admin:optional', { defaultValue: 'Optional' })}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">{t('admin:applyLinkLabel')}</span>
                  <input className={fieldClass} value={form.applicationLink} onChange={(e) => setForm({ ...form, applicationLink: e.target.value })} placeholder="https://…" />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">Application email</span>
                  <input type="email" className={fieldClass} value={form.applyEmail} onChange={(e) => setForm({ ...form, applyEmail: e.target.value })} placeholder="jobs@employer.example" />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">Official source URL</span>
                  <input className={fieldClass} value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://…" />
                </label>
                <label>
                  <span className="text-xs text-gray-500">Source / employer website name</span>
                  <input className={fieldClass} value={form.sourceWebsite} onChange={(e) => setForm({ ...form, sourceWebsite: e.target.value })} placeholder="e.g. PPSC, FPSC" />
                </label>
                <label>
                  <span className="text-xs text-gray-500">External job ID / reference ID</span>
                  <input className={fieldClass} value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">{t('admin:fieldDescription')}</span>
                  <textarea rows={4} className={fieldClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">{t('admin:fieldRequirements')}</span>
                  <textarea rows={3} className={fieldClass} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} placeholder={t('admin:onePerLine')} />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">Skills required</span>
                  <textarea rows={3} className={fieldClass} value={form.skillsRequired} onChange={(e) => setForm({ ...form, skillsRequired: e.target.value })} placeholder={t('admin:onePerLine')} />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">Compensation / Benefits</span>
                  <textarea rows={3} className={fieldClass} value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} placeholder="Competitive salary\nHealth insurance\nPaid leave\nPerformance bonus" />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">Location Eligibility</span>
                  <textarea rows={3} className={fieldClass} value={form.locationEligibility} onChange={(e) => setForm({ ...form, locationEligibility: e.target.value })} placeholder="Applicants must be based in a specified region or country" />
                </label>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:fieldStatus')}</span>
                  <AdminSelectBare className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                  </AdminSelectBare>
                </label>
                <label>
                  <span className="text-xs text-gray-500">{t('admin:colApproval')}</span>
                  <AdminSelectBare className={fieldClass} value={form.approvalStatus} onChange={(e) => setForm({ ...form, approvalStatus: e.target.value })}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </AdminSelectBare>
                </label>
                <div className="sm:col-span-2">
                  <AdminImageUrlField label={t('admin:fieldLogoUrl')} value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
                </div>
                <AdminSlugField
                  className="sm:col-span-2"
                  resourceType="job"
                  value={form.slug}
                  onChange={(slug) => setForm({ ...form, slug })}
                  sourceText={`${form.title} ${form.province || form.location || ''}`.trim()}
                  status={form.status}
                  excludeId={editingId}
                  publicPreviewReady={isAdminSlugPreviewReady('job', form, form.status)}
                />
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">{t('admin:fieldSeoTitle')}</span>
                  <input className={fieldClass} value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">{t('admin:fieldMetaDescription')}</span>
                  <textarea rows={2} className={fieldClass} value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
                </label>
                <div className="sm:col-span-2 flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} /> {t('admin:fieldUrgent')}</label>
                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /> {t('admin:fieldFeatured')}</label>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-lg border text-sm">{t('common:cancel')}</button>
                <button type="button" onClick={saveJob} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50">{saving ? t('admin:saving') : t('admin:save')}</button>
              </div>
            </div>
          </div>
        )}

        <AdminConfirmDialog
          open={!!confirm}
          title={t('common:delete')}
          message={t('admin:deleteJobConfirm')}
          danger
          onConfirm={() => runAction('delete', confirm?.id)}
          onCancel={() => setConfirm(null)}
        />
      </div>
    </AdminRouteGuard>
  );
}
