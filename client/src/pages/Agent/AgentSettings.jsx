import { useState } from 'react';
import { Link } from 'react-router-dom';
import { agentAuthApi } from '../../services/agentService';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';
import { ChangePasswordForm } from '../../components/auth/ChangePasswordForm';
import { ConnectedAccountsPanel } from '../../components/account/ConnectedAccountsPanel';

export default function AgentSettings() {
  const { logout, agent } = useAgentAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async ({ currentPassword, newPassword }) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await agentAuthApi.changePassword({ currentPassword, newPassword });
      setMessage('Password changed. Other sessions were revoked. Sign in again.');
      await logout();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to change password.');
    } finally {
      setBusy(false);
    }
  };

  const logoutAll = async () => {
    setBusy(true);
    setError('');
    try {
      await agentAuthApi.logoutAll();
      await logout();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to revoke sessions.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Shared account settings. Profile, security, notifications, language, and billing apply across provider domains. Education availability and Business capability setup stay in their workspaces. Security changes revoke Agent sessions without affecting Student or Employer sessions. Refresh cookies remain HttpOnly.</p>
      </div>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-sm">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Shared account settings</h2>
        <h3 className="mt-2 font-semibold text-gray-900 dark:text-white">Account</h3>
        <p className="mt-1 text-gray-600 dark:text-gray-400">Email: {agent?.email || '—'}</p>
      </section>
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Security</h2>
        <ChangePasswordForm onSubmit={submit} busy={busy} successMessage={message} />
        <button type="button" onClick={logoutAll} disabled={busy} className="mt-4 rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 min-h-[44px]">Log out all other sessions</button>
      </section>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2 text-sm">
        <h2 className="font-semibold text-gray-900 dark:text-white">Notifications</h2>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_NOTIFICATIONS}>Notification preferences / inbox</Link></p>
      </section>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2 text-sm">
        <h2 className="font-semibold text-gray-900 dark:text-white">Billing / Usage</h2>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_USAGE_BILLING}>Usage & Billing</Link></p>
      </section>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2 text-sm">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Provider identity</h2>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_PROFILE}>Profile</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_TRUST}>Trust Center</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_TEAM}>Team</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_VERIFICATION}>Identity & organization verification</Link></p>
      </section>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2 text-sm">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Workspace settings</h2>
        <p className="text-xs text-slate-500">Active dashboard switching stays in Agent navigation. These links do not grant a domain.</p>
        <p className="pt-2 font-medium text-gray-900 dark:text-white">Education & Mobility</p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_AVAILABILITY}>Availability</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_SERVICES}>Education & Mobility service preferences</Link></p>
        <p className="pt-2 font-medium text-gray-900 dark:text-white">Business Services</p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_BUSINESS_SERVICES}>Business Services workspace</Link></p>
        <p className="text-xs text-slate-500">Session tokens are never displayed. No fake future setting pages.</p>
      </section>
      <ConnectedAccountsPanel />
    </div>
  );
}
