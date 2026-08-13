import { useState } from 'react';
import { Link } from 'react-router-dom';
import { institutionAuthApi } from '../../services/institutionPortalService';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { PageState, primaryButton, secondaryButton } from './InstitutionUi';

export default function InstitutionSettings() {
  const { logout } = useInstitutionAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await institutionAuthApi.changePassword(password);
      setMessage('Password changed. Sign in again.');
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
      await institutionAuthApi.logoutAll();
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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings / security</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Session tokens are never displayed. Refresh cookies remain HttpOnly.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {message ? <PageState tone="success">{message}</PageState> : null}
      <form onSubmit={submit} className="max-w-xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3">
        <label htmlFor="institution-new-password" className="block text-sm font-medium text-gray-900 dark:text-white">
          New password
          <div className="mt-1">
            <PasswordInput
              id="institution-new-password"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="8–128 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400">Minimum 8 characters. You will be signed out on all devices after a successful change.</p>
        <button disabled={busy} className={primaryButton}>{busy ? 'Changing…' : 'Change password'}</button>
      </form>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3 text-sm">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Sessions</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Revoke refresh tokens on every device except this browser session flow.</p>
          <button type="button" onClick={logoutAll} disabled={busy} className={`${secondaryButton} mt-2`}>Log out all sessions</button>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Related workspace areas</h2>
          <ul className="mt-2 space-y-1">
            <li><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_TEAM}>Team</Link></li>
            <li><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_VERIFICATION}>Verification</Link></li>
            <li><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_CLAIM}>Canonical claim</Link></li>
            <li><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_BILLING}>Billing / usage</Link></li>
            <li><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_NOTIFICATIONS}>Notifications</Link></li>
          </ul>
        </div>
      </section>
    </div>
  );
}
