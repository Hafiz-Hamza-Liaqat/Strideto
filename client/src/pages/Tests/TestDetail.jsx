import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { testsApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { fallbackScopeLabel, ACCEPTANCE_SCOPES } from '@shared/education/acceptanceExplorer.js';
import { ProvenanceStrip } from '../../components/public/ProvenanceStrip';

const FRESHNESS_LABELS = {
  fresh: { label: 'Current', className: 'text-green-600 dark:text-green-400' },
  review_due: { label: 'Review due', className: 'text-yellow-600 dark:text-yellow-400' },
  stale: { label: 'Stale — verify with institution', className: 'text-red-600 dark:text-red-400' },
  broken: { label: 'Source unavailable', className: 'text-red-600 dark:text-red-400' },
  unknown: { label: 'Not yet verified', className: 'text-gray-500 dark:text-gray-400' },
};

const ACCEPTANCE_BADGES = {
  accepted: { label: 'Accepted', className: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  conditional: { label: 'Conditional', className: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' },
  not_accepted: { label: 'Not accepted', className: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
  case_by_case: { label: 'Case by case', className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  unknown: { label: 'Not confirmed', className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
};

const TRUST_BADGES = {
  official: { label: 'Official', className: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  trusted: { label: 'Trusted', className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  community: { label: 'Community', className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
};

const ALERT_IMPORTANCE_STYLES = {
  high: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20',
  medium: 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20',
  low: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800',
};

function SourceBadge({ type }) {
  if (!type) return null;
  const isOfficial = type === 'official';
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${isOfficial ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
      {isOfficial ? 'Official fact' : 'Source-backed'}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function TestDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acceptance, setAcceptance] = useState(null);
  const [acceptanceLoading, setAcceptanceLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    testsApi
      .get(slug)
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Test not found.'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    setAcceptanceLoading(true);
    testsApi
      .getAcceptance(slug, { limit: 10 })
      .then(({ data: d }) => setAcceptance(d))
      .catch(() => setAcceptance(null))
      .finally(() => setAcceptanceLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-red-600 dark:text-red-400">{error || 'Test not found.'}</p>
        <Link to={ROUTES.TEST_HUB} className="mt-2 inline-block text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to Test Hub
        </Link>
      </div>
    );
  }

  const { test, prepGuide, resources, alerts } = data;
  const provider = test.providerId;
  const officialResources = (resources || []).filter((r) => r.trustLevel === 'official');
  const trustedResources = (resources || []).filter((r) => r.trustLevel !== 'official');

  return (
    <>
      <SeoHead
        title={`${test.name}${test.shortName ? ` (${test.shortName})` : ''} — Strideto Test Hub`}
        description={test.description || `Learn about ${test.name}: format, preparation guidance, and official resources.`}
        canonical={`${ROUTES.TEST_HUB}/${slug}`}
      />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Link to={ROUTES.TEST_HUB} className="hover:underline">Test Hub</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-700 dark:text-gray-200">{test.name}</span>
        </nav>

        {/* Header */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {test.name}
                {test.shortName && <span className="ml-2 text-base font-normal text-gray-500">({test.shortName})</span>}
              </h1>
              {provider && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Administered by{' '}
                  {provider.officialWebsite
                    ? <a href={provider.officialWebsite} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{provider.name}</a>
                    : provider.name
                  }
                </p>
              )}
            </div>
            {test.officialWebsite && (
              <a
                href={test.officialWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Official Website ↗
              </a>
            )}
          </div>

          {test.description && (
            <p className="mt-4 text-gray-700 dark:text-gray-300">{test.description}</p>
          )}

          {/* Quick facts */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {test.scoreScale && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Score Scale</p>
                <p className="font-medium text-gray-900 dark:text-white">{test.scoreScale}</p>
                {(test.sources || []).length > 0 && <SourceBadge type={test.sources[0].sourceType} />}
              </div>
            )}
            {test.validityMonths != null && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Score Validity</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {test.validityMonths} months
                </p>
                {(test.sources || []).length > 0 && <SourceBadge type={test.sources[0].sourceType} />}
              </div>
            )}
            {test.totalDurationMinutes && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Duration</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {Math.floor(test.totalDurationMinutes / 60)}h {test.totalDurationMinutes % 60}m
                </p>
              </div>
            )}
          </div>

          {/* Delivery modes */}
          {(test.deliveryModes || []).length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Delivery modes</p>
              <div className="flex flex-wrap gap-2">
                {test.deliveryModes.map((m) => (
                  <span key={m} className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {m.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Registration link */}
          {test.registrationUrl && (
            <div className="mt-4">
              <a
                href={test.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Register for {test.shortName || test.name} ↗
              </a>
              {(test.sources || []).length > 0 && (
                <span className="ml-2">
                  <SourceBadge type="official" />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Test sections */}
        {(test.sections || []).length > 0 && (
          <Section title="Test Format &amp; Sections">
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {test.sections.map((s, i) => (
                    <tr key={i} className="bg-white dark:bg-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {s.durationMinutes ? `${s.durationMinutes} min` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{s.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Active alerts */}
        {(alerts || []).length > 0 && (
          <Section title="Announcements &amp; Alerts">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert._id}
                  className={`rounded-lg border p-4 ${ALERT_IMPORTANCE_STYLES[alert.importance] || ALERT_IMPORTANCE_STYLES.low}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{alert.title}</p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {alert.alertType?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {alert.effectiveDate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Effective: {new Date(alert.effectiveDate).toLocaleDateString()}
                    </p>
                  )}
                  {alert.officialSourceUrl && (
                    <a
                      href={alert.officialSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                    >
                      Official source ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Preparation guide */}
        {prepGuide && (
          <Section title="Preparation Guide">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">{prepGuide.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium">
                  Strideto Guidance
                </span>
              </div>

              {prepGuide.overview && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{prepGuide.overview}</p>
              )}

              {prepGuide.recommendedDurationMinWeeks && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Recommended preparation: {prepGuide.recommendedDurationMinWeeks}
                  {prepGuide.recommendedDurationMaxWeeks && prepGuide.recommendedDurationMaxWeeks !== prepGuide.recommendedDurationMinWeeks
                    ? `–${prepGuide.recommendedDurationMaxWeeks}`
                    : ''}
                  {' '}weeks
                </p>
              )}

              {(prepGuide.prepSequence || []).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preparation Steps</h4>
                  <ol className="space-y-2">
                    {prepGuide.prepSequence.map((step) => (
                      <li key={step.order} className="flex gap-3 text-sm">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                          {step.order}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{step.title}</p>
                          {step.description && <p className="text-gray-600 dark:text-gray-400">{step.description}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {prepGuide.testDayGuidance && (
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 text-sm">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Test Day</p>
                  <p className="text-gray-600 dark:text-gray-300">{prepGuide.testDayGuidance}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Official resources */}
        {officialResources.length > 0 && (
          <Section title="Official Resources">
            <div className="space-y-3">
              {officialResources.map((r) => (
                <ResourceCard key={r._id} resource={r} />
              ))}
            </div>
          </Section>
        )}

        {/* Trusted third-party resources */}
        {trustedResources.length > 0 && (
          <Section title="Trusted Practice Resources">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Strideto links to trusted external resources. Always verify currency directly with the provider.
            </p>
            <div className="space-y-3">
              {trustedResources.map((r) => (
                <ResourceCard key={r._id} resource={r} />
              ))}
            </div>
          </Section>
        )}

        {/* Test Acceptance Explorer (Mission 6) */}
        {(acceptanceLoading || (acceptance && acceptance.total > 0)) && (
          <Section title="Where Is This Test Accepted?">
            {acceptanceLoading ? (
              <div className="h-24 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Showing source-backed acceptance claims. Always verify current requirements with the institution.
                </p>
                <div className="space-y-3">
                  {(acceptance.data || []).map((claim) => (
                    <AcceptanceCard key={claim._id} claim={claim} />
                  ))}
                </div>
                {acceptance.total > 10 && (
                  <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                    Showing 10 of {acceptance.total} acceptance claims.
                  </p>
                )}
              </>
            )}
          </Section>
        )}
      </div>
    </>
  );
}

function ResourceCard({ resource }) {
  const badge = TRUST_BADGES[resource.trustLevel] || TRUST_BADGES.community;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
            {badge.label}
          </span>
          {resource.isFree && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
              Free
            </span>
          )}
          {resource.isPaid && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              Paid
            </span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {resource.resourceType?.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="font-medium text-gray-900 dark:text-white text-sm">{resource.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{resource.provider}</p>
        {resource.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{resource.description}</p>
        )}
      </div>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
      >
        Visit ↗
      </a>
    </div>
  );
}

function AcceptanceCard({ claim }) {
  const badge = ACCEPTANCE_BADGES[claim.acceptanceStatus] || ACCEPTANCE_BADGES.unknown;
  const freshness = FRESHNESS_LABELS[claim.freshnessState] || FRESHNESS_LABELS.unknown;
  const scopeLabel = {
    country: 'Country — not institution-wide unless specified',
    institution: 'Institution',
    program: 'Program',
    program_intake: 'Program intake',
  }[claim.acceptanceScope] || claim.acceptanceScope;
  const scopeCaution = claim.acceptanceScope === 'country'
    ? fallbackScopeLabel(ACCEPTANCE_SCOPES.COUNTRY)
    : claim.acceptanceScope === 'institution'
      ? fallbackScopeLabel(ACCEPTANCE_SCOPES.INSTITUTION)
      : null;

  const institutionName = claim.institutionId?.officialName;
  const programName = claim.programId?.name;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex flex-wrap items-start gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
          {badge.label}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          {scopeLabel}
        </span>
        {claim.intake && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {claim.intake}
          </span>
        )}
      </div>

      {(institutionName || programName || claim.countryCode) && (
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
          {programName || institutionName || claim.countryCode}
        </p>
      )}
      {scopeCaution ? (
        <p className="text-xs text-amber-800 dark:text-amber-200 mb-1">{scopeCaution}</p>
      ) : null}

      {claim.minimumOverallScore != null && (
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">
          Minimum overall score: <span className="font-medium">{claim.minimumOverallScore}</span>
        </p>
      )}

      {(claim.sectionMinimums || []).length > 0 && (
        <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">
          <span className="font-medium">Section minimums: </span>
          {claim.sectionMinimums.map((s, i) => (
            <span key={i}>{i > 0 && ' · '}{s.sectionName}: {s.minimum}{s.scale ? ` (${s.scale})` : ''}</span>
          ))}
        </div>
      )}

      {claim.conditions && (
        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">{claim.conditions}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
        {claim.lastVerifiedAt && (
          <span>
            Last verified: {new Date(claim.lastVerifiedAt).toLocaleDateString()}
          </span>
        )}
        <span className={freshness.className}>{freshness.label}</span>
        <ProvenanceStrip freshnessState={claim.freshnessState} lastReviewedAt={claim.lastVerifiedAt} />
        {(claim.sources || []).length > 0 && claim.sources[0].sourceUrl && (
          <a
            href={claim.sources[0].sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 dark:text-blue-400 hover:underline"
          >
            {claim.sources[0].publisher || 'Source'} ↗
          </a>
        )}
        {(claim.sources || []).length === 0 && (
          <span className="text-yellow-500 dark:text-yellow-400">Unverified — no source on file</span>
        )}
      </div>
    </div>
  );
}
