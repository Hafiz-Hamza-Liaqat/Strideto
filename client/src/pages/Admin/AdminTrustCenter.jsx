import { useEffect, useState } from 'react';
import { listAdminReports, listAdminDisputes, listAdminReviews, updateAdminReport, resolveAdminDispute } from '../../services/adminSuperControlApi';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminTableFilters } from '../../components/admin/AdminTableFilters';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { SkillVerificationReviewPanel } from '../../components/skills/SkillVerificationReviewPanel';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';

// Skill claims join the Trust Center rather than getting an admin area of their
// own — it is the same question ("what do we actually stand behind?") asked
// about a person's evidence instead of an organization's conduct.
const TABS = ['Reports', 'Disputes', 'Reviews', 'Skill Claims'];

const REPORT_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'action_taken', label: 'Action Taken' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'resolved', label: 'Resolved' },
];

const DISPUTE_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'opened', label: 'Opened' },
  { value: 'awaiting_response', label: 'Awaiting Response' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'proposed_resolution', label: 'Proposed Resolution' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'escalated', label: 'Escalated' },
];

function ReportsList() {
  const { can } = usePermissions();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState({ page: 1, limit: 20, status: '' });
  const [actionRow, setActionRow] = useState(null);
  const [actionForm, setActionForm] = useState({ status: 'triaged', reason: '' });
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    listAdminReports(query)
      .then(setData)
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { void load(); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAction() {
    if (!actionRow || !actionForm.reason?.trim()) return;
    setBusy(true);
    try {
      await updateAdminReport(actionRow._id, actionForm);
      setActionRow(null);
      load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    { key: 'targetType', label: 'Target Type' },
    { key: 'category', label: 'Category' },
    { key: 'severity', label: 'Severity' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Created', render: row => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—' },
  ];

  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Reporter identity is protected. Private messages and Vault contents are not shown.
      </p>
      <AdminTableFilters
        filters={[{ key: 'status', type: 'select', options: REPORT_STATUS_OPTIONS }]}
        values={query}
        onChange={f => setQuery(prev => ({ ...prev, ...f, page: 1 }))}
      />
      {error && <p className="text-red-600 text-sm my-2" role="alert">{error}</p>}
      <AdminDataTable
        columns={columns}
        data={data?.data ?? []}
        pagination={data?.pagination}
        loading={loading}
        onPageChange={page => setQuery(prev => ({ ...prev, page }))}
        actions={can(PERMISSIONS.TRUST_RESOLVE)
          ? [{ label: 'Triage', onClick: row => { setActionRow(row); setActionForm({ status: 'triaged', reason: '' }); } }]
          : []}
        emptyMessage="No reports found"
      />
      {actionRow && (
        <AdminConfirmDialog
          title="Update Report"
          message={`Update report ${actionRow._id}?`}
          onConfirm={handleAction}
          onCancel={() => setActionRow(null)}
          busy={busy}
        >
          <div className="mt-3 space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={actionForm.status}
              onChange={e => setActionForm(p => ({ ...p, status: e.target.value }))}
            >
              {REPORT_STATUS_OPTIONS.filter(o => o.value).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason (required)</label>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm"
              rows={3}
              maxLength={500}
              value={actionForm.reason}
              onChange={e => setActionForm(p => ({ ...p, reason: e.target.value }))}
            />
          </div>
        </AdminConfirmDialog>
      )}
    </div>
  );
}

function DisputesList() {
  const { can } = usePermissions();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState({ page: 1, limit: 20, status: '' });
  const [resolveRow, setResolveRow] = useState(null);
  const [resolveForm, setResolveForm] = useState({ status: 'resolved', resolution: '', reason: '' });
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    listAdminDisputes(query)
      .then(setData)
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { void load(); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleResolve() {
    if (!resolveRow || !resolveForm.reason?.trim()) return;
    setBusy(true);
    try {
      await resolveAdminDispute(resolveRow._id, resolveForm);
      setResolveRow(null);
      load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    { key: 'contextType', label: 'Context' },
    { key: 'category', label: 'Category' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Created', render: row => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—' },
  ];

  const actions = can(PERMISSIONS.TRUST_RESOLVE)
    ? [{ label: 'Resolve', onClick: row => { setResolveRow(row); setResolveForm({ status: 'resolved', resolution: '', reason: '' }); } }]
    : [];

  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Student/reporter identity protected. Private messages not shown. Resolution requires Admin authority.
      </p>
      <AdminTableFilters
        filters={[{ key: 'status', type: 'select', options: DISPUTE_STATUS_OPTIONS }]}
        values={query}
        onChange={f => setQuery(prev => ({ ...prev, ...f, page: 1 }))}
      />
      {error && <p className="text-red-600 text-sm my-2" role="alert">{error}</p>}
      <AdminDataTable
        columns={columns}
        data={data?.data ?? []}
        pagination={data?.pagination}
        loading={loading}
        onPageChange={page => setQuery(prev => ({ ...prev, page }))}
        actions={actions}
        emptyMessage="No disputes found"
      />
      {resolveRow && (
        <AdminConfirmDialog
          title="Resolve Dispute"
          message={`Resolve dispute ${resolveRow._id}? This action is audited.`}
          onConfirm={handleResolve}
          onCancel={() => setResolveRow(null)}
          busy={busy}
          confirmLabel="Resolve"
        >
          <div className="mt-3 space-y-2">
            <label className="block text-sm font-medium">Status</label>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={resolveForm.status}
              onChange={e => setResolveForm(p => ({ ...p, status: e.target.value }))}
            >
              {['proposed_resolution', 'resolved', 'closed', 'dismissed'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <label className="block text-sm font-medium">Reason (required)</label>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm"
              rows={3}
              maxLength={500}
              value={resolveForm.reason}
              onChange={e => setResolveForm(p => ({ ...p, reason: e.target.value }))}
            />
            <label className="block text-sm font-medium">Resolution note</label>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm"
              rows={2}
              maxLength={1500}
              value={resolveForm.resolution}
              onChange={e => setResolveForm(p => ({ ...p, resolution: e.target.value }))}
            />
          </div>
        </AdminConfirmDialog>
      )}
    </div>
  );
}

function ReviewsList() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState({ page: 1, limit: 20, status: '' });

  useEffect(() => {
    setLoading(true);
    listAdminReviews(query)
      .then(setData)
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [query]);

  const columns = [
    { key: 'organizationId', label: 'Org ID' },
    { key: 'interactionType', label: 'Interaction' },
    { key: 'rating', label: 'Rating' },
    { key: 'verifiedInteraction', label: 'Verified', render: row => row.verifiedInteraction ? 'Yes' : 'No' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Created', render: row => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—' },
  ];

  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Student identity not shown. Review body not shown by default. Verified status is server-derived and immutable.
      </p>
      {error && <p className="text-red-600 text-sm my-2" role="alert">{error}</p>}
      <AdminDataTable
        columns={columns}
        data={data?.data ?? []}
        pagination={data?.pagination}
        loading={loading}
        onPageChange={page => setQuery(prev => ({ ...prev, page }))}
        emptyMessage="No reviews found"
      />
    </div>
  );
}

export default function AdminTrustCenter() {
  const [tab, setTab] = useState(0);

  return (
    <AdminRouteGuard permission={PERMISSIONS.TRUST_TRIAGE}>
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Trust Center</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Skill Verification is unchanged. Professional-service disputes and financial disputes stay separate. Trust disputes never trigger an automatic refund. Reporter identity is withheld.
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

      {tab === 0 && <ReportsList />}
      {tab === 1 && <DisputesList />}
      {tab === 2 && <ReviewsList />}
      {tab === 3 && <SkillVerificationReviewPanel />}
    </div>
    </AdminRouteGuard>
  );
}
