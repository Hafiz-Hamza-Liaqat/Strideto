import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { formatProfessionalFee, providerKindLabel } from './gbsMarketplaceFormat';

export function GbsMarketplaceCard({ item }) {
  const to = `${ROUTES.BUSINESS_SERVICES}/${item.slug}`;
  return (
    <article className={`${ui.card} p-5 min-w-0 flex flex-col gap-2 transition hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-primary/10 dark:bg-primary/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary dark:text-mint">
          {providerKindLabel(item.subject?.providerKind)}
        </span>
        {item.verificationBadge?.label ? (
          <span className="text-xs font-medium text-green-700 dark:text-green-300">
            {item.verificationBadge.label}
          </span>
        ) : null}
      </div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white break-words-safe leading-snug">
        <Link to={to} className="hover:text-primary dark:hover:text-mint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
          {item.title}
        </Link>
      </h2>
      <p className="text-sm text-gray-700 dark:text-gray-200 break-words-safe">{item.subject?.displayName}</p>
      {(item.jurisdiction?.name || item.jurisdiction?.id) && (
        <p className={`text-xs ${ui.muted} break-words-safe`}>
          {item.jurisdiction?.name || item.jurisdiction?.id}
        </p>
      )}
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {formatProfessionalFee(item.professionalFeeSummary)}
      </p>
      {item.shortDescription ? (
        <p className={`text-sm ${ui.muted} break-words-safe line-clamp-3`}>{item.shortDescription}</p>
      ) : null}
      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
        <Link to={to} className={`${ui.link} inline-flex min-h-[44px] items-center text-sm font-semibold`}>
          View details →
        </Link>
      </div>
    </article>
  );
}
