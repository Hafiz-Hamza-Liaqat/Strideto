import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';
import { Logo } from '../../components/brand/Logo';
import { publicProviderDomainProjection } from '@shared/provider/providerDomains.js';

export default function AgentAcceptInvitation() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { agent } = useAgentAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState([]);

  useEffect(() => {
    if (!token) { setError('Invitation token is missing.'); return; }
    agentApi.previewInvite(token).then(({ data }) => {
      setPreview(data);
      const ids = (data.domainAccess || []).map((row) => row.domainId);
      setAccepted(ids);
    }).catch((err) => setError(err.response?.data?.error || 'Unable to preview invitation.'));
  }, [token]);

  const accept = async () => {
    if ((preview?.domainAccess || []).length && accepted.length === 0) {
      setError('Confirm at least one invited provider domain.');
      return;
    }
    setBusy(true); setError('');
    try {
      await agentApi.acceptInvite(token, accepted);
      navigate(`${ROUTES.AGENT_DASHBOARD}?home=1`);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to accept invitation.');
    } finally { setBusy(false); }
  };

  const invitedDomains = preview?.domainAccess || [];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-main dark:bg-secondary">
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <Logo height={32} />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Accept agency invitation</h1>
        {error ? <p className="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p> : null}
        {preview ? <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{preview.organizationName} · {preview.role} · {preview.status}</p> : null}
        {invitedDomains.length > 0 ? (
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-white">Confirm invited professional domain access <span className="text-red-700">*</span></legend>
            {invitedDomains.map((row) => {
              const def = publicProviderDomainProjection(row.domainId);
              return (
                <label key={row.domainId} className="mt-2 flex items-start gap-2 text-sm text-gray-900 dark:text-white">
                  <input
                    type="checkbox"
                    checked={accepted.includes(row.domainId)}
                    onChange={() => setAccepted((current) => (
                      current.includes(row.domainId) ? current.filter((id) => id !== row.domainId) : [...current, row.domainId]
                    ))}
                  />
                  <span className="break-words">{def?.publicName || row.domainId}</span>
                </label>
              );
            })}
            <p className="mt-2 text-xs text-gray-500">This grants agency workspace access only. It does not verify personal or agency professional capabilities.</p>
          </fieldset>
        ) : null}
        {!agent ? (
          <p className="text-sm">
            <Link className="text-primary hover:underline" to={`${ROUTES.AGENT_LOGIN}?next=/agent/accept-invitation?token=${encodeURIComponent(token)}`}>Sign in to accept</Link>
            {' · '}
            <Link className="text-primary hover:underline" to={`${ROUTES.AGENT_REGISTER}?invite=${encodeURIComponent(token)}`}>Register</Link>
          </p>
        ) : (
          <button type="button" disabled={busy || !token || preview?.status !== 'pending' || ((preview?.domainAccess || []).length > 0 && accepted.length === 0)} onClick={accept} className="w-full min-h-[44px] bg-primary text-white rounded-lg disabled:opacity-50">
            Accept invitation
          </button>
        )}
      </div>
    </div>
  );
}
