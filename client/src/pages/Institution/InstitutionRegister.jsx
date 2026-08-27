import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { INSTITUTION_ORGANIZATION_TYPES } from '../../../../shared/institution/institutionPortal.js';
import { FormField } from '../../components/common/FormField';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { getInstitutionRegistrationError } from '../../utils/portalRegistrationErrors';
import { PageState, fieldClass, primaryButton } from './InstitutionUi';
import { TermsConsentField } from '../../components/auth/TermsConsentField';
import { TurnstileField } from '../../components/auth/TurnstileField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { pendingVerifyPath } from '../../utils/authUrls.js';
import { AuthCard } from '../../layouts/AuthLayout.jsx';
import { clearAuthFormDraft, useAuthFormDraft } from '../../hooks/useAuthFormDraft.js';
import { WorkspaceComingSoon } from '../../components/launch/WorkspaceComingSoon';
import {
  WORKSPACE_LAUNCH_IDS,
  isInstitutionWorkspaceLaunched,
} from '../../config/workspaceLaunchGates';

const TYPE_LABELS = Object.freeze({
  university: 'University',
  college: 'College',
  institute: 'Institute',
  school: 'School',
  training_center: 'Training center',
});

export default function InstitutionRegister() {
  const { account, organizationId, loading, register } = useInstitutionAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: '', institutionType: 'university', countryCode: '', email: '', password: '', acceptedTerms: false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useAuthFormDraft('institution', form, (safe) => setForm((current) => ({ ...current, ...safe })));

  if (!isInstitutionWorkspaceLaunched()) {
    return <WorkspaceComingSoon workspaceId={WORKSPACE_LAUNCH_IDS.INSTITUTION} />;
  }

  if (!loading && account && organizationId) {
    return <Navigate to={ROUTES.INSTITUTION_ONBOARDING} replace />;
  }

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.countryCode) {
      setError('Select a country.');
      return;
    }
    if (!form.acceptedTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await register({
        ...form,
        displayName: form.displayName.trim(),
        countryCode: form.countryCode.trim().toUpperCase(),
        email: form.email.trim().toLowerCase(),
        acceptedTerms: true,
      });
      if (result?.requiresVerification || !result?._id) {
        clearAuthFormDraft('institution');
        const path = pendingVerifyPath('institution');
        navigate(result?.emailMode === 'unavailable' ? `${path}&delivery=unavailable` : path, { replace: true });
        return;
      }
      navigate(ROUTES.INSTITUTION_ONBOARDING, { replace: true });
    } catch (registrationError) {
      setError(getInstitutionRegistrationError(registrationError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Create Institution representative account" subtitle="Start a restricted, unverified organization workspace. Registration never grants a verified badge, canonical authority, or publishing approval.">
        {error ? <div className="mb-4"><PageState tone="error" role="alert">{error}</PageState></div> : null}
        <form className="space-y-4" onSubmit={submit}>
          <FormField id="institution-register-name" label="Institution legal or official name">
            <input id="institution-register-name" required value={form.displayName} onChange={set('displayName')} className={fieldClass} autoComplete="organization" placeholder="Official legal name" />
          </FormField>
          <FormField id="institution-register-type" label="Institution type">
            <select id="institution-register-type" value={form.institutionType} onChange={set('institutionType')} className={fieldClass}>
              {INSTITUTION_ORGANIZATION_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}
            </select>
          </FormField>
          <FormField id="institution-register-country" label="Country">
            <CountrySelect
              id="institution-register-country"
              value={form.countryCode}
              allowAll={false}
              placeholder="Search country"
              inputClassName={fieldClass}
              onChange={(code) => setForm((current) => ({ ...current, countryCode: code || '' }))}
            />
          </FormField>
          <p className="text-xs text-gray-500 dark:text-gray-400">Select the country where this institution is legally based.</p>
          <FormField id="institution-register-email" label="Representative email">
            <input id="institution-register-email" required type="email" value={form.email} onChange={set('email')} className={fieldClass} autoComplete="username" placeholder="you@institution.edu" />
          </FormField>
          <FormField id="institution-register-password" label="Password">
            <PasswordInput id="institution-register-password" required minLength={8} maxLength={128} value={form.password} onChange={set('password')} autoComplete="new-password" placeholder="8–128 characters" />
          </FormField>
          <p className="text-xs text-gray-500 dark:text-gray-400">Use 8–128 characters with uppercase, lowercase, and a number.</p>
          <TermsConsentField
            checked={form.acceptedTerms}
            onChange={(checked) => setForm((current) => ({ ...current, acceptedTerms: checked }))}
          />
          <TurnstileField action="register" />
          <button type="submit" disabled={busy || loading} className={`${primaryButton} w-full`}>{busy ? 'Creating restricted account…' : 'Create Institution account'}</button>
        </form>
        <p className="mt-5 text-sm text-gray-600 dark:text-gray-400">Already registered? <Link className="font-semibold text-primary underline" to={ROUTES.INSTITUTION_LOGIN}>Sign in</Link></p>
        <div className="mt-4"><PageState role="note"><strong>Privacy boundary:</strong> Institution access grants no Student or Vault access. Verification and canonical Institution claims are reviewed separately.</PageState></div>
    </AuthCard>
  );
}
