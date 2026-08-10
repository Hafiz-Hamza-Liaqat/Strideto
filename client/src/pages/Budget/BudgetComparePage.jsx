/**
 * BudgetComparePage — Mission 20.
 *
 * Compare two cost plans side-by-side.
 *
 * Safety: Only shows a qualified comparison.
 * Refuses to rank plans as "cheapest" when currencies differ or unknowns exist.
 * Language: deterministic, planning-only.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { arePlansComparable } from '../../../../shared/budget/calculationEngine.js';

const API_BASE = '/api';

export default function BudgetComparePage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedA, setSelectedA] = useState('');
  const [selectedB, setSelectedB] = useState('');
  const [summaryA, setSummaryA] = useState(null);
  const [summaryB, setSummaryB] = useState(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/budget/plans?limit=50`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load plans');
        const data = await res.json();
        setPlans((data.plans || []).filter((p) => p.status !== 'archived'));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCompare = useCallback(async () => {
    if (!selectedA || !selectedB || selectedA === selectedB) {
      setError('Select two different plans to compare.');
      return;
    }
    setComparing(true);
    setError('');
    try {
      const [resA, resB] = await Promise.all([
        fetch(`${API_BASE}/budget/plans/${selectedA}/summary`, { credentials: 'include' }),
        fetch(`${API_BASE}/budget/plans/${selectedB}/summary`, { credentials: 'include' }),
      ]);
      const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);
      setSummaryA(dataA.summary);
      setSummaryB(dataB.summary);
    } catch (e) {
      setError(e.message);
    } finally {
      setComparing(false);
    }
  }, [selectedA, selectedB]);

  const comparability = summaryA && summaryB
    ? arePlansComparable(
        { totals: summaryA.totalsByCurrency, unknownCount: summaryA.unknownCostCount },
        { totals: summaryB.totalsByCurrency, unknownCount: summaryB.unknownCostCount }
      )
    : null;

  if (loading) return <div className="text-center py-16 text-gray-500">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-4">
        <button onClick={() => navigate(ROUTES.BUDGET)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">← Budget Planner</button>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Compare Plans</h1>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="mb-4 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-200">
        Comparison is based on currently known costs only. Unknown costs and currency differences affect reliability.
        This tool does not determine which plan is &quot;cheapest&quot; unless currencies and all costs are fully known.
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan A</label>
          <select
            value={selectedA}
            onChange={(e) => { setSelectedA(e.target.value); setSummaryA(null); setSummaryB(null); }}
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">Select a plan…</option>
            {plans.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan B</label>
          <select
            value={selectedB}
            onChange={(e) => { setSelectedB(e.target.value); setSummaryA(null); setSummaryB(null); }}
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">Select a plan…</option>
            {plans.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={handleCompare}
        disabled={comparing || !selectedA || !selectedB}
        className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {comparing ? 'Comparing…' : 'Compare'}
      </button>

      {summaryA && summaryB && (
        <div className="mt-6">
          {comparability && !comparability.comparable && (
            <div className="mb-4 p-3 rounded-md bg-orange-50 dark:bg-orange-900/20 text-sm text-orange-700 dark:text-orange-300">
              <strong>Cannot rank:</strong> {comparability.reason}
            </div>
          )}
          {comparability?.comparable && (
            <div className="mb-4 p-3 rounded-md bg-green-50 dark:bg-green-900/20 text-sm text-green-700 dark:text-green-300">
              Plans are comparable. {comparability.reason}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {[{ s: summaryA, label: 'Plan A' }, { s: summaryB, label: 'Plan B' }].map(({ s, label }) => (
              <div key={label} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{label}: {s.title}</h3>
                <div className="space-y-1 text-xs">
                  {Object.entries(s.totalsByCurrency || {}).map(([currency, amt]) => (
                    <div key={currency} className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">{currency}</span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{amt.toLocaleString()}</span>
                    </div>
                  ))}
                  {Object.keys(s.totalsByCurrency || {}).length === 0 && (
                    <p className="text-gray-400">No known amounts</p>
                  )}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Unknown costs</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">{s.unknownCostCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Estimated items</span>
                      <span className="font-semibold text-yellow-600 dark:text-yellow-400">{s.estimatedCostCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Stale items</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">{s.dataQuality?.staleCount || 0}</span>
                    </div>
                  </div>
                  {s.multiCurrencyUnresolved && (
                    <p className="text-orange-600 dark:text-orange-400 pt-1">Multi-currency unresolved</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
