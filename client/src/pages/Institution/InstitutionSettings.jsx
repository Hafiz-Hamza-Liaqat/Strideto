import { useState } from 'react';
import { Link } from 'react-router-dom';
import { institutionAuthApi } from '../../services/institutionPortalService';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { PageState, fieldClass, primaryButton, secondaryButton } from './InstitutionUi';

export default function InstitutionSettings() {
  const { logout } = useInstitutionAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await institutionAuthApi.changePassword(password);
      setMessage('Password changed. Sign in again.');
      await logout();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to change password.');
    } finally { setBusy(false); }
  };

  const logoutAll = async () => {
    setBusy(true); setError('');
    try {
      await institutionAuthApi.logoutAll();
      await logout();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to revoke sessions.');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings / security</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Session tokens are never displayed. Refresh cookies remain HttpOnly.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {message ? <PageState tone="success">{message}</PageState> : null}
      <form onSubmit={submit} className="max-w-xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <label className="text-sm font-medium text-gray-900 dark:text-white">New password
          <input type="password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} />
        </label>
        <button disabled={busy} className={`${primaryButton} mt-4`}>{busy ? 'Changing…' : 'Change password'}</button>
      </form>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2 text-sm">
        <button type="button" onClick={logoutAll} disabled={busy} className={secondaryButton}>Log out all sessions</button>
        <p><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_TEAM}>Team</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_VERIFICATION}>Verification</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_CLAIM}>Canonical claim</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_BILLING}>Billing / usage</Link></p>
        <p><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_NOTIFICATIONS}>Notifications</Link></p>
      </section>
    </div>
  );
}
