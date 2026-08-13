/**
 * Frontend Turnstile boundary. Local/launch default is not_configured.
 * Never embeds a secret. Authenticated navigation must not render this.
 */
export function TurnstileField({ action = 'register', className = '' }) {
  const enabled = import.meta.env.VITE_TURNSTILE_ENABLED === '1';
  const siteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

  if (!enabled || !siteKey) {
    return (
      <p className={`text-xs text-gray-500 dark:text-gray-400 ${className}`} role="status">
        Human verification is not configured in this environment. Rate limits still apply.
      </p>
    );
  }

  return (
    <div
      className={className}
      data-turnstile-action={action}
      data-sitekey={siteKey}
      role="group"
      aria-label="Human verification"
    />
  );
}
