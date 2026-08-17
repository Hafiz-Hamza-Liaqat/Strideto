import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';
import { LOGIN_REALMS, resolveLoginReturnPath } from '../../utils/loginReturn.js';
import { PasswordInput } from '../../components/forms/PasswordInput.jsx';
import { AuthCard } from '../../layouts/AuthLayout.jsx';
import { inputControlClassName } from '../../components/forms/controlClasses.js';

export default function AgentLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const portal = params.get('portal');
  const { login, error: ctxError, setError: setCtxError } = useAgentAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const defaultReturn = portal === 'business'
    ? ROUTES.AGENT_BUSINESS_SERVICES
    : portal === 'education'
      ? ROUTES.AGENT_EDUCATION
      : ROUTES.AGENT_DASHBOARD;

  const from = resolveLoginReturnPath(
    location.state?.from,
    defaultReturn,
    LOGIN_REALMS.AGENT
  );

  const title = portal === 'business'
    ? 'Business Formation Provider Login'
    : portal === 'education'
      ? 'Education & Mobility Provider Login'
      : 'Provider Portal Login';
  const subtitle = portal === 'business'
    ? 'Sign in to your Business Formation professional portal. Auth is shared with Education if you use both products.'
    : portal === 'education'
      ? 'Sign in to your Education & Mobility professional portal. Auth is shared with Business Formation if you use both products.'
      : 'Sign in to your Strideto provider account. Choose Education or Business after sign-in when you use both products.';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCtxError?.(null);
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setCtxError?.(
        err.response?.status === 429
          ? (err.response?.data?.error || 'Too many requests. Please try again later.')
          : (err.response?.data?.error || 'Login failed. Check your credentials.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title={title} subtitle={subtitle}>
      {ctxError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">{ctxError}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="agent-login-email" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Email</label>
          <input
            id="agent-login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputControlClassName()}
          />
        </div>
        <div>
          <label htmlFor="agent-login-password" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Password</label>
          <PasswordInput
            id="agent-login-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="mt-2 text-right">
            <Link to={ROUTES.AGENT_FORGOT_PASSWORD} className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] py-2 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
        New agent?{' '}
        <Link to={ROUTES.AGENT_REGISTER} className="text-primary font-medium hover:underline">
          Register your agency
        </Link>
      </p>
    </AuthCard>
  );
}
