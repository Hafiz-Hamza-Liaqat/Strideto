import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { ROUTES } from '../../constants';
import { TermsConsentField } from '../../components/auth/TermsConsentField';
import { TurnstileField } from '../../components/auth/TurnstileField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { validatePassword } from '../../utils/validation';
import { translateValidationError } from '../../utils/validationI18n';

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
      const result = await register({ ...form, acceptedTerms: true });
      if (result?.requiresVerification || !result?._id) {
        const params = new URLSearchParams({ pending: '1', email: form.email.trim().toLowerCase(), realm: 'employer' });
        if (result?.emailMode === 'unavailable') params.set('smtp', '0');
        navigate(`${ROUTES.VERIFY_EMAIL}?${params.toString()}`, { replace: true });
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-4 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">{t('employer:registrationHeading')}</h1>
            <p className="text-slate-600 mt-1 mb-6">{t('employer:registrationSubtitle')}</p>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:companyName')}</label>
                <input
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('common:email')} *</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:phone')}</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:website')}</label>
                <input
                  name="website"
                  type="url"
                  value={form.website}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:companyDescription')}</label>
                <textarea
                  name="companyDescription"
                  value={form.companyDescription}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
                />
              </div>
              <div>
                <label htmlFor="employer-register-password" className="block text-sm font-medium text-[#0F172A] mb-1">{t('common:password')} *</label>
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
                className="w-full py-2.5 bg-[#635BFF] hover:bg-[#4F46E5] text-white font-medium rounded-lg disabled:opacity-50"
              >
                {submitting ? t('employer:creating') : t('employer:createAccount')}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-600">
              {t('common:alreadyHaveAccount')}{' '}
              <Link to={ROUTES.EMPLOYER_LOGIN} className="text-[#635BFF] font-medium hover:underline">
                {t('common:signIn')}
              </Link>
            </p>
          </div>
          <p className="mt-4 text-center">
            <Link to={ROUTES.HOME} className="text-sm text-slate-500 hover:text-[#635BFF]">
              {t('employer:backToStrideto')}
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
