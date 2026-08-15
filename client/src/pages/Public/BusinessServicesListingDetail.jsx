import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, combineSchemas, webPageSchema } from '../../seo/schemas';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { gbsMarketplaceApi } from '../../services/gbsMarketplaceApi';
import { useBusinessServicesMarketplaceEnabled } from '../../hooks/useBusinessServicesMarketplaceEnabled';
import NotFound from '../Static/NotFound';
import {
  formatGovernmentFee,
  formatProfessionalFee,
  providerKindLabel,
  turnaroundLabel,
} from './gbsMarketplaceFormat';
import { GbsListingRequestCta } from './GbsListingRequestCta';
import { formatMoney } from '@shared/international/dateDisplay.js';

function offerJsonLd(item, canonical) {
  const summary = item.professionalFeeSummary;
  if (!summary || summary.kind === 'quote_required' || !Number.isFinite(summary.amountMinor) || !summary.currency) {
    return webPageSchema({
      name: item.title,
      description: item.shortDescription || item.description,
      url: canonical,
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: item.title,
    description: item.shortDescription || item.description,
    url: canonical,
    provider: {
      '@type': item.subject?.providerKind === 'agency' ? 'Organization' : 'Person',
      name: item.subject?.displayName,
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: summary.currency,
      price: (summary.amountMinor / 100).toFixed(2),
    },
  };
}

export default function BusinessServicesListingDetail() {
  const { listingSlug } = useParams();
  const { enabled, loading: flagLoading } = useBusinessServicesMarketplaceEnabled();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (enabled !== true) return undefined;
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    gbsMarketplaceApi
      .get(listingSlug)
      .then(({ data }) => {
        if (!cancelled) setItem(data.item);
      })
      .catch((err) => {
        if (!cancelled) {
          setItem(null);
          setMissing(err.response?.status === 404);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, listingSlug]);

  if (flagLoading || (enabled === true && loading)) {
    return (
      <>
        <SeoHead title="Business Services listing | Strideto" noindex />
        <div className="mx-auto max-w-4xl px-4 py-10 text-slate-500" role="status" aria-busy="true">
          Loading listing…
        </div>
      </>
    );
  }
  if (enabled !== true || missing || !item) return <NotFound />;

  const canonical = `${ROUTES.BUSINESS_SERVICES}/${item.slug}`;
  const turnaround = turnaroundLabel(item);

  return (
    <>
      <SeoHead
        title={`${item.title} | Strideto`}
        description={item.shortDescription || `Approved ${item.capability?.publicName || 'Business Services'} listing on Strideto.`}
        canonical={canonical}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: 'Home', url: ROUTES.HOME },
            { name: 'Business Services', url: ROUTES.BUSINESS_SERVICES },
            { name: item.title, url: canonical },
          ]),
          offerJsonLd(item, canonical)
        )}
      />
      <div className={`mx-auto max-w-4xl px-4 py-10 space-y-6 ${ui.page}`}>
        <Link to={ROUTES.BUSINESS_SERVICES} className={`${ui.link} inline-flex min-h-[44px] items-center`}>
          ← Business Services
        </Link>
        <header className={`${ui.card} p-6 min-w-0`}>
          <p className="text-xs font-medium uppercase tracking-wide text-primary dark:text-mint">
            {providerKindLabel(item.subject?.providerKind)}
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white break-words-safe">{item.title}</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-200 break-words-safe">{item.subject?.displayName}</p>
          {item.verificationBadge?.label ? (
            <p className="mt-3 text-sm font-medium text-green-800 dark:text-green-200 break-words-safe">
              {item.verificationBadge.label}
            </p>
          ) : null}
        </header>

        {item.description ? (
          <section className={`${ui.card} p-6`}>
            <h2 className="text-xl font-semibold">Service description</h2>
            <p className="mt-3 whitespace-pre-line text-gray-700 dark:text-gray-200 break-words-safe">{item.description}</p>
          </section>
        ) : null}

        <section className={`${ui.card} p-6 grid gap-4 sm:grid-cols-2`}>
          <div>
            <h2 className="font-semibold">Jurisdiction</h2>
            <p className={`mt-1 ${ui.muted} break-words-safe`}>{item.jurisdiction?.name} ({item.countryCode})</p>
          </div>
          <div>
            <h2 className="font-semibold">Entity types</h2>
            <p className={`mt-1 ${ui.muted} break-words-safe`}>{item.entityTypes?.length ? item.entityTypes.join(', ') : 'Not specified'}</p>
          </div>
          <div>
            <h2 className="font-semibold">Delivery</h2>
            <p className={`mt-1 ${ui.muted}`}>{String(item.deliveryMode || '').replaceAll('_', ' ') || 'Not specified'}</p>
          </div>
          <div>
            <h2 className="font-semibold">Languages</h2>
            <p className={`mt-1 ${ui.muted} break-words-safe`}>{item.languages?.length ? item.languages.join(', ') : 'Not provided'}</p>
          </div>
        </section>

        <section className={`${ui.card} p-6`}>
          <h2 className="text-xl font-semibold">Pricing</h2>
          <div className="mt-4 space-y-3">
            <div>
              <h3 className="text-sm font-medium">Professional service fee</h3>
              <p className="mt-1 text-gray-900 dark:text-white">{formatProfessionalFee(item.professionalFeeSummary)}</p>
              {item.professionalFees?.length && item.pricingMode !== 'quote_required' ? (
                <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                  {item.professionalFees.map((line) => (
                    <li key={`${line.label}-${line.amountMinor}`} className="break-words-safe">
                      {line.label}: {formatMoney({ amountMinor: line.amountMinor, currency: line.currency })}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              <h3 className="text-sm font-medium">Official/government fee</h3>
              {item.governmentFees?.length ? (
                <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                  {item.governmentFees.map((fee) => (
                    <li key={fee.label} className="break-words-safe">
                      {fee.label}: {formatGovernmentFee(fee)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={`mt-1 ${ui.muted}`}>Official fee not listed here</p>
              )}
            </div>
            <p className={`text-xs ${ui.muted}`}>
              Professional service fees belong to the provider. Official/government fees belong to the relevant authority, not Strideto and not the provider’s professional fee. Amounts are informational and may change.
            </p>
          </div>
        </section>

        {item.includedItems?.length || item.excludedItems?.length ? (
          <section className={`${ui.card} p-6 grid gap-4 sm:grid-cols-2`}>
            <div>
              <h2 className="font-semibold">Included</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 dark:text-gray-200">
                {(item.includedItems || []).map((row) => (
                  <li key={row} className="break-words-safe">{row}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-semibold">Excluded</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 dark:text-gray-200">
                {(item.excludedItems || []).map((row) => (
                  <li key={row} className="break-words-safe">{row}</li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className={`${ui.card} p-6 space-y-3`}>
          {turnaround ? (
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Estimated turnaround: {turnaround}
              {item.turnaroundIsProviderEstimate ? <span className={`ml-2 ${ui.muted}`}>Provider estimate</span> : null}
            </p>
          ) : null}
          {item.recurringService ? <p className="text-sm text-gray-700 dark:text-gray-200">This is a recurring service.</p> : null}
          {item.consultationAvailable ? <p className="text-sm text-gray-700 dark:text-gray-200">Consultation is listed as available. Requesting it through Strideto is not offered on this page yet.</p> : null}
          <GbsListingRequestCta listingSlug={item.slug} />
        </section>
      </div>
    </>
  );
}
