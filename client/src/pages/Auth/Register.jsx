import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants';
import { validateEmail, validatePassword, validateName } from '../../utils/validation';
import { translateValidationError } from '../../utils/validationI18n';
import { Button } from '../../components/common/Button';
import { SocialAuthButton } from '../../components/auth/SocialAuthButton';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/ui/Alerts';
import { SeoHead } from '../../components/seo';
import { isOnboardingComplete, markOnboardingPending } from '../../onboarding';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  const { register, error, setError } = useAuth();
  const { t } = useTranslation(['forms', 'common', 'validation']);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const nameErr = translateValidationError(validateName(name), t);
    const emailErr = translateValidationError(validateEmail(email), t);
    const passwordErr = translateValidationError(validatePassword(password, true), t);
    const confirmErr = password !== confirmPassword
      ? t('validation:passwordMismatch')
      : null;
    if (nameErr || emailErr || passwordErr || confirmErr) {
      setErrors({ name: nameErr, email: emailErr, password: passwordErr, confirmPassword: confirmErr });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await register({ name: name.trim(), email: email.trim().toLowerCase(), password, referralCode: refCode || undefined });
      if (result?.requiresVerification) {
        const params = new URLSearchParams({
          pending: '1',
          email: email.trim().toLowerCase(),
        });
        if (result.emailMode === 'unavailable') params.set('smtp', '0');
        navigate(`${ROUTES.VERIFY_EMAIL}?${params.toString()}`, { replace: true });
        return;
      }
      const user = result?.user;
      const uid = user?._id ? String(user._id) : null;
      if (!isOnboardingComplete({ userId: uid, userFlag: user?.onboardingCompleted })) {
        markOnboardingPending();
      }
      navigate(ROUTES.HOME, { replace: true });
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.error || t('forms:register.failed');
      const details = data?.details || {};
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setErrors({
        name: details.name || null,
        email: details.email || null,
        password: details.password || null,
        confirmPassword: details.confirmPassword || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignUp = () => {
    setError(t('forms:register.googleSoon'));
  };

  return (
    <>
      <SeoHead title={t('forms:register.signUp')} description={t('forms:register.seoDescription')} noindex />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('forms:register.signUp')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('forms:register.subtitle')}</p>

        {error && (
          <Alert variant="error" title={t('common:error')} className="mb-6">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label={t('common:name')} id="reg-name" error={errors.name}>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow duration-200"
              placeholder={t('forms:register.namePlaceholder')}
            />
          </FormField>
          <FormField label={t('common:email')} id="reg-email" error={errors.email}>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow duration-200"
              placeholder={t('common:emailPlaceholder')}
            />
          </FormField>
          <FormField label={t('common:password')} id="reg-password" error={errors.password}>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow duration-200"
              placeholder={t('forms:register.passwordHint')}
            />
          </FormField>
          <FormField label={t('common:confirmPassword')} id="reg-confirm" error={errors.confirmPassword}>
            <input
              id="reg-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow duration-200"
              placeholder={t('forms:register.confirmPlaceholder')}
            />
          </FormField>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t('forms:register.signingUp') : t('common:register')}
          </Button>
        </form>

        <div className="mt-6 animate-fade-in">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">{t('forms:register.signUpWith')}</p>
          <SocialAuthButton provider="Google" onClick={handleGoogleSignUp} comingSoon />
        </div>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {t('common:alreadyHaveAccount')}{' '}
          <Link to={ROUTES.LOGIN} className="text-primary dark:text-mint font-medium hover:underline link-hover">
            {t('common:login')}
          </Link>
        </p>
      </div>
    </>
  );
}
