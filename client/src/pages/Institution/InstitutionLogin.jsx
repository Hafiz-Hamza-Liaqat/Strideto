import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FormField } from '../../components/common/FormField';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { PageState, primaryButton } from './InstitutionUi';

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
      const requested = location.state?.from?.pathname;
      navigate(requested?.startsWith('/institution') ? requested : ROUTES.INSTITUTION_DASHBOARD, { replace: true });
    } catch (error) {
      setServerError(error.response?.data?.error || 'Institution sign-in failed. Check your credentials and try again.');
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-blue-700">Strideto Institution Portal</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Institution sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Use an Institution realm account. Student, Employer, Agent, and Admin sessions do not grant access.</p>
        {serverError ? <div className="mt-4"><PageState tone="error" role="alert">{serverError}</PageState></div> : null}
        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <FormField id="institution-email" label="Institution account email" error={errors.email}>
            <input id="institution-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-200" />
          </FormField>
          <FormField id="institution-password" label="Password" error={errors.password}>
            <input id="institution-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-200" />
          </FormField>
          <button type="submit" disabled={busy || loading} className={`${primaryButton} w-full`}>{busy ? 'Signing in…' : 'Sign in to Institution Portal'}</button>
        </form>
        <p className="mt-5 text-sm text-slate-600">
          Need Institution access?{' '}
          <Link className="font-semibold text-blue-700 underline" to={ROUTES.INSTITUTION_REGISTER}>
            Create a restricted verification account
          </Link>
        </p>
        <p className="mt-2 text-xs text-slate-500">Registration does not verify or approve an Institution. Canonical claims and authoritative publishing require separate review.</p>
        <PageState role="note"><strong>Privacy boundary:</strong> this portal does not provide Student search, profiles, Vault documents, cases, Budget plans, or Copilot conversations.</PageState>
      </div>
    </main>
  );
}
