import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { PasswordInput } from '../../components/forms/PasswordInput.jsx';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { ROUTES } from '../../constants';
import { LOGIN_REALMS, resolveLoginReturnPath } from '../../utils/loginReturn.js';
import { isOnboardingComplete, markOnboardingPending } from '../../onboarding';
import { AuthCard } from '../../layouts/AuthLayout.jsx';
import { inputControlClassName } from '../../components/forms/controlClasses.js';

export default function EmployerLogin() {
  const { t } = useTranslation(['employer', 'common', 'forms', 'validation']);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error: ctxError, setError: setCtxError } = useEmployerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = resolveLoginReturnPath(
    location.state?.from,
    ROUTES.EMPLOYER_DASHBOARD,
    LOGIN_REALMS.EMPLOYER
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCtxError?.(null);
    setSubmitting(true);
    try {
      const emp = await login(email.trim().toLowerCase(), password);
      const empId = emp?._id ? String(emp._id) : 'employer';
      if (!isOnboardingComplete({ userId: empId })) {
        markOnboardingPending();
        navigate(ROUTES.HOME, { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setCtxError?.(
        err.response?.status === 429
          ? (err.response?.data?.error || t('validation:tooManyRequests', { defaultValue: 'Too many requests. Please try again later.' }))
          : (err.response?.data?.error || t('employer:loginFailed'))
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SeoHead title={t('employer:loginTitle')} description={t('forms:employerLogin.seoDescription')} noindex />
      <AuthCard title={t('employer:loginHeading')} subtitle={t('employer:loginSubtitle')}>
        {ctxError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">{ctxError}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="employer-login-email" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">{t('common:email')}</label>
            <input
              id="employer-login-email"
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
            <label htmlFor="employer-login-password" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">{t('common:password')}</label>
            <PasswordInput
              id="employer-login-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="mt-2 text-right">
              <Link to={ROUTES.EMPLOYER_FORGOT_PASSWORD} className="text-sm text-primary hover:underline">
                {t('common:forgotPassword', { defaultValue: 'Forgot password?' })}
              </Link>
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg disabled:opacity-50"
          >
            {submitting ? t('common:signingIn') : t('common:signIn')}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {t('employer:noEmployerAccount')}{' '}
          <Link to={ROUTES.EMPLOYER_REGISTER} className="text-primary font-medium hover:underline">
            {t('common:register')}
          </Link>
        </p>
      </AuthCard>
    </>
  );
}
