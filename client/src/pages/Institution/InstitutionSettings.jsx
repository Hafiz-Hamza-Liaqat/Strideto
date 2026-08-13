import { useState } from 'react';
import { Link } from 'react-router-dom';
import { institutionAuthApi } from '../../services/institutionPortalService';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { ChangePasswordForm } from '../../components/auth/ChangePasswordForm';
import { ConnectedAccountsPanel } from '../../components/account/ConnectedAccountsPanel';
import { PageState, secondaryButton } from './InstitutionUi';

export default function InstitutionSettings() {
  const { logout, account } = useInstitutionAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async ({ currentPassword, newPassword }) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await institutionAuthApi.changePassword({ currentPassword, newPassword });
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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Account / security</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Session tokens are never displayed. Refresh cookies remain HttpOnly.</p>
      </div>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-sm">
        <h2 className="font-semibold text-gray-900 dark:text-white">Account</h2>
        <p className="mt-1 text-gray-600 dark:text-gray-400">Email: {account?.email || '—'}</p>
        <p className="text-gray-600 dark:text-gray-400">Channel verification is separate from organization verification and canonical claim.</p>
      </section>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Security</h2>
        <ChangePasswordForm onSubmit={submit} busy={busy} successMessage={message} />
      </section>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3 text-sm">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Sessions</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Revoke refresh tokens on every device except this browser session flow.</p>
          <button type="button" onClick={logoutAll} disabled={busy} className={`${secondaryButton} mt-2`}>Log out all other sessions</button>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Related workspace areas</h2>
          <ul className="mt-2 space-y-1">
            <li><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_TEAM}>Team</Link></li>
            <li><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_VERIFICATION}>Organization verification</Link></li>
            <li><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_CLAIM}>Canonical claim</Link></li>
            <li><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_BILLING}>Billing / usage</Link></li>
            <li><Link className="text-primary hover:underline" to={ROUTES.INSTITUTION_NOTIFICATIONS}>Notifications</Link></li>
          </ul>
        </div>
      </section>
      <ConnectedAccountsPanel />
    </div>
  );
}
