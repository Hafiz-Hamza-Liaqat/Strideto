import { useEffect, useState } from 'react';
import axios from '../../services/axiosBase';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminTableFilters } from '../../components/admin/AdminTableFilters';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';
import { listAdminInstitutionConflicts } from '../../services/adminSuperControlApi';

const FRESHNESS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'stale', label: 'Stale' },
  { value: 'review_due', label: 'Review Due' },
  { value: 'broken', label: 'Broken' },
  { value: 'fresh', label: 'Fresh' },
  { value: 'unknown', label: 'Unknown' },
];

function FreshnessQueue() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState({ page: 1, limit: 20, freshness: 'stale' });

  useEffect(() => {
    setLoading(true);
    axios.get('/admin/trust/freshness-queue', {
      params: Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '')),
    })
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [query]);

  const columns = [
    { key: 'targetEntityType', label: 'Entity Type' },
    { key: 'targetEntityId', label: 'Entity ID' },
    { key: 'claimKey', label: 'Claim' },
    { key: 'freshnessState', label: 'Freshness' },
    { key: 'verificationStatus', label: 'Status' },
    { key: 'lastVerifiedAt', label: 'Last Verified', render: row => row.lastVerifiedAt ? new Date(row.lastVerifiedAt).toLocaleDateString() : '—' },
    { key: 'reviewDueAt', label: 'Review Due', render: row => row.reviewDueAt ? new Date(row.reviewDueAt).toLocaleDateString() : '—' },
  ];

  return (
    <div>
      <AdminTableFilters
        filters={[{ key: 'freshness', type: 'select', label: 'Freshness', options: FRESHNESS_OPTIONS }]}
        values={query}
        onChange={f => setQuery(prev => ({ ...prev, ...f, page: 1 }))}
      />
      {error && <p className="text-red-600 text-sm my-2" role="alert">{error}</p>}
      <AdminDataTable
        columns={columns}
        data={data?.data ?? data?.items ?? []}
        pagination={data?.pagination}
        loading={loading}
        onPageChange={page => setQuery(prev => ({ ...prev, page }))}
        emptyMessage="No freshness records found for the selected filter"
      />
    </div>
  );
}

function MetricsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    axios.get('/admin/trust/metrics')
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading metrics…</p>;
  if (error) return <p className="text-red-600 text-sm" role="alert">{error}</p>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Object.entries(data).map(([key, val]) => (
        typeof val === 'number' && (
          <div key={key} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{val}</p>
          </div>
        )
      ))}
    </div>
  );
}

function ConflictsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState({ page: 1, limit: 20, state: 'open' });

  useEffect(() => {
    setLoading(true);
    listAdminInstitutionConflicts(query)
      .then(setData)
      .catch((e) => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Opening this page does not mark data fresh. Conflicts are stored, not silently overwritten.
      </p>
      {error && <p className="text-red-600 text-sm my-2" role="alert">{error}</p>}
      <AdminDataTable
        columns={[
          { key: 'conflictType', label: 'Type', render: (row) => row.conflictType || row.type || '—' },
          { key: 'state', label: 'State' },
          { key: 'organizationId', label: 'Organization', render: (row) => String(row.organizationId || '—') },
          { key: 'createdAt', label: 'Created', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—' },
        ]}
        data={data?.conflicts ?? data?.data ?? []}
        loading={loading}
        onPageChange={(page) => setQuery((p) => ({ ...p, page }))}
        emptyMessage="No data-quality conflicts for this filter"
        tableLabel="Data quality conflicts"
      />
    </div>
  );
}

const TABS = ['Metrics', 'Freshness Queue', 'Conflicts'];

export default function AdminDataQualityCenter() {
  const [tab, setTab] = useState(0);

  return (
    <AdminRouteGuard permission={PERMISSIONS.DATA_QUALITY_MANAGE}>
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Data Quality Center</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Freshness, provenance, and source authority operational view. No automated silent overwrite. Viewing this page does not mutate freshness.
      </p>

      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${tab === i ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            aria-selected={tab === i}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <MetricsPanel />}
      {tab === 1 && <FreshnessQueue />}
      {tab === 2 && <ConflictsPanel />}
    </div>
    </AdminRouteGuard>
  );
}
