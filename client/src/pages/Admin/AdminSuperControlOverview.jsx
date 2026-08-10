import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { getAdminOverview } from '../../services/adminSuperControlApi';

function MetricCard({ label, value, sub, to, warn }) {
  const card = (
    <div className={`rounded-lg border p-4 ${warn && value > 0 ? 'border-amber-400 dark:border-amber-600' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

export default function AdminSuperControlOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getAdminOverview()
      .then(setData)
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500 dark:text-gray-400 text-sm p-4">Loading overview…</p>;
  if (error) return <p className="text-red-600 dark:text-red-400 text-sm p-4" role="alert">Error: {error}</p>;
  if (!data) return null;

  const { users, verification, trustOperations, services, commerce, institutions, marketplace, dataQuality, ai, recentAuditActivity } = data;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Super Control Center</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Current operational counts — generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'}
          </p>
        </div>
      </div>

      <Section title="Users">
        <MetricCard label="Total Students" value={users?.totalStudents} sub="role: User" />
        <MetricCard label="Active Students" value={users?.activeStudents} />
        <MetricCard label="Suspended Students" value={users?.suspendedStudents} warn />
      </Section>

      <Section title="Verification Queue">
        <MetricCard label="Pending Verification" value={verification?.pending} warn to={`${ROUTES.ADMIN}/verification-queue`} />
        <MetricCard label="Needs Information" value={verification?.needsInformation} warn to={`${ROUTES.ADMIN}/verification-queue`} />
        <MetricCard label="Enhanced Review" value={verification?.enhancedReview} warn to={`${ROUTES.ADMIN}/verification-queue`} />
      </Section>

      <Section title="Trust Operations">
        <MetricCard label="Open Reports" value={trustOperations?.openReports} warn to={`${ROUTES.ADMIN}/sc/trust`} />
        <MetricCard label="Open Disputes" value={trustOperations?.openDisputes} warn to={`${ROUTES.ADMIN}/sc/trust`} />
        <MetricCard label="Institution Claims" value={institutions?.claimsPending} warn to={`${ROUTES.ADMIN}/institutions`} />
        <MetricCard label="Marketplace Pending" value={marketplace?.pendingModeration} warn to={`${ROUTES.ADMIN}/agent-marketplace`} />
      </Section>

      <Section title="Services">
        <MetricCard label="Active Consultations" value={services?.activeConsultations} />
        <MetricCard label="Active Cases" value={services?.activeCases} />
      </Section>

      <Section title="Commerce">
        <MetricCard label="Refund Requests" value={commerce?.refundRequests} warn to={`${ROUTES.ADMIN}/sc/commerce`} />
        <MetricCard label="Reconciliation Mismatches" value={commerce?.reconciliationMismatches} warn to={`${ROUTES.ADMIN}/sc/commerce`} />
      </Section>

      <Section title="Data Quality">
        <MetricCard label="Stale Facts" value={dataQuality?.staleFacts} warn to={`${ROUTES.ADMIN}/sc/data-quality`} />
        <MetricCard label="Review Due Facts" value={dataQuality?.reviewDueFacts} warn to={`${ROUTES.ADMIN}/sc/data-quality`} />
        <MetricCard label="Broken Sources" value={dataQuality?.brokenSources} warn to={`${ROUTES.ADMIN}/sc/data-quality`} />
      </Section>

      <Section title="AI Provider">
        <MetricCard
          label="Copilot Provider"
          value={ai?.providerStatus?.state ?? '—'}
          sub={`source: ${data.ai?.source ?? 'in-process config'}`}
        />
      </Section>

      {recentAuditActivity?.entries?.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
            Recent Audit Activity
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Actor</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Action</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Target</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentAuditActivity.entries.map((e, i) => (
                  <tr key={i} className="bg-white dark:bg-gray-800">
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.actorEmail || e.actorRole || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">{e.action}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.targetType || '—'}</td>
                    <td className="px-3 py-2 text-gray-400 dark:text-gray-500 whitespace-nowrap text-xs">
                      {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {recentAuditActivity.scope} — <Link to={`${ROUTES.ADMIN}/audit`} className="underline">View full audit log</Link>
          </p>
        </div>
      )}
    </div>
  );
}
