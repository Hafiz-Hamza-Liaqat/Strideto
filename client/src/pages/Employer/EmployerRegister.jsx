import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { ROUTES } from '../../constants';
import { TermsConsentField } from '../../components/auth/TermsConsentField';
import { TurnstileField } from '../../components/auth/TurnstileField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { validatePassword } from '../../utils/validation';
import { translateValidationError } from '../../utils/validationI18n';
import { pendingVerifyPath } from '../../utils/authUrls.js';
import { AuthCard } from '../../layouts/AuthLayout.jsx';
import { inputControlClassName, textareaControlClassName } from '../../components/forms/controlClasses.js';
import { clearAuthFormDraft, useAuthFormDraft } from '../../hooks/useAuthFormDraft.js';

export default function EmployerRegister() {
  const { t } = useTranslation(['employer', 'common', 'forms', 'validation']);
  const navigate = useNavigate();
  const { register } = useEmployerAuth();
  const [form, setForm] = useState({
    companyName: '',
    email: '',
    phone: '',
    website: '',
    companyDescription: '',
    password: '',
    acceptedTerms: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  useAuthFormDraft('employer', form, (safe) => setForm((f) => ({ ...f, ...safe })));

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.acceptedTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy');
      return;
    }
    const passwordErr = translateValidationError(validatePassword(form.password, true), t);
    if (passwordErr) {
      setError(passwordErr);
      return;
    }
    setSubmitting(true);
    try {
      const result = await register({
        ...form,
        phone: form.phone || '',
        acceptedTerms: true,
      });
      if (result?.requiresVerification || !result?._id) {
        clearAuthFormDraft('employer');
        const path = pendingVerifyPath('employer');
        navigate(result?.emailMode === 'unavailable' ? `${path}&delivery=unavailable` : path, { replace: true });
        return;
      }
      navigate(ROUTES.EMPLOYER_DASHBOARD, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || t('employer:registrationFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SeoHead title={t('employer:registerTitle')} description={t('forms:employerRegister.seoDescription')} noindex />
      <AuthCard title={t('employer:registrationHeading')} subtitle={t('employer:registrationSubtitle')}>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1" htmlFor="employer-company">{t('employer:companyName')}</label>
                <input
                  id="employer-company"
                  name="companyName"
                  autoComplete="organization"
                  value={form.companyName}
                  onChange={handleChange}
                  required
                  className={inputControlClassName()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1" htmlFor="employer-email">{t('common:email')} *</label>
                <input
                  id="employer-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className={inputControlClassName()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1" htmlFor="employer-phone-national">{t('employer:phone')}</label>
                <PhoneInput
                  id="employer-phone"
                  nationalId="employer-phone-national"
                  countryId="employer-phone-country"
                  value={form.phone}
                  onChange={(next) => setForm((f) => ({ ...f, phone: next.e164 || '' }))}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Optional. Stored in international format. Phone is not verified at launch.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1" htmlFor="employer-website">{t('employer:website')}</label>
                <input
                  id="employer-website"
                  name="website"
                  type="url"
                  autoComplete="url"
                  value={form.website}
                  onChange={handleChange}
                  className={inputControlClassName()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1" htmlFor="employer-desc">{t('employer:companyDescription')}</label>
                <textarea
                  id="employer-desc"
                  name="companyDescription"
                  value={form.companyDescription}
                  onChange={handleChange}
                  rows={3}
                  className={textareaControlClassName()}
                />
              </div>
              <div>
                <label htmlFor="employer-register-password" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">{t('common:password')} *</label>
                <PasswordInput
                  id="employer-register-password"
                  name="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  maxLength={128}
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
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg disabled:opacity-50"
              >
                {submitting ? t('employer:creating') : t('employer:createAccount')}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              {t('common:alreadyHaveAccount')}{' '}
              <Link to={ROUTES.EMPLOYER_LOGIN} className="text-primary font-medium hover:underline">
                {t('common:signIn')}
              </Link>
            </p>
      </AuthCard>
    </>
  );
}
