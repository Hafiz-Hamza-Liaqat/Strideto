import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { formatProfessionalFee, providerKindLabel } from './gbsMarketplaceFormat';

export function GbsMarketplaceCard({ item }) {
  const to = `${ROUTES.BUSINESS_SERVICES}/${item.slug}`;
  return (
    <article className={`${ui.card} p-5 min-w-0`}>
      <p className="text-xs font-medium uppercase tracking-wide text-primary dark:text-mint">
        {providerKindLabel(item.subject?.providerKind)}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white break-words-safe">
        <Link to={to} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
          {item.title}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-200 break-words-safe">{item.subject?.displayName}</p>
      {item.verificationBadge?.label ? (
        <p className="mt-2 text-xs font-medium text-green-800 dark:text-green-200 break-words-safe">
          {item.verificationBadge.label}
        </p>
      ) : null}
      <p className={`mt-2 ${ui.muted} break-words-safe`}>
        {item.jurisdiction?.name || item.jurisdiction?.id}
      </p>
      <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
        {formatProfessionalFee(item.professionalFeeSummary)}
      </p>
      {item.shortDescription ? (
        <p className={`mt-2 ${ui.muted} break-words-safe`}>{item.shortDescription}</p>
      ) : null}
      <Link to={to} className={`${ui.link} mt-4 inline-flex min-h-[44px] items-center`}>
        View Details
      </Link>
    </article>
  );
}
