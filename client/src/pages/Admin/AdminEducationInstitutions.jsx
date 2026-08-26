import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminSelectBare, adminFieldClass } from '../../components/admin/AdminFormFields';
import { adminEducationInstitutionsApi } from '../../services/adminEducationInstitutionsApi';
import { ROUTES } from '../../constants';
import { EscapeWhen } from '../../a11y/EscapeWhen';
import {
  INSTITUTION_TYPES,
  PUB_STATUSES,
} from '@shared/education/taxonomy.js';

const EMPTY = {
  officialName: '',
  slug: '',
  countryCode: '',
  region: '',
  city: '',
  institutionType: '',
  officialWebsite: '',
  officialDomain: '',
  isPublic: '',
  status: PUB_STATUSES.DRAFT,
  sourceUrl: '',
  sourceType: 'official',
  sourcePublisher: '',
};

function toForm(doc) {
  const sources = Array.isArray(doc.sources) ? doc.sources : [];
  const first = sources[0] || {};
  return {
    ...EMPTY,
    officialName: doc.officialName || '',
    slug: doc.slug || '',
    countryCode: doc.countryCode || '',
    region: doc.region || '',
    city: doc.city || '',
    institutionType: doc.institutionType || '',
    officialWebsite: doc.officialWebsite || '',
    officialDomain: doc.officialDomain || '',
    isPublic: doc.isPublic == null ? '' : String(doc.isPublic),
    status: doc.status || PUB_STATUSES.DRAFT,
    sourceUrl: first.sourceUrl || '',
    sourceType: first.sourceType || 'official',
    sourcePublisher: first.publisher || '',
  };
}

function buildPayload(form) {
  const sources = form.sourceUrl?.trim()
    ? [{
      sourceType: form.sourceType || 'official',
      sourceUrl: form.sourceUrl.trim(),
      publisher: form.sourcePublisher || '',
    }]
    : [];
  let isPublic = null;
  if (form.isPublic === 'true') isPublic = true;
  if (form.isPublic === 'false') isPublic = false;
  return {
    officialName: form.officialName,
    slug: form.slug || undefined,
    countryCode: form.countryCode,
    region: form.region,
    city: form.city,
    institutionType: form.institutionType,
    officialWebsite: form.officialWebsite,
    officialDomain: form.officialDomain,
    isPublic,
    status: form.status,
    sources,
  };
}

export default function AdminEducationInstitutions() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_UNIVERSITIES);

  const {
    data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch,
  } = useAdminList('/admin/education/institutions', {
    initialFilters: {
      search: '',
      status: '',
      country: '',
      region: '',
      city: '',
      institutionType: '',
    },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [trustNote, setTrustNote] = useState('');
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
    { key: 'country', type: 'text', label: t('admin:colCountry'), placeholder: `${t('admin:colCountry')} (ISO)` },
    {
      key: 'region',
      type: 'text',
      label: t('admin:fieldRegion', { defaultValue: 'State / Province / Region' }),
      placeholder: t('admin:fieldRegion', { defaultValue: 'State / Province / Region' }),
    },
    { key: 'city', type: 'text', label: t('admin:fieldCity'), placeholder: t('admin:fieldCity') },
    {
      key: 'institutionType',
      type: 'select',
      label: t('admin:colInstitutionType', { defaultValue: 'Type' }),
      options: [
        { value: '', label: t('admin:filterAll') },
        ...Object.values(INSTITUTION_TYPES).map((v) => ({ value: v, label: v })),
      ],
    },
  ], [t]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setTrustNote(t('admin:catalogTrustHint', {
      defaultValue: 'Creating a catalog record does not approve verification or claim authority.',
    }));
    setFormOpen(true);
  };

  const openEdit = async (id) => {
    try {
      const res = await adminEducationInstitutionsApi.get(id);
      const doc = res.data?.data || res.data;
      setForm(toForm(doc));
      setEditingId(id);
      setTrustNote(
        t('admin:catalogTrustStatus', {
          defaultValue: 'Claim: {{claim}} · Verification: {{verification}} — catalog edits never approve either.',
          claim: doc.claimState || t('admin:none', { defaultValue: 'none' }),
          verification: doc.verificationStatus || t('admin:none', { defaultValue: 'none' }),
        })
      );
      setFormOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const save = async ({ publish = false, archive = false } = {}) => {
    if (!form.officialName?.trim()) {
      toast.error(t('admin:titleRequired'));
      return;
    }
    if (!form.institutionType) {
      toast.error(t('admin:institutionTypeRequired', { defaultValue: 'Institution type is required' }));
      return;
    }
    if (!form.countryCode?.trim()) {
      toast.error(t('admin:countryRequired', { defaultValue: 'Country (ISO alpha-2) is required' }));
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (archive && editingId) {
        await adminEducationInstitutionsApi.update(editingId, { status: PUB_STATUSES.ARCHIVED });
      } else if (publish) {
        payload.status = PUB_STATUSES.PUBLISHED;
        if (editingId) await adminEducationInstitutionsApi.update(editingId, payload);
        else await adminEducationInstitutionsApi.create(payload);
      } else if (editingId) {
        await adminEducationInstitutionsApi.update(editingId, payload);
      } else {
        await adminEducationInstitutionsApi.create(payload);
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
        const res = await adminEducationInstitutionsApi.get(id);
        const doc = res.data?.data || res.data;
        await adminEducationInstitutionsApi.update(id, {
          status: PUB_STATUSES.PUBLISHED,
          sources: doc.sources || [],
          countryCode: doc.countryCode,
        });
      } else if (action === 'archive') {
        await adminEducationInstitutionsApi.update(id, { status: PUB_STATUSES.ARCHIVED });
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
      key: 'officialName',
      label: t('admin:colInstitution', { defaultValue: 'Institution' }),
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium break-words">{row.officialName}</div>
          <div className="text-xs text-gray-500">{row.slug}</div>
        </div>
      ),
    },
    { key: 'countryCode', label: t('admin:colCountry'), sortable: true },
    {
      key: 'region',
      label: t('admin:fieldRegion', { defaultValue: 'Region' }),
      render: (row) => row.region || '—',
    },
    { key: 'city', label: t('admin:fieldCity'), render: (row) => row.city || '—' },
    { key: 'institutionType', label: t('admin:colInstitutionType', { defaultValue: 'Type' }) },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'claimState',
      label: t('admin:colClaimState', { defaultValue: 'Claim' }),
      render: (row) => row.claimState || '—',
    },
    {
      key: 'verificationStatus',
      label: t('admin:colVerificationState', { defaultValue: 'Verification' }),
      render: (row) => row.verificationStatus || '—',
    },
    { key: 'updatedAt', label: t('admin:colUpdated', { defaultValue: 'Updated' }), type: 'date', sortable: true },
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
          <Link to={`${ROUTES.ADMIN}/programs`} className="text-xs underline" title={t('admin:useInPrograms', { defaultValue: 'Use in Programs' })}>
            {t('admin:programs', { defaultValue: 'Programs' })}
          </Link>
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
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_UNIVERSITIES}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('admin:educationInstitutions', { defaultValue: 'Education Institutions' })}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('admin:educationInstitutionsHint', {
                defaultValue: 'Canonical Institution catalog for Program Explorer, Test Acceptance, and claims. Separate from legacy Schools & Colleges and does not grant verification or claim authority.',
              })}
            </p>
          </div>
          {canEdit && (
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">
              {t('admin:addEducationInstitution', { defaultValue: 'Add institution' })}
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
              <h3 className="text-lg font-bold mb-2">
                {editingId
                  ? t('admin:editEducationInstitution', { defaultValue: 'Edit education institution' })
                  : t('admin:addEducationInstitution', { defaultValue: 'Add institution' })}
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-200 mb-4" data-testid="catalog-trust-hint">
                {trustNote}
              </p>
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto">
                <input
                  className={adminFieldClass}
                  placeholder={`${t('admin:colInstitution', { defaultValue: 'Official name' })} *`}
                  value={form.officialName}
                  onChange={(e) => setForm({ ...form, officialName: e.target.value })}
                />
                <input className={adminFieldClass} placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />

                <AdminSelectBare
                  className={adminFieldClass}
                  value={form.institutionType}
                  onChange={(e) => setForm({ ...form, institutionType: e.target.value })}
                >
                  <option value="">{t('admin:colInstitutionType', { defaultValue: 'Institution type' })} *</option>
                  {Object.values(INSTITUTION_TYPES).map((v) => <option key={v} value={v}>{v}</option>)}
                </AdminSelectBare>

                <input
                  className={adminFieldClass}
                  placeholder={`${t('admin:colCountry')} * (ISO alpha-2)`}
                  value={form.countryCode}
                  onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}
                  maxLength={2}
                />
                <input
                  className={adminFieldClass}
                  placeholder={t('admin:fieldRegion', { defaultValue: 'State / Province / Region' })}
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                />
                <input
                  className={adminFieldClass}
                  placeholder={t('admin:fieldCity')}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />

                <input
                  className={adminFieldClass}
                  placeholder={t('admin:fieldOfficialWebsite', { defaultValue: 'Official website' })}
                  value={form.officialWebsite}
                  onChange={(e) => setForm({ ...form, officialWebsite: e.target.value })}
                />
                <input
                  className={adminFieldClass}
                  placeholder={t('admin:fieldOfficialDomain', { defaultValue: 'Official domain' })}
                  value={form.officialDomain}
                  onChange={(e) => setForm({ ...form, officialDomain: e.target.value.toLowerCase() })}
                />

                <AdminSelectBare
                  className={adminFieldClass}
                  value={form.isPublic}
                  onChange={(e) => setForm({ ...form, isPublic: e.target.value })}
                >
                  <option value="">{t('admin:fieldIsPublicUnset', { defaultValue: 'Public / private unset' })}</option>
                  <option value="true">{t('admin:fieldIsPublicTrue', { defaultValue: 'Public institution' })}</option>
                  <option value="false">{t('admin:fieldIsPublicFalse', { defaultValue: 'Private institution' })}</option>
                </AdminSelectBare>

                <AdminSelectBare
                  className={adminFieldClass}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {Object.values(PUB_STATUSES).map((v) => <option key={v} value={v}>{v}</option>)}
                </AdminSelectBare>

                <input
                  className={adminFieldClass}
                  placeholder={t('admin:fieldSourceUrl', { defaultValue: 'Source URL (required to publish)' })}
                  value={form.sourceUrl}
                  onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                />
                <input
                  className={adminFieldClass}
                  placeholder={t('admin:fieldSourcePublisher', { defaultValue: 'Source publisher' })}
                  value={form.sourcePublisher}
                  onChange={(e) => setForm({ ...form, sourcePublisher: e.target.value })}
                />
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <button type="button" disabled={saving} onClick={() => save()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">
                  {t('common:save')}
                </button>
                {canEdit && (
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
            ? t('admin:confirmPublish', { defaultValue: 'Publish institution?' })
            : t('admin:confirmArchive', { defaultValue: 'Archive institution?' })}
          message={confirm?.action === 'publish'
            ? t('admin:confirmPublishInstitutionBody', {
              defaultValue: 'Publishing catalogs the institution for education discovery APIs. It does not approve organization verification or institution claims.',
            })
            : t('admin:confirmArchiveInstitutionBody', {
              defaultValue: 'Archiving removes the institution from published education discovery.',
            })}
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
