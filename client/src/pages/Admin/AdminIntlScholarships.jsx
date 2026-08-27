import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { adminFieldClass, linesToText, textToLines } from '../../components/admin/AdminImageUrlField';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { AdminSlugField } from '../../components/admin/AdminSlugField';
import { AdminViewPublicLink, isAdminSlugPreviewReady } from '../../components/admin/AdminViewPublicLink';
import { adminContentApi } from '../../services/adminContentApi';
import { ROUTES } from '../../constants';
import { EscapeWhen } from '../../a11y/EscapeWhen';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { coerceCountryCode, countryDisplayName } from '@shared/international/country.js';

const EMPTY = {
  title: '',
  country: '',
  university: '',
  provider: '',
  fundingType: '',
  degreeLevel: '',
  amount: '',
  deadline: '',
  eligibility: '',
  link: '',
  status: 'draft',
  isFeatured: false,
  slug: '',
  seoTitle: '',
  metaDescription: '',
};

export default function AdminIntlScholarships() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_SCHOLARSHIPS);

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch } = useAdminList('/admin/intl-scholarships');
  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setFormOpen(true); };

  const openEdit = async (id) => {
    try {
      const res = await adminContentApi.getIntlScholarship(id);
      const item = res.data;
      setForm({
        ...EMPTY,
        ...item,
        eligibility: linesToText(item.eligibility),
        deadline: item.deadline ? item.deadline.slice(0, 10) : '',
      });
      setEditingId(id);
      setFormOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const save = async () => {
    if (!form.title?.trim() || !form.country?.trim()) {
      toast.error(t('admin:intlScholarshipValidation'));
      return;
    }
    setSaving(true);
    const payload = { ...form, eligibility: textToLines(form.eligibility) };
    try {
      if (editingId) await adminContentApi.updateIntlScholarship(editingId, payload);
      else await adminContentApi.createIntlScholarship(payload);
      toast.success(t('admin:saved'));
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
      if (action === 'delete') await adminContentApi.deleteIntlScholarship(id);
      else if (action === 'duplicate') await adminContentApi.duplicateIntlScholarship(id);
      else if (action === 'publish') await adminContentApi.updateIntlScholarship(id, { status: 'active' });
      else if (action === 'archive') await adminContentApi.updateIntlScholarship(id, { status: 'closed' });
      else if (action === 'draft') await adminContentApi.updateIntlScholarship(id, { status: 'draft' });
      toast.success(t('admin:actionDone'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const columns = [
    { key: 'title', label: t('admin:colTitle'), sortable: true },
    { key: 'country', label: t('admin:colCountry') },
    { key: 'university', label: t('admin:colUniversity') },
    { key: 'fundingType', label: t('admin:fieldFundingType') },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canEdit && <button type="button" onClick={() => openEdit(row._id)} className="text-xs text-primary underline">{t('common:edit')}</button>}
          <AdminViewPublicLink
            ready={row.status === 'active' && Boolean(row.slug)}
            href={row.slug ? `${ROUTES.INTL_SCHOLARSHIPS}/${row.slug}` : ''}
            label={t('admin:viewPublic')}
          />
          {canEdit && (
            <>
              <button type="button" onClick={() => runAction('duplicate', row._id)} className="text-xs">{t('admin:duplicate')}</button>
              {row.status !== 'active' && <button type="button" onClick={() => runAction('publish', row._id)} className="text-xs">{t('admin:published')}</button>}
              <button type="button" onClick={() => setConfirm({ id: row._id })} className="text-xs text-red-600">{t('common:delete')}</button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_SCHOLARSHIPS}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageIntlScholarships')}</h1>
          {canEdit && (
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">{t('admin:addIntlScholarship')}</button>
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
          filterFields={['search', 'status', 'country', 'funding', 'featured']}
          selectable={canEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          bulkActions={canEdit ? [
            { id: 'publish', label: t('admin:bulkPublish') },
            { id: 'archive', label: t('admin:bulkArchive') },
            { id: 'feature', label: t('admin:bulkFeature') },
            { id: 'delete', label: t('admin:bulkDelete'), danger: true },
          ] : []}
          onBulkAction={(action, ids) => adminContentApi.bulkIntlScholarships(action, ids).then(() => { toast.success(t('admin:bulkDone')); setSelectedIds([]); refetch(); }).catch(() => toast.error(t('admin:actionFailed')))}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'intl-scholarships' : undefined}
          onExport={(r, f) => adminContentApi.exportData(r, f)}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-2xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">{editingId ? t('admin:editIntlScholarship') : t('admin:addIntlScholarship')}</h3>
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto">
                <input className={adminFieldClass} placeholder={t('admin:fieldTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('admin:colCountry')} *</label>
                  <CountrySelect
                    value={coerceCountryCode(form.country) || ''}
                    onChange={(code) => setForm({ ...form, country: code ? (countryDisplayName(code) || code) : '' })}
                    inputClassName={adminFieldClass}
                    placeholder={t('admin:countryPlaceholder')}
                  />
                </div>
                <input className={adminFieldClass} placeholder={t('admin:fieldUniversity')} value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:colProvider')} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldFundingType')} value={form.fundingType} onChange={(e) => setForm({ ...form, fundingType: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldDegreeLevel')} value={form.degreeLevel} onChange={(e) => setForm({ ...form, degreeLevel: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldFunding')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                <input type="date" className={adminFieldClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                <textarea rows={3} className={adminFieldClass} placeholder={t('admin:fieldEligibility')} value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:applyLinkPlaceholder')} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
                <AdminSelectBare  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </AdminSelectBare>
                <AdminSlugField
                  resourceType="intl-scholarship"
                  value={form.slug}
                  onChange={(slug) => setForm({ ...form, slug })}
                  sourceText={`${form.title} ${form.country || ''}`.trim()}
                  status={form.status}
                  excludeId={editingId}
                  publicPreviewReady={isAdminSlugPreviewReady('intl-scholarship', form, form.status)}
                />
                <input className={adminFieldClass} placeholder={t('admin:fieldSeoTitle')} value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
                <textarea rows={2} className={adminFieldClass} placeholder={t('admin:fieldMetaDescription')} value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /> {t('admin:fieldFeatured')}</label>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 border rounded-lg text-sm">{t('common:cancel')}</button>
                <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">{saving ? t('admin:saving') : t('admin:save')}</button>
              </div>
            </div>
          </div>
        )}

        {confirm && <AdminConfirmDialog open title={t('admin:bulkDeleteConfirm')} onConfirm={() => runAction('delete', confirm.id)} onCancel={() => setConfirm(null)} />}
      </div>
    </AdminRouteGuard>
  );
}
