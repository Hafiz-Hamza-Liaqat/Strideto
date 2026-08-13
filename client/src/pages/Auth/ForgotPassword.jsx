import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { validateEmail } from '../../utils/validation';
import { translateValidationError } from '../../utils/validationI18n';
import { authApi } from '../../services/authService';
import { Button } from '../../components/common/Button';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/ui/Alerts';
import { AuthCard } from '../../layouts/AuthLayout.jsx';

export default function ForgotPassword() {
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
      const { data } = await authApi.forgotPassword(email.trim().toLowerCase());
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
      <SeoHead
        title={t('forms:forgotPassword.title')}
        description={t('forms:forgotPassword.seoDescription')}
        noindex
      />
      <AuthCard title={t('forms:forgotPassword.title')} subtitle={t('forms:forgotPassword.subtitleExtended')}>

        {success && (
          <Alert variant="success" title={t('forms:forgotPassword.checkEmail')} className="mb-6">
            {successMessage}
          </Alert>
        )}

        {submitError && (
          <Alert variant="error" title={t('common:error')} className="mb-6">
            {submitError}
          </Alert>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label={t('common:email')} id="forgot-email" error={errors.email}>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow duration-200"
                placeholder={t('common:emailPlaceholder')}
              />
            </FormField>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t('forms:forgotPassword.sending') : t('forms:forgotPassword.sendLink')}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <Link to={ROUTES.LOGIN} className="text-primary dark:text-mint font-medium hover:underline link-hover">
            {t('forms:forgotPassword.backToLogin')}
          </Link>
        </p>
      </AuthCard>
    </>
  );
}
