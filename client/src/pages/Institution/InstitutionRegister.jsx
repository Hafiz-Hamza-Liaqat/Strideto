import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { INSTITUTION_ORGANIZATION_TYPES } from '../../../../shared/institution/institutionPortal.js';
import { FormField } from '../../components/common/FormField';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';
import { getInstitutionRegistrationError } from '../../utils/portalRegistrationErrors';
import { PageState, primaryButton } from './InstitutionUi';

const TYPE_LABELS = Object.freeze({
  university: 'University',
  college: 'College',
  institute: 'Institute',
  school: 'School',
  training_center: 'Training center',
});

const fieldClass = 'min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-200';

export default function InstitutionRegister() {
  const { account, organizationId, loading, register } = useInstitutionAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: '', institutionType: 'university', countryCode: '', email: '', password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && account && organizationId) {
    return <Navigate to={ROUTES.INSTITUTION_ONBOARDING} replace />;
  }

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register({
        ...form,
        displayName: form.displayName.trim(),
        countryCode: form.countryCode.trim().toUpperCase(),
        email: form.email.trim().toLowerCase(),
      });
      navigate(ROUTES.INSTITUTION_ONBOARDING, { replace: true });
    } catch (registrationError) {
      setError(getInstitutionRegistrationError(registrationError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-blue-700">Strideto Institution Portal</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Create Institution representative account</h1>
        <p className="mt-2 text-sm text-slate-600">Start a restricted, unverified organization workspace. Registration never grants a verified badge, canonical authority, or publishing approval.</p>
        {error ? <div className="mt-4"><PageState tone="error" role="alert">{error}</PageState></div> : null}
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <FormField id="institution-register-name" label="Institution legal or official name">
            <input id="institution-register-name" required value={form.displayName} onChange={set('displayName')} className={fieldClass} autoComplete="organization" />
          </FormField>
          <FormField id="institution-register-type" label="Institution type">
            <select id="institution-register-type" value={form.institutionType} onChange={set('institutionType')} className={fieldClass}>
              {INSTITUTION_ORGANIZATION_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}
            </select>
          </FormField>
          <FormField id="institution-register-country" label="Country (ISO 3166-1 two-letter code)">
            <input id="institution-register-country" required maxLength={2} placeholder="For example: PK, GB, US" value={form.countryCode} onChange={set('countryCode')} className={fieldClass} autoComplete="country" />
          </FormField>
          <FormField id="institution-register-email" label="Representative email">
            <input id="institution-register-email" required type="email" value={form.email} onChange={set('email')} className={fieldClass} autoComplete="username" />
          </FormField>
          <FormField id="institution-register-password" label="Password">
            <input id="institution-register-password" required type="password" minLength={8} maxLength={128} value={form.password} onChange={set('password')} className={fieldClass} autoComplete="new-password" />
          </FormField>
          <p className="text-xs text-slate-500">Use 8–128 characters with uppercase, lowercase, and a number.</p>
          <button type="submit" disabled={busy || loading} className={`${primaryButton} w-full`}>{busy ? 'Creating restricted account…' : 'Create Institution account'}</button>
        </form>
        <p className="mt-5 text-sm text-slate-600">Already registered? <Link className="font-semibold text-blue-700 underline" to={ROUTES.INSTITUTION_LOGIN}>Sign in</Link></p>
        <PageState role="note"><strong>Privacy boundary:</strong> Institution access grants no Student or Vault access. Verification and canonical Institution claims are reviewed separately.</PageState>
      </div>
    </main>
  );
}
