import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { captureVerifyEmailSecrets, stripSecretQueryParams } from '../auth/verifyEmailLifecycle.js';

/**
 * Read a one-time secret from the query string, keep it in memory, then
 * replace the URL so the secret is not left in history.
 *
 * Capture uses the first available snapshot (router search, then
 * window.location.search) so a Mailpit/email first-navigation never loses
 * the token if React Router hydrates one tick later. The captured secret is
 * kept in React state only — never written to web storage.
 */
export function useSecretQueryToken(param = 'token') {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => {
    const fromRouter = String(searchParams.get(param) || '').trim();
    if (fromRouter) return fromRouter;
    if (typeof window !== 'undefined') {
      return String(captureVerifyEmailSecrets(window.location.search)[param] || '').trim()
        || String(new URLSearchParams(window.location.search).get(param) || '').trim();
    }
    return '';
  });

  useEffect(() => {
    if (!searchParams.get(param) && !searchParams.get('email')) return;
    const next = stripSecretQueryParams(searchParams, [param, 'email']);
    setSearchParams(next, { replace: true });
  }, [param, searchParams, setSearchParams]);

  return token;
}
