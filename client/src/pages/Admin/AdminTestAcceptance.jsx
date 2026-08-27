import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { PERMISSIONS } from '../../config/rbac';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { adminContentApi } from '../../services/adminContentApi';
import { EscapeWhen } from '../../a11y/EscapeWhen';
import { ACCEPTANCE_STATUSES, ACCEPTANCE_SCOPES } from '@shared/education/acceptanceExplorer.js';

const EMPTY_FORM = {
  testId: '',
  institutionId: '',
  programId: '',
  minimumOverallScore: '',
  resultValidityMonths: '',
  acceptanceScope: ACCEPTANCE_SCOPES.PROGRAM,
  acceptanceStatus: ACCEPTANCE_STATUSES.ACCEPTED,
  conditions: '',
  adminNotes: '',
  sectionMinimums: [],
};

const EMPTY_SECTION = { sectionName: '', minimum: '', scale: '' };

const SCOPE_OPTIONS = [
  { value: ACCEPTANCE_SCOPES.COUNTRY, label: 'Country' },
  { value: ACCEPTANCE_SCOPES.INSTITUTION, label: 'Institution' },
  { value: ACCEPTANCE_SCOPES.PROGRAM, label: 'Program' },
  { value: ACCEPTANCE_SCOPES.PROGRAM_INTAKE, label: 'Program Intake' },
];

const STATUS_OPTIONS = [
  { value: ACCEPTANCE_STATUSES.ACCEPTED, label: 'Accepted' },
  { value: ACCEPTANCE_STATUSES.CONDITIONAL, label: 'Conditional' },
  { value: ACCEPTANCE_STATUSES.NOT_ACCEPTED, label: 'Not Accepted' },
  { value: ACCEPTANCE_STATUSES.CASE_BY_CASE, label: 'Case by Case' },
  { value: ACCEPTANCE_STATUSES.UNKNOWN, label: 'Unknown' },
];

export default function AdminTestAcceptance() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();

  const [records, setRecords] = useState([]);
  const [tests, setTests] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [programsByInstitution, setProgramsByInstitution] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [recRes, testRes, instRes] = await Promise.all([
        adminContentApi.educationAcceptance.list({ limit: 200 }),
        adminContentApi.educationTests.list({ limit: 200 }),
        adminContentApi.educationInstitutions.list({ limit: 500 }),
      ]);
      setRecords(recRes.data?.data || []);
      setTests(testRes.data?.data || []);
      setInstitutions(instRes.data?.data || []);
    } catch {
      setError(t('admin:loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadPrograms = useCallback(async (institutionId) => {
    if (!institutionId) { setProgramsByInstitution([]); return; }
    try {
      const res = await adminContentApi.educationPrograms.list({ institutionId, limit: 200 });
      setProgramsByInstitution(res.data?.data || []);
    } catch {
      setProgramsByInstitution([]);
    }
  }, []);

  const handleInstitutionChange = (institutionId) => {
    setForm((f) => ({ ...f, institutionId, programId: '' }));
    loadPrograms(institutionId);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setProgramsByInstitution([]);
    setFormOpen(true);
  };

  const openEdit = async (row) => {
    setEditingId(row._id);
    const instId = row.institutionId?._id || row.institutionId || '';
    setForm({
      testId: row.testId?._id || row.testId || '',
      institutionId: instId,
      programId: row.programId?._id || row.programId || '',
      minimumOverallScore: row.minimumOverallScore != null ? String(row.minimumOverallScore) : '',
      resultValidityMonths: row.resultValidityMonths != null ? String(row.resultValidityMonths) : '',
      acceptanceScope: row.acceptanceScope || ACCEPTANCE_SCOPES.PROGRAM,
      acceptanceStatus: row.acceptanceStatus || ACCEPTANCE_STATUSES.ACCEPTED,
      conditions: row.conditions || '',
      adminNotes: row.adminNotes || '',
      sectionMinimums: (row.sectionMinimums || []).map((s) => ({ sectionName: s.sectionName, minimum: String(s.minimum), scale: s.scale || '' })),
    });
    await loadPrograms(instId);
    setFormOpen(true);
  };

  const addSection = () => setForm((f) => ({ ...f, sectionMinimums: [...f.sectionMinimums, { ...EMPTY_SECTION }] }));
  const removeSection = (idx) => setForm((f) => ({ ...f, sectionMinimums: f.sectionMinimums.filter((_, i) => i !== idx) }));
  const updateSection = (idx, field, value) => setForm((f) => {
    const secs = [...f.sectionMinimums];
    secs[idx] = { ...secs[idx], [field]: value };
    return { ...f, sectionMinimums: secs };
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        testId: form.testId || undefined,
        institutionId: form.institutionId || undefined,
        programId: form.programId || undefined,
        minimumOverallScore: form.minimumOverallScore !== '' ? Number(form.minimumOverallScore) : undefined,
        resultValidityMonths: form.resultValidityMonths !== '' ? Number(form.resultValidityMonths) : undefined,
        acceptanceScope: form.acceptanceScope,
        acceptanceStatus: form.acceptanceStatus,
        conditions: form.conditions.trim() || undefined,
        adminNotes: form.adminNotes.trim() || undefined,
        sectionMinimums: form.sectionMinimums
          .filter((s) => s.sectionName.trim() && s.minimum !== '')
          .map((s) => ({ sectionName: s.sectionName.trim(), minimum: Number(s.minimum), scale: s.scale.trim() || undefined })),
      };
      if (editingId) await adminContentApi.educationAcceptance.update(editingId, body);
      else await adminContentApi.educationAcceptance.create(body);
      toast({ type: 'success', message: t('common:saved') });
      setFormOpen(false);
      await loadAll();
    } catch {
      toast({ type: 'error', message: t('common:saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleSupersede = (row) => {
    setConfirm({
      message: t('admin:acceptanceSupersedeConfirm'),
      onConfirm: async () => {
        setConfirm(null);
        try {
          await adminContentApi.educationAcceptance.supersede(row._id, {});
          toast({ type: 'success', message: t('common:saved') });
          await loadAll();
        } catch {
          toast({ type: 'error', message: t('common:saveFailed') });
        }
      },
    });
  };

  const columns = [
    { key: 'testId', label: t('admin:acceptanceTestLabel'), render: (v) => v?.name || v || '—' },
    { key: 'institutionId', label: t('admin:acceptanceInstitutionLabel'), render: (v) => v?.officialName || v?.name || v || '—' },
    { key: 'programId', label: t('admin:acceptanceProgramLabel'), render: (v) => v?.title || v?.name || v || '—' },
    { key: 'acceptanceStatus', label: t('admin:acceptanceStatus'), render: (v) => STATUS_OPTIONS.find((o) => o.value === v)?.label || v },
    { key: 'resultValidityMonths', label: t('admin:acceptanceResultValidityMonths'), render: (v) => v != null ? `${v} mo` : '—' },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-2">
        <button type="button" className="text-xs text-primary dark:text-mint hover:underline" onClick={() => openEdit(row)}>
          {t('common:edit')}
        </button>
        {!row.supersededById && (
          <button type="button" className="text-xs text-amber-600 dark:text-amber-400 hover:underline" onClick={() => handleSupersede(row)}>
            {t('admin:acceptanceSupersede')}
          </button>
        )}
      </div>
    )},
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_ADMISSIONS}>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:navTestAcceptance')}</h1>
          <button type="button" className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition" onClick={openAdd}>
            + {t('admin:acceptanceAddNew')}
          </button>
        </div>

        {error && <p className="text-red-600 dark:text-red-400 mb-3 text-sm">{error}</p>}

        <AdminDataTable columns={columns} rows={records} loading={loading} />

        {formOpen && (
          <EscapeWhen active onEscape={() => setFormOpen(false)}>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="max-w-2xl w-full mx-auto rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold mb-4">
                  {editingId ? t('admin:acceptanceEditTitle') : t('admin:acceptanceAddNew')}
                </h3>
                <div className="grid gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('admin:acceptanceTestLabel')} *</label>
                    <AdminSelectBare value={form.testId} onChange={(e) => setForm({ ...form, testId: e.target.value })}>
                      <option value="">— select test —</option>
                      {tests.map((t2) => <option key={t2._id} value={t2._id}>{t2.name}{t2.code ? ` (${t2.code})` : ''}</option>)}
                    </AdminSelectBare>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('admin:acceptanceScope')}</label>
                    <AdminSelectBare value={form.acceptanceScope} onChange={(e) => setForm({ ...form, acceptanceScope: e.target.value })}>
                      {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </AdminSelectBare>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('admin:acceptanceInstitutionLabel')}</label>
                    <AdminSelectBare value={form.institutionId} onChange={(e) => handleInstitutionChange(e.target.value)}>
                      <option value="">— select institution —</option>
                      {institutions.map((i) => <option key={i._id} value={i._id}>{i.officialName || i.name}</option>)}
                    </AdminSelectBare>
                  </div>

                  {form.institutionId && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t('admin:acceptanceProgramLabel')}</label>
                      <AdminSelectBare value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
                        <option value="">— any program —</option>
                        {programsByInstitution.map((p) => <option key={p._id} value={p._id}>{p.title || p.name}</option>)}
                      </AdminSelectBare>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('admin:acceptanceStatus')}</label>
                    <AdminSelectBare value={form.acceptanceStatus} onChange={(e) => setForm({ ...form, acceptanceStatus: e.target.value })}>
                      {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </AdminSelectBare>
                  </div>

                  <input
                    type="number"
                    min="0"
                    className={adminFieldClass}
                    placeholder={t('admin:acceptanceMinScore')}
                    value={form.minimumOverallScore}
                    onChange={(e) => setForm({ ...form, minimumOverallScore: e.target.value })}
                  />

                  <input
                    type="number"
                    min="1"
                    className={adminFieldClass}
                    placeholder={t('admin:acceptanceResultValidityMonths') + ' (months)'}
                    value={form.resultValidityMonths}
                    onChange={(e) => setForm({ ...form, resultValidityMonths: e.target.value })}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('admin:acceptanceSectionMinimums')}</span>
                      <button type="button" className="text-xs text-primary dark:text-mint hover:underline" onClick={addSection}>
                        + {t('admin:acceptanceAddSection')}
                      </button>
                    </div>
                    {form.sectionMinimums.map((sec, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <input
                          className={`${adminFieldClass} flex-1`}
                          placeholder={t('admin:acceptanceSectionName')}
                          value={sec.sectionName}
                          onChange={(e) => updateSection(idx, 'sectionName', e.target.value)}
                        />
                        <input
                          type="number"
                          className={`${adminFieldClass} w-24`}
                          placeholder={t('admin:acceptanceSectionMin')}
                          value={sec.minimum}
                          onChange={(e) => updateSection(idx, 'minimum', e.target.value)}
                        />
                        <input
                          className={`${adminFieldClass} w-24`}
                          placeholder={t('admin:acceptanceSectionScale')}
                          value={sec.scale}
                          onChange={(e) => updateSection(idx, 'scale', e.target.value)}
                        />
                        <button type="button" className="text-red-500 hover:text-red-700 text-sm px-2" onClick={() => removeSection(idx)}>✕</button>
                      </div>
                    ))}
                  </div>

                  <textarea
                    rows={2}
                    className={adminFieldClass}
                    placeholder={t('admin:fieldConditions', { defaultValue: 'Conditions / notes (public)' })}
                    value={form.conditions}
                    onChange={(e) => setForm({ ...form, conditions: e.target.value })}
                  />

                  <textarea
                    rows={2}
                    className={adminFieldClass}
                    placeholder={t('admin:acceptanceNotes') + ' (admin only — never public)'}
                    value={form.adminNotes}
                    onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="button" disabled={saving || !form.testId} onClick={handleSave} className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50">
                    {saving ? t('common:saving') : t('common:save')}
                  </button>
                  <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600">
                    {t('common:cancel')}
                  </button>
                </div>
              </div>
            </div>
          </EscapeWhen>
        )}

        {confirm && (
          <AdminConfirmDialog
            message={confirm.message}
            onConfirm={confirm.onConfirm}
            onCancel={() => setConfirm(null)}
          />
        )}
      </div>
    </AdminRouteGuard>
  );
}
