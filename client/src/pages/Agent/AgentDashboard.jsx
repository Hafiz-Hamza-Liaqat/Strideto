import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';

const STATUS_LABELS = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  email_verified: { label: 'Email Verified', color: 'bg-blue-100 text-blue-700' },
  verification_pending: { label: 'Verification Pending', color: 'bg-yellow-100 text-yellow-700' },
  under_review: { label: 'Under Review', color: 'bg-orange-100 text-orange-700' },
  needs_information: { label: 'Needs Information', color: 'bg-red-100 text-red-700' },
  enhanced_review: { label: 'Enhanced Review', color: 'bg-purple-100 text-purple-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  suspended: { label: 'Suspended', color: 'bg-red-200 text-red-800' },
  revoked: { label: 'Revoked', color: 'bg-red-200 text-red-800' },
  expired: { label: 'Expired', color: 'bg-slate-100 text-slate-700' },
};

export default function AgentDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    agentApi
      .getDashboard()
      .then((r) => setDashboard(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500 text-sm">Loading dashboard…</div>;
  if (error) return <div className="text-red-600 text-sm">{error}</div>;

  const vs = dashboard?.verificationStatus || 'draft';
  const badge = STATUS_LABELS[vs] || STATUS_LABELS.draft;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0F172A]">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Welcome to your Agent Portal.</p>
      </div>

      {/* Verification status card */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Verification Status</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Privileged features require approved status.
            </p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.color}`}>
            {badge.label}
          </span>
        </div>
        {!dashboard?.isApproved && (
          <div className="mt-3">
            <Link
              to={ROUTES.AGENT_VERIFICATION}
              className="text-sm text-[#1D4ED8] hover:underline font-medium"
            >
              Manage verification →
            </Link>
          </div>
        )}
      </div>

      {/* Profile completeness */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <p className="text-sm font-medium text-[#0F172A] mb-2">Profile Completeness</p>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="bg-[#1D4ED8] h-2 rounded-full transition-all"
            style={{ width: `${dashboard?.profileCompleteness || 0}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1.5">
          {dashboard?.profileCompleteness || 0}% complete —{' '}
          <span className="text-slate-400 italic">
            100% completeness does not mean verified.
          </span>
        </p>
        <Link
          to={ROUTES.AGENT_PROFILE}
          className="text-sm text-[#1D4ED8] hover:underline font-medium mt-2 inline-block"
        >
          Complete profile →
        </Link>
      </div>

      {/* Deferred metrics — honest placeholders */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Leads', route: ROUTES.AGENT_LEADS },
          { label: 'Clients', route: ROUTES.AGENT_CLIENTS },
          { label: 'Consultations', route: null },
          { label: 'Earnings', route: null },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center"
          >
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {item.label}
            </p>
            {item.route ? (
              <Link to={item.route} className="text-xl font-bold text-[#0F172A] hover:text-[#1D4ED8]">
                —
              </Link>
            ) : (
              <p className="text-xs text-slate-400 mt-1 italic">Coming soon</p>
            )}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-[#0F172A]">Marketplace</p><Link to={ROUTES.AGENT_MARKETPLACE} className="text-sm text-[#1D4ED8]">Manage posts →</Link></div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
          ['Drafts', dashboard?.marketplace?.drafts], ['Pending review', dashboard?.marketplace?.pendingReview], ['Published', dashboard?.marketplace?.published], ['Needs changes', dashboard?.marketplace?.needsChanges],
        ].map(([label,value])=><div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-xl font-semibold">{value ?? 0}</p><p className="text-xs text-slate-500">{label}</p></div>)}</div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <p className="text-sm font-medium text-[#0F172A] mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          <Link
            to={ROUTES.AGENT_PROFILE}
            className="text-sm px-4 py-2 bg-[#EFF6FF] text-[#1D4ED8] rounded-lg hover:bg-blue-100 font-medium"
          >
            Edit Profile
          </Link>
          <Link
            to={ROUTES.AGENT_SERVICES}
            className="text-sm px-4 py-2 bg-[#EFF6FF] text-[#1D4ED8] rounded-lg hover:bg-blue-100 font-medium"
          >
            Manage Services
          </Link>
          <Link
            to={ROUTES.AGENT_VERIFICATION}
            className="text-sm px-4 py-2 bg-[#EFF6FF] text-[#1D4ED8] rounded-lg hover:bg-blue-100 font-medium"
          >
            Verification
          </Link>
        </div>
      </div>
    </div>
  );
}
