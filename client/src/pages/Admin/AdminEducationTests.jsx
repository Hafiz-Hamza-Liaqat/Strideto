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
import { Link } from 'react-router-dom';
import { TEST_CATEGORIES, PUB_STATUSES } from '@shared/education/taxonomy.js';

const TABS = ['providers', 'tests'];

const EMPTY_PROVIDER = { name: '', website: '', notes: '' };
const EMPTY_TEST = {
  name: '',
  code: '',
  category: TEST_CATEGORIES.ENGLISH_PROFICIENCY,
  providerId: '',
  maxScore: '',
  validityMonths: '',
  description: '',
  status: PUB_STATUSES.DRAFT,
};

const TEST_CATEGORY_OPTIONS = [
  { value: TEST_CATEGORIES.ENGLISH_PROFICIENCY, label: 'English Proficiency' },
  { value: TEST_CATEGORIES.ADMISSIONS, label: 'Admissions' },
  { value: TEST_CATEGORIES.NATIONAL_QUALIFICATION, label: 'National Qualification' },
  { value: TEST_CATEGORIES.PROFESSIONAL, label: 'Professional' },
  { value: TEST_CATEGORIES.OTHER, label: 'Other' },
];

export default function AdminEducationTests() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();

  const [tab, setTab] = useState('providers');
  const [providers, setProviders] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PROVIDER);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const loadProviders = useCallback(async () => {
    try {
      const res = await adminContentApi.educationProviders.list({ limit: 200 });
      setProviders(res.data?.data || []);
    } catch {
      setError(t('admin:loadError'));
    }
  }, [t]);

  const loadTests = useCallback(async () => {
    try {
      const res = await adminContentApi.educationTests.list({ limit: 200 });
      setTests(res.data?.data || []);
    } catch {
      setError(t('admin:loadError'));
    }
  }, [t]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    await Promise.all([loadProviders(), loadTests()]);
    setLoading(false);
  }, [loadProviders, loadTests]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openAdd = () => {
    setEditingId(null);
    setForm(tab === 'providers' ? EMPTY_PROVIDER : EMPTY_TEST);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row._id);
    if (tab === 'providers') {
      setForm({ name: row.name || '', website: row.website || '', notes: row.notes || '' });
    } else {
      setForm({
        name: row.name || '',
        code: row.code || '',
        category: row.category || TEST_CATEGORIES.ENGLISH_PROFICIENCY,
        providerId: row.providerId?._id || row.providerId || '',
        maxScore: row.maxScore != null ? String(row.maxScore) : '',
        validityMonths: row.validityMonths != null ? String(row.validityMonths) : '',
        description: row.description || '',
        status: row.status || PUB_STATUSES.DRAFT,
      });
    }
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === 'providers') {
        const body = { name: form.name.trim(), website: form.website.trim() || undefined, notes: form.notes.trim() || undefined };
        if (editingId) await adminContentApi.educationProviders.update(editingId, body);
        else await adminContentApi.educationProviders.create(body);
      } else {
        const body = {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          category: form.category,
          providerId: form.providerId || undefined,
          maxScore: form.maxScore !== '' ? Number(form.maxScore) : undefined,
          validityMonths: form.validityMonths !== '' ? Number(form.validityMonths) : undefined,
          description: form.description.trim() || undefined,
          status: form.status,
        };
        if (editingId) await adminContentApi.educationTests.update(editingId, body);
        else await adminContentApi.educationTests.create(body);
      }
      toast({ type: 'success', message: t('common:saved') });
      setFormOpen(false);
      await loadAll();
    } catch {
      toast({ type: 'error', message: t('common:saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const providerColumns = [
    { key: 'name', label: t('admin:testProviderLabel') },
    { key: 'website', label: t('admin:testProviderWebsite'), render: (v) => v ? <a href={v} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-mint hover:underline text-xs">{v}</a> : '—' },
    { key: 'actions', label: '', render: (_, row) => (
      <button type="button" className="text-xs text-primary dark:text-mint hover:underline" onClick={() => openEdit(row)}>
        {t('common:edit')}
      </button>
    )},
  ];

  const testColumns = [
    { key: 'name', label: t('admin:testNameLabel') },
    { key: 'code', label: 'Code' },
    { key: 'category', label: t('admin:testCategoryLabel'), render: (v) => TEST_CATEGORY_OPTIONS.find((o) => o.value === v)?.label || v },
    { key: 'status', label: t('admin:testPublicationStatus') },
    { key: 'actions', label: '', render: (_, row) => (
      <button type="button" className="text-xs text-primary dark:text-mint hover:underline" onClick={() => openEdit(row)}>
        {t('common:edit')}
      </button>
    )},
  ];

  const rows = tab === 'providers' ? providers : tests;
  const cols = tab === 'providers' ? providerColumns : testColumns;
  const addLabel = tab === 'providers' ? t('admin:testProviderAddNew') : t('admin:testAddNew');

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_ADMISSIONS}>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:navTestsProviders')}</h1>
          <button type="button" className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition" onClick={openAdd}>
            + {addLabel}
          </button>
          <Link to="/admin/education/test-editorial" className="border border-primary text-primary px-4 py-2 rounded-lg text-sm hover:bg-primary/5">
            Editorial content
          </Link>
        </div>

        <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
          {TABS.map((t2) => (
            <button
              key={t2}
              type="button"
              onClick={() => { setTab(t2); setFormOpen(false); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === t2 ? 'border-primary text-primary dark:text-mint dark:border-mint' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
            >
              {t2 === 'providers' ? 'Providers' : 'Tests'}
            </button>
          ))}
        </div>

        {error && <p className="text-red-600 dark:text-red-400 mb-3 text-sm">{error}</p>}

        <AdminDataTable columns={cols} rows={rows} loading={loading} />

        {formOpen && (
          <EscapeWhen active onEscape={() => setFormOpen(false)}>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="max-w-lg w-full mx-auto rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold mb-4">
                  {editingId
                    ? (tab === 'providers' ? t('admin:testProviderEditTitle') : t('admin:testEditTitle'))
                    : addLabel}
                </h3>
                <div className="grid gap-3">
                  {tab === 'providers' ? (
                    <>
                      <input className={adminFieldClass} placeholder={t('admin:testProviderLabel') + ' *'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      <input className={adminFieldClass} placeholder={t('admin:testProviderWebsite')} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                      <textarea rows={3} className={adminFieldClass} placeholder={t('common:notes', { defaultValue: 'Notes' })} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </>
                  ) : (
                    <>
                      <input className={adminFieldClass} placeholder={t('admin:testNameLabel') + ' *'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      <input className={adminFieldClass} placeholder="Code (e.g. IELTS)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                      <AdminSelectBare value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                        {TEST_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </AdminSelectBare>
                      <AdminSelectBare value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}>
                        <option value="">{t('admin:testProviderLabel')} (optional)</option>
                        {providers.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                      </AdminSelectBare>
                      <input type="number" min="0" className={adminFieldClass} placeholder={t('admin:testMaxScore')} value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} />
                      <input type="number" min="1" className={adminFieldClass} placeholder={t('admin:testValidityMonths')} value={form.validityMonths} onChange={(e) => setForm({ ...form, validityMonths: e.target.value })} />
                      <textarea rows={3} className={adminFieldClass} placeholder={t('admin:fieldDescription')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                      <AdminSelectBare value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        <option value={PUB_STATUSES.DRAFT}>Draft</option>
                        <option value={PUB_STATUSES.PUBLISHED}>Published</option>
                        <option value={PUB_STATUSES.ARCHIVED}>Archived</option>
                      </AdminSelectBare>
                    </>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="button" disabled={saving || !form.name.trim()} onClick={handleSave} className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50">
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
