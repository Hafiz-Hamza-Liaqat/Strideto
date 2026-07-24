import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';
import { ROUTES } from '../../constants';
import { adminContentApi } from '../../services/adminContentApi';
import { adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { getAllBlockDefinitions } from '@shared/blockRegistry.js';
import { BlockConfigFields } from '../../components/pageBuilder/BlockConfigFields';
import { useToast } from '../../context/ToastContext';
import { EscapeWhen } from '../../a11y/EscapeWhen';

export default function AdminGlobalBlocks() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [usage, setUsage] = useState([]);

  const definitions = useMemo(() => getAllBlockDefinitions(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminContentApi.listGlobalBlocks({ limit: 200 });
      setItems(data?.data || []);
    } catch {
      toast.error('Failed to load global blocks');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...items]
      .filter((g) => !query || String(g.name).toLowerCase().includes(query) || String(g.blockType).toLowerCase().includes(query))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [items, q]);

  const openEdit = async (item) => {
    try {
      const { data } = await adminContentApi.getGlobalBlock(item._id);
      setUsage(data.usage || []);
      if (data.usageCount > 0) {
        const ok = window.confirm(
          `This block is used on ${data.usageCount} page(s). Changes will affect all pages using it. Continue?`,
        );
        if (!ok) return;
      }
      setEditing({ ...data });
    } catch {
      toast.error('Failed to load global block');
    }
  };

  const saveEdit = async () => {
    if (!editing?._id) return;
    try {
      await adminContentApi.updateGlobalBlock(editing._id, editing);
      toast.success('Global block saved');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const remove = async (id, usageCount = 0) => {
    if (usageCount > 0) {
      const force = window.confirm(`Used on ${usageCount} page(s). Force delete anyway?`);
      if (!force) return;
      await adminContentApi.deleteGlobalBlock(id, true);
    } else {
      if (!window.confirm('Delete this global block?')) return;
      await adminContentApi.deleteGlobalBlock(id);
    }
    toast.success('Global block deleted');
    load();
  };

  const editingDef = editing ? definitions.find((d) => d.blockType === editing.blockType) : null;

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_SITE}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Global Blocks</h2>
            <p className="text-sm text-gray-500 mt-1">Shared content — editing updates every page that references the block.</p>
          </div>
          <Link to={`${ROUTES.ADMIN}/page-builder`} className="text-sm text-primary underline">← Page Builder</Link>
        </div>

        <input className={adminFieldClass} placeholder="Search global blocks…" value={q} onChange={(e) => setQ(e.target.value)} />

        {loading ? <p className="text-gray-500">Loading…</p> : (
          <div className="space-y-2">
            {filtered.map((g) => (
              <div key={g._id} className="flex flex-wrap items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{g.name}{g.enabled === false ? ' (disabled)' : ''}</p>
                  <p className="text-xs text-gray-500">{g.blockType} · used {g.usageCount || 0}×</p>
                </div>
                <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => openEdit(g)}>Edit</button>
                <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => adminContentApi.duplicateGlobalBlock(g._id).then(load)}>Duplicate</button>
                <button type="button" className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded" onClick={() => remove(g._id, g.usageCount)}>Delete</button>
              </div>
            ))}
          </div>
        )}

        {editing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
            <EscapeWhen active onEscape={() => setEditing(null)} />
            <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 border p-6 space-y-3 my-8">
              <h3 className="font-semibold">Edit global block</h3>
              {usage.length ? (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 p-3 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Used on {usage.length} page(s):</p>
                  <ul className="mt-1 text-xs list-disc list-inside">
                    {usage.map((u) => (
                      <li key={`${u.pageKey}:${u.locale}`}>
                        <Link to={`${ROUTES.ADMIN}/page-builder?pageKey=${u.pageKey}&locale=${u.locale}`} className="text-primary underline">
                          {u.title || u.pageKey} ({u.locale})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <input className={adminFieldClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <textarea className={adminFieldClass} rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.enabled !== false} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /> Enabled</label>
              {editingDef ? (
                <BlockConfigFields
                  blockType={editing.blockType}
                  definition={editingDef}
                  config={editing.config || {}}
                  onChange={(key, val) => setEditing({ ...editing, config: { ...editing.config, [key]: val } })}
                />
              ) : null}
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
