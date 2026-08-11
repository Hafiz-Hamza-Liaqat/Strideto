import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listAdminInstitutionClaims, updateAdminInstitutionClaim } from '../../services/adminSuperControlApi';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminStatusBadge } from '../../components/admin/adminTableUtils';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const STATE_OPTIONS = [
  { value: '', label: 'All states' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'needs_information', label: 'Needs information' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'revoked', label: 'Revoked' },
];

export default function AdminCanonicalClaims() {
  const { can } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState({ page: 1, limit: 20, state: 'submitted', q: '', countryCode: '' });
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    setLoading(true);
    listAdminInstitutionClaims(query)
      .then(setData)
      .catch((e) => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    const claimId = searchParams.get('claim');
    if (claimId && data?.claims) {
      const found = data.claims.find((c) => String(c._id) === claimId);
      if (found) setSelected(found);
    }
  }, [searchParams, data]);

  async function act(action) {
    if (!selected) return;
    if (['reject', 'request_information', 'revoke'].includes(action) && !reason.trim()) {
      setError('A reason is required for this action');
      return;
    }
    setBusy(action);
    setError(null);
    try {
      await updateAdminInstitutionClaim(selected._id, { action, reason: reason.trim() || undefined });
      setSelected(null);
      setReason('');
      setQuery((q) => ({ ...q }));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setBusy('');
    }
  }

  const columns = [
    {
      key: 'org',
      label: 'Requesting institution',
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-sm text-gray-900 dark:text-white break-words">
            {row.organizationId?.displayName || '—'}
          </div>
          <div className="text-xs text-gray-500">{row.organizationId?.organizationType} · {row.countryCode || '—'}</div>
        </div>
      ),
    },
    {
      key: 'orgVerification',
      label: 'Org verification',
      render: (row) => <AdminStatusBadge value={row.organizationVerificationState} label={(row.organizationVerificationState || 'unknown').replace(/_/g, ' ')} />,
    },
    {
      key: 'canonical',
      label: 'Canonical candidate',
      render: (row) => (
        <div className="text-sm text-gray-800 dark:text-gray-200 break-words">
          {row.canonicalInstitutionId?.officialName || row.proposedCanonical?.officialName || '—'}
          <div className="text-xs text-gray-500">{row.officialDomain || row.proposedCanonical?.officialDomain || '—'}</div>
        </div>
      ),
    },
    {
      key: 'state',
      label: 'Claim state',
      render: (row) => <AdminStatusBadge value={row.state} label={row.state?.replace(/_/g, ' ')} />,
    },
    {
      key: 'conflict',
      label: 'Conflict',
      render: (row) => row.competingClaims?.length
        ? <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{row.competingClaims.length} competing</span>
        : <span className="text-xs text-gray-400">None</span>,
    },
    {
      key: 'submittedAt',
      label: 'Submitted',
      render: (row) => row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—',
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.VERIFICATION_READ}>
      <div className="space-y-4 min-w-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Canonical institution claims</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Answers which authoritative Institution record an organization is claiming. It does not answer whether the organization is legitimate. Organization verification remains independent.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            aria-label="Search official name or domain"
            placeholder="Name or domain"
            value={query.q}
            onChange={(e) => setQuery((p) => ({ ...p, q: e.target.value, page: 1 }))}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[44px]"
          />
          <select
            aria-label="Claim state"
            value={query.state}
            onChange={(e) => setQuery((p) => ({ ...p, state: e.target.value, page: 1 }))}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[44px]"
          >
            {STATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {error && <p className="text-red-600 dark:text-red-400 text-sm" role="alert">{error}</p>}

        <AdminDataTable
          columns={columns}
          data={data?.claims ?? []}
          pagination={data?.pagination}
          loading={loading}
          onPageChange={(page) => setQuery((p) => ({ ...p, page }))}
          onRowClick={(row) => {
            setSelected(row);
            const next = new URLSearchParams(searchParams);
            next.set('claim', row._id);
            setSearchParams(next, { replace: true });
          }}
          emptyMessage="No canonical claims found"
          tableLabel="Canonical institution claims"
        />

        {selected && (
          <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40" onClick={() => setSelected(null)}>
            <EscapeWhen active onEscape={() => setSelected(null)} />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="claim-dossier-title"
              className="relative bg-white dark:bg-gray-900 w-full max-w-xl h-full overflow-y-auto shadow-2xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="claim-dossier-title" className="text-lg font-semibold text-gray-900 dark:text-white">Canonical claim review</h2>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div><dt className="text-gray-500">Requesting institution</dt><dd className="text-gray-900 dark:text-white">{selected.organizationId?.displayName || '—'}</dd></div>
                <div><dt className="text-gray-500">Organization verification</dt><dd>{selected.organizationVerificationState || '—'}</dd></div>
                <div><dt className="text-gray-500">Official name</dt><dd>{selected.canonicalInstitutionId?.officialName || selected.proposedCanonical?.officialName || '—'}</dd></div>
                <div><dt className="text-gray-500">Country</dt><dd>{selected.countryCode || '—'}</dd></div>
                <div><dt className="text-gray-500">Official domain</dt><dd className="break-all">{selected.officialDomain || selected.proposedCanonical?.officialDomain || '—'}</dd></div>
                <div><dt className="text-gray-500">Claim state</dt><dd>{selected.state}</dd></div>
                <div><dt className="text-gray-500">Competing claims</dt><dd>{selected.competingClaims?.length || 0}</dd></div>
              </dl>
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Canonical claim approval cannot proceed unless organization verification is approved. No silent overwrite of canonical data.
              </p>
              {selected.organizationId?._id && (
                <Link className="text-sm text-primary dark:text-mint underline" to={`/admin/verification-queue?org=${selected.organizationId._id}`}>
                  Open organization verification dossier
                </Link>
              )}
              {can(PERMISSIONS.VERIFICATION_APPROVE) && (
                <div className="space-y-2">
                  <label htmlFor="claim-reason" className="text-xs text-gray-600 dark:text-gray-300">Reason (required for reject / more information / revoke)</label>
                  <textarea id="claim-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  <div className="flex flex-wrap gap-2">
                    {selected.state === 'submitted' && <button type="button" disabled={!!busy} onClick={() => act('begin_review')} className="min-h-[44px] text-xs px-3 py-1.5 bg-blue-600 text-white rounded">Start review</button>}
                    {['submitted', 'under_review'].includes(selected.state) && <button type="button" disabled={!!busy} onClick={() => act('request_information')} className="min-h-[44px] text-xs px-3 py-1.5 bg-yellow-600 text-white rounded">Request information</button>}
                    {selected.state === 'under_review' && <button type="button" disabled={!!busy} onClick={() => act('approve')} className="min-h-[44px] text-xs px-3 py-1.5 bg-green-600 text-white rounded">Approve</button>}
                    {selected.state === 'under_review' && <button type="button" disabled={!!busy} onClick={() => act('reject')} className="min-h-[44px] text-xs px-3 py-1.5 bg-red-600 text-white rounded">Reject</button>}
                    {selected.state === 'approved' && <button type="button" disabled={!!busy} onClick={() => act('revoke')} className="min-h-[44px] text-xs px-3 py-1.5 bg-red-800 text-white rounded">Revoke</button>}
                  </div>
                </div>
              )}
              <button type="button" className="text-sm text-gray-600 dark:text-gray-300 underline" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
}
