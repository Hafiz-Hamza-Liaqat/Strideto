import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { getAgentRegistrationError } from '../../utils/portalRegistrationErrors';
import { ROUTES } from '../../constants';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { TermsConsentField } from '../../components/auth/TermsConsentField';
import { TurnstileField } from '../../components/auth/TurnstileField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { pendingVerifyPath } from '../../utils/authUrls.js';
import { AuthCard } from '../../layouts/AuthLayout.jsx';
import { clearAuthFormDraft, useAuthFormDraft } from '../../hooks/useAuthFormDraft.js';
import { inputControlClassName, selectControlClassName } from '../../components/forms/controlClasses.js';

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
  useAuthFormDraft('agent', form, (safe) => setForm((f) => ({ ...f, ...safe })));

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
      const result = await register({
        ...form,
        email: form.email.trim().toLowerCase(),
        displayName: form.displayName.trim(),
        countryCode: form.countryCode.trim().toUpperCase(),
        acceptedTerms: true,
      });
      if (result?.requiresVerification || !result?._id) {
        clearAuthFormDraft('agent');
        const path = pendingVerifyPath('agent');
        navigate(result?.emailMode === 'unavailable' ? `${path}&delivery=unavailable` : path, { replace: true });
        return;
      }
      navigate(ROUTES.AGENT_ONBOARDING, { replace: true });
    } catch (err) {
      setCtxError?.(getAgentRegistrationError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Create Agent Account" subtitle="Register as a professional agent or agency on Strideto.">
      {ctxError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm">{ctxError}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="agent-register-name" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            Organization / Professional Name
          </label>
          <input
            id="agent-register-name"
            type="text"
            autoComplete="organization"
            value={form.displayName}
            onChange={set('displayName')}
            required
            className={inputControlClassName()}
            placeholder="Your agency or professional name"
          />
        </div>
        <div>
          <label htmlFor="agent-register-type" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Account Type</label>
          <select
            id="agent-register-type"
            value={form.agentType}
            onChange={set('agentType')}
            className={selectControlClassName()}
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
          <label htmlFor="agent-register-email" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Email</label>
          <input
            id="agent-register-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={form.email}
            onChange={set('email')}
            required
            className={inputControlClassName()}
          />
        </div>
        <div>
          <label htmlFor="agent-register-password" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Password</label>
          <PasswordInput
            id="agent-register-password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            required
            minLength={8}
            maxLength={128}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Use 8–128 characters with uppercase, lowercase, and a number.</p>
        </div>
        <TermsConsentField
          checked={form.acceptedTerms}
          onChange={(checked) => setForm((f) => ({ ...f, acceptedTerms: checked }))}
        />
        <TurnstileField action="register" />
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] py-2 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
        Already registered?{' '}
        <Link to={ROUTES.AGENT_LOGIN} className="text-primary font-medium hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
