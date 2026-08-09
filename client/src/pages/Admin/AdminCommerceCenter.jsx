import { useEffect, useState } from 'react';
import {
  listAdminReconciliation,
  markReconciliationManualReview,
  listAdminConnectAccounts,
  listAdminRefunds,
} from '../../services/adminSuperControlApi';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';

const TABS = ['Reconciliation', 'Connect Accounts', 'Refunds'];

const RECON_STATUS_OPTIONS = ['', 'pending_provider', 'matched', 'mismatch', 'manual_review', 'resolved'];

function ReconciliationPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState({ page: 1, limit: 20, status: 'mismatch' });
  const [actionRow, setActionRow] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    listAdminReconciliation(query)
      .then(setData)
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [query]);

  async function handleManualReview() {
    if (!actionRow || !reason.trim()) return;
    setBusy(true);
    try {
      await markReconciliationManualReview(actionRow._id, { reason });
      setActionRow(null);
      setReason('');
      load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    { key: 'correlationId', label: 'Correlation ID' },
    { key: 'expectedAmountMinor', label: 'Expected (minor)' },
    { key: 'actualAmountMinor', label: 'Actual (minor)', render: v => v ?? '—' },
    { key: 'expectedCurrency', label: 'Currency' },
    { key: 'status', label: 'Status' },
    { key: 'discrepancyReason', label: 'Reason', render: v => v || '—' },
    { key: 'createdAt', label: 'Created', render: v => v ? new Date(v).toLocaleDateString() : '—' },
  ];

  return (
    <div>
      <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
        Ledger history is immutable. Admin may only mark for manual review. No direct ledger edits.
        Admin cannot mark payment paid, refund completed, or payout paid.
      </div>
      <div className="flex gap-2 mb-3">
        {RECON_STATUS_OPTIONS.map(s => (
          <button
            key={s || 'all'}
            onClick={() => setQuery(p => ({ ...p, status: s, page: 1 }))}
            className={`text-xs px-2 py-1 rounded border ${query.status === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      {error && <p className="text-red-600 text-sm my-2" role="alert">{error}</p>}
      <AdminDataTable
        columns={columns}
        data={data?.data ?? []}
        pagination={data?.pagination}
        loading={loading}
        onPageChange={page => setQuery(p => ({ ...p, page }))}
        actions={[{ label: 'Manual Review', onClick: row => setActionRow(row), disabled: row => !['mismatch', 'pending_provider'].includes(row.status) }]}
        emptyMessage="No reconciliation records found"
      />
      {actionRow && (
        <AdminConfirmDialog
          title="Mark for Manual Review"
          message={`Mark reconciliation ${actionRow.correlationId} for manual review?`}
          onConfirm={handleManualReview}
          onCancel={() => { setActionRow(null); setReason(''); }}
          busy={busy}
        >
          <div className="mt-3">
            <label className="block text-sm font-medium">Reason (required)</label>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm mt-1"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
        </AdminConfirmDialog>
      )}
    </div>
  );
}

function ConnectAccountsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState({ page: 1, limit: 20 });

  useEffect(() => {
    setLoading(true);
    listAdminConnectAccounts(query)
      .then(setData)
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [query]);

  const columns = [
    { key: 'organizationId', label: 'Org ID' },
    { key: 'provider', label: 'Provider' },
    { key: 'onboardingStatus', label: 'Onboarding' },
    { key: 'chargesCapability', label: 'Charges' },
    { key: 'transfersCapability', label: 'Transfers' },
    { key: 'requirementsState', label: 'Requirements' },
    { key: 'lastSynchronizedAt', label: 'Last Sync', render: v => v ? new Date(v).toLocaleDateString() : '—' },
  ];

  return (
    <div>
      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
        Safe projection only. Stripe account IDs, bank details, identity documents, and KYC raw data are not shown.
      </div>
      {error && <p className="text-red-600 text-sm my-2" role="alert">{error}</p>}
      <AdminDataTable
        columns={columns}
        data={data?.data ?? []}
        pagination={data?.pagination}
        loading={loading}
        onPageChange={page => setQuery(p => ({ ...p, page }))}
        emptyMessage="No connected accounts found"
      />
    </div>
  );
}

function RefundsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState({ page: 1, limit: 20, status: 'requested' });

  useEffect(() => {
    setLoading(true);
    listAdminRefunds(query)
      .then(setData)
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [query]);

  const columns = [
    { key: 'orderId', label: 'Order ID' },
    { key: 'requesterType', label: 'Requester' },
    { key: 'amountMinor', label: 'Amount (minor)' },
    { key: 'currency', label: 'Currency' },
    { key: 'status', label: 'Status' },
    { key: 'reason', label: 'Reason' },
    { key: 'createdAt', label: 'Created', render: v => v ? new Date(v).toLocaleDateString() : '—' },
  ];

  return (
    <div>
      <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
        Admin cannot mark refund as completed. Provider confirmation is authoritative. Refund initiation uses existing authorized workflow only.
      </div>
      <div className="flex gap-2 mb-3">
        {['', 'requested', 'approved', 'rejected', 'completed'].map(s => (
          <button
            key={s || 'all'}
            onClick={() => setQuery(p => ({ ...p, status: s, page: 1 }))}
            className={`text-xs px-2 py-1 rounded border ${query.status === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      {error && <p className="text-red-600 text-sm my-2" role="alert">{error}</p>}
      <AdminDataTable
        columns={columns}
        data={data?.data ?? []}
        pagination={data?.pagination}
        loading={loading}
        onPageChange={page => setQuery(p => ({ ...p, page }))}
        emptyMessage="No refunds found"
      />
    </div>
  );
}

export default function AdminCommerceCenter() {
  const [tab, setTab] = useState(0);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Commerce Center</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Operational commerce visibility. Ledger is immutable. Financial truth from canonical Commerce.
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

      {tab === 0 && <ReconciliationPanel />}
      {tab === 1 && <ConnectAccountsPanel />}
      {tab === 2 && <RefundsPanel />}
    </div>
  );
}
