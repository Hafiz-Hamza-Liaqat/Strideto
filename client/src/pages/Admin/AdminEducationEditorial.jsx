import { useCallback, useEffect, useState } from 'react';
import { adminContentApi } from '../../services/adminContentApi';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { PERMISSIONS } from '../../config/rbac';
import { ALERT_TYPES, PUB_STATUSES, RESOURCE_TYPES, TRUST_LEVELS } from '@shared/education/taxonomy.js';

const TABS = ['prep-guides', 'resources', 'alerts'];
const EMPTY = {
  testId: '', title: '', overview: '', status: PUB_STATUSES.DRAFT, url: '', provider: '',
  resourceType: RESOURCE_TYPES.OFFICIAL_GUIDE, trustLevel: TRUST_LEVELS.OFFICIAL,
  alertType: ALERT_TYPES.GENERAL, officialSourceUrl: '', sourceType: 'official', sourceUrl: '',
  publisher: '', evidenceRef: '', verifiedAt: '', retrievedAt: '',
  nextReviewAt: '',
};

function testName(row) { return row.testId?.name || row.testId?.slug || '—'; }
function firstSource(row) { return Array.isArray(row?.sources) ? row.sources[0] || {} : {}; }
function dateValue(value) { return value ? String(value).slice(0, 10) : ''; }
function sourcePayload(form) {
  if (!form.sourceUrl && !form.evidenceRef) return [];
  return [{
    sourceType: form.sourceType || 'official', sourceUrl: form.sourceUrl.trim(),
    publisher: form.publisher.trim(), evidenceRef: form.evidenceRef.trim(),
    verifiedAt: form.verifiedAt || undefined, retrievedAt: form.retrievedAt || undefined,
  }];
}

export default function AdminEducationEditorial() {
  const [tab, setTab] = useState(TABS[0]);
  const [tests, setTests] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [testResponse, contentResponse] = await Promise.all([
        adminContentApi.educationTests.list({ limit: 200 }),
        adminContentApi[tab === 'prep-guides' ? 'educationPrepGuides' : tab === 'resources' ? 'educationResources' : 'educationAlerts'].list({}),
      ]);
      setTests(testResponse.data?.data || []);
      setRows(contentResponse.data?.data || []);
    } catch { setError('Could not load editorial records.'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const open = (row) => {
    setFormOpen(true);
    setEditingId(row?._id || null);
    setForm(row ? {
      ...EMPTY, testId: row.testId?._id || row.testId || '', title: row.title || '', overview: row.overview || '',
      status: row.status || row.publicationStatus || PUB_STATUSES.DRAFT, url: row.url || '', provider: row.provider || '',
      resourceType: row.resourceType || EMPTY.resourceType, trustLevel: row.trustLevel || EMPTY.trustLevel,
      alertType: row.alertType || EMPTY.alertType, officialSourceUrl: row.officialSourceUrl || '',
      sourceType: firstSource(row).sourceType || 'official', sourceUrl: firstSource(row).sourceUrl || '',
      publisher: firstSource(row).publisher || '', evidenceRef: firstSource(row).evidenceRef || '',
      verifiedAt: dateValue(firstSource(row).verifiedAt), retrievedAt: dateValue(firstSource(row).retrievedAt),
      nextReviewAt: dateValue(row.nextReviewAt),
    } : { ...EMPTY });
  };

  const save = async () => {
    if (!form.testId || !form.title.trim()) return;
    setSaving(true); setError('');
    try {
      const api = tab === 'prep-guides' ? adminContentApi.educationPrepGuides : tab === 'resources' ? adminContentApi.educationResources : adminContentApi.educationAlerts;
      const body = tab === 'prep-guides'
        ? { testId: form.testId, title: form.title.trim(), overview: form.overview.trim(), status: form.status, nextReviewAt: form.nextReviewAt || null, sources: sourcePayload(form) }
        : tab === 'resources'
          ? { testId: form.testId, title: form.title.trim(), provider: form.provider.trim(), url: form.url.trim(), resourceType: form.resourceType, trustLevel: form.trustLevel, status: form.status, nextReviewAt: form.nextReviewAt || null, sources: sourcePayload(form) }
          : { testId: form.testId, title: form.title.trim(), alertType: form.alertType, officialSourceUrl: form.officialSourceUrl.trim(), publicationStatus: form.status, nextReviewAt: form.nextReviewAt || null, sources: sourcePayload(form) };
      if (editingId) await api.update(editingId, body); else await api.create(body);
      setEditingId(null); setForm({ ...EMPTY }); setFormOpen(false); setMessage('Editorial record saved.'); await load();
    } catch (err) { setError(err.response?.data?.error || 'Could not save editorial record.'); }
    finally { setSaving(false); }
  };

  const apiRows = rows.map((row) => ({ ...row, testName: testName(row), sourceSummary: firstSource(row).publisher || firstSource(row).sourceUrl || 'Not verified', verified: dateValue(row.lastVerifiedAt) || 'Not set', nextReview: dateValue(row.nextReviewAt) || 'Not scheduled', reviewState: row.verificationStatus === 'verified' && !row.nextReviewAt ? 'Verified — review not scheduled' : row.freshnessState || 'unknown' }));
  const columns = [
    { key: 'testName', label: 'Test' },
    { key: 'title', label: 'Title' },
    { key: tab === 'alerts' ? 'publicationStatus' : 'status', label: 'Status' },
    { key: 'sourceSummary', label: 'Source' },
    { key: 'verified', label: 'Last verified' },
    { key: 'nextReview', label: 'Next review' },
    { key: 'reviewState', label: 'Review state' },
    { key: 'actions', label: '', render: (_, row) => <button type="button" className="text-xs text-primary dark:text-mint hover:underline" onClick={() => open(row)}>Edit</button> },
  ];

  return <AdminRouteGuard permission={PERMISSIONS.CONTENT_ADMISSIONS}>
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div><h1 className="text-xl font-bold text-gray-900 dark:text-white">Test editorial content</h1><p className="text-sm text-gray-500">Manage source-aware guides, external resources, and factual alerts. No question authoring is available here.</p></div>
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((item) => <button key={item} type="button" onClick={() => { setTab(item); setEditingId(null); setFormOpen(false); }} className={`px-4 py-2 text-sm border-b-2 ${tab === item ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>{item.replace('-', ' ')}</button>)}
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {message && <p className="text-sm text-green-700 dark:text-green-300" role="status">{message}</p>}
      <button type="button" onClick={() => open(null)} className="bg-primary text-white px-4 py-2 rounded-lg text-sm">+ Add {tab.replace('-', ' ')}</button>
      <AdminDataTable columns={columns} rows={apiRows} loading={loading} />
      {formOpen ? <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 grid gap-3 max-w-2xl">
        <h2 className="font-semibold text-gray-900 dark:text-white">{editingId ? 'Edit' : 'Add'} {tab.replace('-', ' ')}</h2>
        <AdminSelectBare aria-label="Test" value={form.testId} onChange={(e) => setForm({ ...form, testId: e.target.value })}><option value="">Select test</option>{tests.map((test) => <option key={test._id} value={test._id}>{test.name}</option>)}</AdminSelectBare>
        <input className={adminFieldClass} aria-label="Title" placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        {tab === 'prep-guides' && <textarea className={adminFieldClass} rows={5} aria-label="Overview" placeholder="Overview" value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} />}
        {tab === 'resources' && <><input className={adminFieldClass} aria-label="Provider" placeholder="Provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /><input className={adminFieldClass} aria-label="HTTPS resource URL" placeholder="HTTPS resource URL *" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /><AdminSelectBare aria-label="Resource type" value={form.resourceType} onChange={(e) => setForm({ ...form, resourceType: e.target.value })}>{Object.values(RESOURCE_TYPES).map((value) => <option key={value} value={value}>{value}</option>)}</AdminSelectBare><AdminSelectBare aria-label="Trust level" value={form.trustLevel} onChange={(e) => setForm({ ...form, trustLevel: e.target.value })}>{Object.values(TRUST_LEVELS).map((value) => <option key={value} value={value}>{value}</option>)}</AdminSelectBare></>}
        {tab === 'alerts' && <><AdminSelectBare aria-label="Alert type" value={form.alertType} onChange={(e) => setForm({ ...form, alertType: e.target.value })}>{Object.values(ALERT_TYPES).map((value) => <option key={value} value={value}>{value}</option>)}</AdminSelectBare><input className={adminFieldClass} aria-label="Official source URL" placeholder="Official source URL" value={form.officialSourceUrl} onChange={(e) => setForm({ ...form, officialSourceUrl: e.target.value })} /></>}
        <fieldset className="grid gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><legend className="px-1 text-sm font-medium">Evidence and review</legend><AdminSelectBare aria-label="Source type" value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })}><option value="official">Official</option><option value="document">Document</option><option value="third_party">Third party</option><option value="other">Other</option></AdminSelectBare><input className={adminFieldClass} aria-label="Source URL" placeholder="Source URL (HTTPS)" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} /><input className={adminFieldClass} aria-label="Source publisher" placeholder="Publisher" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} /><input className={adminFieldClass} aria-label="Source title or evidence reference" placeholder="Source title / evidence reference" value={form.evidenceRef} onChange={(e) => setForm({ ...form, evidenceRef: e.target.value })} /><div className="grid sm:grid-cols-2 gap-3"><label className="text-xs text-gray-600 dark:text-gray-300">Verified at<input type="date" className={adminFieldClass} value={form.verifiedAt} onChange={(e) => setForm({ ...form, verifiedAt: e.target.value })} /></label><label className="text-xs text-gray-600 dark:text-gray-300">Retrieved at<input type="date" className={adminFieldClass} value={form.retrievedAt} onChange={(e) => setForm({ ...form, retrievedAt: e.target.value })} /></label><label className="text-xs text-gray-600 dark:text-gray-300">Next review (optional)<input type="date" className={adminFieldClass} value={form.nextReviewAt} onChange={(e) => setForm({ ...form, nextReviewAt: e.target.value })} /></label></div><p className="text-xs text-gray-500">Review state is derived from source verification and the optional review date. A published record needs valid source evidence.</p></fieldset>
        <AdminSelectBare aria-label="Publication status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{[PUB_STATUSES.DRAFT, PUB_STATUSES.PUBLISHED, PUB_STATUSES.ARCHIVED].map((value) => <option key={value} value={value}>{value}</option>)}</AdminSelectBare>
        <div className="flex gap-2"><button type="button" disabled={saving || !form.testId || !form.title.trim()} onClick={save} className="bg-primary text-white px-4 py-2 rounded-lg disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button><button type="button" onClick={() => { setEditingId(null); setForm({ ...EMPTY }); setFormOpen(false); }} className="border px-4 py-2 rounded-lg">Cancel</button></div>
      </div> : null}
    </div>
  </AdminRouteGuard>;
}
