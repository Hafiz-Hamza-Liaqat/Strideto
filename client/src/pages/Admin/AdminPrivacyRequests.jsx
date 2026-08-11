import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';
import { ROUTES } from '../../constants';
import { adminPrivacyApi } from '../../services/privacyApi';

export default function AdminPrivacyRequests() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = () =>
    adminPrivacyApi.list().then(({ data }) => setRows(data.data || []));

  useEffect(() => {
    load()
      .catch((err) => setError(err.response?.data?.error || 'Unable to load privacy requests'))
      .finally(() => setLoading(false));
  }, []);

  async function setStatus(id, status) {
    setBusyId(id);
    try {
      await adminPrivacyApi.updateStatus(id, status);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update request');
    } finally {
      setBusyId('');
    }
  }

  return (
    <AdminRouteGuard permission={PERMISSIONS.USERS_READ}>
      <div className="space-y-4 min-w-0 max-w-4xl">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Privacy / legal requests</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Support and privacy handling does not require SuperAdmin access. Staff see only data necessary for the assigned task. Actions are audited. Immediate destructive account deletion is not available from this portal.
        </p>
        {loading ? <p role="status">Loading requests…</p> : null}
        {error ? <p className="text-red-600" role="alert">{error}</p> : null}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Subject</th>
                <th className="text-left px-3 py-2">Requested</th>
                <th className="text-left px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr><td className="px-3 py-4 text-gray-500" colSpan={5}>No Student export or deletion requests yet.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2 capitalize">{row.type}</td>
                  <td className="px-3 py-2">{row.status.replaceAll('_', ' ')}</td>
                  <td className="px-3 py-2">{row.subjectEmail || row.subjectId}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.requestedAt ? new Date(row.requestedAt).toLocaleString() : '—'}</td>
                  <td className="px-3 py-2">
                    {row.status === 'requested' || row.status === 'in_progress' ? (
                      <div className="flex flex-wrap gap-2">
                        {row.status === 'requested' ? (
                          <button type="button" disabled={busyId === row.id} onClick={() => setStatus(row.id, 'in_progress')} className="min-h-[44px] text-primary underline">In progress</button>
                        ) : null}
                        <button type="button" disabled={busyId === row.id} onClick={() => setStatus(row.id, 'completed')} className="min-h-[44px] text-primary underline">Complete</button>
                        <button type="button" disabled={busyId === row.id} onClick={() => setStatus(row.id, 'rejected')} className="min-h-[44px] text-red-600 underline">Reject</button>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-semibold">Fail-closed privacy boundaries</p>
          <ul className="list-disc list-inside space-y-1">
            <li>SuperAdmin is not universal access to the Student Vault.</li>
            <li>Private Copilot conversations are not visible here.</li>
            <li>Student Budget contents are not visible here.</li>
            <li>Private Agent notes and cases require explicit privileged-support authority and audit.</li>
            <li>Reporter identity is not shown on Trust reports unless policy requires it.</li>
            <li>Completed export requests do not invent a downloadable archive.</li>
          </ul>
        </div>
        <Link to={`${ROUTES.ADMIN}/support`} className="inline-flex min-h-[44px] items-center text-primary dark:text-mint underline">
          Open support / user requests
        </Link>
      </div>
    </AdminRouteGuard>
  );
}
