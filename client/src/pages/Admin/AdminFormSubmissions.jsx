import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { PERMISSIONS } from '../../config/rbac';
import { ROUTES } from '../../constants';
import { adminContentApi } from '../../services/adminContentApi';
import { useToast } from '../../context/ToastContext';

export default function AdminFormSubmissions() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminContentApi.listFormSubmissions({
        page,
        search: search.trim() || undefined,
        status: status || undefined,
      });
      setItems(data?.items || []);
      setPages(data?.pages || 1);
    } catch {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, toast]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    try {
      const { data } = await adminContentApi.getFormSubmission(id);
      setSelected(data.submission);
      if (data.submission?.status === 'new') {
        await adminContentApi.patchFormSubmission(id, { status: 'read' });
        load();
      }
    } catch {
      toast.error('Failed to load submission');
    }
  };

  const exportCsv = async () => {
    try {
      const { data } = await adminContentApi.exportFormSubmissions({ search, status });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'form-submissions.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this submission?')) return;
    await adminContentApi.deleteFormSubmission(id);
    setSelected(null);
    load();
  };

  return (
    <AdminRouteGuard permission={[PERMISSIONS.USERS_READ, PERMISSIONS.CONTENT_SITE]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to={`${ROUTES.ADMIN}/forms`} className="text-sm text-primary underline">← Forms</Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Form Submissions</h1>
          </div>
          <button type="button" onClick={exportCsv} className="px-4 py-2 rounded-lg border text-sm">Export CSV</button>
        </div>

        <div className="flex flex-wrap gap-2">
          <input className={`${adminFieldClass} w-full min-w-0 sm:flex-1 sm:min-w-[160px]`} placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className={adminFieldClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="new">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 max-h-[70vh] overflow-y-auto">
            {loading ? <p className="p-4 text-gray-500">Loading…</p> : items.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => openDetail(s._id)}
                className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 ${selected?._id === s._id ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{s.formSlug}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.status === 'new' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>{s.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{new Date(s.createdAt).toLocaleString()}</p>
              </button>
            ))}
            <div className="flex justify-between p-3 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <span>{page}/{pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>

          {selected && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold">{selected.formSlug} · v{selected.formVersion}</h3>
                <button type="button" className="text-xs text-red-600" onClick={() => remove(selected._id)}>Delete</button>
              </div>
              <p className="text-xs text-gray-500">{new Date(selected.createdAt).toLocaleString()}</p>
              <dl className="space-y-2 text-sm">
                {Object.entries(selected.data || {}).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-medium text-gray-500">{k}</dt>
                    <dd className="text-gray-800 dark:text-gray-200 break-words">{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
                  </div>
                ))}
              </dl>
              {selected.files?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-1">Files</h4>
                  <ul className="text-sm space-y-1">
                    {selected.files.map((f, i) => (
                      <li key={i}><a href={f.url} className="text-primary underline" target="_blank" rel="noreferrer">{f.filename}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
}
