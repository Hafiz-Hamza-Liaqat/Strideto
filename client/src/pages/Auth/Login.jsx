import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants';
import { validateEmail, validatePassword } from '../../utils/validation';
import { translateValidationError } from '../../utils/validationI18n';
import { Button } from '../../components/common/Button';
import { SocialAuthButton } from '../../components/auth/SocialAuthButton';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/ui/Alerts';
import { SeoHead } from '../../components/seo';
import { isOnboardingComplete, markOnboardingPending } from '../../onboarding';
import { resolveLoginReturnPath } from '../../utils/loginReturn.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error, setError } = useAuth();
  const { t } = useTranslation(['forms', 'common', 'validation']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');

  const from = resolveLoginReturnPath(location.state?.from, ROUTES.HOME);
  const isFromAdmin = from === ROUTES.ADMIN || from.startsWith(`${ROUTES.ADMIN}/`);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setVerificationEmail('');
    const emailErr = translateValidationError(validateEmail(email), t);
    const passwordErr = translateValidationError(validatePassword(password, false), t);
    if (emailErr || passwordErr) {
      setErrors({ email: emailErr, password: passwordErr });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (result?.mustChangePassword) {
        navigate(ROUTES.PROFILE, { replace: true, state: { mustChangePassword: true } });
      } else if (from === ROUTES.HOME || from === ROUTES.LOGIN || from === ROUTES.REGISTER) {
        const uid = result?.user?._id ? String(result.user._id) : null;
        if (!isOnboardingComplete({ userId: uid, userFlag: result?.user?.onboardingCompleted })) {
          markOnboardingPending();
        }
        navigate(ROUTES.HOME, { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'email_verification_required') {
        const target = data.email || email.trim().toLowerCase();
        setVerificationEmail(target);
        setError(data.error || t('forms:login.verifyRequired', { defaultValue: 'Please verify your email before signing in.' }));
      } else {
        const msg = data?.error || t('forms:login.failed');
        const details = data?.details || {};
        setError(msg);
        setErrors({ email: details.email || null, password: details.password || null });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    setError(t('forms:login.googleSoon'));
  };

  return (
    <>
      <SeoHead title={t('forms:login.title')} description={t('forms:login.seoDescription')} noindex />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('forms:login.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {isFromAdmin ? t('forms:login.adminSubtitle') : t('forms:login.subtitle')}
        </p>

        {error && (
          <Alert variant="error" title={t('common:error')} className="mb-6">
            {error}
            {verificationEmail ? (
              <p className="mt-3">
                <Link
                  to={`${ROUTES.VERIFY_EMAIL}?pending=1&email=${encodeURIComponent(verificationEmail)}`}
                  className="text-primary dark:text-mint font-medium hover:underline"
                >
                  {t('forms:login.goVerify', { defaultValue: 'Resend verification email' })}
                </Link>
              </p>
            ) : null}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label={t('common:email')} id="login-email" error={errors.email}>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow duration-200"
              placeholder={t('common:emailPlaceholder')}
            />
          </FormField>
          <FormField label={t('common:password')} id="login-password" error={errors.password}>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow duration-200"
              placeholder={t('common:passwordPlaceholder')}
            />
          </FormField>
          <div className="flex justify-end">
            <Link to={ROUTES.FORGOT_PASSWORD} className="text-sm text-primary dark:text-mint hover:underline link-hover">
              {t('common:forgotPassword')}
            </Link>
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t('forms:login.signingIn') : t('forms:login.signIn')}
          </Button>
        </form>

        <div className="mt-6 animate-fade-in">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">{t('common:continueWith')}</p>
          <SocialAuthButton provider="Google" onClick={handleGoogleLogin} comingSoon />
        </div>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {t('common:dontHaveAccount')}{' '}
          <Link to={ROUTES.REGISTER} className="text-primary dark:text-mint font-medium hover:underline link-hover">
            {t('common:register')}
          </Link>
        </p>
      </div>
    </>
  );
}
