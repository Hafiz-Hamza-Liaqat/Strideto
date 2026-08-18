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
import {
  VERIFY_EMAIL_STATES,
  VERIFY_EMAIL_MESSAGES,
  captureVerifyEmailSecrets,
  initialVerifyEmailStatus,
  isWellFormedVerifyToken,
  mapResendHttpResult,
  mapVerifyEmailHttpError,
  nextConsumeGate,
  shouldStartVerification,
  verifiedSearchParams,
} from '../../auth/verifyEmailLifecycle.js';

function realmOnlyParams(realm) {
  const next = new URLSearchParams();
  if (realm && realm !== 'user') next.set('realm', realm);
  return next;
}

export default function VerifyEmail() {
  const [, setSearchParams] = useSearchParams();
  const token = useSecretQueryToken('token');
  const [captured] = useState(() => {
    const snap = captureVerifyEmailSecrets(
      typeof window !== 'undefined' ? window.location.search : ''
    );
    return {
      ...snap,
      token: token || snap.token,
    };
  });
  const realm = captured.realm;
  const pending = captured.pending;
  const deliveryUnavailable = captured.deliveryUnavailable;
  const capturedToken = captured.token;
  const { t } = useTranslation(['forms', 'common']);
  const [status, setStatus] = useState(() => initialVerifyEmailStatus({
    token: capturedToken,
    pending,
    verified: captured.verified,
  }));
  const [message, setMessage] = useState(
    captured.verified ? VERIFY_EMAIL_MESSAGES.SUCCESS : ''
  );
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [resendOk, setResendOk] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const consumedRef = useRef(false);

  useEffect(() => {
    if (captured.verified && !capturedToken) {
      setStatus(VERIFY_EMAIL_STATES.VERIFIED);
      setMessage(t('forms:verifyEmail.success', { defaultValue: VERIFY_EMAIL_MESSAGES.SUCCESS }));
      return undefined;
    }
    if (!capturedToken) {
      setStatus(pending ? VERIFY_EMAIL_STATES.PENDING_EMAIL_INPUT : VERIFY_EMAIL_STATES.IDLE);
      return undefined;
    }
    if (!isWellFormedVerifyToken(capturedToken)) {
      setStatus(VERIFY_EMAIL_STATES.INVALID_OR_EXPIRED);
      setMessage(VERIFY_EMAIL_MESSAGES.INVALID_OR_EXPIRED);
      setSearchParams(realmOnlyParams(realm), { replace: true });
      return undefined;
    }
    if (!shouldStartVerification({ token: capturedToken, alreadyStarted: consumedRef.current })) {
      return undefined;
    }
    const gate = nextConsumeGate(consumedRef.current);
    consumedRef.current = gate.alreadyStarted;
    if (!gate.start) return undefined;

    setStatus(VERIFY_EMAIL_STATES.VERIFYING);
    const token = capturedToken;
    let settled = false;
    authApi.verifyEmail({ token, realm })
      .then((res) => {
        settled = true;
        setStatus(VERIFY_EMAIL_STATES.VERIFIED);
        setMessage(res.data?.message || t('forms:verifyEmail.success', {
          defaultValue: VERIFY_EMAIL_MESSAGES.SUCCESS,
        }));
        const next = verifiedSearchParams(realm);
        setSearchParams(next, { replace: true });
      })
      .catch((err) => {
        settled = true;
        const mapped = mapVerifyEmailHttpError(err);
        setStatus(mapped.state);
        setMessage(mapped.message);
        setSearchParams(realmOnlyParams(realm), { replace: true });
      })
      .finally(() => {
        if (!settled) {
          setStatus(VERIFY_EMAIL_STATES.ERROR_SAFE);
          setMessage(VERIFY_EMAIL_MESSAGES.ERROR_SAFE);
          setSearchParams(realmOnlyParams(realm), { replace: true });
        }
      });
    return undefined;
    // Token capture is frozen on first navigation. Do not restart when the
    // address bar is replaced, i18n re-renders, or StrictMode remounts the
    // effect — consumedRef is the single-consume gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedToken, realm]);

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
      setResendMsg(t('forms:verifyEmail.emailRequired', {
        defaultValue: VERIFY_EMAIL_MESSAGES.EMAIL_REQUIRED,
      }));
      return;
    }
    setResending(true);
    setResendMsg('');
    try {
      const { data } = await authApi.resendVerification(target, realm);
      setResendOk(true);
      setCooldown(60);
      setStatus(VERIFY_EMAIL_STATES.RESEND_ACCEPTED);
      if (data.emailMode === 'unavailable') {
        setResendMsg(t('forms:verifyEmail.resendUnavailable', {
          defaultValue: 'If an unverified account exists, a link will be sent once email delivery is available.',
        }));
      } else {
        setResendMsg(data.message || t('forms:verifyEmail.resendSent', {
          defaultValue: VERIFY_EMAIL_MESSAGES.RESEND_ACCEPTED,
        }));
      }
    } catch (err) {
      const mapped = mapResendHttpResult(err);
      setResendOk(false);
      setStatus(mapped.state);
      setResendMsg(mapped.message);
    } finally {
      setResending(false);
    }
  };

  const nextLogin = realmLoginPath(realm);
  const nextWorkspace = realmDashboardPath(realm);
  const showResend = [
    VERIFY_EMAIL_STATES.IDLE,
    VERIFY_EMAIL_STATES.PENDING_EMAIL_INPUT,
    VERIFY_EMAIL_STATES.INVALID_OR_EXPIRED,
    VERIFY_EMAIL_STATES.ALREADY_USED,
    VERIFY_EMAIL_STATES.RATE_LIMITED,
    VERIFY_EMAIL_STATES.RESEND_ACCEPTED,
    VERIFY_EMAIL_STATES.ERROR_SAFE,
  ].includes(status);
  const errorStates = [
    VERIFY_EMAIL_STATES.INVALID_OR_EXPIRED,
    VERIFY_EMAIL_STATES.ALREADY_USED,
    VERIFY_EMAIL_STATES.RATE_LIMITED,
    VERIFY_EMAIL_STATES.ERROR_SAFE,
  ];

  return (
    <>
      <SeoHead title={t('forms:verifyEmail.title', { defaultValue: 'Verify email' })} noindex />
      <AuthCard title={t('forms:verifyEmail.title', { defaultValue: 'Verify email' })}>
        <div className="text-center">
          {status === VERIFY_EMAIL_STATES.VERIFYING && (
            <p className="text-gray-600 dark:text-gray-300" role="status">
              {t('forms:verifyEmail.verifying', { defaultValue: VERIFY_EMAIL_MESSAGES.VERIFYING })}
            </p>
          )}
          {status === VERIFY_EMAIL_STATES.VERIFIED && (
            <>
              <Alert variant="success" title={t('forms:verifyEmail.successTitle', { defaultValue: 'Email verified' })} className="mb-6 text-left">
                {message || VERIFY_EMAIL_MESSAGES.SUCCESS}
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
          {errorStates.includes(status) && (
            <Alert variant="error" title={t('forms:verifyEmail.errorTitle', { defaultValue: 'Verification failed' })} className="mb-6 text-left">
              {message}
            </Alert>
          )}
        </div>
        {showResend && (
          <div className="text-left space-y-4">
            {status === VERIFY_EMAIL_STATES.PENDING_EMAIL_INPUT && (
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
            {status === VERIFY_EMAIL_STATES.IDLE && (
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
