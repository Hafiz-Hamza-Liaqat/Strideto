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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Account / security</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Security changes revoke Agent sessions without affecting Student or Employer sessions. Refresh cookies remain HttpOnly.</p>
      </div>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-sm">
        <h2 className="font-semibold text-gray-900 dark:text-white">Account</h2>
        <p className="mt-1 text-gray-600 dark:text-gray-400">Email: {agent?.email || '—'}</p>
      </section>
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Security</h2>
        <ChangePasswordForm onSubmit={submit} busy={busy} successMessage={message} />
      </section>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2 text-sm">
        <button type="button" onClick={logoutAll} disabled={busy} className="rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 min-h-[44px]">Log out all other sessions</button>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_TEAM}>Team</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_VERIFICATION}>Organization verification</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_USAGE_BILLING}>Usage & Billing</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_NOTIFICATIONS}>Notification preferences / inbox</Link></p>
        <p className="text-xs text-slate-500">Session tokens are never displayed.</p>
      </section>
      <ConnectedAccountsPanel />
    </div>
  );
}
