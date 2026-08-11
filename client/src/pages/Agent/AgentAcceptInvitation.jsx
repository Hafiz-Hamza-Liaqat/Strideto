import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';
import { Logo } from '../../components/brand/Logo';

export default function AgentAcceptInvitation() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { agent } = useAgentAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invitation token is missing.'); return; }
    agentApi.previewInvite(token).then(({ data }) => setPreview(data)).catch((err) => setError(err.response?.data?.error || 'Unable to preview invitation.'));
  }, [token]);

  const accept = async () => {
    setBusy(true); setError('');
    try {
      await agentApi.acceptInvite(token);
      navigate(ROUTES.AGENT_TEAM);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to accept invitation.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-main dark:bg-secondary">
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <Logo height={32} />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Accept agency invitation</h1>
        {error ? <p className="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p> : null}
        {preview ? <p className="text-sm text-gray-700 dark:text-gray-300">{preview.organizationName} · {preview.role} · {preview.status}</p> : null}
        {!agent ? (
          <p className="text-sm">
            <Link className="text-primary hover:underline" to={`${ROUTES.AGENT_LOGIN}?next=/agent/accept-invitation?token=${encodeURIComponent(token)}`}>Sign in to accept</Link>
            {' · '}
            <Link className="text-primary hover:underline" to={ROUTES.AGENT_REGISTER}>Register</Link>
          </p>
        ) : (
          <button type="button" disabled={busy || !token || preview?.status !== 'pending'} onClick={accept} className="w-full min-h-[44px] bg-primary text-white rounded-lg disabled:opacity-50">
            Accept invitation
          </button>
        )}
      </div>
    </div>
  );
}
