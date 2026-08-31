import { API_BASE_URL } from '../constants';
import {
  buildGoogleStartUrl,
  isGoogleSignInEnabled,
  sanitizeOAuthReturnPath,
} from '@shared/auth/googleSignIn.js';

/**
 * Runtime glue for Google sign-in. Everything decidable is decided by the pure
 * policy in `@shared/auth/googleSignIn.js`; this module only reads Vite env,
 * touches `sessionStorage`, and performs the top-level navigation.
 *
 * The client holds no OAuth material of any kind. `VITE_OAUTH_GOOGLE_ENABLED`
 * is a boolean-ish flag, not a credential — the client id and secret stay on
 * the server, and no Google endpoint is ever contacted from the browser.
 */

/** Same flag `ConnectedAccountsPanel` already reads. No second flag. */
export function googleSignInEnabled() {
  return isGoogleSignInEnabled(import.meta.env.VITE_OAUTH_GOOGLE_ENABLED);
}

/**
 * Where to send the user after a successful Google sign-in.
 *
 * The OAuth round trip leaves the SPA entirely, so React Router's in-memory
 * `location.state.from` cannot survive it. Only a validated same-origin path
 * is stored, and only for the duration of the round trip. No token, profile,
 * email, subject, state, nonce, or PKCE verifier is ever written to browser
 * storage — the transaction values live exclusively in the backend's HttpOnly
 * cookie.
 */
const RETURN_PATH_KEY = 'strideto.oauth.return';

export function rememberOAuthReturnPath(path) {
  const safe = sanitizeOAuthReturnPath(path);
  try {
    if (safe) sessionStorage.setItem(RETURN_PATH_KEY, safe);
    else sessionStorage.removeItem(RETURN_PATH_KEY);
  } catch {
    // Private mode or blocked storage: the default destination still works.
  }
}

/** Reads and clears in one step, so a stale path cannot be reused. */
export function takeOAuthReturnPath() {
  let raw = null;
  try {
    raw = sessionStorage.getItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(RETURN_PATH_KEY);
  } catch {
    return null;
  }
  return sanitizeOAuthReturnPath(raw);
}

/**
 * Begins Google sign-in. This is a full-page navigation to STRIDETO's own
 * backend, not an XHR: the endpoint answers with a 302 to Google and sets an
 * HttpOnly transaction cookie, neither of which an axios call could follow or
 * receive correctly. Nothing is sent from the browser but the navigation.
 */
export function startGoogleSignIn({ returnPath } = {}) {
  if (!googleSignInEnabled()) return false;
  rememberOAuthReturnPath(returnPath);
  window.location.assign(buildGoogleStartUrl(API_BASE_URL));
  return true;
}
