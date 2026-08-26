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
import { adminEducationProgramsApi } from '../../services/adminEducationProgramsApi';
import { adminEducationInstitutionsApi } from '../../services/adminEducationInstitutionsApi';
import { ROUTES } from '../../constants';
import { EscapeWhen } from '../../a11y/EscapeWhen';
import {
  DEGREE_LEVELS,
  ACADEMIC_FIELDS,
  STUDY_MODES,
  PUB_STATUSES,
} from '@shared/education/taxonomy.js';
import { isEducationProgramPublicReady } from '@shared/cms/publicReadiness.js';

const EMPTY = {
  institutionId: '',
  name: '',
  slug: '',
  degreeLevel: '',
  field: '',
  campus: '',
  instructionLanguage: '',
  studyMode: '',
  durationMonths: '',
  officialProgramUrl: '',
  country: '',
  admissionRequirementsUrl: '',
  tuitionAmountMinor: '',
  tuitionCurrency: '',
  tuitionPer: '',
  tuitionNotes: '',
  intakesText: '',
  status: PUB_STATUSES.DRAFT,
  sourceUrl: '',
  sourceType: 'official',
  sourcePublisher: '',
};

function institutionFromRow(row) {
  return row?.institutionId && typeof row.institutionId === 'object' ? row.institutionId : null;
}

function toForm(program) {
  const tuition = program.tuition || {};
  const intakes = Array.isArray(program.intakes) ? program.intakes : [];
  const sources = Array.isArray(program.sources) ? program.sources : [];
  const firstSource = sources[0] || {};
  return {
    ...EMPTY,
    institutionId: program.institutionId?._id || program.institutionId || '',
    name: program.name || '',
    slug: program.slug || '',
    degreeLevel: program.degreeLevel || '',
    field: program.field || '',
    campus: program.campus || '',
    instructionLanguage: program.instructionLanguage || '',
    studyMode: program.studyMode || '',
    durationMonths: program.durationMonths ?? '',
    officialProgramUrl: program.officialProgramUrl || '',
    country: program.country || '',
    admissionRequirementsUrl: program.admissionRequirementsUrl || '',
    tuitionAmountMinor: tuition.amountMinor ?? '',
    tuitionCurrency: tuition.currency || '',
    tuitionPer: tuition.per || '',
    tuitionNotes: tuition.notes || '',
    intakesText: intakes.map((i) => i.cycleLabel).filter(Boolean).join(', '),
    status: program.status || PUB_STATUSES.DRAFT,
    sourceUrl: firstSource.sourceUrl || '',
    sourceType: firstSource.sourceType || 'official',
    sourcePublisher: firstSource.publisher || '',
  };
}

function buildPayload(form, { forPublish = false } = {}) {
  const sources = form.sourceUrl?.trim()
    ? [{
      sourceType: form.sourceType || 'official',
      sourceUrl: form.sourceUrl.trim(),
      publisher: form.sourcePublisher || '',
    }]
    : [];
  const intakes = form.intakesText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((cycleLabel) => ({ cycleLabel }));
  const payload = {
    institutionId: form.institutionId,
    name: form.name,
    slug: form.slug || undefined,
    degreeLevel: form.degreeLevel || undefined,
    field: form.field || undefined,
    campus: form.campus,
    instructionLanguage: form.instructionLanguage,
    studyMode: form.studyMode || undefined,
    durationMonths: form.durationMonths === '' ? undefined : Number(form.durationMonths),
    officialProgramUrl: form.officialProgramUrl,
    country: form.country,
    admissionRequirementsUrl: form.admissionRequirementsUrl,
    tuition: {
      amountMinor: form.tuitionAmountMinor === '' ? null : Number(form.tuitionAmountMinor),
      currency: form.tuitionCurrency,
      per: form.tuitionPer,
      notes: form.tuitionNotes,
    },
    intakes,
    status: form.status,
    sources,
  };
  if (forPublish) payload.status = PUB_STATUSES.PUBLISHED;
  return payload;
}

export default function AdminPrograms() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_UNIVERSITIES);

  const {
    data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch,
  } = useAdminList('/admin/education/programs', {
    initialFilters: {
      search: '',
      status: '',
      country: '',
      region: '',
      city: '',
      institutionId: '',
      degreeLevel: '',
      field: '',
      studyMode: '',
    },
  });

  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [acceptanceNote, setAcceptanceNote] = useState('');
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
    { key: 'country', type: 'text', label: t('admin:colCountry'), placeholder: t('admin:colCountry') },
    { key: 'region', type: 'text', label: t('admin:fieldRegion', { defaultValue: 'State / Province / Region' }), placeholder: t('admin:fieldRegion', { defaultValue: 'State / Province / Region' }) },
    { key: 'city', type: 'text', label: t('admin:fieldCity'), placeholder: t('admin:fieldCity') },
    {
      key: 'institutionId',
      type: 'text',
      label: t('admin:colInstitution', { defaultValue: 'Institution' }),
      placeholder: t('admin:institutionIdFilter', { defaultValue: 'Canonical institution ID' }),
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
    {
      key: 'studyMode',
      type: 'select',
      label: t('admin:colStudyMode', { defaultValue: 'Study mode' }),
      options: [
        { value: '', label: t('admin:filterAll') },
        ...Object.values(STUDY_MODES).map((v) => ({ value: v, label: v })),
      ],
    },
  ], [t]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setSelectedInstitution(null);
    setAcceptanceNote('');
    setFormOpen(true);
  };

  const openEdit = async (id) => {
    try {
      const res = await adminEducationProgramsApi.get(id);
      const program = res.data?.data || res.data;
      setForm(toForm(program));
      setEditingId(id);
      const inst = institutionFromRow(program);
      setSelectedInstitution(inst);
      if (!inst && program.institutionId) {
        adminEducationInstitutionsApi.get(program.institutionId)
          .then((r) => setSelectedInstitution(r.data?.data || r.data || null))
          .catch(() => {});
      }
      setAcceptanceNote(
        program.hasAcceptedTests || program.acceptedTestsCount > 0
          ? t('admin:programAcceptedTestsExist', { defaultValue: 'Accepted tests exist', count: program.acceptedTestsCount || 0 })
          : t('admin:programAcceptedTestsNone', { defaultValue: 'No accepted tests on file' })
      );
      setFormOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const onInstitutionPick = ({ institutionId, institution }) => {
    setSelectedInstitution(institution);
    setForm((prev) => ({
      ...prev,
      institutionId: institutionId || '',
      country: prev.country || institution?.countryCode || '',
    }));
  };

  const save = async ({ publish = false, archive = false } = {}) => {
    if (!form.institutionId) {
      toast.error(t('admin:institutionRequired', { defaultValue: 'Select a canonical institution' }));
      return;
    }
    if (!form.name?.trim()) {
      toast.error(t('admin:titleRequired'));
      return;
    }
    setSaving(true);
    try {
      if (archive && editingId) {
        await adminEducationProgramsApi.update(editingId, { status: PUB_STATUSES.ARCHIVED });
      } else if (publish && editingId) {
        const payload = buildPayload(form, { forPublish: true });
        await adminEducationProgramsApi.update(editingId, payload);
        await adminEducationProgramsApi.publishIntelligence(editingId, {
          country: payload.country,
          admissionRequirementsUrl: payload.admissionRequirementsUrl,
          tuition: payload.tuition,
          intakes: payload.intakes,
          status: PUB_STATUSES.PUBLISHED,
          sources: payload.sources,
        });
      } else {
        const payload = buildPayload(form);
        if (editingId) await adminEducationProgramsApi.update(editingId, payload);
        else await adminEducationProgramsApi.create(payload);
      }
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
        const res = await adminEducationProgramsApi.get(id);
        const program = res.data?.data || res.data;
        const sources = Array.isArray(program.sources) ? program.sources : [];
        await adminEducationProgramsApi.publishIntelligence(id, {
          status: PUB_STATUSES.PUBLISHED,
          sources,
          country: program.country,
          admissionRequirementsUrl: program.admissionRequirementsUrl,
          tuition: program.tuition,
          intakes: program.intakes,
        });
      } else if (action === 'archive') {
        await adminEducationProgramsApi.update(id, { status: PUB_STATUSES.ARCHIVED });
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
      key: 'name',
      label: t('admin:colProgram', { defaultValue: 'Program' }),
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium break-words">{row.name}</div>
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
      render: (row) => row.country || institutionFromRow(row)?.countryCode || '—',
    },
    { key: 'degreeLevel', label: t('admin:colDegree', { defaultValue: 'Degree' }) },
    { key: 'field', label: t('admin:colField', { defaultValue: 'Field' }) },
    { key: 'studyMode', label: t('admin:colStudyMode', { defaultValue: 'Study mode' }) },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'acceptedTests',
      label: t('admin:colAcceptedTests', { defaultValue: 'Test acceptance' }),
      render: (row) => (row.hasAcceptedTests || row.acceptedTestsCount > 0
        ? t('admin:programAcceptedTestsExist', { defaultValue: 'Accepted tests exist', count: row.acceptedTestsCount || 0 })
        : t('admin:programAcceptedTestsNone', { defaultValue: 'None' })),
    },
    { key: 'updatedAt', label: t('admin:colUpdated', { defaultValue: 'Updated' }), type: 'date', sortable: true },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => {
        const publicReady = isEducationProgramPublicReady(row);
        return (
          <div className="flex flex-wrap gap-1">
            {canEdit && (
              <button type="button" onClick={() => openEdit(row._id)} className="text-xs text-primary underline">
                {row.status === PUB_STATUSES.SUBMITTED || row.status === PUB_STATUSES.UNDER_REVIEW || row.status === PUB_STATUSES.NEEDS_CHANGES
                  ? t('admin:review', { defaultValue: 'Review' })
                  : t('common:edit')}
              </button>
            )}
            <AdminViewPublicLink
              type="program"
              record={row}
              ready={publicReady}
              href={row.slug ? `${ROUTES.PROGRAM_EXPLORER}/${row.slug}` : undefined}
              label={t('admin:viewPublic')}
            />
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

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_UNIVERSITIES}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('admin:managePrograms', { defaultValue: 'Manage Programs' })}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('admin:manageProgramsHint', {
                defaultValue: 'Canonical Institution Programs for Program Explorer. Scholarships and Test Acceptance remain separate workflows.',
              })}
            </p>
          </div>
          {canEdit && (
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">
              {t('admin:addProgram', { defaultValue: 'Add program' })}
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
          selectable={canEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-2xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">
                {editingId
                  ? t('admin:editProgram', { defaultValue: 'Edit / review program' })
                  : t('admin:addProgram', { defaultValue: 'Add program' })}
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
                      disabled={Boolean(editingId)}
                      placeholder={t('admin:searchInstitutions', { defaultValue: 'Search institutions...' })}
                    />
                  </div>
                </label>
                {selectedInstitution && (
                  <p className="text-xs text-gray-500">
                    {t('admin:institutionLocationReadonly', {
                      defaultValue: 'Institution location (read-only): {{country}} · {{region}} · {{city}} · status {{status}}',
                      country: selectedInstitution.countryCode || '—',
                      region: selectedInstitution.region || '—',
                      city: selectedInstitution.city || '—',
                      status: selectedInstitution.status || '—',
                    })}
                  </p>
                )}

                <input className={adminFieldClass} placeholder={t('admin:colProgram', { defaultValue: 'Program name' })} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className={adminFieldClass} placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />

                <AdminSelectBare className={adminFieldClass} value={form.degreeLevel} onChange={(e) => setForm({ ...form, degreeLevel: e.target.value })}>
                  <option value="">{t('admin:colDegree', { defaultValue: 'Degree level' })}</option>
                  {Object.values(DEGREE_LEVELS).map((v) => <option key={v} value={v}>{v}</option>)}
                </AdminSelectBare>
                <AdminSelectBare className={adminFieldClass} value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
                  <option value="">{t('admin:colField', { defaultValue: 'Field' })}</option>
                  {Object.values(ACADEMIC_FIELDS).map((v) => <option key={v} value={v}>{v}</option>)}
                </AdminSelectBare>

                <input className={adminFieldClass} placeholder={`${t('admin:colCountry')} * (ISO alpha-2)`} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldCampus', { defaultValue: 'Location / Campus (optional)' })} value={form.campus} onChange={(e) => setForm({ ...form, campus: e.target.value })} />

                <AdminSelectBare className={adminFieldClass} value={form.studyMode} onChange={(e) => setForm({ ...form, studyMode: e.target.value })}>
                  <option value="">{t('admin:colStudyMode', { defaultValue: 'Study mode' })}</option>
                  {Object.values(STUDY_MODES).map((v) => <option key={v} value={v}>{v}</option>)}
                </AdminSelectBare>
                <input className={adminFieldClass} placeholder={t('admin:fieldDurationMonths', { defaultValue: 'Duration (months)' })} value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldLanguage', { defaultValue: 'Instruction language' })} value={form.instructionLanguage} onChange={(e) => setForm({ ...form, instructionLanguage: e.target.value })} />

                <input className={adminFieldClass} placeholder={t('admin:fieldTuitionMinor', { defaultValue: 'Tuition amount (minor units)' })} value={form.tuitionAmountMinor} onChange={(e) => setForm({ ...form, tuitionAmountMinor: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldTuitionCurrency', { defaultValue: 'Tuition currency' })} value={form.tuitionCurrency} onChange={(e) => setForm({ ...form, tuitionCurrency: e.target.value.toUpperCase() })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldTuitionPer', { defaultValue: 'Tuition per (year / semester / program)' })} value={form.tuitionPer} onChange={(e) => setForm({ ...form, tuitionPer: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldTuitionNotes', { defaultValue: 'Tuition notes' })} value={form.tuitionNotes} onChange={(e) => setForm({ ...form, tuitionNotes: e.target.value })} />

                <input className={adminFieldClass} placeholder={t('admin:fieldIntakes', { defaultValue: 'Intakes (comma-separated cycle labels)' })} value={form.intakesText} onChange={(e) => setForm({ ...form, intakesText: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldAdmissionRequirementsUrl', { defaultValue: 'Entry requirements URL' })} value={form.admissionRequirementsUrl} onChange={(e) => setForm({ ...form, admissionRequirementsUrl: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldOfficialProgramUrl', { defaultValue: 'Official program URL' })} value={form.officialProgramUrl} onChange={(e) => setForm({ ...form, officialProgramUrl: e.target.value })} />

                <AdminSelectBare className={adminFieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.values(PUB_STATUSES).map((v) => <option key={v} value={v}>{v}</option>)}
                </AdminSelectBare>

                <input className={adminFieldClass} placeholder={t('admin:fieldSourceUrl', { defaultValue: 'Source URL (required to publish)' })} value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldSourcePublisher', { defaultValue: 'Source publisher' })} value={form.sourcePublisher} onChange={(e) => setForm({ ...form, sourcePublisher: e.target.value })} />

                {editingId && (
                  <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="program-acceptance-summary">
                    {acceptanceNote}
                  </p>
                )}

                {editingId && form.slug && (
                  <AdminViewPublicLink
                    type="program"
                    record={{ ...form, slug: form.slug }}
                    href={`${ROUTES.PROGRAM_EXPLORER}/${form.slug}`}
                    label={t('admin:viewPublic')}
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <button type="button" disabled={saving} onClick={() => save()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">
                  {t('common:save')}
                </button>
                {editingId && canEdit && (
                  <button type="button" disabled={saving} onClick={() => save({ publish: true })} className="px-4 py-2 rounded-lg border border-green-600 text-green-700 text-sm min-h-[44px]">
                    {t('admin:publish', { defaultValue: 'Publish' })}
                  </button>
                )}
                {editingId && canEdit && form.status !== PUB_STATUSES.ARCHIVED && (
                  <button type="button" disabled={saving} onClick={() => save({ archive: true })} className="px-4 py-2 rounded-lg border border-amber-600 text-amber-700 text-sm min-h-[44px]">
                    {t('admin:archive', { defaultValue: 'Archive' })}
                  </button>
                )}
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-lg border text-sm min-h-[44px]">
                  {t('common:cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        <AdminConfirmDialog
          open={Boolean(confirm)}
          title={confirm?.action === 'publish'
            ? t('admin:confirmPublish', { defaultValue: 'Publish program?' })
            : t('admin:confirmArchive', { defaultValue: 'Archive program?' })}
          message={confirm?.action === 'publish'
            ? t('admin:confirmPublishProgramBody', { defaultValue: 'Publishing uses server authority and requires a valid source. The program will appear on Program Explorer when public requirements are met.' })
            : t('admin:confirmArchiveProgramBody', { defaultValue: 'Archiving removes the program from public Program Explorer.' })}
          confirmLabel={confirm?.action === 'publish'
            ? t('admin:publish', { defaultValue: 'Publish' })
            : t('admin:archive', { defaultValue: 'Archive' })}
          onConfirm={() => confirm && runStatusAction(confirm.action, confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      </div>
    </AdminRouteGuard>
  );
}
