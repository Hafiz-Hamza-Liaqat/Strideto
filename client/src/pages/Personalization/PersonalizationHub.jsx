/**
 * Personalization Hub (Mission 8).
 *
 * Entry point for the student personalization experience:
 * - Gap analysis / profile completeness
 * - Recommended programs
 * - Recommended scholarships
 *
 * No AI. No admission probability. Deterministic, explainable results.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { useAuth } from '../../context/AuthContext';
import { personalizationApi } from '../../services/personalizationApi';
import { ROUTES } from '../../constants';
import { Pagination } from '../../components/ui/Pagination';

const ELIGIBILITY_STATE_LABELS = {
  eligible: 'Meets Criteria',
  potentially_eligible: 'Potentially Eligible',
  not_eligible: 'Does Not Meet Criteria',
  insufficient_information: 'Needs More Info',
  requires_manual_review: 'Needs Review',
};

const ELIGIBILITY_STATE_COLORS = {
  eligible: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
  potentially_eligible: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  not_eligible: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  insufficient_information: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  requires_manual_review: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800',
};

const GAP_SEVERITY_COLORS = {
  critical: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
  major: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
  minor: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
  info: 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700',
};

const GAP_SEVERITY_LABELS = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  info: 'Info',
};

function GuidanceOverview() {
  const { isAuthenticated, hasStudentCapability: studentCapable, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || authLoading || !studentCapable) {
      setLoading(false);
      return undefined;
    }
    personalizationApi.guidance()
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load your guidance overview.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, authLoading, studentCapable]);

  if (loading) return <div className="py-10 text-center text-sm text-gray-500">Loading your guidance overview…</div>;
  if (error) return <div className="py-6 text-sm text-red-600 dark:text-red-400">{error}</div>;
  if (!data) return null;

  const context = data.studentContextSummary || {};
  const readiness = data.readiness?.items || [];
  const applicationReadiness = data.applicationReadiness || {};
  const actions = data.nextActions || [];
  const recommendations = [
    ...(data.recommendations?.programs || []).slice(0, 3),
    ...(data.recommendations?.scholarships || []).slice(0, 2),
    ...(data.recommendations?.institutions || []).slice(0, 2),
  ];
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Your guidance snapshot</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
          {context.known?.studyLevel && <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-1">Level: {context.known.studyLevel}</span>}
          {context.known?.fieldsOfStudy?.map((field) => <span key={field} className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-1">Field: {field}</span>)}
          {context.known?.destinations?.map((country) => <span key={country} className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-1">Destination: {country}</span>)}
        </div>
        {context.missing?.length > 0 && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Still unknown: {context.missing.join(', ').replace(/_/g, ' ')}.</p>}
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Next actions</h2>
        {actions.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">No profile actions are currently identified.</p> : (
          <div className="space-y-2">{actions.map((action) => <GapItem key={action.key} gap={action} />)}</div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Readiness</h2>
        {readiness.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Readiness remains unknown until more profile and opportunity requirements are available.</p> : (
          <div className="space-y-2">{readiness.map((item) => <div key={item.key} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm"><span className="text-gray-800 dark:text-gray-200">{item.label}</span><span className="text-xs text-gray-500 dark:text-gray-400">{item.status}</span></div>)}</div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Applications and deadlines</h2>
        <div className="space-y-2 text-sm">
          {(applicationReadiness.applications || []).length > 0 && <p className="text-gray-600 dark:text-gray-400">Active applications: {applicationReadiness.applications.length}</p>}
          {(applicationReadiness.hardDeadlines || []).length > 0 && <div className="space-y-2">{applicationReadiness.hardDeadlines.slice(0, 5).map((deadline, index) => <div key={`${deadline.title}-${index}`} className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3"><span className="font-medium text-gray-900 dark:text-white">{deadline.title || 'Application deadline'}</span><span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{deadline.deadlineAt ? new Date(deadline.deadlineAt).toLocaleDateString() : 'Date unknown'}</span></div>)}</div>}
          {(applicationReadiness.documents || []).length === 0 && (applicationReadiness.unknownRequirements || []).length === 0 && (applicationReadiness.hardDeadlines || []).length === 0 && <p className="text-gray-600 dark:text-gray-400">Application requirements and deadlines are unknown until a supported application or checklist provides them.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Recommended starting points</h2>
        {recommendations.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">No recommendations can be calculated from the recorded information yet.</p> : (
          <div className="grid gap-3 sm:grid-cols-2">{recommendations.map((item) => <Link key={`${item.id}-${item.url}`} to={item.url || ROUTES.TALENT_PROFILE} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-400"><span className="text-xs text-gray-500 dark:text-gray-400">{item.degreeLevel || 'Opportunity'}</span><span className="mt-1 block font-medium text-gray-900 dark:text-white line-clamp-2">{item.title}</span>{item.match?.score != null && <span className="mt-2 block text-xs text-gray-600 dark:text-gray-400">Preference alignment: {item.match.score}%</span>}</Link>)}</div>
        )}
      </section>
    </div>
  );
}

// ── Match score badge ─────────────────────────────────────────────────────────

function MatchScoreBadge({ score }) {
  const color =
    score >= 70 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
    score >= 40 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score}% match
    </span>
  );
}

// ── Eligibility badge ─────────────────────────────────────────────────────────

function EligibilityBadge({ state }) {
  const color = ELIGIBILITY_STATE_COLORS[state] || ELIGIBILITY_STATE_COLORS.insufficient_information;
  const label = ELIGIBILITY_STATE_LABELS[state] || state;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
}

// ── Freshness warning ─────────────────────────────────────────────────────────

function FreshnessWarning({ warnings }) {
  if (!warnings?.length) return null;
  return (
    <div className="mt-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
      ⚠ Source data may be outdated — verify requirements directly with the institution.
    </div>
  );
}

// ── Gap item ──────────────────────────────────────────────────────────────────

function GapItem({ gap }) {
  const color = GAP_SEVERITY_COLORS[gap.severity] || GAP_SEVERITY_COLORS.info;
  const severityLabel = GAP_SEVERITY_LABELS[gap.severity] || gap.severity;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${color}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{gap.label}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{severityLabel}</span>
        </div>
        {gap.requirement && (
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
            Requirement: {gap.requirement}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────

function RecommendationCard({ rec, detailPath, eligibilityDetailPath }) {
  const { opportunity, eligibility, match, gaps, whyRecommended } = rec;
  const name = opportunity?.name || opportunity?.title || 'Opportunity';
  const topGaps = (gaps || []).slice(0, 3);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2">
            {detailPath ? (
              <Link to={detailPath} className="hover:text-blue-600 dark:hover:text-blue-400">
                {name}
              </Link>
            ) : name}
          </h3>
          {opportunity?.country && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opportunity.country}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <MatchScoreBadge score={match.score} />
          <EligibilityBadge state={eligibility.state} />
        </div>
      </div>

      {/* Strideto match label */}
      <div className="text-xs text-gray-500 dark:text-gray-500 italic">
        Strideto Match — {match.note}
      </div>

      {/* Why recommended */}
      {whyRecommended?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {whyRecommended.map((r, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 text-xs capitalize">
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Criterion summary */}
      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        {eligibility.passedCount > 0 && <span className="text-green-600 dark:text-green-400">✓ {eligibility.passedCount} passed</span>}
        {eligibility.failedCount > 0 && <span className="text-red-600 dark:text-red-400">✗ {eligibility.failedCount} failed</span>}
        {eligibility.unknownCount > 0 && <span>? {eligibility.unknownCount} unknown</span>}
        {eligibility.manualCount > 0 && <span className="text-yellow-600 dark:text-yellow-400">⚡ {eligibility.manualCount} needs review</span>}
      </div>

      {/* Top gaps */}
      {topGaps.length > 0 && (
        <div className="space-y-1.5">
          {topGaps.map((gap) => (
            <GapItem key={gap.key} gap={gap} />
          ))}
        </div>
      )}

      {/* Freshness */}
      <FreshnessWarning warnings={eligibility.freshnessWarnings} />

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        {eligibilityDetailPath && (
          <Link to={eligibilityDetailPath} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
            View eligibility details →
          </Link>
        )}
        <Link to={ROUTES.TALENT_PROFILE} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
          Improve profile
        </Link>
      </div>
    </div>
  );
}

// ── Gap analysis panel ────────────────────────────────────────────────────────

function GapAnalysisPanel() {
  const { isAuthenticated, hasStudentCapability: studentCapable, loading: authLoading } = useAuth();
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || authLoading || !studentCapable) {
      setLoading(false);
      return undefined;
    }
    personalizationApi.gapAnalysis()
      .then((res) => setGaps(res.data?.gaps || []))
      .catch(() => setError('Could not load gap analysis.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, authLoading, studentCapable]);

  if (loading) return <div className="py-6 text-center text-sm text-gray-500">Analysing profile…</div>;
  if (error) return <div className="py-4 text-sm text-red-600 dark:text-red-400">{error}</div>;
  if (gaps.length === 0) return (
    <div className="py-4 text-sm text-green-700 dark:text-green-300">
      Your profile looks complete for personalized recommendations.
    </div>
  );

  return (
    <div className="space-y-2">
      {gaps.map((gap) => <GapItem key={gap.key} gap={gap} />)}
      <div className="pt-2">
        <Link to={ROUTES.TALENT_PROFILE} className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Complete your profile →
        </Link>
      </div>
    </div>
  );
}

// ── Program recommendations tab ───────────────────────────────────────────────

function ProgramTab() {
  const { isAuthenticated, hasStudentCapability: studentCapable, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = (p) => {
    if (!isAuthenticated || authLoading || !studentCapable) return;
    setLoading(true);
    setError(null);
    personalizationApi.programRecommendations({ page: p, limit: 10 })
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load program recommendations.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(page); }, [page, isAuthenticated, authLoading, studentCapable]);

  if (loading) return <div className="py-10 text-center text-sm text-gray-500">Loading recommendations…</div>;
  if (error) return <div className="py-6 text-sm text-red-600 dark:text-red-400">{error}</div>;
  if (!data) return null;

  if (data.results?.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">No program recommendations yet.</p>
        <Link to={ROUTES.TALENT_PROFILE} className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Add study goals to get recommendations →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {data.total} program{data.total !== 1 ? 's' : ''} found. Sorted by match score.
        Results show STRIDETO MATCH only — not admission probability.
      </p>
      {data.results.map((rec, i) => (
        <RecommendationCard
          key={rec.opportunity?._id || i}
          rec={rec}
          detailPath={rec.opportunity?.slug ? `${ROUTES.PROGRAM_EXPLORER}/${rec.opportunity.slug}` : null}
          eligibilityDetailPath={rec.opportunity?._id ? `/personalization/programs/${rec.opportunity._id}/eligibility` : null}
        />
      ))}
      {data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

// ── Scholarship recommendations tab ──────────────────────────────────────────

function ScholarshipTab() {
  const { isAuthenticated, hasStudentCapability: studentCapable, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = (p) => {
    if (!isAuthenticated || authLoading || !studentCapable) return;
    setLoading(true);
    setError(null);
    personalizationApi.scholarshipRecommendations({ page: p, limit: 10 })
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load scholarship recommendations.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(page); }, [page, isAuthenticated, authLoading, studentCapable]);

  if (loading) return <div className="py-10 text-center text-sm text-gray-500">Loading recommendations…</div>;
  if (error) return <div className="py-6 text-sm text-red-600 dark:text-red-400">{error}</div>;
  if (!data) return null;

  if (data.results?.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">No scholarship recommendations yet.</p>
        <Link to={ROUTES.TALENT_PROFILE} className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Add study goals and preferences →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {data.total} scholarship{data.total !== 1 ? 's' : ''} found. Sorted by match score.
        Results show STRIDETO MATCH only — not scholarship award probability.
      </p>
      {data.results.map((rec, i) => (
        <RecommendationCard
          key={rec.opportunity?._id || i}
          rec={rec}
          detailPath={rec.opportunity?.slug ? `${ROUTES.CANONICAL_SCHOLARSHIPS}/${rec.opportunity.slug}` : null}
          eligibilityDetailPath={rec.opportunity?._id ? `/personalization/scholarships/${rec.opportunity._id}/eligibility` : null}
        />
      ))}
      {data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

// ── Main hub ─────────────────────────────────────────────────────────────────

export default function PersonalizationHub() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'programs', label: 'Programs' },
    { key: 'scholarships', label: 'Scholarships' },
    { key: 'gaps', label: 'Profile Gaps' },
  ];

  return (
    <>
      <SeoHead title="My Recommendations | Strideto" noindex />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Recommendations</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Deterministic matches based on your profile. Eligibility is evaluated, not guaranteed.
            Match score reflects preference alignment only.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="mb-6 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
          <strong>About recommendations:</strong> These results are based on your profile and are for guidance only.
          Strideto does not guarantee admission, scholarship awards, or visa outcomes.
          Always verify requirements directly with the institution.
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 sm:flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full px-3 py-3 text-sm font-medium rounded-t transition-colors sm:w-auto sm:px-4 sm:py-2 ${
                activeTab === tab.key
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && <GuidanceOverview />}
        {activeTab === 'programs' && <ProgramTab />}
        {activeTab === 'scholarships' && <ScholarshipTab />}
        {activeTab === 'gaps' && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Profile Gaps
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              These gaps in your profile may reduce the quality and accuracy of recommendations.
            </p>
            <GapAnalysisPanel />
          </div>
        )}
      </div>
    </>
  );
}
