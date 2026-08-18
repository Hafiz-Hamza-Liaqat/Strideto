import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminImageUrlField, adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { AdminSlugField } from '../../components/admin/AdminSlugField';
import { AdminLocaleSelect, AdminSeoFields, AdminPublishFields } from '../../components/admin/AdminCmsFields';
import { adminContentApi } from '../../services/adminContentApi';
import { ROUTES } from '../../constants';
import { getCmsBannerPlacements } from '@shared/placementRegistry.js';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const CMS_BANNER_PLACEMENTS = getCmsBannerPlacements();

const TABS = [
  { id: 'homepage', label: 'Homepage', perm: PERMISSIONS.CONTENT_SITE },
  { id: 'header', label: 'Navigation', perm: PERMISSIONS.CONTENT_NAV },
  { id: 'footer', label: 'Footer', perm: PERMISSIONS.CONTENT_NAV },
  { id: 'pages', label: 'Static Pages', perm: PERMISSIONS.CONTENT_PAGES },
  { id: 'banners', label: 'Banners', perm: PERMISSIONS.CONTENT_SITE },
];

const PAGE_TYPES = ['about', 'contact', 'faq', 'privacy', 'terms', 'cookies', 'disclaimer', 'refund', 'careers', 'advertise', 'help', 'support', 'services', 'license', 'custom'];

const EMPTY_PAGE = {
  title: '', slug: '', locale: 'en', heading: '', content: '', pageType: 'custom',
  status: 'draft', scheduledAt: '', seoTitle: '', metaDescription: '', canonicalUrl: '', ogImageUrl: '',
};

const EMPTY_BANNER = {
  title: '', locale: 'en', headline: '', subheadline: '', ctaLabel: '', ctaUrl: '',
  backgroundImageUrl: '', mobileImageUrl: '', active: true, order: 0, status: 'draft',
  scheduledStart: '', scheduledEnd: '', placement: 'homepage',
};

function JsonListEditor({ label, items, onChange, fields }) {
  const add = () => onChange([...(items || []), fields.reduce((a, f) => ({ ...a, [f.key]: f.default ?? '' }), {})]);
  const update = (i, key, val) => {
    const next = [...(items || [])];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };
  const remove = (i) => onChange((items || []).filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-gray-900 dark:text-white">{label}</span>
        <button type="button" onClick={add} className="text-xs text-primary underline">+ Add</button>
      </div>
      {(items || []).map((item, i) => (
        <div key={i} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
          {fields.map((f) => (
            <label key={f.key} className="block text-xs">
              {f.label}
              <input
                className={adminFieldClass}
                type={f.type || 'text'}
                value={item[f.key] ?? ''}
                onChange={(e) => update(i, f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
              />
            </label>
          ))}
          <button type="button" onClick={() => remove(i)} className="text-xs text-red-600 underline">Remove</button>
        </div>
      ))}
    </div>
  );
}

function FooterColumnsEditor({ columns, onChange }) {
  const cols = columns || [];
  const addColumn = () => onChange([...cols, { title: '', titleUr: '', titleAr: '', links: [] }]);
  const updateColumn = (i, patch) => {
    const next = [...cols];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const removeColumn = (i) => onChange(cols.filter((_, idx) => idx !== i));
  const updateLinks = (colIdx, links) => updateColumn(colIdx, { links });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-gray-900 dark:text-white">Footer columns</span>
        <button type="button" onClick={addColumn} className="text-xs text-primary underline">+ Add column</button>
      </div>
      {cols.map((col, colIdx) => (
        <div key={colIdx} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
          <label className="block text-xs">Column title (EN)
            <input className={adminFieldClass} value={col.title || ''} onChange={(e) => updateColumn(colIdx, { title: e.target.value })} />
          </label>
          <label className="block text-xs">Column title (UR)
            <input className={adminFieldClass} value={col.titleUr || ''} onChange={(e) => updateColumn(colIdx, { titleUr: e.target.value })} />
          </label>
          <label className="block text-xs">Column title (AR)
            <input className={adminFieldClass} value={col.titleAr || ''} onChange={(e) => updateColumn(colIdx, { titleAr: e.target.value })} />
          </label>
          <JsonListEditor
            label="Links"
            items={col.links || []}
            onChange={(links) => updateLinks(colIdx, links)}
            fields={[
              { key: 'label', label: 'Label (EN)' },
              { key: 'labelUr', label: 'Label (UR)' },
              { key: 'labelAr', label: 'Label (AR)' },
              { key: 'path', label: 'Path' },
            ]}
          />
          <button type="button" onClick={() => removeColumn(colIdx)} className="text-xs text-red-600 underline">Remove column</button>
        </div>
      ))}
    </div>
  );
}

function FooterPromoEditor({ promo, onChange }) {
  const value = promo || {};
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-gray-900 dark:text-white">Promotional column</span>
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <input type="checkbox" checked={value.enabled !== false} onChange={(e) => set({ enabled: e.target.checked })} />
          Enabled
        </label>
      </div>
      <p className="text-xs text-gray-500">Optional footer promo block. Hidden on the public site when empty.</p>
      <div className="grid md:grid-cols-2 gap-3">
        <label className="block text-xs">Title (EN)
          <input className={adminFieldClass} value={value.title || ''} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className="block text-xs">Title (UR)
          <input className={adminFieldClass} value={value.titleUr || ''} onChange={(e) => set({ titleUr: e.target.value })} />
        </label>
        <label className="block text-xs md:col-span-2">Description (EN)
          <textarea className={adminFieldClass} rows={3} value={value.description || ''} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label className="block text-xs">CTA label (EN)
          <input className={adminFieldClass} value={value.ctaLabel || ''} onChange={(e) => set({ ctaLabel: e.target.value })} />
        </label>
        <label className="block text-xs">CTA URL
          <input className={adminFieldClass} value={value.ctaUrl || ''} onChange={(e) => set({ ctaUrl: e.target.value })} placeholder="/jobs or https://…" />
        </label>
        <label className="flex items-center gap-2 text-xs md:col-span-2">
          <input type="checkbox" checked={Boolean(value.ctaExternal)} onChange={(e) => set({ ctaExternal: e.target.checked })} />
          Open CTA in new tab (external link)
        </label>
        <AdminImageUrlField label="Image URL (optional)" value={value.imageUrl || ''} onChange={(imageUrl) => set({ imageUrl })} />
        <label className="block text-xs">Icon text (optional, used when no image)
          <input className={adminFieldClass} value={value.icon || ''} onChange={(e) => set({ icon: e.target.value })} placeholder="e.g. ER" />
        </label>
      </div>
    </div>
  );
}

export default function AdminSiteCms() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canPublish = can(PERMISSIONS.CONTENT_CMS_PUBLISH);

  const visibleTabs = TABS.filter((tab) => can(tab.perm));
  const [tab, setTab] = useState(visibleTabs[0]?.id || 'homepage');
  const [locale, setLocale] = useState('en');
  const [saving, setSaving] = useState(false);

  // Homepage
  const [homepage, setHomepage] = useState(null);
  // Navigation
  const [headerNav, setHeaderNav] = useState(null);
  const [footerNav, setFooterNav] = useState(null);
  // Pages
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pageFormOpen, setPageFormOpen] = useState(false);
  const [pageForm, setPageForm] = useState(EMPTY_PAGE);
  const [pageEditingId, setPageEditingId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  // Banners
  const [banners, setBanners] = useState([]);
  const [bannerFormOpen, setBannerFormOpen] = useState(false);
  const [bannerForm, setBannerForm] = useState(EMPTY_BANNER);
  const [bannerEditingId, setBannerEditingId] = useState(null);

  const loadHomepage = useCallback(async () => {
    const res = await adminContentApi.getCmsHomepage(locale);
    setHomepage(res.data || { locale, hero: {}, sections: {}, stats: [] });
  }, [locale]);

  const loadNav = useCallback(async () => {
    const [h, f] = await Promise.all([
      adminContentApi.getCmsNavigation(locale, 'header'),
      adminContentApi.getCmsNavigation(locale, 'footer'),
    ]);
    setHeaderNav(h.data || { locale, placement: 'header', items: [] });
    setFooterNav(f.data || { locale, placement: 'footer', columns: [], socialLinks: [] });
  }, [locale]);

  const loadPages = useCallback(async () => {
    setPagesLoading(true);
    try {
      const res = await adminContentApi.listCmsPages({ locale, limit: 100 });
      setPages(res.data?.data || res.data || []);
    } finally {
      setPagesLoading(false);
    }
  }, [locale]);

  const loadBanners = useCallback(async () => {
    const res = await adminContentApi.listCmsBanners({ locale, limit: 100 });
    setBanners(res.data?.data || res.data || []);
  }, [locale]);

  useEffect(() => {
    if (tab === 'homepage') loadHomepage().catch(() => toast.error(t('admin:loadFailed')));
    if (tab === 'header' || tab === 'footer') loadNav().catch(() => toast.error(t('admin:loadFailed')));
    if (tab === 'pages') loadPages().catch(() => toast.error(t('admin:loadFailed')));
    if (tab === 'banners') loadBanners().catch(() => toast.error(t('admin:loadFailed')));
  }, [tab, locale, loadHomepage, loadNav, loadPages, loadBanners, toast, t]);

  const saveHomepage = async () => {
    setSaving(true);
    try {
      await adminContentApi.saveCmsHomepage({ ...homepage, locale });
      toast.success(t('admin:saved'));
      loadHomepage();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const publishHomepage = async () => {
    if (!canPublish) return;
    try {
      await adminContentApi.publishCmsHomepage(locale);
      toast.success(t('admin:actionDone'));
      loadHomepage();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  const saveHeaderNav = async () => {
    setSaving(true);
    try {
      await adminContentApi.saveCmsNavigation({ ...headerNav, locale, placement: 'header' });
      toast.success(t('admin:saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const saveFooterNav = async () => {
    setSaving(true);
    try {
      await adminContentApi.saveCmsNavigation({ ...footerNav, locale, placement: 'footer' });
      toast.success(t('admin:saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const openPageEdit = async (id) => {
    const res = await adminContentApi.getCmsPage(id);
    const p = res.data;
    setPageForm({
      ...EMPTY_PAGE, ...p,
      scheduledAt: p.scheduledAt ? p.scheduledAt.slice(0, 16) : '',
    });
    setPageEditingId(id);
    setPageFormOpen(true);
  };

  const savePage = async () => {
    if (!pageForm.title?.trim()) { toast.error(t('admin:titleRequired')); return; }
    setSaving(true);
    try {
      if (pageEditingId) await adminContentApi.updateCmsPage(pageEditingId, pageForm);
      else await adminContentApi.createCmsPage(pageForm);
      toast.success(t('admin:saved'));
      setPageFormOpen(false);
      loadPages();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const saveBanner = async () => {
    if (!bannerForm.title?.trim()) { toast.error(t('admin:titleRequired')); return; }
    setSaving(true);
    try {
      if (bannerEditingId) await adminContentApi.updateCmsBanner(bannerEditingId, bannerForm);
      else await adminContentApi.createCmsBanner(bannerForm);
      toast.success(t('admin:saved'));
      setBannerFormOpen(false);
      loadBanners();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const pageColumns = [
    { key: 'title', label: t('admin:colTitle') },
    { key: 'slug', label: 'Slug' },
    { key: 'pageType', label: 'Type' },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'actions', label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => openPageEdit(row._id)} className="text-xs text-primary underline">{t('common:edit')}</button>
          {canPublish && row.status !== 'published' && (
            <button type="button" onClick={() => adminContentApi.publishCmsPage(row._id).then(loadPages)} className="text-xs underline">Publish</button>
          )}
          <button type="button" onClick={() => setConfirm({ type: 'page', id: row._id })} className="text-xs text-red-600 underline">{t('common:delete')}</button>
        </div>
      ),
    },
  ];

  const bannerColumns = [
    { key: 'title', label: t('admin:colTitle') },
    { key: 'placement', label: 'Placement', render: (r) => r.placement || 'homepage' },
    { key: 'order', label: 'Order' },
    { key: 'active', label: 'Active', render: (r) => (r.active ? 'Yes' : 'No') },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'actions', label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={async () => {
            const res = await adminContentApi.getCmsBanner(row._id);
            setBannerForm({ ...EMPTY_BANNER, ...res.data });
            setBannerEditingId(row._id);
            setBannerFormOpen(true);
          }} className="text-xs text-primary underline">{t('common:edit')}</button>
          <button type="button" onClick={() => setConfirm({ type: 'banner', id: row._id })} className="text-xs text-red-600 underline">{t('common:delete')}</button>
        </div>
      ),
    },
  ];

  return (
    <AdminRouteGuard anyPermission={[PERMISSIONS.CONTENT_SITE, PERMISSIONS.CONTENT_NAV, PERMISSIONS.CONTENT_PAGES]}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin:siteCms', { defaultValue: 'Site CMS' })}</h1>
          <AdminLocaleSelect value={locale} onChange={setLocale} />
        </div>

        <nav className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
          {visibleTabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-sm rounded-lg ${tab === id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'homepage' && homepage && (
          <div className="space-y-4">
            <AdminPublishFields form={homepage} setForm={setHomepage} canPublish={canPublish} />
            <div className="grid md:grid-cols-2 gap-3">
              <label className="block text-sm">Hero headline
                <input className={adminFieldClass} value={homepage.hero?.headline || ''} onChange={(e) => setHomepage({ ...homepage, hero: { ...homepage.hero, headline: e.target.value } })} />
              </label>
              <label className="block text-sm">Hero subheadline
                <input className={adminFieldClass} value={homepage.hero?.subheadline || ''} onChange={(e) => setHomepage({ ...homepage, hero: { ...homepage.hero, subheadline: e.target.value } })} />
              </label>
            </div>
            <AdminImageUrlField label="Hero background" value={homepage.hero?.backgroundImageUrl || ''} onChange={(v) => setHomepage({ ...homepage, hero: { ...homepage.hero, backgroundImageUrl: v } })} />
            <AdminImageUrlField label="Hero mobile image" value={homepage.hero?.mobileImageUrl || ''} onChange={(v) => setHomepage({ ...homepage, hero: { ...homepage.hero, mobileImageUrl: v } })} />
            <JsonListEditor
              label="Hero CTAs"
              items={homepage.hero?.ctas || []}
              onChange={(ctas) => setHomepage({ ...homepage, hero: { ...homepage.hero, ctas } })}
              fields={[
                { key: 'label', label: 'Label' },
                { key: 'url', label: 'URL' },
                { key: 'style', label: 'Style', default: 'primary' },
              ]}
            />
            <JsonListEditor
              label="Featured stats"
              items={homepage.stats || []}
              onChange={(stats) => setHomepage({ ...homepage, stats })}
              fields={[
                { key: 'label', label: 'Label' },
                { key: 'value', label: 'Value' },
                { key: 'icon', label: 'Icon' },
              ]}
            />
            <div className="grid sm:grid-cols-3 gap-3">
              {['featuredJobs', 'featuredScholarships', 'featuredAdmissions'].map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={homepage.sections?.[key]?.enabled !== false}
                    onChange={(e) => setHomepage({
                      ...homepage,
                      sections: { ...homepage.sections, [key]: { ...homepage.sections?.[key], enabled: e.target.checked } },
                    })}
                  />
                  {key}
                </label>
              ))}
            </div>
            <JsonListEditor
              label="Testimonials"
              items={homepage.sections?.testimonials?.items || []}
              onChange={(items) => setHomepage({
                ...homepage,
                sections: { ...homepage.sections, testimonials: { ...homepage.sections?.testimonials, enabled: true, items } },
              })}
              fields={[
                { key: 'quote', label: 'Quote' },
                { key: 'author', label: 'Author' },
                { key: 'role', label: 'Role' },
                { key: 'avatarUrl', label: 'Avatar URL' },
              ]}
            />
            <JsonListEditor
              label="Partner logos"
              items={homepage.sections?.partners?.logos || []}
              onChange={(logos) => setHomepage({
                ...homepage,
                sections: { ...homepage.sections, partners: { ...homepage.sections?.partners, enabled: true, logos } },
              })}
              fields={[
                { key: 'name', label: 'Name' },
                { key: 'imageUrl', label: 'Image URL' },
                { key: 'url', label: 'Link URL' },
              ]}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={homepage.sections?.studentResources?.enabled !== false}
                onChange={(e) => setHomepage({
                  ...homepage,
                  sections: { ...homepage.sections, studentResources: { ...homepage.sections?.studentResources, enabled: e.target.checked } },
                })}
              />
              Student resources section
            </label>
            <JsonListEditor
              label="Student resources"
              items={homepage.sections?.studentResources?.items || []}
              onChange={(items) => setHomepage({
                ...homepage,
                sections: { ...homepage.sections, studentResources: { ...homepage.sections?.studentResources, enabled: true, items } },
              })}
              fields={[
                { key: 'label', label: 'Label' },
                { key: 'description', label: 'Description' },
                { key: 'path', label: 'Path' },
                { key: 'icon', label: 'Icon' },
              ]}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={homepage.sections?.foreignStudyCountries?.enabled !== false}
                onChange={(e) => setHomepage({
                  ...homepage,
                  sections: { ...homepage.sections, foreignStudyCountries: { ...homepage.sections?.foreignStudyCountries, enabled: e.target.checked } },
                })}
              />
              Foreign study countries section
            </label>
            <JsonListEditor
              label="Foreign study countries"
              items={homepage.sections?.foreignStudyCountries?.items || []}
              onChange={(items) => setHomepage({
                ...homepage,
                sections: { ...homepage.sections, foreignStudyCountries: { ...homepage.sections?.foreignStudyCountries, enabled: true, items } },
              })}
              fields={[
                { key: 'name', label: 'Country name' },
                { key: 'path', label: 'Path' },
                { key: 'query', label: 'Query string (e.g. ?country=Turkey)' },
              ]}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={homepage.sections?.newsletter?.enabled !== false}
                onChange={(e) => setHomepage({
                  ...homepage,
                  sections: { ...homepage.sections, newsletter: { ...homepage.sections?.newsletter, enabled: e.target.checked } },
                })}
              />
              Newsletter section
            </label>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="block text-sm">Newsletter title
                <input className={adminFieldClass} value={homepage.sections?.newsletter?.title || ''} onChange={(e) => setHomepage({
                  ...homepage,
                  sections: { ...homepage.sections, newsletter: { ...homepage.sections?.newsletter, title: e.target.value } },
                })} />
              </label>
              <label className="block text-sm">Newsletter subtitle
                <input className={adminFieldClass} value={homepage.sections?.newsletter?.subtitle || ''} onChange={(e) => setHomepage({
                  ...homepage,
                  sections: { ...homepage.sections, newsletter: { ...homepage.sections?.newsletter, subtitle: e.target.value } },
                })} />
              </label>
            </div>
            <AdminSeoFields form={homepage} setForm={setHomepage} />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={saveHomepage} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">{t('common:save')}</button>
              {canPublish && (
                <button type="button" onClick={publishHomepage} className="px-4 py-2 rounded-lg border border-primary text-primary text-sm">Publish</button>
              )}
              <a href={`${ROUTES.HOME}?preview=cms`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-sm underline">Preview site</a>
            </div>
          </div>
        )}

        {tab === 'header' && headerNav && (
          <div className="space-y-4">
            <AdminPublishFields form={headerNav} setForm={setHeaderNav} canPublish={canPublish} />
            <JsonListEditor
              label="Main navigation items"
              items={headerNav.items || []}
              onChange={(items) => setHeaderNav({ ...headerNav, items })}
              fields={[
                { key: 'label', label: 'Label (EN)' },
                { key: 'labelUr', label: 'Label (UR)' },
                { key: 'labelAr', label: 'Label (AR)' },
                { key: 'path', label: 'Path' },
                { key: 'icon', label: 'Icon' },
                { key: 'order', label: 'Order', type: 'number', default: 0 },
              ]}
            />
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={saveHeaderNav} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">{t('common:save')}</button>
              {canPublish && (
                <button type="button" onClick={() => adminContentApi.publishCmsNavigation('header', locale).then(() => toast.success(t('admin:actionDone')))} className="px-4 py-2 rounded-lg border text-sm">Publish</button>
              )}
            </div>
          </div>
        )}

        {tab === 'footer' && footerNav && (
          <div className="space-y-4">
            <AdminPublishFields form={footerNav} setForm={setFooterNav} canPublish={canPublish} />
            <label className="block text-sm">Newsletter text
              <input className={adminFieldClass} value={footerNav.newsletterText || ''} onChange={(e) => setFooterNav({ ...footerNav, newsletterText: e.target.value })} />
            </label>
            <label className="block text-sm">Copyright
              <input className={adminFieldClass} value={footerNav.copyrightText || ''} onChange={(e) => setFooterNav({ ...footerNav, copyrightText: e.target.value })} />
            </label>
            <JsonListEditor
              label="Social links"
              items={footerNav.socialLinks || []}
              onChange={(socialLinks) => setFooterNav({ ...footerNav, socialLinks })}
              fields={[
                { key: 'platform', label: 'Platform' },
                { key: 'url', label: 'URL' },
                { key: 'icon', label: 'Icon' },
              ]}
            />
            <div className="grid md:grid-cols-3 gap-3">
              <label className="block text-sm">Contact email
                <input className={adminFieldClass} value={footerNav.contact?.email || ''} onChange={(e) => setFooterNav({ ...footerNav, contact: { ...footerNav.contact, email: e.target.value } })} />
              </label>
              <label className="block text-sm">Phone
                <input className={adminFieldClass} value={footerNav.contact?.phone || ''} onChange={(e) => setFooterNav({ ...footerNav, contact: { ...footerNav.contact, phone: e.target.value } })} />
              </label>
              <label className="block text-sm">Address
                <input className={adminFieldClass} value={footerNav.contact?.address || ''} onChange={(e) => setFooterNav({ ...footerNav, contact: { ...footerNav.contact, address: e.target.value } })} />
              </label>
            </div>
            <FooterColumnsEditor
              columns={footerNav.columns || []}
              onChange={(columns) => setFooterNav({ ...footerNav, columns })}
            />
            <FooterPromoEditor
              promo={footerNav.promoColumn}
              onChange={(promoColumn) => setFooterNav({ ...footerNav, promoColumn })}
            />
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={saveFooterNav} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">{t('common:save')}</button>
              {canPublish && (
                <button type="button" onClick={() => adminContentApi.publishCmsNavigation('footer', locale).then(() => toast.success(t('admin:actionDone')))} className="px-4 py-2 rounded-lg border text-sm">Publish</button>
              )}
            </div>
          </div>
        )}

        {tab === 'pages' && (
          <div className="space-y-4">
            <button type="button" onClick={() => { setPageForm({ ...EMPTY_PAGE, locale }); setPageEditingId(null); setPageFormOpen(true); }} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">+ New page</button>
            <AdminDataTable columns={pageColumns} data={pages} loading={pagesLoading} />
            {pageFormOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <EscapeWhen active onEscape={() => setPageFormOpen(false)} />
                <div className="bg-white dark:bg-gray-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-3">
                  <h3 className="font-semibold">{pageEditingId ? 'Edit page' : 'New page'}</h3>
                  <AdminPublishFields form={pageForm} setForm={setPageForm} canPublish={canPublish} />
                  <label className="block text-sm">Title<input className={adminFieldClass} value={pageForm.title} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })} /></label>
                  <AdminSlugField
                    resourceType="cms-page"
                    value={pageForm.slug}
                    onChange={(slug) => setPageForm({ ...pageForm, slug })}
                    sourceText={pageForm.title}
                    status={pageForm.status}
                    locale={pageForm.locale}
                    excludeId={pageEditingId}
                  />
                  <label className="block text-sm">Heading<input className={adminFieldClass} value={pageForm.heading} onChange={(e) => setPageForm({ ...pageForm, heading: e.target.value })} /></label>
                  <label className="block text-sm">Page type
                    <AdminSelectBare  value={pageForm.pageType} onChange={(e) => setPageForm({ ...pageForm, pageType: e.target.value })}>
                      {PAGE_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
                    </AdminSelectBare>
                  </label>
                  <label className="block text-sm">Rich content (HTML)
                    <textarea className={adminFieldClass} rows={8} value={pageForm.content} onChange={(e) => setPageForm({ ...pageForm, content: e.target.value })} />
                  </label>
                  <AdminSeoFields form={pageForm} setForm={setPageForm} />
                  <div className="flex gap-2 pt-2">
                    <button type="button" disabled={saving} onClick={savePage} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">{t('common:save')}</button>
                    <button type="button" onClick={() => setPageFormOpen(false)} className="px-4 py-2 text-sm">{t('common:cancel')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'banners' && (
          <div className="space-y-4">
            <button type="button" onClick={() => { setBannerForm({ ...EMPTY_BANNER, locale }); setBannerEditingId(null); setBannerFormOpen(true); }} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">+ New banner</button>
            <AdminDataTable columns={bannerColumns} data={banners} loading={false} />
            {bannerFormOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <EscapeWhen active onEscape={() => setBannerFormOpen(false)} />
                <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-3">
                  <h3 className="font-semibold">{bannerEditingId ? 'Edit banner' : 'New banner'}</h3>
                  <AdminPublishFields form={bannerForm} setForm={setBannerForm} canPublish={canPublish} />
                  <label className="block text-sm">Placement
                    <AdminSelectBare value={bannerForm.placement || 'homepage'} onChange={(e) => setBannerForm({ ...bannerForm, placement: e.target.value })}>
                      {CMS_BANNER_PLACEMENTS.map((p) => (
                        <option key={p.id} value={p.bannerPlacement}>{p.displayName}</option>
                      ))}
                    </AdminSelectBare>
                  </label>
                  <label className="block text-sm">Title<input className={adminFieldClass} value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} /></label>
                  <label className="block text-sm">Headline<input className={adminFieldClass} value={bannerForm.headline} onChange={(e) => setBannerForm({ ...bannerForm, headline: e.target.value })} /></label>
                  <label className="block text-sm">Subheadline<input className={adminFieldClass} value={bannerForm.subheadline} onChange={(e) => setBannerForm({ ...bannerForm, subheadline: e.target.value })} /></label>
                  <label className="block text-sm">CTA label<input className={adminFieldClass} value={bannerForm.ctaLabel} onChange={(e) => setBannerForm({ ...bannerForm, ctaLabel: e.target.value })} /></label>
                  <label className="block text-sm">CTA URL<input className={adminFieldClass} value={bannerForm.ctaUrl} onChange={(e) => setBannerForm({ ...bannerForm, ctaUrl: e.target.value })} /></label>
                  <AdminImageUrlField label="Background" value={bannerForm.backgroundImageUrl || ''} onChange={(v) => setBannerForm({ ...bannerForm, backgroundImageUrl: v })} />
                  <AdminImageUrlField label="Mobile image" value={bannerForm.mobileImageUrl || ''} onChange={(v) => setBannerForm({ ...bannerForm, mobileImageUrl: v })} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={bannerForm.active !== false} onChange={(e) => setBannerForm({ ...bannerForm, active: e.target.checked })} />
                    Active
                  </label>
                  <label className="block text-sm">Order<input type="number" className={adminFieldClass} value={bannerForm.order || 0} onChange={(e) => setBannerForm({ ...bannerForm, order: Number(e.target.value) })} /></label>
                  <div className="flex gap-2">
                    <button type="button" disabled={saving} onClick={saveBanner} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">{t('common:save')}</button>
                    <button type="button" onClick={() => setBannerFormOpen(false)} className="px-4 py-2 text-sm">{t('common:cancel')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {confirm && (
          <AdminConfirmDialog
            open
            title={t('admin:confirmDelete')}
            onConfirm={async () => {
              try {
                if (confirm.type === 'page') await adminContentApi.deleteCmsPage(confirm.id);
                if (confirm.type === 'banner') await adminContentApi.deleteCmsBanner(confirm.id);
                toast.success(t('admin:actionDone'));
                if (confirm.type === 'page') loadPages();
                if (confirm.type === 'banner') loadBanners();
              } catch (err) {
                toast.error(err.response?.data?.error || t('admin:actionFailed'));
              }
              setConfirm(null);
            }}
            onCancel={() => setConfirm(null)}
          />
        )}
      </div>
    </AdminRouteGuard>
  );
}
