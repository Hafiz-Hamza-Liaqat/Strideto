import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants';
import { AuthCard } from '../../layouts/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alerts';
import { Button } from '../../components/common/Button';
import { SeoHead } from '../../components/seo';
import { takeOAuthReturnPath } from '../../auth/googleSignIn.js';
import { resolveLoginReturnPath, LOGIN_REALMS } from '../../utils/loginReturn.js';
import {
  parseOAuthCallbackParams,
  oauthErrorMessageKey,
  shouldOfferRegister,
  OAUTH_CLIENT_ERROR_CODES,
} from '@shared/auth/googleSignIn.js';

/**
 * Landing page for the backend's Google OAuth redirect.
 *
 * The browser arrives here with at most `?status=success` or
 * `?error=<allowlisted code>`. No token, code, email, or subject is present or
 * read — by the time this renders, the backend has already verified Google,
 * resolved the account, and written the ordinary HttpOnly refresh cookie. All
 * that remains is to walk the existing refresh → `/auth/me` → bind path, which
 * `completeOAuthLogin` does by reusing the very same machinery password login
 * and the realm bootstrap use.
 */
export default function OAuthCallback() {
  const { t } = useTranslation(['forms', 'common']);
  const navigate = useNavigate();
  const location = useLocation();
  const { completeOAuthLogin } = useAuth();
  const [errorCode, setErrorCode] = useState(null);
  /** Guards against a second run under React StrictMode's double-invoke. */
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const { outcome, errorCode: parsedError } = parseOAuthCallbackParams(location.search);

    if (outcome !== 'success') {
      // Strip the OAuth parameters immediately so the failed attempt does not
      // sit in history; the message is already captured in component state.
      navigate(ROUTES.OAUTH_CALLBACK, { replace: true });
      setErrorCode(parsedError);
      return;
    }

    let cancelled = false;
    completeOAuthLogin()
      .then((result) => {
        if (cancelled) return;
        if (!result?.ok) {
          navigate(ROUTES.OAUTH_CALLBACK, { replace: true });
          setErrorCode(OAUTH_CLIENT_ERROR_CODES.SESSION_FAILED);
          return;
        }
        // Same destination rules as a normal successful user login, resolved
        // through the existing return-path policy. `replace` leaves no
        // `?status=success` entry behind in history.
        const stored = takeOAuthReturnPath();
        const destination = resolveLoginReturnPath(
          stored ? { pathname: stored } : undefined,
          ROUTES.HOME,
          LOGIN_REALMS.STUDENT
        );
        navigate(destination, { replace: true });
      })
      .catch(() => {
        if (cancelled) return;
        navigate(ROUTES.OAUTH_CALLBACK, { replace: true });
        setErrorCode(OAUTH_CLIENT_ERROR_CODES.SESSION_FAILED);
      });

    return () => {
      cancelled = true;
    };
    // Runs exactly once for this navigation; `startedRef` makes that explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!errorCode) {
    return (
      <>
        <SeoHead title={t('forms:oauthCallback.title', { defaultValue: 'Signing in' })} noindex />
        <AuthCard title={t('forms:oauthCallback.title', { defaultValue: 'Signing in' })}>
          <p
            className="text-sm text-gray-600 dark:text-gray-400 text-center"
            role="status"
            aria-live="polite"
          >
            {t('forms:oauthCallback.completing', { defaultValue: 'Completing Google sign-in…' })}
          </p>
        </AuthCard>
      </>
    );
  }

  const messageKey = oauthErrorMessageKey(errorCode);
  const offerRegister = shouldOfferRegister(errorCode);

  return (
    <>
      <SeoHead title={t('forms:oauthCallback.failedTitle', { defaultValue: 'Sign-in failed' })} noindex />
      <AuthCard title={t('forms:oauthCallback.failedTitle', { defaultValue: 'Sign-in failed' })}>
        <Alert variant="error">
          <p>
            {t(`forms:${messageKey}`, {
              defaultValue: t('forms:oauthCallback.errors.oauth_failed', {
                defaultValue: 'Google sign-in could not be completed. Please try again.',
              }),
            })}
          </p>
        </Alert>

        <div className="mt-6 space-y-3">
          <Button
            className="w-full"
            onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
          >
            {t('forms:oauthCallback.backToSignIn', { defaultValue: 'Back to Sign In' })}
          </Button>
          {offerRegister && (
            <Link
              to={ROUTES.REGISTER}
              className="block text-center text-sm text-primary dark:text-mint font-medium hover:underline link-hover"
            >
              {t('common:register')}
            </Link>
          )}
        </div>
      </AuthCard>
    </>
  );
}
