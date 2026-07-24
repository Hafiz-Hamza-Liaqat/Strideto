import { Link } from 'react-router-dom';
import { useProfileCompletion } from '../../hooks/useProfileCompletion';

function itemHref(item) {
  if (item.tab) return `${item.href}?tab=${encodeURIComponent(item.tab)}`;
  return item.href;
}

/**
 * LinkedIn-style profile completion card (Phase B.4).
 */
export function ProfileCompletionCard({ className = '', compact = false }) {
  const { loading, percent, items } = useProfileCompletion();

  if (loading) {
    return (
      <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 animate-pulse ${className}`}>
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
    );
  }

  return (
    <section
      className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6 ${className}`}
      aria-labelledby="profile-completion-heading"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 id="profile-completion-heading" className="text-lg font-semibold text-gray-900 dark:text-white font-heading">
          Complete Your Profile
        </h2>
        <span className="text-sm font-semibold text-primary dark:text-mint tabular-nums" aria-live="polite">
          {percent}%
        </span>
      </div>

      <div
        className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-3"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Profile ${percent}% complete`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {!compact ? (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
          Complete your profile to receive better job, scholarship, internship and admission recommendations.
        </p>
      ) : null}

      <ul className="space-y-2" role="list">
        {items.map((item) => (
          <li key={item.key}>
            {item.done ? (
              <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-success" aria-hidden="true">✓</span>
                {item.label}
              </span>
            ) : (
              <Link
                to={itemHref(item)}
                className="flex items-center gap-2 text-sm text-primary dark:text-mint hover:underline min-h-[44px] sm:min-h-0"
              >
                <span aria-hidden="true">○</span>
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ProfileCompletionCard;
