import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAdminOrganizations } from '../../services/adminSuperControlApi';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminTableFilters } from '../../components/admin/AdminTableFilters';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminStatusBadge } from '../../components/admin/adminTableUtils';
import { PERMISSIONS } from '../../config/rbac';

const STATUS_OPTIONS = [
  { value: '', label: 'All lifecycle statuses' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'employer', label: 'Employer' },
  { value: 'agent', label: 'Agent' },
  { value: 'agency', label: 'Agency' },
  { value: 'university', label: 'University' },
  { value: 'college', label: 'College' },
  { value: 'institute', label: 'Institute' },
  { value: 'school', label: 'School' },
  { value: 'training_center', label: 'Training center' },
];

const VERIFICATION_OPTIONS = [
  { value: '', label: 'Any verification' },
  { value: 'verification_pending', label: 'Pending' },
  { value: 'under_review', label: 'Under review' },
  { value: 'needs_information', label: 'Needs information' },
  { value: 'enhanced_review', label: 'Enhanced review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'expired', label: 'Expired' },
];

const COLUMNS = [
  { key: 'displayName', label: 'Name', render: (row) => <span className="break-words">{row.displayName || row.legalName || '—'}</span> },
  { key: 'organizationType', label: 'Type' },
  { key: 'countryCode', label: 'Country' },
  {
    key: 'verificationStatus',
    label: 'Verification',
    render: (row) => <AdminStatusBadge value={row.verificationStatus} label={(row.verificationStatus || 'none').replace(/_/g, ' ')} />,
  },
  {
    key: 'canonicalClaimState',
    label: 'Canonical claim',
    render: (row) => row.canonicalClaimState ? row.canonicalClaimState.replace(/_/g, ' ') : '—',
  },
  { key: 'status', label: 'Lifecycle' },
  { key: 'createdAt', label: 'Created', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—' },
];

export default function AdminOrganizations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState({
    page: 1,
    limit: 20,
    search: '',
    status: '',
    organizationType: '',
    countryCode: '',
    verificationStatus: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    listAdminOrganizations(query)
      .then(setData)
      .catch((e) => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <AdminRouteGuard permission={PERMISSIONS.ORGANIZATIONS_READ}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Organizations</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Employer, Agent/Agency, and Institution inventory. No student private data. No full confidential evidence in this list.
        </p>

        <AdminTableFilters
          filters={[
            { key: 'search', type: 'search', label: 'Search', placeholder: 'Search name…' },
            { key: 'status', type: 'select', label: 'Lifecycle', options: STATUS_OPTIONS },
            { key: 'organizationType', type: 'select', label: 'Type', options: TYPE_OPTIONS },
            { key: 'verificationStatus', type: 'select', label: 'Verification', options: VERIFICATION_OPTIONS },
            { key: 'countryCode', type: 'search', label: 'Country', placeholder: 'Country code' },
          ]}
          values={query}
          onChange={(f) => setQuery((prev) => ({ ...prev, ...f, page: 1 }))}
        />

        {error && <p className="text-red-600 dark:text-red-400 text-sm my-2" role="alert">{error}</p>}

        <AdminDataTable
          columns={COLUMNS}
          data={data?.data ?? []}
          pagination={data?.pagination}
          loading={loading}
          onPageChange={(page) => setQuery((prev) => ({ ...prev, page }))}
          onRowClick={(row) => navigate(`/admin/sc/organizations/${row._id}`)}
          emptyMessage="No organizations found"
          tableLabel="Organizations"
        />
      </div>
    </AdminRouteGuard>
  );
}
