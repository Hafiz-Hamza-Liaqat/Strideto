/**
 * Program Intelligence Explorer (Mission 7).
 *
 * Browse and detail view for canonical programs with requirements, accepted
 * tests (Mission 6), related scholarships, and freshness metadata.
 * No personalized eligibility decisions (Mission 8).
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { useCollectionSeo } from '../../seo/collectionSeo';
import { programIntelligenceApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { Pagination } from '../../components/ui/Pagination';
import { checkSaved, saveOpportunity, unsaveOpportunity } from '../../services/actionEngineService';
import { formatMoney } from '@shared/international/dateDisplay.js';
import { countryDisplayName } from '@shared/international/country.js';
import { formatPublicDateOnly, APPLICATION_MODE_LABELS, NO_GUARANTEE_DISCLAIMER, NOT_SPECIFIED } from '@shared/publicDiscovery/publicTruth.js';
import { publicHttpUrlOrNull } from '@shared/publicDiscovery/safePublicUrl.js';
import { ProvenanceStrip } from '../../components/public/ProvenanceStrip';
import { testsApi } from '../../services/listingsService';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { fallbackScopeLabel, ACCEPTANCE_SCOPES } from '@shared/education/acceptanceExplorer.js';
import { resolveScholarshipDetailPath } from '@shared/seo/entityDetailSeoPolicy.js';
import { RelatedResources } from '../../components/seo/RelatedResources';

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

const REQ_TYPE_LABELS = {
  academic: 'Academic',
  language_test: 'Language Test',
  standardized_test: 'Standardized Test',
  prerequisite_subject: 'Prerequisite Subject',
  experience: 'Experience',
  portfolio: 'Portfolio',
  document: 'Document',
  other: 'Other',
};

const REQ_SEMANTICS_COLORS = {
  required: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  optional: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  conditional: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
};

const PAGE_SIZE = 20;

// ── Program Card (list) ───────────────────────────────────────────────────────

function ProgramCard({ program }) {
  const detailPath = `${ROUTES.PROGRAM_EXPLORER}/${program.slug}`;
  return (
    <Link
      to={detailPath}
      className="interactive-card block p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2">
        {program.name}
      </h3>
      {program.institutionId?.officialName && (
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {program.institutionId.officialName}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {program.degreeLevel && (
          <span className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
            {DEGREE_LABELS[program.degreeLevel] || program.degreeLevel}
          </span>
        )}
        {program.field && (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {FIELD_LABELS[program.field] || program.field}
          </span>
        )}
        {program.studyMode && (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {STUDY_MODE_LABELS[program.studyMode] || program.studyMode}
          </span>
        )}
        {program.country && (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {countryDisplayName(program.country) || program.country}
          </span>
        )}
        {program.durationMonths && (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {program.durationMonths}mo
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Program List page ─────────────────────────────────────────────────────────

function FilterBar({ pending, onPendingChange, onApply, onReset }) {
  const selectClass = 'text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 [color-scheme:light] dark:[color-scheme:dark]';
  return (
    <form
      className="flex flex-wrap gap-3 items-end"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="w-full sm:w-64">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="program-country">Country</label>
        <CountrySelect
          id="program-country"
          allowAll
          value={pending.country || ''}
          onChange={(code) => onPendingChange({ ...pending, country: code || undefined })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="program-degree">Degree</label>
        <select
          id="program-degree"
          value={pending.degree || ''}
          onChange={(e) => onPendingChange({ ...pending, degree: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All Degrees</option>
          {Object.entries(DEGREE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="program-field">Field</label>
        <select
          id="program-field"
          value={pending.field || ''}
          onChange={(e) => onPendingChange({ ...pending, field: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All Fields</option>
          {Object.entries(FIELD_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="program-mode">Study mode</label>
        <select
          id="program-mode"
          value={pending.studyMode || ''}
          onChange={(e) => onPendingChange({ ...pending, studyMode: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All Study Modes</option>
          {Object.entries(STUDY_MODE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
          Apply filters
        </button>
        <button type="button" onClick={onReset} className="min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
          Reset filters
        </button>
      </div>
    </form>
  );
}

function readAppliedFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return {
    page: 1,
    limit: PAGE_SIZE,
    country: params.get('country') || undefined,
    degree: params.get('degree') || undefined,
    field: params.get('field') || undefined,
    studyMode: params.get('studyMode') || undefined,
    search: params.get('search') || undefined,
  };
}

export function ProgramExplorerList() {
  const location = useLocation();
  const navigate = useNavigate();
  const [applied, setApplied] = useState(() => readAppliedFromSearch(location.search));
  const [pending, setPending] = useState(() => readAppliedFromSearch(location.search));
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const res = await programIntelligenceApi.list(params);
      setData(Array.isArray(res.data.data) ? res.data.data.filter((row) => row && row._id) : []);
      setPagination(res.data.pagination || { page: 1, total: 0, pages: 1 });
    } catch {
      setError('Failed to load programs.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(applied); }, [applied, fetchData]);

  const applyFilters = () => {
    const next = { ...pending, page: 1, limit: PAGE_SIZE };
    setApplied(next);
    const params = new URLSearchParams();
    ['country', 'degree', 'field', 'studyMode', 'search'].forEach((key) => {
      if (next[key]) params.set(key, next[key]);
    });
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : '' }, { replace: true });
  };

  const resetFilters = () => {
    const next = { page: 1, limit: PAGE_SIZE };
    setPending(next);
    setApplied(next);
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
  };

  const collectionSeo = useCollectionSeo(ROUTES.PROGRAM_EXPLORER);

  return (
    <>
      <SeoHead
        title="Study & Institutions | Strideto"
        description="Browse international programs by country, degree, field, and study mode."
        canonical={collectionSeo.canonical}
        noindex={collectionSeo.noindex}
        robots={collectionSeo.robots}
      />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Program Explorer</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Browse source-backed programs with requirements and accepted tests.
            </p>
          </div>

          <div className="mb-6">
            <FilterBar
              pending={pending}
              onPendingChange={setPending}
              onApply={applyFilters}
              onReset={resetFilters}
            />
          </div>
          <p className="sr-only" aria-live="polite">
            {loading ? 'Loading programs' : `${pagination.total || 0} programs found`}
          </p>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-36 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="py-16 text-center text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">No public programs yet</h2>
              <p className="mt-2 text-sm">
                No programs found matching your filters. Source-backed programs appear here after they are published and launch-eligible.
                You can change filters and apply them, or reset to the unfiltered catalog. This is not sample inventory.
              </p>
              <button type="button" onClick={resetFilters} className="mt-4 text-sm text-primary underline min-h-[44px]">
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((p) => <ProgramCard key={p._id} program={p} />)}
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="mt-8">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={(p) => setApplied((f) => ({ ...f, page: p }))}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Program Detail page ───────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      {children}
    </div>
  );
}

const APPLY_BTN_PRIMARY = 'inline-flex items-center justify-center min-h-[44px] text-sm px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium btn-theme transition-colors';
const APPLY_BTN_SECONDARY = 'inline-flex items-center justify-center min-h-[44px] text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors break-words-safe';

function buildApplyPath(programId, intake) {
  const base = ROUTES.STUDENT_INSTITUTION_APPLY.replace(':programId', programId);
  if (!intake?.cycleLabel) return base;
  return `${base}?intakeCycleLabel=${encodeURIComponent(intake.cycleLabel)}`;
}

function intakeSupportsApply(intake) {
  const mode = intake?.applicationMode || 'not_configured';
  const applyUrl = publicHttpUrlOrNull(intake?.applicationUrl);
  return mode === 'internal' || mode === 'platform' || mode === 'both' || (mode === 'external' && applyUrl);
}

function ProgramApplyActions({ programId, intake, isAuthenticated, loginReturnPath }) {
  const mode = intake.applicationMode || 'not_configured';
  const applyUrl = publicHttpUrlOrNull(intake.applicationUrl);
  const showInternal = ['internal', 'both', 'platform'].includes(mode);
  const showExternal = ['external', 'both'].includes(mode) && applyUrl;

  if (mode === 'not_configured') {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Application path not configured for this intake. Use the official program page or contact the institution directly.
      </p>
    );
  }

  const internalPath = buildApplyPath(programId, intake);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {showInternal ? (
        isAuthenticated ? (
          <Link to={internalPath} className={APPLY_BTN_PRIMARY}>
            {APPLICATION_MODE_LABELS.platform || 'Apply on Strideto'}
          </Link>
        ) : (
          <Link to={ROUTES.LOGIN} state={{ from: loginReturnPath }} className={APPLY_BTN_PRIMARY}>
            Sign in to apply on Strideto
          </Link>
        )
      ) : null}
      {showExternal ? (
        <a href={applyUrl} target="_blank" rel="noopener noreferrer" className={APPLY_BTN_SECONDARY}>
          Apply on the Institution&apos;s official website ↗
        </a>
      ) : null}
    </div>
  );
}

export function ProgramExplorerDetail() {
  const { slug } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [acceptedTests, setAcceptedTests] = useState([]);
  const [relatedScholarships, setRelatedScholarships] = useState([]);
  const [relatedPrograms, setRelatedPrograms] = useState([]);
  const [relatedResources, setRelatedResources] = useState([]);
  const [freshnessWarning, setFreshnessWarning] = useState(null);
  const [acceptanceFallback, setAcceptanceFallback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareStatus, setShareStatus] = useState('');

  useEffect(() => {
    if (!slug) return;
    programIntelligenceApi.get(slug)
      .then((res) => {
        setData(res.data.data);
        setRequirements(res.data.requirements || []);
        setAcceptedTests(res.data.acceptedTests || []);
        setRelatedScholarships(res.data.relatedScholarships || []);
        setRelatedPrograms(res.data.relatedPrograms || []);
        setRelatedResources(res.data.relatedResources || []);
        setFreshnessWarning(res.data.freshnessWarning || null);
        if (!(res.data.acceptedTests || []).length) {
          return testsApi.getProgramAcceptance(slug).then(({ data: acc }) => {
            if (acc?.fallback?.data?.length) setAcceptanceFallback(acc.fallback);
          }).catch(() => {});
        }
        return undefined;
      })
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!isAuthenticated || !data?._id) return undefined;
    checkSaved('program', data._id).then((r) => setSaved(!!r?.saved)).catch(() => {});
    return undefined;
  }, [isAuthenticated, data?._id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <>
        <SeoHead title="Program not found | Strideto" noindex />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Program not found.</p>
          <Link to={ROUTES.PROGRAM_EXPLORER} className="text-blue-600 dark:text-blue-400 text-sm underline">
            Back to Program Explorer
          </Link>
        </div>
      </div>
      </>
    );
  }

  const inst = data.institutionId;
  const primaryApplyIntake = (data.intakes || []).find((intake) => intakeSupportsApply(intake));
  const loginReturnPath = location.pathname;

  return (
    <>
      <SeoHead
        title={`${data.name || 'Program'} | Strideto`}
        description={`Program details for ${data.name || 'this program'}${inst?.officialName ? ` at ${inst.officialName}` : ''}.`}
        canonical={`${ROUTES.PROGRAM_EXPLORER}/${data.slug || ''}`}
      />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <Link
            to={ROUTES.PROGRAM_EXPLORER}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6 inline-block"
          >
            ← Program Explorer
          </Link>

          {freshnessWarning && (
            <div className="mb-6 rounded-lg border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
              {freshnessWarning}
            </div>
          )}

          {/* Core info */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{data.name}</h1>
            {inst?.officialName && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {inst.slug ? (
                  <Link to={`${ROUTES.EDUCATION_INSTITUTIONS}/${inst.slug}`} className="text-primary hover:underline">
                    {inst.officialName}
                  </Link>
                ) : (
                  inst.officialName
                )}
                {inst.countryCode && ` · ${countryDisplayName(inst.countryCode) || inst.countryCode}`}
                {inst.city || inst.region ? ` · ${[inst.city, inst.region].filter(Boolean).join(', ')}` : ''}
                {data.campus ? ` · ${data.campus}` : ''}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {isAuthenticated ? (
                <button
                  type="button"
                  className={APPLY_BTN_SECONDARY}
                  onClick={async () => {
                    try {
                      if (saved) await unsaveOpportunity('program', data._id);
                      else await saveOpportunity({ entityType: 'program', entityId: data._id, title: data.name });
                      setSaved(!saved);
                    } catch { /* keep current */ }
                  }}
                >
                  {saved ? 'Saved' : 'Save'}
                </button>
              ) : (
                <Link to={ROUTES.LOGIN} state={{ from: loginReturnPath }} className={APPLY_BTN_SECONDARY}>Sign in to save</Link>
              )}
              <button
                type="button"
                className={APPLY_BTN_SECONDARY}
                onClick={async () => {
                  const url = typeof window !== 'undefined' ? window.location.href : '';
                  try {
                    if (navigator.share) await navigator.share({ title: data.name, url });
                    else await navigator.clipboard.writeText(url);
                    setShareStatus('Link copied');
                  } catch { setShareStatus(''); }
                }}
              >
                Share
              </button>
              {shareStatus ? <span className="text-xs text-gray-500 self-center">{shareStatus}</span> : null}
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {data.degreeLevel && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Degree</p>
                  <p className="text-gray-900 dark:text-white capitalize">{DEGREE_LABELS[data.degreeLevel] || data.degreeLevel}</p>
                </div>
              )}
              {data.field && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Field</p>
                  <p className="text-gray-900 dark:text-white capitalize">{FIELD_LABELS[data.field] || data.field}</p>
                </div>
              )}
              {data.studyMode && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Study Mode</p>
                  <p className="text-gray-900 dark:text-white">{STUDY_MODE_LABELS[data.studyMode] || data.studyMode}</p>
                </div>
              )}
              {data.durationMonths && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Duration</p>
                  <p className="text-gray-900 dark:text-white">{data.durationMonths} months</p>
                </div>
              )}
              {data.campus && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Campus</p>
                  <p className="text-gray-900 dark:text-white">{data.campus}</p>
                </div>
              )}
              {data.country && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Country</p>
                  <p className="text-gray-900 dark:text-white">{countryDisplayName(data.country) || data.country}</p>
                </div>
              )}
            </div>

            {/* Tuition */}
            {data.tuition?.amountMinor != null && (
              <div className="mt-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 px-4 py-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Tuition</h2>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatMoney(data.tuition)}
                  {data.tuition.per ? <span className="text-sm font-normal text-gray-500 ml-1">/ {data.tuition.per}</span> : ''}
                </p>
                {data.tuition.currency && data.tuition.currency !== 'USD' && (
                  <p className="text-xs text-gray-400 mt-0.5">{data.tuition.currency}</p>
                )}
                {data.tuition.notes && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{data.tuition.notes}</p>
                )}
              </div>
            )}

            <div className="mt-5 flex gap-3 flex-wrap">
              {primaryApplyIntake ? (
                <ProgramApplyActions
                  programId={data._id}
                  intake={primaryApplyIntake}
                  isAuthenticated={isAuthenticated}
                  loginReturnPath={loginReturnPath}
                />
              ) : null}
              {data.officialProgramUrl && (
                <a href={data.officialProgramUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center min-h-[44px] text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors">
                  Official Program Page ↗
                </a>
              )}
              {data.admissionRequirementsUrl && (
                <a href={data.admissionRequirementsUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center min-h-[44px] text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors">
                  Admission Requirements ↗
                </a>
              )}
            </div>
          </div>

          {/* Intakes */}
          {data.intakes?.length > 0 && (
            <Section title="Intakes">
              <div className="space-y-2">
                {data.intakes.map((intake, i) => {
                  const open = intake.applicationOpenDate || formatPublicDateOnly(intake.applicationOpenAt);
                  const deadline = intake.deadlineDate || formatPublicDateOnly(intake.deadlineAt);
                  const start = intake.startDate || null;
                  const mode = intake.applicationMode || 'not_configured';
                  return (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white break-words-safe">{intake.cycleLabel || 'Intake'}</div>
                      <div className="text-gray-500 dark:text-gray-400 mt-0.5 space-y-1">
                        <p>Opens: {open || NOT_SPECIFIED}</p>
                        <p>Deadline: {deadline || NOT_SPECIFIED}</p>
                        <p>Start: {start || NOT_SPECIFIED}</p>
                        <p>Application: {APPLICATION_MODE_LABELS[mode] || NOT_SPECIFIED}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ProgramApplyActions
                          programId={data._id}
                          intake={intake}
                          isAuthenticated={isAuthenticated}
                          loginReturnPath={loginReturnPath}
                        />
                      </div>
                      {intake.notes && <div className="text-xs text-gray-400 mt-0.5">{intake.notes}</div>}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Requirements */}
          {requirements.length > 0 && (
            <Section title="Admission Requirements">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {requirements.map((r) => (
                  <div key={r._id} className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {REQ_TYPE_LABELS[r.requirementType] || r.requirementType}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REQ_SEMANTICS_COLORS[r.semantics] || ''}`}>
                        {r.semantics}
                      </span>
                      {r.testId?.abbreviation && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{r.testId.abbreviation}</span>
                      )}
                    </div>
                    {r.minimumScore != null && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">Minimum score: {r.minimumScore}</p>
                    )}
                    {r.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{r.description}</p>
                    )}
                    {r.semantics === 'conditional' && r.conditionNote && (
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">Condition: {r.conditionNote}</p>
                    )}
                    {r.intake && <p className="text-xs text-gray-400 mt-0.5">Intake: {r.intake}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {acceptanceFallback?.data?.length > 0 && acceptedTests.length === 0 && (
            <Section title="Accepted tests (institution-level guidance)">
              <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">{acceptanceFallback.label || fallbackScopeLabel(ACCEPTANCE_SCOPES.INSTITUTION)}</p>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {acceptanceFallback.data.map((at) => (
                  <div key={at._id} className="px-4 py-3 text-sm">
                    <span className="font-medium">{at.testId?.name || 'Test'}</span>
                    {(() => {
                      const STATUS_LABEL = { accepted: 'Accepted', conditional: 'Conditional', not_accepted: 'Not Accepted', case_by_case: 'Case by Case', unknown: 'Unknown' };
                      return <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{STATUS_LABEL[at.acceptanceStatus] || at.acceptanceStatus}</span>;
                    })()}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Accepted tests — Mission 6 */}
          {acceptedTests.length > 0 && (
            <Section title="Accepted Language / Admissions Tests">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {acceptedTests.map((at) => (
                  <div key={at._id} className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {at.testId?.name || 'Test'}
                      </span>
                      {(() => {
                        const STATUS_UI = {
                          accepted: { label: 'Accepted', cls: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
                          conditional: { label: 'Conditional', cls: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' },
                          not_accepted: { label: 'Not Accepted', cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' },
                          case_by_case: { label: 'Case by Case', cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
                          unknown: { label: 'Status Unknown', cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
                        };
                        const ui = STATUS_UI[at.acceptanceStatus] || { label: at.acceptanceStatus, cls: 'bg-gray-100 dark:bg-gray-700 text-gray-500' };
                        return <span className={`text-xs px-2 py-0.5 rounded-full ${ui.cls}`}>{ui.label}</span>;
                      })()}
                    </div>
                    {at.minimumOverallScore != null && (
                      <p className="text-gray-500 dark:text-gray-400 mt-0.5">Overall: {at.minimumOverallScore}</p>
                    )}
                    {Array.isArray(at.sectionMinimums) && at.sectionMinimums.length > 0 && (
                      <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                        {at.sectionMinimums.map((sec) => (
                          <li key={`${sec.sectionName}-${sec.minimum}`}>
                            {sec.sectionName}: {sec.minimum}{sec.scale ? ` (${sec.scale})` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    {at.resultValidityMonths != null && (
                      <p className="text-xs text-gray-500 mt-0.5">Validity: {at.resultValidityMonths} months</p>
                    )}
                    {at.conditions && (
                      <p className="text-xs text-gray-400 mt-0.5">{at.conditions}</p>
                    )}
                    {at.lastVerifiedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Verified {new Date(at.lastVerifiedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Related scholarships */}
          {relatedScholarships.length > 0 && (
            <Section title="Related Scholarships">
              <div className="space-y-2">
                {relatedScholarships.map((s) => {
                  const scholarshipPath = resolveScholarshipDetailPath({
                    ...s,
                    sourceType: 'institution_canonical',
                  });
                  if (!scholarshipPath) return null;
                  return (
                  <Link
                    key={s._id}
                    to={scholarshipPath}
                    className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 hover:shadow-sm transition-shadow text-sm"
                  >
                    <span className="font-medium text-gray-800 dark:text-gray-200">{s.title}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                      {s['funding.type'] || s.funding?.type || ''}
                    </span>
                  </Link>
                  );
                })}
              </div>
            </Section>
          )}

          {relatedPrograms.length > 0 && (
            <Section title="Related Programs">
              <div className="space-y-2">
                {relatedPrograms.map((program) => (
                  <Link
                    key={program._id}
                    to={`${ROUTES.PROGRAM_EXPLORER}/${program.slug}`}
                    className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 hover:shadow-sm transition-shadow text-sm"
                  >
                    <span className="font-medium text-gray-800 dark:text-gray-200">{program.name}</span>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {relatedResources.length > 0 && (
            <RelatedResources
              title="Explore related resources"
              items={relatedResources}
              maxItems={4}
              variant="list"
              className="!mt-0 !pt-0 !border-0"
            />
          )}

          {/* Source */}
          {data.lastVerifiedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Last verified: {new Date(data.lastVerifiedAt).toLocaleDateString()}
            </p>
          )}
          <ProvenanceStrip
            className="mt-4"
            authorityLabel={data.authorityLabel}
            lastReviewedAt={data.lastVerifiedAt}
            freshnessState={data.freshnessState}
            officialUrl={data.officialProgramUrl}
          />
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {NO_GUARANTEE_DISCLAIMER}
          </p>
        </div>
      </div>
    </>
  );
}
