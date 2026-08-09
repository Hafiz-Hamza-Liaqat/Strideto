import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';

export default function AgentRegister() {
  const navigate = useNavigate();
  const { register, error: ctxError, setError: setCtxError } = useAgentAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    agentType: 'agent',
    countryCode: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCtxError?.(null);
    setSubmitting(true);
    try {
      await register({
        ...form,
        email: form.email.trim().toLowerCase(),
        displayName: form.displayName.trim(),
        countryCode: form.countryCode.trim().toUpperCase(),
      });
      navigate(ROUTES.AGENT_ONBOARDING, { replace: true });
    } catch (err) {
      setCtxError?.(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-[#0F172A]">Create Agent Account</h1>
          <p className="text-slate-500 mt-1 mb-6 text-sm">
            Register as a professional agent or agency on Strideto.
          </p>
          {ctxError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{ctxError}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">
                Organization / Professional Name
              </label>
              <input
                type="text"
                value={form.displayName}
                onChange={set('displayName')}
                required
                className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your agency or professional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Account Type</label>
              <select
                value={form.agentType}
                onChange={set('agentType')}
                className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="agent">Individual Agent</option>
                <option value="agency">Agency / Organization</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Country (ISO code)</label>
              <input
                type="text"
                value={form.countryCode}
                onChange={set('countryCode')}
                maxLength={2}
                className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. PK, GB, US"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                minLength={8}
                className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 bg-[#1D4ED8] text-white rounded-lg font-medium hover:bg-[#1e40af] disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="mt-6 text-sm text-slate-600">
            Already registered?{' '}
            <Link to={ROUTES.AGENT_LOGIN} className="text-[#1D4ED8] font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
