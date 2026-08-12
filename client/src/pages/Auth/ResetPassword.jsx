import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { validatePassword } from '../../utils/validation';
import { translateValidationError } from '../../utils/validationI18n';
import { authApi } from '../../services/authService';
import { Button } from '../../components/common/Button';
import { FormField } from '../../components/common/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput.jsx';
import { Alert } from '../../components/ui/Alerts';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
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
    const confirmErr = password !== confirmPassword
      ? t('validation:passwordMismatch')
      : null;
    if (passwordErr || confirmErr) {
      setErrors({ password: passwordErr, confirmPassword: confirmErr });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      setSuccess(true);
      setTimeout(() => navigate(ROUTES.LOGIN, { replace: true }), 2000);
    } catch (err) {
      const msg = err.response?.data?.error || t('forms:resetPassword.failed');
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <>
        <SeoHead title={t('forms:resetPassword.successTitle')} noindex />
        <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12 text-center">
          <Alert variant="success" title={t('forms:resetPassword.successTitle')} className="mb-6">
            {t('forms:resetPassword.success')}
          </Alert>
          <Link to={ROUTES.LOGIN} className="text-primary dark:text-mint font-medium hover:underline">
            {t('forms:resetPassword.goToLogin')}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title={t('forms:resetPassword.setNewPasswordTitle')} description={t('forms:resetPassword.seoDescription')} noindex />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('forms:resetPassword.setNewPasswordTitle')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('forms:resetPassword.subtitle')}
        </p>

        {submitError && (
          <Alert variant="error" title={t('common:error')} className="mb-6">
            {submitError}
          </Alert>
        )}

        {token ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label={t('forms:resetPassword.newPassword')} id="reset-password" error={errors.password}>
              <PasswordInput
                id="reset-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={Boolean(errors.password)}
                placeholder={t('common:passwordPlaceholder')}
              />
            </FormField>
            <FormField label={t('forms:resetPassword.confirmPassword')} id="reset-confirm" error={errors.confirmPassword}>
              <PasswordInput
                id="reset-confirm"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={Boolean(errors.confirmPassword)}
                placeholder={t('common:passwordPlaceholder')}
              />
            </FormField>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t('forms:resetPassword.resetting') : t('forms:resetPassword.submit')}
            </Button>
          </form>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">
            <Link to={ROUTES.FORGOT_PASSWORD} className="text-primary dark:text-mint font-medium hover:underline">
              {t('forms:resetPassword.requestNewLink')}
            </Link>
          </p>
        )}

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <Link to={ROUTES.LOGIN} className="text-primary dark:text-mint font-medium hover:underline link-hover">
            ← {t('common:backToLogin')}
          </Link>
        </p>
      </div>
    </>
  );
}
