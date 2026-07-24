import { Icon } from '../brand/Icon';

/**
 * Standardized Strideto buttons.
 * Variants: primary | secondary | cta | danger | success | outline
 */
export function Button({
  children,
  variant = 'primary',
  type = 'button',
  className = '',
  disabled,
  loading = false,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-secondary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100';

  const variants = {
    primary:
      'bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary shadow-sm hover:shadow-btn-primary',
    secondary:
      'bg-white dark:bg-dark-elevated border-2 border-primary text-primary hover:bg-primary-light/40 dark:hover:bg-primary/10 focus-visible:ring-primary',
    outline:
      'bg-transparent border-2 border-primary text-primary hover:bg-primary-light/40 dark:hover:bg-primary/10 focus-visible:ring-primary',
    cta:
      'bg-accent text-white hover:bg-accent-hover focus-visible:ring-accent shadow-sm',
    danger:
      'bg-danger text-white hover:bg-danger-hover focus-visible:ring-danger',
    success:
      'bg-success text-white hover:bg-success-hover focus-visible:ring-success',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Icon name="spinner" className="w-4 h-4" /> : null}
      {children}
    </button>
  );
}

export default Button;
