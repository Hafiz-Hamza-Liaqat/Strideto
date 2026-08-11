import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';
import { LOGIN_REALMS, resolveLoginReturnPath } from '../../utils/loginReturn.js';
import { Logo } from '../../components/brand/Logo';

export default function AgentLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error: ctxError, setError: setCtxError } = useAgentAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = resolveLoginReturnPath(
    location.state?.from,
    ROUTES.AGENT_DASHBOARD,
    LOGIN_REALMS.AGENT
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCtxError?.(null);
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setCtxError?.(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main dark:bg-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-8">
          <Logo height={32} className="mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Agent Portal Login</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 mb-6 text-sm">
            Sign in to your Strideto agent account.
          </p>
          {ctxError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{ctxError}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="agent-login-email" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Email</label>
              <input
                id="agent-login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="agent-login-password" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Password</label>
              <input
                id="agent-login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] py-2 px-4 bg-primary text-white rounded-lg font-medium disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-sm text-slate-600 dark:text-gray-400">
            New agent?{' '}
            <Link to={ROUTES.AGENT_REGISTER} className="text-primary font-medium hover:underline">
              Register your agency
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
