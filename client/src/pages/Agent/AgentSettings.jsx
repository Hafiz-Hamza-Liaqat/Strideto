import { useState } from 'react';
import { agentAuthApi } from '../../services/agentService';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ChangePasswordForm } from '../../components/auth/ChangePasswordForm';
import { ConnectedAccountsPanel } from '../../components/account/ConnectedAccountsPanel';

export default function AgentSettings({
  heading = 'Account Settings',
  description = 'Account security only. Password and session actions apply to this Provider account. Refresh cookies remain HttpOnly.',
}) {
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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{heading}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">{description}</p>
      </div>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-sm">
        <h2 className="font-semibold text-gray-900 dark:text-white">Account</h2>
        <p className="mt-1 text-gray-600 dark:text-gray-400">Email: {agent?.email || '—'}</p>
      </section>
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Security</h2>
        <ChangePasswordForm onSubmit={submit} busy={busy} successMessage={message} />
        <button type="button" onClick={logoutAll} disabled={busy} className="mt-4 rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 min-h-[44px]">Log out all other sessions</button>
      </section>
      <ConnectedAccountsPanel />
    </div>
  );
}
