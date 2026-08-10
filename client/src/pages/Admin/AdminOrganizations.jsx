import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAdminOrganizations } from '../../services/adminSuperControlApi';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminTableFilters } from '../../components/admin/AdminTableFilters';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'deactivated', label: 'Deactivated' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'employer', label: 'Employer' },
  { value: 'agent_agency', label: 'Agent / Agency' },
  { value: 'institution', label: 'Institution' },
];

const COLUMNS = [
  { key: 'displayName', label: 'Name' },
  { key: 'organizationType', label: 'Type' },
  { key: 'countryCode', label: 'Country' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created', render: row => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—' },
];

export default function AdminOrganizations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState({ page: 1, limit: 20, search: '', status: '', organizationType: '' });
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    listAdminOrganizations(query)
      .then(setData)
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Organizations</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Safe operational view. No cross-tenant mutation. High-risk actions require explicit authority.
      </p>

      <AdminTableFilters
        filters={[
          { key: 'search', type: 'search', placeholder: 'Search name…' },
          { key: 'status', type: 'select', options: STATUS_OPTIONS },
          { key: 'organizationType', type: 'select', options: TYPE_OPTIONS },
        ]}
        values={query}
        onChange={f => setQuery(prev => ({ ...prev, ...f, page: 1 }))}
      />

      {error && <p className="text-red-600 dark:text-red-400 text-sm my-2" role="alert">{error}</p>}

      <AdminDataTable
        columns={COLUMNS}
        data={data?.data ?? []}
        pagination={data?.pagination}
        loading={loading}
        onPageChange={page => setQuery(prev => ({ ...prev, page }))}
        onRowClick={row => navigate(`/admin/organizations/${row._id}`)}
        emptyMessage="No organizations found"
      />
    </div>
  );
}
