import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';

const STATUS_LABELS = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100' },
  email_verified: { label: 'Email Verified', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' },
  verification_pending: { label: 'Verification Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' },
  under_review: { label: 'Under Review', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100' },
  needs_information: { label: 'Needs Information', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
  enhanced_review: { label: 'Enhanced Review', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
  suspended: { label: 'Suspended', color: 'bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-100' },
  revoked: { label: 'Revoked', color: 'bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-100' },
  expired: { label: 'Expired', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100' },
};

const cardClass = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4';

export default function AgentDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    agentApi.getDashboard()
      .then((r) => setDashboard(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500 dark:text-gray-400 text-sm">Loading dashboard…</div>;
  if (error) return <div className="text-red-700 dark:text-red-400 text-sm" role="alert">{error}</div>;

  const vs = dashboard?.verificationStatus || 'draft';
  const badge = STATUS_LABELS[vs] || STATUS_LABELS.draft;
  const cards = dashboard?.cards || {};
  const display = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    return String(value);
  };

  const metric = (key, fallbackLabel, fallbackHref) => {
    const card = cards[key] || {};
    return {
      label: fallbackLabel,
      value: display(card.value),
      href: card.href || fallbackHref,
      empty: card.value === 0 || card.value === 'not_configured' || card.value === 'not started',
    };
  };

  const metrics = [
    metric('newLeads', 'Leads', ROUTES.AGENT_LEADS),
    { label: 'Clients', value: display(dashboard?.clientsCount), href: ROUTES.AGENT_CLIENTS },
    metric('upcomingConsultations', 'Consultations', ROUTES.AGENT_CONSULTATIONS),
    metric('activeCases', 'Active cases', ROUTES.AGENT_CASES),
    metric('activeServices', 'Active services', ROUTES.AGENT_SERVICES),
    metric('marketplacePosts', 'Marketplace published', ROUTES.AGENT_MARKETPLACE),
    metric('unreadMessages', 'Unread messages', ROUTES.AGENT_MESSAGES),
    metric('unreadNotifications', 'Unread notifications', ROUTES.AGENT_NOTIFICATIONS),
    metric('pendingStudentApprovals', 'Student approvals', ROUTES.AGENT_CASES),
    metric('commerceReadiness', 'KYC / payout', ROUTES.AGENT_COMMERCE),
    metric('usageBilling', 'Usage & billing', ROUTES.AGENT_USAGE_BILLING),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">
          {dashboard?.agentType === 'agency' ? 'Agency workspace' : 'Professional workspace'}. Empty cards show 0 or not configured — they are not missing data.
        </p>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Verification status</p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Privileged features require approved status. Profile completeness is not verification.</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.color}`}>{badge.label}</span>
        </div>
        <Link to={ROUTES.AGENT_VERIFICATION} className="text-sm text-primary hover:underline font-medium mt-3 inline-block">Manage verification →</Link>
      </div>

      <div className={cardClass}>
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Profile completeness</p>
        <div className="w-full bg-slate-100 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-primary h-2 rounded-full" style={{ width: `${dashboard?.profileCompleteness || 0}%` }} />
        </div>
        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1.5">{dashboard?.profileCompleteness || 0}% complete — 100% completeness does not mean verified.</p>
        <Link to={ROUTES.AGENT_PROFILE} className="text-sm text-primary hover:underline font-medium mt-2 inline-block">Complete profile →</Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {metrics.map((item) => (
          <Link key={item.label} to={item.href} className={`${cardClass} hover:border-primary`}>
            <p className="text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wide">{item.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 break-words-safe">{item.value}</p>
          </Link>
        ))}
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Consultations</p>
          <Link to={ROUTES.AGENT_CONSULTATIONS} className="text-sm text-primary">Open schedule →</Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[['Incoming', dashboard?.consultations?.incoming], ['Upcoming', dashboard?.consultations?.upcoming], ['History', dashboard?.consultations?.history]].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 dark:bg-gray-900 p-3">
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{value ?? 0}</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Marketplace</p>
          <Link to={ROUTES.AGENT_MARKETPLACE} className="text-sm text-primary">Manage posts →</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Drafts', dashboard?.marketplace?.drafts], ['Pending review', dashboard?.marketplace?.pendingReview], ['Published', dashboard?.marketplace?.published], ['Needs changes', dashboard?.marketplace?.needsChanges]].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 dark:bg-gray-900 p-3">
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{value ?? 0}</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
