import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { searchApi } from '../../services/searchApi';
import { entityTypeLabel } from '@shared/search/entityTypes.js';
import { ROUTES } from '../../constants';
import { adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';

const TYPE_ICONS = {
  job: '💼',
  scholarship: '🎓',
  admission: '📋',
  university: '🏛',
  blog: '📝',
  'career-guidance': '💡',
  'cms-page': '📄',
  'page-builder-page': '📄',
  form: '📩',
  media: '🖼',
};

export default function AdminGlobalSearch() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexMessage, setReindexMessage] = useState('');
  const [testReindexing, setTestReindexing] = useState(false);

  const refreshStats = () => {
    searchApi.adminStats().then(({ data }) => setStats(data)).catch(() => {});
  };

  useEffect(() => {
    refreshStats();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      searchApi.adminSearch({ q: q || undefined, type: type || undefined, limit: 30 })
        .then(({ data }) => setResults(data?.results || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [q, type]);

  const handleRebuildIndex = async () => {
    if (reindexing) return;
    setReindexing(true);
    setReindexMessage('');
    try {
      const { data } = await searchApi.adminReindex({});
      const resultsList = data?.results || [];
      const indexed = resultsList.reduce((n, r) => n + (r.indexed || 0), 0);
      setReindexMessage(`Rebuild complete — ${indexed} documents indexed across ${resultsList.length} entity types.`);
      refreshStats();
    } catch (err) {
      setReindexMessage(err.response?.data?.error || 'Rebuild failed. Check permissions and server logs.');
    } finally {
      setReindexing(false);
    }
  };

  const handleRebuildTests = async () => {
    if (testReindexing) return;
    setTestReindexing(true);
    setReindexMessage('');
    try {
      const { data } = await searchApi.adminReindex({ entityType: 'test' });
      const result = data?.results?.find((item) => item.entityType === 'test');
      setReindexMessage(`Test search rebuild complete — ${result?.indexed || 0} eligible Tests indexed; ${result?.removed || 0} stale Test documents removed.`);
      refreshStats();
    } catch (err) {
      setReindexMessage(err.response?.data?.error || 'Test search rebuild failed. Check permissions and server logs.');
    } finally {
      setTestReindexing(false);
    }
  };

  const byType = stats?.byType || [];
  const indexEmpty = stats?.total === 0;

  return (
    <AdminRouteGuard anyPermission={[PERMISSIONS.CONTENT_SITE, PERMISSIONS.SYSTEM_SETTINGS]}>
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Global Search</h1>
          <p className="text-sm text-gray-500 mt-1">
            Search across jobs, content, pages, media, and forms.
            {stats?.total != null ? ` Index: ${stats.total} documents.` : ''}
          </p>
          {indexEmpty ? (
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
              Search index is empty. After seeding content, click <strong>Rebuild Search Index</strong> so public search returns results.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRebuildTests}
            disabled={testReindexing || reindexing}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/5 disabled:opacity-60 min-h-[44px]"
          >
            {testReindexing ? 'Rebuilding Tests…' : 'Rebuild Test Search'}
          </button>
          <button
            type="button"
            onClick={handleRebuildIndex}
            disabled={reindexing || testReindexing}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 min-h-[44px]"
          >
            {reindexing ? 'Rebuilding…' : 'Rebuild Search Index'}
          </button>
        </div>
      </div>

      {reindexMessage ? (
        <p className="text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2" role="status">
          {reindexMessage}
        </p>
      ) : null}

      {byType.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Indexed document counts by type">
          {byType.map((row) => (
            <span
              key={row._id}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
            >
              {entityTypeLabel(row._id)}: {row.count}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          className={`${adminFieldClass} flex-1 w-full`}
          placeholder="Search admin content…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Admin search query"
        />
        <select className={`${adminFieldClass} w-full sm:w-56 shrink-0`} value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          {['job', 'scholarship', 'admission', 'university', 'blog', 'career-guidance', 'cms-page', 'page-builder-page', 'form', 'media'].map((et) => (
            <option key={et} value={et}>{entityTypeLabel(et)}</option>
          ))}
        </select>
      </div>

      {loading ? <p className="text-sm text-gray-500">Searching…</p> : null}

      <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        {!loading && !results.length ? (
          <li className="p-6 text-sm text-gray-500 text-center">
            {indexEmpty
              ? 'No documents in the search index yet. Rebuild the index after seeding or publishing content.'
              : 'No results'}
          </li>
        ) : null}
        {results.map((item) => {
          const icon = TYPE_ICONS[item.entityType] || '•';
          const editPath = item.metadata?.adminEditUrl || ROUTES.ADMIN;
          return (
            <li key={`${item.entityType}-${item.id}`} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-xl shrink-0" aria-hidden>{icon}</span>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    {entityTypeLabel(item.entityType)} · {item.status}
                    {item.updatedAt ? ` · ${new Date(item.updatedAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {item.url ? (
                  <Link to={item.url} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded border hover:bg-gray-50 dark:hover:bg-gray-800">
                    View
                  </Link>
                ) : null}
                <Link to={editPath} className="text-xs px-3 py-1.5 rounded border border-primary text-primary hover:bg-primary/5">
                  Edit
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
    </AdminRouteGuard>
  );
}
