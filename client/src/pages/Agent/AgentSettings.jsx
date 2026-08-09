import { useState } from 'react';
import { agentAuthApi } from '../../services/agentService';
import { useAgentAuth } from '../../context/AgentAuthContext';

export default function AgentSettings() {
  const { logout } = useAgentAuth(); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { await agentAuthApi.changePassword(password); setMessage('Password changed. Sign in again.'); await logout(); } catch (err) { setError(err.response?.data?.error || 'Unable to change password.'); } finally { setBusy(false); } };
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Account settings</h1><p className="mt-1 text-sm text-slate-500">Security changes revoke existing Agent sessions without affecting User or Employer sessions.</p></div>{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}<form onSubmit={submit} className="max-w-xl rounded-xl border bg-white p-5"><label className="text-sm font-medium">New password<input type="password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><button disabled={busy} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Changing…' : 'Change password'}</button></form><section className="rounded-xl border border-dashed p-5 text-sm text-slate-500">Consultations, cases, payments, and earnings are not available yet.</section></div>;
}
