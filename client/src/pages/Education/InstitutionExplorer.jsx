/**
 * Public Canonical Institution directory + detail (education discovery).
 * Separate from legacy Schools & Colleges (/schools-and-colleges).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { useCollectionSeo } from '../../seo/collectionSeo';
import { testsApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { Pagination } from '../../components/ui/Pagination';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { ProvenanceStrip } from '../../components/public/ProvenanceStrip';
import { KeyFacts } from '../../components/public/KeyFacts';
import { PublicSourceLink } from '../../components/public/PublicSourceLink.jsx';
import {
  resolveInstitutionOfficialWebsite,
} from '@shared/seo/sourceAuthority.js';
import { countryDisplayName } from '@shared/international/country.js';
import { formatMoney } from '@shared/international/dateDisplay.js';
import { NO_GUARANTEE_DISCLAIMER } from '@shared/publicDiscovery/publicTruth.js';
import { isCanonicalInstitutionDetailEligible } from '@shared/seo/entityDetailSeoPolicy.js';
import { clusterResourceLinks } from '@shared/seo/contentClusters.js';
import { RelatedResources } from '../../components/seo/RelatedResources';
import { INSTITUTION_TYPES } from '@shared/education/taxonomy.js';
import { fallbackScopeLabel, ACCEPTANCE_SCOPES } from '@shared/education/acceptanceExplorer.js';

const TYPE_LABELS = {
  university: 'University',
  college: 'College',
  institute: 'Institute',
  school: 'School',
  training_center: 'Training center',
  other: 'Other',
};

const DEGREE_LABELS = {
  high_school: 'High School',
  diploma: 'Diploma',
  certificate: 'Certificate',
  bachelor: 'Bachelor',
  master: 'Master',
  phd: 'PhD',
  postdoc: 'Postdoc',
  professional: 'Professional',
};

const FIELD_LABELS = {
  arts: 'Arts',
  business: 'Business',
  computing: 'Computing',
  education: 'Education',
  engineering: 'Engineering',
  health: 'Health',
  humanities: 'Humanities',
  law: 'Law',
  natural_science: 'Natural Science',
  social_science: 'Social Science',
  other: 'Other',
};

const STUDY_MODE_LABELS = {
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  online: 'Online',
  blended: 'Blended',
  distance: 'Distance',
};

const PAGE_SIZE = 20;

function locationLine(inst) {
  return [inst.city, inst.region, countryDisplayName(inst.countryCode) || inst.countryCode]
    .filter(Boolean)
    .join(' · ');
}

function AcceptanceCard({ claim }) {
  const name = claim.testIdentity?.name || claim.testId?.name || 'Test';
  const provider = claim.testIdentity?.providerName || claim.testId?.providerId?.name;
  return (
    <div className="px-4 py-3 text-sm border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-900 dark:text-white">{name}</span>
        {provider && <span className="text-xs text-gray-500">{provider}</span>}
        {(() => {
          const ST = { accepted: ['Accepted', 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'], conditional: ['Conditional', 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'], not_accepted: ['Not Accepted', 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'], case_by_case: ['Case by Case', 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'] };
          const [label, cls] = ST[claim.acceptanceStatus] || [claim.acceptanceStatus, 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'];
          return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
        })()}
        {claim.acceptanceScope && (
          <span className="text-xs text-gray-400">{claim.acceptanceScope}</span>
        )}
      </div>
      {claim.minimumOverallScore != null && (
        <p className="mt-1 text-gray-600 dark:text-gray-300">Overall: {claim.minimumOverallScore}</p>
      )}
      {Array.isArray(claim.sectionMinimums) && claim.sectionMinimums.length > 0 && (
        <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
          {claim.sectionMinimums.map((sec) => (
            <li key={`${sec.sectionName}-${sec.minimum}`}>
              {sec.sectionName}: {sec.minimum}{sec.scale ? ` (${sec.scale})` : ''}
            </li>
          ))}
        </ul>
      )}
      {claim.resultValidityMonths != null && (
        <p className="mt-1 text-xs text-gray-500">Validity: {claim.resultValidityMonths} months</p>
      )}
      {(claim.effectiveFrom || claim.effectiveUntil) && (
        <p className="mt-0.5 text-xs text-gray-400">
          Effective
          {claim.effectiveFrom ? ` from ${new Date(claim.effectiveFrom).toLocaleDateString()}` : ''}
          {claim.effectiveUntil ? ` until ${new Date(claim.effectiveUntil).toLocaleDateString()}` : ''}
        </p>
      )}
      {claim.conditions && <p className="mt-1 text-xs text-gray-500">{claim.conditions}</p>}
    </div>
  );
}

function InstitutionCard({ institution }) {
  const path = `${ROUTES.EDUCATION_INSTITUTIONS}/${institution.slug}`;
  const loc = locationLine(institution);
  return (
    <Link
      to={path}
      className="group flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md hover:border-primary/30 dark:hover:border-mint/30 transition-all duration-150 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="p-5 flex-1">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-mint/10 flex items-center justify-center shrink-0 text-primary dark:text-mint font-bold text-lg select-none">
            {institution.officialName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-mint transition-colors line-clamp-2 leading-snug">
              {institution.officialName}
            </h3>
            {loc && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{loc}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {institution.institutionType && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
              {TYPE_LABELS[institution.institutionType] || institution.institutionType}
            </span>
          )}
          {typeof institution.programCount === 'number' && institution.programCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {institution.programCount} program{institution.programCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function InstitutionExplorerList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filters = {
    search: searchParams.get('search') || '',
    country: searchParams.get('country') || '',
    region: searchParams.get('region') || '',
    city: searchParams.get('city') || '',
    institutionType: searchParams.get('type') || '',
    page: Math.max(1, parseInt(searchParams.get('page'), 10) || 1),
  };

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    testsApi.listInstitutions({
      search: filters.search || undefined,
      country: filters.country || undefined,
      region: filters.region || undefined,
      city: filters.city || undefined,
      institutionType: filters.institutionType || undefined,
      page: filters.page,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        setData(res.data?.data || []);
        setPagination({
          page: res.data?.page || 1,
          pages: res.data?.pages || 0,
          total: res.data?.total || 0,
        });
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load institutions');
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [filters.search, filters.country, filters.region, filters.city, filters.institutionType, filters.page]);

  useEffect(() => { load(); }, [load]);

  const collectionSeo = useCollectionSeo(ROUTES.EDUCATION_INSTITUTIONS);

  return (
    <>
      <SeoHead
        title="Universities & Institutions | Strideto"
        description="Browse universities and education institutions by country, region, and type. Explore programs and accepted tests."
        canonical={collectionSeo.canonical}
        noindex={collectionSeo.noindex}
        robots={collectionSeo.robots}
      />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Universities & Institutions</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
            Country-first discovery of canonical education institutions, their published programs, and accepted tests.
            Separate from local Schools & Colleges listings.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input
              type="search"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm min-h-[44px]"
              placeholder="Search institutions"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
            <CountrySelect
              allowAll
              value={filters.country}
              onChange={(code) => updateFilter('country', code || '')}
              className="min-h-[44px]"
            />
            <input
              type="text"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm min-h-[44px]"
              placeholder="State / Province / Region"
              value={filters.region}
              onChange={(e) => updateFilter('region', e.target.value)}
            />
            <input
              type="text"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm min-h-[44px]"
              placeholder="City"
              value={filters.city}
              onChange={(e) => updateFilter('city', e.target.value)}
            />
            <select
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm min-h-[44px]"
              value={filters.institutionType}
              onChange={(e) => updateFilter('type', e.target.value)}
              aria-label="Institution type"
            >
              <option value="">All types</option>
              {Object.values(INSTITUTION_TYPES).map((v) => (
                <option key={v} value={v}>{TYPE_LABELS[v] || v}</option>
              ))}
            </select>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Also explore{' '}
            <Link to={ROUTES.PROGRAM_EXPLORER} className="text-primary underline">Program Explorer</Link>
            {' '}and legacy{' '}
            <Link to={ROUTES.SCHOOLS_AND_COLLEGES} className="text-primary underline">Schools & Colleges</Link>.
          </p>

          {loading && <p className="mt-8 text-sm text-gray-500" aria-busy="true">Loading…</p>}
          {error && <p className="mt-8 text-sm text-red-600" role="alert">{error}</p>}
          {!loading && !error && data.length === 0 && (
            <p className="mt-8 text-sm text-gray-500">No institutions match these filters.</p>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((inst) => <InstitutionCard key={inst._id} institution={inst} />)}
          </div>

          {pagination.pages > 1 && (
            <div className="mt-8">
              <Pagination
                page={pagination.page}
                pages={pagination.pages}
                onChange={(p) => updateFilter('page', String(p))}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function InstitutionExplorerDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [acceptedTests, setAcceptedTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      testsApi.getInstitution(slug),
      testsApi.getInstitutionAcceptance(slug).catch(() => ({ data: { data: [] } })),
    ])
      .then(([instRes, accRes]) => {
        if (cancelled) return;
        const body = instRes.data || {};
        // Support both wrapped { data, programs } and legacy flat projection
        const institution = body.data && body.data.officialName ? body.data : body;
        setData(institution);
        setPrograms(Array.isArray(body.programs) ? body.programs : []);
        setAcceptedTests(accRes.data?.data || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Institution not found');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-sm text-gray-500" aria-busy="true">Loading…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <>
        <SeoHead title="Institution not found | Strideto" noindex />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">{error || 'Institution not found.'}</p>
            <Link to={ROUTES.EDUCATION_INSTITUTIONS} className="text-primary underline text-sm">
              Back to Universities & Institutions
            </Link>
          </div>
        </div>
      </>
    );
  }

  const websiteLink = resolveInstitutionOfficialWebsite(data.officialWebsite);
  const detailIndexable = isCanonicalInstitutionDetailEligible(data, {
    programCount: programs.length,
    acceptedTestCount: acceptedTests.length,
  });
  const relatedResources = clusterResourceLinks('institutions-programs', {
    maxItems: 4,
    currentPath: `${ROUTES.EDUCATION_INSTITUTIONS}/${data.slug || ''}`,
  });

  const institutionFacts = [
    { label: 'Institution type', value: TYPE_LABELS[data.institutionType] || data.institutionType },
    { label: 'Location', value: locationLine(data) },
    {
      label: 'Published programs',
      value: programs.length > 0 ? String(programs.length) : null,
    },
    {
      label: 'Accepted tests listed',
      value: acceptedTests.length > 0 ? String(acceptedTests.length) : null,
    },
  ];

  return (
    <>
      <SeoHead
        title={`${data.officialName || 'Institution'} | Strideto`}
        description={`Programs and accepted tests at ${data.officialName || 'this institution'}.`}
        canonical={`${ROUTES.EDUCATION_INSTITUTIONS}/${data.slug || ''}`}
        noindex={!detailIndexable}
        robots={detailIndexable ? 'index, follow' : 'noindex, follow'}
      />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <Link to={ROUTES.EDUCATION_INSTITUTIONS} className="text-sm text-primary hover:underline mb-6 inline-block">
            ← Universities & Institutions
          </Link>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{data.officialName}</h1>
            <p className="mt-1 text-sm text-gray-500">{locationLine(data)}</p>
            <div className="mt-4">
              <KeyFacts facts={institutionFacts} headingId="institution-key-facts" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.institutionType && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                  {TYPE_LABELS[data.institutionType] || data.institutionType}
                </span>
              )}
            </div>
            {websiteLink?.url && (
              <div className="mt-3">
                <PublicSourceLink url={websiteLink.url} label={websiteLink.label} />
              </div>
            )}
            <ProvenanceStrip
              className="mt-4"
              authorityLabel={data.authorityLabel}
              lastReviewedAt={data.lastVerifiedAt}
              freshnessState={data.freshnessState}
              sourceUrl={websiteLink?.url}
              linkLabel={websiteLink?.label}
            />
            <p className="mt-2 text-xs text-gray-400">
              Catalog publication does not mean the organization is verified or that a claim is approved.
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Programs offered</h2>
            {programs.length === 0 ? (
              <p className="text-sm text-gray-500">No published programs listed yet.</p>
            ) : (
              <div className="space-y-3">
                {programs.map((program) => (
                  <Link
                    key={program._id}
                    to={`${ROUTES.PROGRAM_EXPLORER}/${program.slug}`}
                    className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{program.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {program.degreeLevel && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                          {DEGREE_LABELS[program.degreeLevel] || program.degreeLevel}
                        </span>
                      )}
                      {program.field && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                          {FIELD_LABELS[program.field] || program.field}
                        </span>
                      )}
                      {program.studyMode && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                          {STUDY_MODE_LABELS[program.studyMode] || program.studyMode}
                        </span>
                      )}
                      {program.durationMonths != null && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">{program.durationMonths} mo</span>
                      )}
                      {program.campus && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">{program.campus}</span>
                      )}
                      {program.tuition?.amountMinor != null && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                          {formatMoney(program.tuition)}
                          {program.tuition.per ? ` / ${program.tuition.per}` : ''}
                        </span>
                      )}
                    </div>
                    {Array.isArray(program.intakes) && program.intakes.length > 0 && (
                      <p className="mt-2 text-xs text-gray-500">
                        Intakes: {program.intakes.map((i) => i.cycleLabel).filter(Boolean).join(', ') || 'Listed'}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs">
              <Link to={ROUTES.PROGRAM_EXPLORER} className="text-primary underline">
                Browse all programs
              </Link>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Accepted tests</h2>
            <p className="text-xs text-gray-500 mb-3">
              {fallbackScopeLabel(ACCEPTANCE_SCOPES.INSTITUTION)}
            </p>
            {acceptedTests.length === 0 ? (
              <p className="text-sm text-gray-500">No published test acceptance rules on file for this institution.</p>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                {acceptedTests.map((claim) => (
                  <AcceptanceCard key={claim._id} claim={claim} />
                ))}
              </div>
            )}
          </section>

          <RelatedResources
            title="Explore related resources"
            items={relatedResources}
            maxItems={4}
            variant="list"
          />

          <p className="text-xs text-gray-400">{NO_GUARANTEE_DISCLAIMER}</p>
        </div>
      </div>
    </>
  );
}

export default InstitutionExplorerList;
