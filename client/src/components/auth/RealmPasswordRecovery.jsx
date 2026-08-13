import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../seo';
import { validateEmail, validatePassword } from '../../utils/validation';
import { translateValidationError } from '../../utils/validationI18n';
import { Button } from '../common/Button';
import { Alert } from '../ui/Alerts';
import { PasswordInput } from '../forms/PasswordInput.jsx';
import { useSecretQueryToken } from '../../hooks/useSecretQueryToken.js';
import { AuthCard } from '../../layouts/AuthLayout.jsx';
import { inputControlClassName } from '../forms/controlClasses.js';

export function RealmForgotPassword({ realmLabel, loginRoute, forgotApi, seoTitle, seoDescription }) {
  const { t } = useTranslation(['forms', 'common', 'validation']);
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [submitError, setSubmitError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    const emailErr = validateEmail(email);
    if (emailErr) {
      setErrors({ email: translateValidationError(emailErr, t) });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { data } = await forgotApi(email.trim().toLowerCase());
      setSuccessMessage(data?.message || t('forms:forgotPassword.sentExtended'));
      setSuccess(true);
    } catch (err) {
      setSubmitError(err.response?.data?.error || t('forms:forgotPassword.failed'));
      setSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SeoHead title={seoTitle} description={seoDescription} noindex />
      <AuthCard
        title={t('forms:realmForgotPassword.title', { realm: realmLabel, defaultValue: `Reset ${realmLabel} password` })}
        subtitle={t('forms:realmForgotPassword.subtitle', {
          defaultValue: 'Enter your account email. If a matching account exists and email delivery is available, a reset link will be sent.',
        })}
      >

          {success && (
            <Alert variant="success" title={t('forms:forgotPassword.checkEmail')} className="mt-6">
              {successMessage}
            </Alert>
          )}

          {submitError && (
            <Alert variant="error" title={t('common:error')} className="mt-6">
              {submitError}
            </Alert>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="realm-forgot-email" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {t('common:email')}
                </label>
                <input
                  id="realm-forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputControlClassName()}
                  required
                />
                {errors.email ? <p className="mt-1 text-sm text-red-600">{errors.email}</p> : null}
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? t('forms:forgotPassword.sending') : t('forms:forgotPassword.sendLink')}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            <Link to={loginRoute} className="text-primary font-medium hover:underline">
              {t('forms:forgotPassword.backToLogin')}
            </Link>
          </p>
      </AuthCard>
    </>
  );
}

export function RealmResetPassword({ realmLabel, loginRoute, forgotRoute, resetApi, seoTitle }) {
  const token = useSecretQueryToken('token');
  const { t } = useTranslation(['forms', 'common', 'validation']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setSubmitError(t('forms:resetPassword.invalidToken'));
  }, [token, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    const passwordErr = translateValidationError(validatePassword(password, true), t);
    const confirmErr = password !== confirmPassword ? t('validation:passwordMismatch') : null;
    if (passwordErr || confirmErr) {
      setErrors({ password: passwordErr, confirmPassword: confirmErr });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await resetApi({ token, password });
      setSuccess(true);
    } catch (err) {
      setSubmitError(err.response?.data?.error || t('forms:resetPassword.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <>
        <SeoHead title={t('forms:resetPassword.successTitle')} noindex />
        <AuthCard>
          <div className="text-center">
            <Alert variant="success" title={t('forms:resetPassword.successTitle')} className="mb-6">
              {t('forms:resetPassword.success')}
            </Alert>
            <Link to={loginRoute} className="text-primary font-medium hover:underline">
              {t('forms:resetPassword.goToLogin', { defaultValue: `Sign in to ${realmLabel}` })}
            </Link>
          </div>
        </AuthCard>
      </>
    );
  }

  return (
    <>
      <SeoHead title={seoTitle} noindex />
      <AuthCard
        title={t('forms:realmResetPassword.title', { realm: realmLabel, defaultValue: `Set new ${realmLabel} password` })}
        subtitle={t('forms:resetPassword.subtitle')}
      >

          {submitError && (
            <Alert variant="error" title={t('common:error')} className="mt-6">
              {submitError}
            </Alert>
          )}

          {token ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="realm-reset-password" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {t('forms:resetPassword.newPassword')}
                </label>
                <PasswordInput
                  id="realm-reset-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                />
                {errors.password ? <p className="mt-1 text-sm text-red-600">{errors.password}</p> : null}
              </div>
              <div>
                <label htmlFor="realm-reset-confirm" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {t('forms:resetPassword.confirmPassword')}
                </label>
                <PasswordInput
                  id="realm-reset-confirm"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                />
                {errors.confirmPassword ? <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p> : null}
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? t('forms:resetPassword.resetting') : t('forms:resetPassword.submit')}
              </Button>
            </form>
          ) : (
            <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
              <Link to={forgotRoute} className="text-primary font-medium hover:underline">
                {t('forms:resetPassword.requestNewLink')}
              </Link>
            </p>
          )}

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            <Link to={loginRoute} className="text-primary font-medium hover:underline">
              ← {t('common:backToLogin')}
            </Link>
          </p>
      </AuthCard>
    </>
  );
}
