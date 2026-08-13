import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';

export function TermsConsentField({
  id = 'accepted-terms',
  checked,
  onChange,
  error,
}) {
  return (
    <div className="min-h-[3.25rem]">
      <label htmlFor={id} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus-visible:ring-2 focus-visible:ring-primary"
          required
        />
        <span>
          I agree to the{' '}
          <Link to={ROUTES.TERMS} className="text-primary underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to={ROUTES.PRIVACY_POLICY} className="text-primary underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <p className="mt-1 min-h-[1.25rem] text-xs text-red-600 dark:text-red-400" role={error ? 'alert' : undefined}>
        {error || ''}
      </p>
    </div>
  );
}
