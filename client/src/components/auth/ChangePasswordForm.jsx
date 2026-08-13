import { useState } from 'react';
import { PasswordInput } from '../forms/PasswordInput';

const REQUIREMENTS = '8–128 characters, including uppercase, lowercase, and a number.';

export function ChangePasswordForm({
  onSubmit,
  busy = false,
  successMessage = '',
  errorMessage = '',
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');
    if (newPassword !== confirmPassword) {
      setLocalError('New password and confirmation do not match.');
      return;
    }
    await onSubmit({ currentPassword, newPassword });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const error = localError || errorMessage;

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-3">
      <div className="min-h-[1.5rem]" aria-live="polite">
        {successMessage ? (
          <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
        ) : null}
      </div>
      <label htmlFor="current-password" className="block text-sm font-medium text-gray-900 dark:text-white">
        Current password
        <div className="mt-1">
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>
      </label>
      <label htmlFor="new-password" className="block text-sm font-medium text-gray-900 dark:text-white">
        New password
        <div className="mt-1">
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>
      </label>
      <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-900 dark:text-white">
        Confirm new password
        <div className="mt-1">
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
      </label>
      <p className="min-h-[1.25rem] text-xs text-gray-500 dark:text-gray-400">{REQUIREMENTS}</p>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white min-h-[44px] disabled:opacity-50"
      >
        {busy ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}
