import { useState } from 'react';
import { Link } from 'react-router-dom';
import { agentAuthApi } from '../../services/agentService';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2';

export default function AgentSettings() {
  const { logout } = useAgentAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await agentAuthApi.changePassword(password);
      setMessage('Password changed. Sign in again.');
      await logout();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to change password.');
    } finally { setBusy(false); }
  };

  const logoutAll = async () => {
    setBusy(true); setError('');
    try {
      await agentAuthApi.logoutAll();
      await logout();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to revoke sessions.');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings / security</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Security changes revoke Agent sessions without affecting Student or Employer sessions. Refresh cookies remain HttpOnly.</p>
      </div>
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      <form onSubmit={submit} className="max-w-xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <label className="text-sm font-medium text-gray-900 dark:text-white">New password
          <input type="password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
        </label>
        <button disabled={busy} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 min-h-[44px]">{busy ? 'Changing…' : 'Change password'}</button>
      </form>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2 text-sm">
        <button type="button" onClick={logoutAll} disabled={busy} className="rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 min-h-[44px]">Log out all sessions</button>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_TEAM}>Team</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_VERIFICATION}>Verification</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_USAGE_BILLING}>Usage & Billing</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.AGENT_NOTIFICATIONS}>Notification preferences / inbox</Link></p>
        <p className="text-xs text-slate-500">Session tokens are never displayed.</p>
      </section>
    </div>
  );
}
