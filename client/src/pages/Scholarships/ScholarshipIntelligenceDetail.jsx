/**
 * Canonical Scholarship Detail (Mission 7).
 *
 * Shows source-backed scholarship facts: funding, criteria, cycles, applicability.
 * No personalized eligibility decisions (Mission 8).
 * Stale/broken-source warnings shown when API signals them.
 * Guarantee language is never rendered.
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { canonicalScholarshipsApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { formatMoney } from '@shared/international/dateDisplay.js';
import { formatLocationDisplay } from '@shared/international/location.js';
import { PublicTrustBadge } from '../../components/public/PublicTrustBadge';
import { AUTHORITY_KINDS } from '@shared/publicDiscovery/publicTruth.js';
import { KeyFacts } from '../../components/public/KeyFacts';
import { PublicSourceSection } from '../../components/public/PublicSourceSection';
import { ProvenanceStrip } from '../../components/public/ProvenanceStrip';
import { PublicSourceLink } from '../../components/public/PublicSourceLink.jsx';
import {
  resolveCanonicalScholarshipApplicationUrl,
  sourceSectionTitle,
} from '@shared/seo/sourceAuthority.js';

const FUNDING_LABELS = {
  full: 'Fully Funded',
  partial: 'Partial',
  fixed_amount: 'Fixed Amount',
  component_based: 'Component-Based',
  unknown: 'Funding Not Specified',
};

const COMPONENT_LABELS = {
  tuition: 'Tuition',
  stipend: 'Stipend',
  accommodation: 'Accommodation',
  travel: 'Travel',
  insurance: 'Health Insurance',
  books_materials: 'Books & Materials',
  research_allowance: 'Research Allowance',
  other: 'Other',
};

const CRITERIA_LABELS = {
  nationality_residence: 'Nationality / Residence',
  degree_level: 'Degree Level',
  academic_qualification: 'Academic Qualification',
  gpa_grade: 'GPA / Grade',
  field: 'Field of Study',
  age: 'Age',
  language_test: 'Language Test',
  experience_research: 'Experience / Research',
  financial_need: 'Financial Need',
  admission_enrollment: 'Admission / Enrollment',
  other: 'Other',
};

const CYCLE_STATUS_COLORS = {
  open: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  upcoming: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  closed: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
  unknown: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
};

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      {children}
    </div>
  );
}

function FreshnessWarning({ warning }) {
  if (!warning) return null;
  return (
    <div className="mb-6 rounded-lg border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
      {warning}
    </div>
  );
}

export default function ScholarshipIntelligenceDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [applicability, setApplicability] = useState([]);
  const [freshnessWarning, setFreshnessWarning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    canonicalScholarshipsApi.get(slug)
      .then((res) => {
        setData(res.data.data);
        setCycles(res.data.cycles || []);
        setApplicability(res.data.applicability || []);
        setFreshnessWarning(res.data.freshnessWarning || null);
      })
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Scholarship not found.</p>
          <Link to={ROUTES.CANONICAL_SCHOLARSHIPS} className="text-blue-600 dark:text-blue-400 text-sm underline">
            Back to Scholarships
          </Link>
        </div>
      </div>
    );
  }

  const countries = (data.destinationCountries || []).filter((c) => c !== '*');
  const funding = data.funding || {};
  const institution = data.institutionId && typeof data.institutionId === 'object'
    ? data.institutionId
    : null;
  const institutionHref = institution?.slug
    ? `/institutions/${institution.slug}`
    : null;
  const scopeLabel = data.applicabilityScope?.label;
  const locationLine = institution
    ? formatLocationDisplay(institution)
    : '';
  const scholarshipApplication = resolveCanonicalScholarshipApplicationUrl(data.applicationUrl);

  const scholarshipIntelFacts = [
    { label: 'Provider', value: data.provider?.name },
    { label: 'Institution', value: institution?.officialName },
    {
      label: 'Funding',
      value: funding.type && funding.type !== 'unknown' ? (FUNDING_LABELS[funding.type] || funding.type) : null,
    },
    {
      label: 'Study level',
      value: (data.degreeLevels || []).length ? (data.degreeLevels || []).map((d) => d.replace(/_/g, ' ')).join(', ') : null,
    },
    {
      label: 'Destination countries',
      value: countries.length ? countries.join(', ') : null,
    },
    { label: 'Applicability', value: scopeLabel },
  ];

  return (
    <>
      <SeoHead
        title={`${data.title} | Scholarship Intelligence | Strideto`}
        description={data.summary || `Scholarship details for ${data.title}.`}
      />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <Link
            to={ROUTES.SCHOLARSHIPS}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block mr-4"
          >
            ← Scholarships
          </Link>
          <Link
            to={ROUTES.CANONICAL_SCHOLARSHIPS}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block"
          >
            Scholarship Intelligence
          </Link>

          <FreshnessWarning warning={freshnessWarning} />

          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{data.title}</h1>
                {institution ? (
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    {institutionHref ? (
                      <Link to={institutionHref} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                        {institution.officialName}
                      </Link>
                    ) : (
                      <span className="font-medium">{institution.officialName}</span>
                    )}
                    {locationLine ? <span className="text-gray-500"> · {locationLine}</span> : null}
                  </p>
                ) : null}
                {data.provider?.name && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {data.provider.name}
                    {data.provider.providerType && ` · ${data.provider.providerType.replace(/_/g, ' ')}`}
                  </p>
                )}
                <div className="mt-2">
                  <PublicTrustBadge
                    kind={institution ? AUTHORITY_KINDS.INSTITUTION_SCHOLARSHIP : AUTHORITY_KINDS.SOURCE_BACKED}
                  />
                </div>
                <div className="mt-4">
                  <KeyFacts facts={scholarshipIntelFacts} headingId="canonical-scholarship-key-facts" />
                </div>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${funding.type === 'full' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                {FUNDING_LABELS[funding.type] || 'Funding Not Specified'}
              </span>
            </div>

            {scopeLabel ? (
              <p className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">{scopeLabel}</p>
            ) : null}

            {data.summary && (
              <p className="mt-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {data.summary}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {(data.degreeLevels || []).map((d) => (
                <span key={d} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                  {d.replace(/_/g, ' ')}
                </span>
              ))}
              {countries.map((c) => (
                <span key={c} className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                  {c}
                </span>
              ))}
              {(data.fields || []).map((f) => (
                <span key={f} className="text-xs px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 capitalize">
                  {f.replace(/_/g, ' ')}
                </span>
              ))}
            </div>

            {scholarshipApplication?.url && (
              <div className="mt-5">
                <PublicSourceLink
                  url={scholarshipApplication.url}
                  label={scholarshipApplication.label}
                  className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                  showArrow={false}
                />
              </div>
            )}

            <PublicSourceSection title={sourceSectionTitle(scholarshipApplication?.level)} className="mt-6">
              <ProvenanceStrip
                authorityLabel={institution ? institution.officialName : data.provider?.name}
                sourceUrl={scholarshipApplication?.url}
                linkLabel={scholarshipApplication?.label}
              />
            </PublicSourceSection>
          </div>

          {/* Funding detail */}
          {funding.type && funding.type !== 'unknown' && (
            <Section title="Funding Detail">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {(funding.components || []).map((c, i) => (
                  <div key={i} className="px-4 py-3 flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      {COMPONENT_LABELS[c.component] || c.component}
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {c.amountMinor != null && c.currency
                        ? formatMoney({ amountMinor: c.amountMinor, currency: c.currency })
                        : c.notes || 'See official source'}
                    </span>
                  </div>
                ))}
                {funding.notes && (
                  <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {funding.notes}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Criteria */}
          {data.criteria?.length > 0 && (
            <Section title="Eligibility Criteria">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Source-backed factual criteria. Personal eligibility assessment is not provided here.
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {data.criteria.map((c, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                      {CRITERIA_LABELS[c.criteriaType] || c.criteriaType}
                    </div>
                    <div className="text-sm text-gray-800 dark:text-gray-200">
                      {c.value}
                      {c.gradingContext && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({c.gradingContext})</span>
                      )}
                    </div>
                    {c.notes && (
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{c.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Cycles / Deadlines */}
          {cycles.length > 0 && (
            <Section title="Application Cycles">
              <div className="space-y-3">
                {cycles.map((c) => (
                  <div key={c._id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {c.cycleLabel || c.academicYear || 'Upcoming Cycle'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CYCLE_STATUS_COLORS[c.cycleStatus] || CYCLE_STATUS_COLORS.unknown}`}>
                        {c.cycleStatus?.toUpperCase() || 'UNKNOWN'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
                      {c.applicationOpenAt && (
                        <p>Opens: {new Date(c.applicationOpenAt).toLocaleDateString()}</p>
                      )}
                      {c.deadlineAt ? (
                        <p>Deadline: <span className="font-medium text-gray-900 dark:text-white">{new Date(c.deadlineAt).toLocaleDateString()}</span>{c.timezone && ` (${c.timezone})`}</p>
                      ) : (
                        <p className="text-gray-400 dark:text-gray-500 italic">Deadline not confirmed. Check official source.</p>
                      )}
                      {c.intake && <p>Intake: {c.intake}</p>}
                    </div>
                    {c.sources?.[0]?.sourceUrl && (
                      <a
                        href={c.sources[0].sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Source ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Applicability */}
          {(applicability.length > 0 || scopeLabel) && (
            <Section title="Applicability">
              {scopeLabel ? (
                <p className="text-sm text-gray-800 dark:text-gray-200 mb-3 font-medium">{scopeLabel}</p>
              ) : null}
              {applicability.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {applicability.map((a) => (
                  <div key={a._id} className="px-4 py-3 text-sm">
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase mr-2">{a.scope}</span>
                    {a.institutionId?.officialName && (
                      <span className="text-gray-800 dark:text-gray-200">{a.institutionId.officialName}</span>
                    )}
                    {a.programId?.name && (
                      <span className="text-gray-800 dark:text-gray-200">Available for: {a.programId.name}</span>
                    )}
                    {a.countryCode && !a.institutionId && (
                      <span className="text-gray-800 dark:text-gray-200">{a.countryCode}</span>
                    )}
                    {a.degreeLevel && (
                      <span className="text-gray-700 dark:text-gray-300 capitalize ml-1">({a.degreeLevel.replace(/_/g, ' ')})</span>
                    )}
                    {a.field && (
                      <span className="text-gray-700 dark:text-gray-300 capitalize ml-1">{a.field.replace(/_/g, ' ')}</span>
                    )}
                    {a.notes && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{a.notes}</p>}
                  </div>
                ))}
              </div>
              ) : null}
            </Section>
          )}

          {/* Provenance */}
          {(data.sources?.length > 0 || data.lastVerifiedAt) && (
            <Section title="Source & Verification">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4 text-sm space-y-2">
                {data.lastVerifiedAt && (
                  <p className="text-gray-600 dark:text-gray-400">
                    Last verified: {new Date(data.lastVerifiedAt).toLocaleDateString()}
                  </p>
                )}
                {(data.sources || []).map((s, i) => s.sourceUrl && (
                  <p key={i}>
                    <a
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {s.publisher || 'Official Source'} ↗
                    </a>
                    {s.retrievedAt && (
                      <span className="ml-2 text-xs text-gray-400">(retrieved {new Date(s.retrievedAt).toLocaleDateString()})</span>
                    )}
                  </p>
                ))}
              </div>
            </Section>
          )}

          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            Strideto does not guarantee funding, admission, visa approval, or employment outcomes. Always verify information directly with the awarding organization.
          </p>
        </div>
      </div>
    </>
  );
}
