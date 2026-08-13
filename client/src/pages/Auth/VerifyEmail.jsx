import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { authApi } from '../../services/authService';
import { Button } from '../../components/common/Button';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/ui/Alerts';
import { useSecretQueryToken } from '../../hooks/useSecretQueryToken.js';
import { realmLoginPath, realmDashboardPath } from '../../utils/authUrls.js';
import { AuthCard } from '../../layouts/AuthLayout.jsx';

export default function VerifyEmail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = useSecretQueryToken('token');
  const realm = searchParams.get('realm') || 'user';
  const pending = searchParams.get('pending') === '1' || searchParams.get('verified') === '1';
  const deliveryUnavailable = searchParams.get('delivery') === 'unavailable';
  const { t } = useTranslation(['forms', 'common']);
  const [status, setStatus] = useState(token ? 'loading' : pending ? 'pending' : 'idle');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [resendOk, setResendOk] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const consumedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      if (searchParams.get('verified') === '1') {
        setStatus('success');
        setMessage(t('forms:verifyEmail.success', { defaultValue: 'Email verified successfully.' }));
        return undefined;
      }
      if (!pending) {
        setStatus('idle');
        setMessage(t('forms:verifyEmail.missingToken', { defaultValue: 'Verification link is invalid or missing.' }));
      }
      return undefined;
    }
    if (consumedRef.current) return undefined;
    consumedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.verifyEmail({ token, realm });
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
  }, [token, realm, pending, searchParams, t]);

  useEffect(() => {
    if (status !== 'success' || !token) return;
    const next = new URLSearchParams();
    next.set('verified', '1');
    if (realm && realm !== 'user') next.set('realm', realm);
    setSearchParams(next, { replace: true });
  }, [status, token, realm, setSearchParams]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleResend = async (e) => {
    e?.preventDefault?.();
    const target = email.trim().toLowerCase();
    if (!target) {
      setResendOk(false);
      setResendMsg(t('forms:verifyEmail.emailRequired', { defaultValue: 'Enter your email to resend verification.' }));
      return;
    }
    setResending(true);
    setResendMsg('');
    try {
      const { data } = await authApi.resendVerification(target, realm);
      setResendOk(true);
      setCooldown(60);
      if (data.emailMode === 'unavailable') {
        setResendMsg(t('forms:verifyEmail.resendUnavailable', {
          defaultValue: 'If an unverified account exists, a link will be sent once email delivery is available.',
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

  const nextLogin = realmLoginPath(realm);
  const nextWorkspace = realmDashboardPath(realm);

  return (
    <>
      <SeoHead title={t('forms:verifyEmail.title', { defaultValue: 'Verify email' })} noindex />
      <AuthCard>
        <div className="text-center">
          {status === 'loading' && (
            <p className="text-gray-600 dark:text-gray-300">{t('common:loading', { defaultValue: 'Loading…' })}</p>
          )}
          {status === 'success' && (
            <>
              <Alert variant="success" title={t('forms:verifyEmail.successTitle', { defaultValue: 'Email verified' })} className="mb-6 text-left">
                {message}
                <p className="mt-2 text-sm">
                  This confirms email ownership only. It does not verify an organization, approve a claim, or grant publishing or payment authority.
                </p>
              </Alert>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to={nextLogin}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-primary text-white hover:bg-primary-hover"
                >
                  {t('common:signIn', { defaultValue: 'Sign in' })}
                </Link>
                {realm !== 'user' ? (
                  <Link to={nextWorkspace} className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-primary hover:underline">
                    Continue to workspace
                  </Link>
                ) : null}
              </div>
            </>
          )}
          {status === 'error' && (
            <Alert variant="error" title={t('forms:verifyEmail.errorTitle', { defaultValue: 'Verification failed' })} className="mb-6 text-left">
              {message}
            </Alert>
          )}
        </div>
        {(status === 'pending' || status === 'idle' || status === 'error') && (
          <div className="text-left space-y-4">
            {status === 'pending' && (
              <Alert variant={deliveryUnavailable ? 'info' : 'success'} title={t('forms:verifyEmail.checkEmailTitle', { defaultValue: 'Check your email' })} className="mb-2">
                {deliveryUnavailable
                  ? t('forms:verifyEmail.accountCreatedNoDelivery', {
                    defaultValue: 'Your account request was accepted. Email verification is currently unavailable. Try again later or contact support.',
                  })
                  : t('forms:verifyEmail.checkEmailBody', {
                    defaultValue: 'Use the secure verification link to confirm email ownership. Links expire after 30 minutes and can be used once.',
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
                  inputMode="email"
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
              <Button type="submit" disabled={resending || cooldown > 0} className="w-full">
                {resending
                  ? t('forms:verifyEmail.resending', { defaultValue: 'Sending…' })
                  : cooldown > 0
                    ? `Resend available in ${cooldown}s`
                    : t('forms:verifyEmail.resend', { defaultValue: 'Resend verification' })}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 pt-2">
              <Link to={nextLogin} className="text-primary dark:text-mint font-medium hover:underline">
                {t('common:signIn', { defaultValue: 'Sign in' })}
              </Link>
            </p>
          </div>
        )}
      </AuthCard>
    </>
  );
}
