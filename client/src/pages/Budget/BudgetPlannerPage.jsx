/**
 * BudgetPlannerPage — Mission 20.
 *
 * Authenticated Student Budget / Cost Planner.
 *
 * Features:
 *   - List cost plans (paginated)
 *   - Create new plan
 *   - Navigate to plan detail, comparison
 *   - Archive plan
 *   - Clone scenario
 *
 * Boundaries:
 *   - Student auth required (ProtectedRoute wraps this page)
 *   - No Agent / Institution / Employer access
 *   - No live FX / cost APIs
 *   - No financial advice language
 *   - No Commerce mutation
 *
 * Language principle: "Based on currently known costs" — never "You can afford this."
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { budgetApi } from '../../services/budgetApi';

const STATUS_LABELS = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-700' },
  active: { label: 'Active', cls: 'bg-green-100 text-green-800' },
  archived: { label: 'Archived', cls: 'bg-yellow-100 text-yellow-800' },
};

const JOURNEY_LABELS = {
  study: 'Study',
  work: 'Work',
  visit: 'Visit',
  research: 'Research',
  other: 'Other',
};

export default function BudgetPlannerPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await budgetApi.listPlans({ page: p, limit: 20 });
      setPlans(data.plans || []);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e) {
      setError(e.message || 'Failed to load cost plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const handleArchive = useCallback(async (planId) => {
    if (!window.confirm('Archive this plan? You can still view it.')) return;
    setBusy(true);
    try {
      await budgetApi.archivePlan(planId);
      await load(page);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [load, page]);

  const handleClone = useCallback(async (planId) => {
    setBusy(true);
    try {
      const { data } = await budgetApi.clonePlan(planId);
      navigate(ROUTES.BUDGET_DETAIL.replace(':planId', data.plan._id));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }, [navigate]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Budget Planner</h1>
        <div className="flex flex-wrap gap-2">
          {plans.length >= 2 && (
            <Link
              to={ROUTES.BUDGET_COMPARE}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Compare Plans
            </Link>
          )}
          <Link
            to={ROUTES.BUDGET_NEW}
            className="inline-flex min-h-[44px] items-center px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            New Plan
          </Link>
        </div>
      </div>

      <div className="mb-4 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-200">
        Plan your journey costs. Amounts are for planning only — not financial advice. Unknown costs are shown separately.
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading your cost plans…</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No cost plans yet.</p>
          <Link
            to={ROUTES.BUDGET_NEW}
            className="px-5 py-2.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
          >
            Create your first plan
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {plans.map((plan) => (
              <li key={plan._id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={ROUTES.BUDGET_DETAIL.replace(':planId', plan._id)}
                      className="font-semibold text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-1"
                    >
                      {plan.title}
                    </Link>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_LABELS[plan.status]?.cls || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[plan.status]?.label || plan.status}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
                        {JOURNEY_LABELS[plan.journeyType] || plan.journeyType}
                      </span>
                      {plan.destinationCountry && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
                          {plan.destinationCountry}
                        </span>
                      )}
                      {plan.targetIntake && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
                          {plan.targetIntake}
                        </span>
                      )}
                    </div>
                    {plan.programTitle && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Program: {plan.programTitle}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Updated {new Date(plan.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {plan.status !== 'archived' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleClone(plan._id)}
                        disabled={busy}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-2 py-1 rounded border border-gray-200 dark:border-gray-600"
                      >
                        Clone
                      </button>
                      <button
                        onClick={() => handleArchive(plan._id)}
                        disabled={busy}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded border border-gray-200 dark:border-gray-600"
                      >
                        Archive
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {total > 20 && (
            <div className="mt-6 flex justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => load(page - 1)}
                className="px-3 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-500">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => load(page + 1)}
                className="px-3 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
