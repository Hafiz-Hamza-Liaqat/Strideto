import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { getAgentRegistrationError } from '../../utils/portalRegistrationErrors';
import { ROUTES } from '../../constants';
import { Logo } from '../../components/brand/Logo';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { TermsConsentField } from '../../components/auth/TermsConsentField';
import { TurnstileField } from '../../components/auth/TurnstileField';

export default function AgentRegister() {
  const navigate = useNavigate();
  const { register, error: ctxError, setError: setCtxError } = useAgentAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    agentType: 'agent',
    countryCode: '',
    acceptedTerms: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCtxError?.(null);
    if (!form.acceptedTerms) {
      setCtxError?.('You must agree to the Terms of Service and Privacy Policy');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        ...form,
        email: form.email.trim().toLowerCase(),
        displayName: form.displayName.trim(),
        countryCode: form.countryCode.trim().toUpperCase(),
        acceptedTerms: true,
      });
      navigate(ROUTES.AGENT_ONBOARDING, { replace: true });
    } catch (err) {
      setCtxError?.(getAgentRegistrationError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main dark:bg-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          <Logo height={32} className="mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Create Agent Account</h1>
          <p className="text-slate-500 mt-1 mb-6 text-sm">
            Register as a professional agent or agency on Strideto.
          </p>
          {ctxError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{ctxError}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Organization / Professional Name
              </label>
              <input
                type="text"
                value={form.displayName}
                onChange={set('displayName')}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Your agency or professional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Account Type</label>
              <select
                value={form.agentType}
                onChange={set('agentType')}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="agent">Individual Agent</option>
                <option value="agency">Agency / Organization</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Country</label>
              <CountrySelect
                value={form.countryCode}
                allowAll={false}
                placeholder="Search country"
                onChange={(code) => setForm((f) => ({ ...f, countryCode: code || '' }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                minLength={8}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-slate-500">Use 8–128 characters with uppercase, lowercase, and a number.</p>
            </div>
            <TermsConsentField
              checked={form.acceptedTerms}
              onChange={(checked) => setForm((f) => ({ ...f, acceptedTerms: checked }))}
            />
            <TurnstileField action="register" />
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] py-2 px-4 bg-primary text-white rounded-lg font-medium disabled:opacity-60 transition-colors"
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
