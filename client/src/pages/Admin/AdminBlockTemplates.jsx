import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';
import { ROUTES } from '../../constants';
import { adminContentApi } from '../../services/adminContentApi';
import { adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { filterTemplates, TEMPLATE_CATEGORIES } from '@shared/pageBuilderTemplates.js';
import { useToast } from '../../context/ToastContext';
import { EscapeWhen } from '../../a11y/EscapeWhen';

export default function AdminBlockTemplates() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminContentApi.listBlockTemplates({ limit: 200 });
      setItems(data?.data || []);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => filterTemplates(items, { q, category, sort: 'name' }), [items, q, category]);

  const saveEdit = async () => {
    if (!editing?._id) return;
    try {
      await adminContentApi.updateBlockTemplate(editing._id, editing);
      toast.success('Template saved');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this template? Existing pages are not affected.')) return;
    await adminContentApi.deleteBlockTemplate(id);
    toast.success('Template deleted');
    load();
  };

  const duplicate = async (id) => {
    await adminContentApi.duplicateBlockTemplate(id);
    toast.success('Template duplicated');
    load();
  };

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_SITE}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Block Templates</h1>
            <p className="text-sm text-gray-500 mt-1">Reusable starting points — copied into pages, never linked.</p>
          </div>
          <Link to={`${ROUTES.ADMIN}/page-builder`} className="text-sm text-primary underline">← Page Builder</Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <input className={`${adminFieldClass} w-full min-w-0 sm:flex-1 sm:min-w-[200px]`} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={adminFieldClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? <p className="text-gray-500">Loading…</p> : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <div key={t._id} className="flex flex-wrap items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{t.name}{t.favorite ? ' ★' : ''}</p>
                  <p className="text-xs text-gray-500">{t.blockType} · {t.category}{t.description ? ` — ${t.description}` : ''}</p>
                </div>
                <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => setEditing({ ...t })}>Edit</button>
                <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => duplicate(t._id)}>Duplicate</button>
                <button type="button" className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded" onClick={() => remove(t._id)}>Delete</button>
              </div>
            ))}
            {!filtered.length ? <p className="text-sm text-gray-500">No templates yet. Save a block as template from the Page Builder.</p> : null}
          </div>
        )}

        {editing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <EscapeWhen active onEscape={() => setEditing(null)} />
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-900 border p-4 sm:p-6 space-y-3">
              <h3 className="font-semibold">Edit template</h3>
              <input className={adminFieldClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <select className={adminFieldClass} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea className={adminFieldClass} rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(editing.favorite)} onChange={(e) => setEditing({ ...editing, favorite: e.target.checked })} /> Favorite</label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} className="px-3 py-2 text-sm border rounded">Cancel</button>
                <button type="button" onClick={saveEdit} className="px-3 py-2 text-sm bg-primary text-white rounded">Save</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminRouteGuard>
  );
}
