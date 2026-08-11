import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../../components/brand/Logo';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionAuthApi } from '../../services/institutionPortalService';
import { ROUTES } from '../../constants';
import { PageState, fieldClass, primaryButton } from './InstitutionUi';

export default function InstitutionAcceptInvitation() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { isAuthenticated, login } = useInstitutionAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invitation token is required.'); return; }
    institutionAuthApi.previewInvite(token)
      .then(({ data }) => setPreview(data))
      .catch((err) => setError(err.response?.data?.error || 'Invitation not found.'));
  }, [token]);

  const accept = async () => {
    setBusy(true); setError('');
    try {
      await institutionAuthApi.acceptInvite(token);
      navigate(ROUTES.INSTITUTION_TEAM, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to accept invitation.');
    } finally { setBusy(false); }
  };

  const signInThenAccept = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await login(email.trim().toLowerCase(), password);
      await institutionAuthApi.acceptInvite(token);
      navigate(ROUTES.INSTITUTION_TEAM, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Sign-in or accept failed.');
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-bg-main dark:bg-secondary px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-8">
        <Logo height={32} className="mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accept Institution invitation</h1>
        {error ? <div className="mt-4"><PageState tone="error" role="alert">{error}</PageState></div> : null}
        {preview ? (
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{preview.organizationName || 'Institution'} · {preview.role} · {preview.status}</p>
        ) : null}
        {isAuthenticated ? (
          <button className={`${primaryButton} mt-6 w-full`} disabled={busy || !token} onClick={accept}>{busy ? 'Accepting…' : 'Accept invitation'}</button>
        ) : (
          <form className="mt-6 space-y-3" onSubmit={signInThenAccept}>
            <label className="text-sm text-gray-900 dark:text-white">Email<input className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} required type="email" /></label>
            <label className="text-sm text-gray-900 dark:text-white">Password<input className={fieldClass} value={password} onChange={(e) => setPassword(e.target.value)} required type="password" /></label>
            <button className={`${primaryButton} w-full`} disabled={busy}>{busy ? 'Working…' : 'Sign in and accept'}</button>
          </form>
        )}
        <p className="mt-4 text-sm"><Link className="text-primary underline" to={ROUTES.INSTITUTION_LOGIN}>Institution sign in</Link></p>
      </div>
    </main>
  );
}
