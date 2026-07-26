import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { authApi } from '../../services/authService';
import { Button } from '../../components/common/Button';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/ui/Alerts';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const pending = searchParams.get('pending') === '1';
  const smtpUnavailable = searchParams.get('smtp') === '0';
  const emailFromQuery = searchParams.get('email') || '';
  const { t } = useTranslation(['forms', 'common']);
  const [status, setStatus] = useState(token ? 'loading' : pending ? 'pending' : 'idle');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(emailFromQuery);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [resendOk, setResendOk] = useState(false);

  useEffect(() => {
    if (!token) {
      if (!pending) {
        setStatus('idle');
        setMessage(t('forms:verifyEmail.missingToken', { defaultValue: 'Verification link is invalid or missing.' }));
      }
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.verifyEmail({ token });
        if (cancelled) return;
        setStatus('success');
        setMessage(res.data?.message || t('forms:verifyEmail.success', { defaultValue: 'Email verified successfully.' }));
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err.response?.data?.error || t('forms:verifyEmail.failed', { defaultValue: 'Verification failed. The link may have expired.' }));
      }
    })();
    return () => { cancelled = true; };
  }, [token, pending, t]);

  const handleResend = async (e) => {
    e?.preventDefault?.();
    const target = (email || emailFromQuery).trim().toLowerCase();
    if (!target) {
      setResendOk(false);
      setResendMsg(t('forms:verifyEmail.emailRequired', { defaultValue: 'Enter your email to resend verification.' }));
      return;
    }
    setResending(true);
    setResendMsg('');
    try {
      const { data } = await authApi.resendVerification(target);
      setResendOk(true);
      if (data.emailMode === 'unavailable' || data.emailQueued === false) {
        setResendMsg(t('forms:verifyEmail.resendSmtpUnavailable', {
          defaultValue: 'If an unverified account exists, a link will be sent once email delivery is configured.',
        }));
      } else {
        setResendMsg(data.message || t('forms:verifyEmail.resendSent', {
          defaultValue: 'If an unverified account exists for this email, a new verification link has been sent.',
        }));
      }
    } catch (err) {
      setResendOk(false);
      setResendMsg(err.response?.data?.error || t('forms:verifyEmail.resendFailed', { defaultValue: 'Could not resend verification email.' }));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <SeoHead title={t('forms:verifyEmail.title', { defaultValue: 'Verify email' })} noindex />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12 text-center">
        {status === 'loading' && (
          <p className="text-gray-600 dark:text-gray-300">{t('common:loading', { defaultValue: 'Loading…' })}</p>
        )}
        {status === 'success' && (
          <>
            <Alert variant="success" title={t('forms:verifyEmail.successTitle', { defaultValue: 'Email verified' })} className="mb-6">
              {message}
            </Alert>
            <Link
              to={ROUTES.LOGIN}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-primary text-white hover:bg-primary-hover"
            >
              {t('common:signIn', { defaultValue: 'Sign in' })}
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <Alert variant="error" title={t('forms:verifyEmail.errorTitle', { defaultValue: 'Verification failed' })} className="mb-6">
              {message}
            </Alert>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('forms:verifyEmail.expiredHint', { defaultValue: 'Request a new verification link below. Links expire after 30 minutes.' })}
            </p>
          </>
        )}
        {(status === 'pending' || status === 'idle' || status === 'error') && (
          <div className="text-left space-y-4">
            {status === 'pending' && (
              <Alert variant="success" title={t('forms:verifyEmail.checkEmailTitle', { defaultValue: 'Check your email' })} className="mb-2">
                {smtpUnavailable
                  ? t('forms:verifyEmail.accountCreatedNoSmtp', {
                    defaultValue: 'Your account was created, but email delivery is not configured yet. You can try Resend once SMTP is available.',
                  })
                  : t('forms:verifyEmail.checkEmailBody', {
                    defaultValue: 'We sent a verification link to your email. It expires in 30 minutes and can be used once.',
                  })}
              </Alert>
            )}
            {status === 'idle' && (
              <Alert variant="info" title={t('forms:verifyEmail.title', { defaultValue: 'Verify email' })} className="mb-2">
                {t('forms:verifyEmail.idleHint', { defaultValue: 'Enter your email to resend a verification link.' })}
              </Alert>
            )}
            <form onSubmit={handleResend} className="space-y-3">
              <FormField label={t('common:email')} id="verify-resend-email">
                <input
                  id="verify-resend-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                  placeholder={t('common:emailPlaceholder')}
                />
              </FormField>
              {resendMsg && (
                <Alert variant={resendOk ? 'success' : 'error'} className="mb-2">
                  {resendMsg}
                </Alert>
              )}
              <Button type="submit" disabled={resending} className="w-full">
                {resending
                  ? t('forms:verifyEmail.resending', { defaultValue: 'Sending…' })
                  : t('forms:verifyEmail.resend', { defaultValue: 'Resend verification' })}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 pt-2">
              <Link to={ROUTES.LOGIN} className="text-primary dark:text-mint font-medium hover:underline">
                {t('common:signIn', { defaultValue: 'Sign in' })}
              </Link>
            </p>
          </div>
        )}
      </div>
    </>
  );
}
