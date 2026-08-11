import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FormField } from '../../components/common/FormField';
import { Logo } from '../../components/brand/Logo';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { LOGIN_REALMS, resolveLoginReturnPath } from '../../utils/loginReturn.js';
import { PageState, fieldClass, primaryButton } from './InstitutionUi';

export default function InstitutionLogin() {
  const { account, organizationId, loading, login } = useInstitutionAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.getElementById('institution-email')?.focus(); }, [loading]);

  if (!loading && account && organizationId) return <Navigate to={ROUTES.INSTITUTION_DASHBOARD} replace />;

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {
      email: email.trim() ? '' : 'Institution account email is required.',
      password: password ? '' : 'Password is required.',
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;
    setBusy(true);
    setServerError('');
    try {
      await login(email.trim().toLowerCase(), password);
      const requested = resolveLoginReturnPath(
        location.state?.from,
        ROUTES.INSTITUTION_DASHBOARD,
        LOGIN_REALMS.INSTITUTION
      );
      navigate(requested, { replace: true });
    } catch (error) {
      setServerError(
        error.response?.status === 429
          ? (error.response?.data?.error || 'Too many requests. Please try again later.')
          : (error.response?.data?.error || 'Institution sign-in failed. Check your credentials and try again.')
      );
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-bg-main dark:bg-secondary px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm sm:p-8">
        <Logo height={32} className="mb-4" />
        <p className="text-sm font-semibold text-primary">Strideto</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Institution sign in</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Use an Institution realm account. Registration does not verify the organization.</p>
        {serverError ? <div className="mt-4"><PageState tone="error" role="alert">{serverError}</PageState></div> : null}
        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <FormField id="institution-email" label="Institution account email" error={errors.email}>
            <input id="institution-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} placeholder="you@institution.edu" />
          </FormField>
          <FormField id="institution-password" label="Password" error={errors.password}>
            <input id="institution-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} placeholder="Enter password" />
          </FormField>
          <button type="submit" disabled={busy || loading} className={`${primaryButton} w-full`}>{busy ? 'Signing in…' : 'Sign in to Institution Portal'}</button>
        </form>
        <p className="mt-5 text-sm text-gray-600 dark:text-gray-400">
          Need Institution access?{' '}
          <Link className="font-semibold text-primary underline" to={ROUTES.INSTITUTION_REGISTER}>Create an Institution account</Link>
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">This is an Institution Account, not a Verified Institution until Admin approval.</p>
        <div className="mt-4"><PageState role="note"><strong>Privacy boundary:</strong> this portal does not provide Student search, profiles, Vault documents, cases, Budget plans, or Copilot conversations.</PageState></div>
      </div>
    </main>
  );
}
