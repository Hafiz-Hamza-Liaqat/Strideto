import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { PERMISSIONS } from '../../config/rbac';
import { ROUTES } from '../../constants';
import { adminContentApi } from '../../services/adminContentApi';
import { useToast } from '../../context/ToastContext';

export default function AdminForms() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminContentApi.listForms({ search: search.trim() || undefined, limit: 100 });
      setItems(data?.items || []);
    } catch {
      toast.error('Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => { load(); }, [load]);

  const remove = async (formId) => {
    if (!window.confirm('Delete this form? Submissions will remain.')) return;
    try {
      await adminContentApi.deleteForm(formId);
      toast.success('Form deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const duplicate = async (formId) => {
    try {
      await adminContentApi.duplicateForm(formId);
      toast.success('Form duplicated');
      load();
    } catch {
      toast.error('Duplicate failed');
    }
  };

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_SITE}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Forms</h2>
            <p className="text-sm text-gray-500 mt-1">Reusable forms for page builder, CMS, and platform modules.</p>
          </div>
          <div className="flex gap-2">
            <Link to={`${ROUTES.ADMIN}/forms/submissions`} className="px-4 py-2 rounded-lg border text-sm font-medium">Submissions</Link>
            <Link to={`${ROUTES.ADMIN}/forms/new`} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">New form</Link>
          </div>
        </div>

        <input className={adminFieldClass} placeholder="Search forms…" value={search} onChange={(e) => setSearch(e.target.value)} />

        {loading ? <p className="text-gray-500">Loading…</p> : (
          <div className="table-scroll rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((f) => (
                  <tr key={f._id}>
                    <td className="px-4 py-3 font-medium">
                      <Link to={`${ROUTES.ADMIN}/forms/${f._id}`} className="text-primary hover:underline">{f.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{f.slug}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{f.version}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button type="button" className="text-xs text-primary" onClick={() => duplicate(f._id)}>Duplicate</button>
                      <button type="button" className="text-xs text-red-600" onClick={() => remove(f._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <p className="p-6 text-gray-500 text-center">No forms yet.</p>}
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
}
