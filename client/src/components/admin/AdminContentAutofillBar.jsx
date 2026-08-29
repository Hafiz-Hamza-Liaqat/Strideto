import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Deterministic metadata autofill control for blog / career-guidance admin forms.
 */
export function AdminContentAutofillBar({ onAutofill, disabled = false, className = '' }) {
  const { t } = useTranslation(['admin']);
  const [status, setStatus] = useState('');

  const handleClick = () => {
    const result = onAutofill?.();
    if (result?.applied > 0) {
      setStatus(t('admin:contentAutofillApplied', { count: result.applied }));
    } else {
      setStatus(t('admin:contentAutofillNothing'));
    }
  };

  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t('admin:contentAutofillHint')}
        </p>
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          aria-label={t('admin:contentAutofillRecommended')}
          className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 min-h-[40px] shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        >
          {t('admin:contentAutofillRecommended')}
        </button>
      </div>
      {status ? (
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
    </div>
  );
}
