/**
 * Eligibility Detail page (Mission 8).
 *
 * Shows per-criterion breakdown for a program or scholarship.
 * Keeps FACT / STRIDETO MATCH / UNKNOWN visually distinct.
 * No admission probability language.
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { personalizationApi } from '../../services/personalizationApi';
import { ROUTES } from '../../constants';

const STATE_CONFIG = {
  pass: { label: 'Pass', icon: '✓', cls: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' },
  fail: { label: 'Fail', icon: '✗', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800' },
  unknown: { label: 'Unknown', icon: '?', cls: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' },
  manual_review: { label: 'Needs Review', icon: '⚡', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800' },
  missing_profile_data: { label: 'Info Missing', icon: '!', cls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800' },
};

const OVERALL_CONFIG = {
  eligible: { label: 'Meets Criteria', cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
  potentially_eligible: { label: 'Potentially Eligible', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' },
  not_eligible: { label: 'Does Not Meet Criteria', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
  insufficient_information: { label: 'Insufficient Information', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  requires_manual_review: { label: 'Requires Manual Review', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
};

function CriterionRow({ criterion }) {
  const state = criterion.state || 'unknown';
  const cfg = STATE_CONFIG[state] || STATE_CONFIG.unknown;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${cfg.cls}`}>
      <span className="text-lg font-bold shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{criterion.label}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${cfg.cls}`}>{cfg.label}</span>
          {criterion.isOptional && (
            <span className="text-xs text-gray-500 dark:text-gray-400">(optional)</span>
          )}
        </div>
        {criterion.requirement && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            Requirement: <span className="font-medium">{criterion.requirement}</span>
          </p>
        )}
        {criterion.profileValue && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Your value: <span className="font-medium">{criterion.profileValue}</span>
          </p>
        )}
        {criterion.freshnessWarning && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            ⚠ {criterion.freshnessWarning}
          </p>
        )}
      </div>
    </div>
  );
}

function MatchComponentRow({ componentKey, comp }) {
  const pct = Math.round(comp.score * 100);
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600';
  const label = componentKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-700 dark:text-gray-300 font-medium">{label}</span>
        <span className="text-gray-500 dark:text-gray-400">
          {pct}% (weight {Math.round(comp.weight * 100)}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">{comp.reason.replace(/_/g, ' ')}</p>
    </div>
  );
}

export function EligibilityDetailPage({ opportunityType }) {
  const { programId, scholarshipId } = useParams();
  const id = programId || scholarshipId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    const fetchFn = opportunityType === 'scholarship'
      ? personalizationApi.scholarshipEligibility(id)
      : personalizationApi.programEligibility(id);

    fetchFn
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Could not load eligibility.'))
      .finally(() => setLoading(false));
  }, [id, opportunityType]);

  if (loading) return <div className="py-16 text-center text-sm text-gray-500">Evaluating eligibility…</div>;
  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      <Link to={ROUTES.TALENT_PROFILE} className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline text-sm">
        Complete your profile to unlock eligibility evaluation →
      </Link>
    </div>
  );

  const { eligibility, match, gaps } = data || {};
  const overallCfg = OVERALL_CONFIG[eligibility?.overallState] || OVERALL_CONFIG.insufficient_information;

  return (
    <>
      <SeoHead title="Eligibility Detail | Strideto" noindex />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to={-1} className="text-sm text-gray-500 dark:text-gray-400 hover:underline">← Back</Link>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Eligibility Breakdown
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Evaluated at: {eligibility?.evaluatedAt ? new Date(eligibility.evaluatedAt).toLocaleString() : '—'}
          </p>
        </div>

        {/* Overall state */}
        <div className={`px-4 py-3 rounded-xl ${overallCfg.cls}`}>
          <div className="text-sm font-semibold">{overallCfg.label}</div>
          <div className="text-xs mt-0.5 opacity-80">
            Unknown information does not automatically mean ineligible.
            Always verify requirements directly with the institution.
          </div>
        </div>

        {/* Criterion checklist */}
        {eligibility?.evaluatedCriteria?.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Requirement Checklist</h2>
            <div className="space-y-2">
              {eligibility.evaluatedCriteria.map((cr, i) => (
                <CriterionRow key={cr.key || i} criterion={cr} />
              ))}
            </div>
          </section>
        )}

        {/* Freshness warnings */}
        {eligibility?.freshnessWarnings?.length > 0 && (
          <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            <strong>Source data warning:</strong> Some requirements may be outdated.
            Verify directly with the institution before applying.
          </div>
        )}

        {/* Match score breakdown */}
        {match && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Strideto Match Score: {match.score}%
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{match.note}</p>
            <div className="space-y-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              {Object.entries(match.components || {}).map(([key, comp]) => (
                <MatchComponentRow key={key} componentKey={key} comp={comp} />
              ))}
            </div>
          </section>
        )}

        {/* Gaps */}
        {gaps?.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Gaps &amp; Missing Information</h2>
            <div className="space-y-2">
              {gaps.map((gap) => (
                <div key={gap.key} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{gap.label}</span>
                      <span className="text-xs text-gray-500 capitalize">{gap.severity}</span>
                    </div>
                    {gap.requirement && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Requirement: {gap.requirement}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Profile improvement CTA */}
        <div className="flex items-center justify-between pt-2">
          <Link to={ROUTES.TALENT_PROFILE} className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            Improve Profile →
          </Link>
          <Link to="/personalization" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
            Back to recommendations
          </Link>
        </div>
      </div>
    </>
  );
}

export default EligibilityDetailPage;
