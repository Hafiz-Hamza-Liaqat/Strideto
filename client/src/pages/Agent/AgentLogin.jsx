import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';

export default function AgentLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error: ctxError, setError: setCtxError } = useAgentAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || ROUTES.AGENT_DASHBOARD;

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
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-[#0F172A]">Agent Portal Login</h1>
          <p className="text-slate-500 mt-1 mb-6 text-sm">
            Sign in to your Strideto agent account.
          </p>
          {ctxError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{ctxError}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 bg-[#1D4ED8] text-white rounded-lg font-medium hover:bg-[#1e40af] disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-sm text-slate-600">
            New agent?{' '}
            <Link to={ROUTES.AGENT_REGISTER} className="text-[#1D4ED8] font-medium hover:underline">
              Register your agency
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
