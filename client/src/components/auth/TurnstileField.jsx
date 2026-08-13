import { useEffect, useId, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => {
      if (window.turnstile) resolve(window.turnstile);
      existing.addEventListener('load', () => resolve(window.turnstile || null), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile || null);
    script.onerror = () => reject(new Error('turnstile_script_failed'));
    document.head.appendChild(script);
  });
}

/**
 * Official Cloudflare Turnstile widget. Local/launch default is not_configured.
 * Never embeds a secret. Token is ephemeral and lives only in caller state.
 */
export function TurnstileField({ action = 'register', className = '', onTokenChange }) {
  const enabled = import.meta.env.VITE_TURNSTILE_ENABLED === '1';
  const siteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
  const hostId = useId().replace(/:/g, '');
  const widgetIdRef = useRef(null);
  const onTokenRef = useRef(onTokenChange);
  onTokenRef.current = onTokenChange;
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!enabled || !siteKey) {
      onTokenRef.current?.('');
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');
    loadTurnstileScript()
      .then((api) => {
        if (cancelled || !api) {
          setStatus('error');
          return;
        }
        const el = document.getElementById(`turnstile-${hostId}`);
        if (!el) return;
        widgetIdRef.current = api.render(el, {
          sitekey: siteKey,
          action,
          callback: (token) => {
            onTokenRef.current?.(token || '');
            setStatus('ready');
          },
          'error-callback': () => {
            onTokenRef.current?.('');
            setStatus('error');
          },
          'expired-callback': () => {
            onTokenRef.current?.('');
            setStatus('expired');
          },
        });
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          onTokenRef.current?.('');
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget already gone */
        }
      }
    };
  }, [action, enabled, hostId, siteKey]);

  if (!enabled || !siteKey) {
    return (
      <p className={`text-xs text-gray-500 dark:text-gray-400 ${className}`} role="status">
        Human verification is not configured in this environment. Rate limits still apply.
      </p>
    );
  }

  return (
    <div className={className} data-turnstile-action={action} role="group" aria-label="Human verification">
      <div id={`turnstile-${hostId}`} />
      {status === 'loading' && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Loading human verification…</p>
      )}
      {status === 'error' && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          Human verification could not load. Refresh and try again.
        </p>
      )}
    </div>
  );
}
