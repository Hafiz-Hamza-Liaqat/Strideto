/**
 * BudgetPlanDetailPage — Mission 20.
 *
 * Plan detail view:
 *   - Cost summary (grouped by currency)
 *   - Known / estimated / unknown breakdown
 *   - Funding gap (same-currency only)
 *   - Affordability state (qualified language only)
 *   - Cost item list by category
 *   - Add/edit student estimate items
 *   - Freshness warnings on stale items
 *   - Refresh canonical items
 *   - Stale tuition warning
 *   - Multi-currency unresolved notice
 *   - Budget snapshot management
 *
 * Language principle: "Based on currently known costs" — never "affordable".
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants';

const API_BASE = '/api';

const TRUTH_LABELS = {
  verified: { label: 'Source-backed', cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  institution_official: { label: 'Institution Official', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  government_official: { label: 'Government Official', cls: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
  student_entered: { label: 'Your Estimate', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  strideto_estimate: { label: 'Strideto Estimate', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  derived: { label: 'Calculated', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  unknown: { label: 'Unknown', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

const FRESHNESS_WARNINGS = {
  stale: 'This cost is stale — verify current value.',
  broken: 'This cost source is broken — verify current value.',
  review_due: 'This cost is due for review.',
};

const AFFORDABILITY_DISPLAY = {
  within_budget: { label: 'Within budget', cls: 'text-green-700 dark:text-green-400' },
  near_budget: { label: 'Near budget limit', cls: 'text-yellow-600 dark:text-yellow-400' },
  over_budget: { label: 'Exceeds stated budget', cls: 'text-red-600 dark:text-red-400' },
  insufficient_information: { label: 'Insufficient information', cls: 'text-gray-500 dark:text-gray-400' },
  multi_currency_unresolved: { label: 'Multiple currencies — cannot compare', cls: 'text-orange-600 dark:text-orange-400' },
};

const CATEGORY_GROUPS = {
  Academic: ['tuition', 'application_fee', 'enrollment_deposit'],
  Tests: ['test_fee', 'test_preparation'],
  Documents: ['document_fee', 'credential_evaluation'],
  Immigration: ['visa_application_fee', 'immigration_health_fee', 'biometrics', 'medical_exam'],
  Travel: ['flight_travel', 'local_transport'],
  Living: ['accommodation', 'food', 'utilities', 'books_materials', 'technology', 'living_expenses', 'insurance'],
  Services: ['agent_service', 'consultation', 'professional_service'],
  Other: ['emergency_buffer', 'other'],
};

function formatMinorUnits(amountMinor, currency) {
  // Simple display — no locale assumptions beyond currency
  return `${currency} ${amountMinor}`;
}

function groupItems(items) {
  const grouped = {};
  for (const [groupName, cats] of Object.entries(CATEGORY_GROUPS)) {
    const groupItems = items.filter((i) => cats.includes(i.category));
    if (groupItems.length > 0) grouped[groupName] = groupItems;
  }
  const uncategorized = items.filter((i) => !Object.values(CATEGORY_GROUPS).flat().includes(i.category));
  if (uncategorized.length > 0) grouped['Uncategorized'] = uncategorized;
  return grouped;
}

export default function BudgetPlanDetailPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemForm, setAddItemForm] = useState({
    category: 'other',
    label: '',
    amountState: 'estimated',
    amountMinor: '',
    currency: '',
    cadence: 'one_time',
    notes: '',
  });
  const [addItemError, setAddItemError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [planRes, summaryRes, itemsRes] = await Promise.all([
        fetch(`${API_BASE}/budget/plans/${planId}`, { credentials: 'include' }),
        fetch(`${API_BASE}/budget/plans/${planId}/summary`, { credentials: 'include' }),
        fetch(`${API_BASE}/budget/plans/${planId}/items`, { credentials: 'include' }),
      ]);
      if (!planRes.ok) throw new Error('Plan not found or access denied');
      const [planData, summaryData, itemsData] = await Promise.all([
        planRes.json(), summaryRes.json(), itemsRes.json(),
      ]);
      setPlan(planData.plan);
      setSummary(summaryData.summary);
      setItems(itemsData.items || []);
    } catch (e) {
      setError(e.message || 'Failed to load plan.');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  const handleRemoveItem = async (itemId) => {
    if (!window.confirm('Remove this cost item?')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/budget/plans/${planId}/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove item');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshItem = async (itemId) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/budget/plans/${planId}/items/${itemId}/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Refresh failed'); }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setAddItemError('');
    if (!addItemForm.label.trim()) { setAddItemError('Label is required.'); return; }

    const body = {
      category: addItemForm.category,
      label: addItemForm.label.trim(),
      amountState: addItemForm.amountState,
      cadence: addItemForm.cadence,
      truthCategory: 'student_entered',
      studentEditable: true,
      notes: addItemForm.notes,
    };

    if (addItemForm.amountState !== 'unknown') {
      const minor = parseInt(addItemForm.amountMinor, 10);
      if (!Number.isSafeInteger(minor)) { setAddItemError('Amount must be an integer (minor units, e.g. 150000 for USD 1500.00).'); return; }
      if (!addItemForm.currency || addItemForm.currency.length !== 3) { setAddItemError('Currency must be a 3-letter ISO code.'); return; }
      body.money = { amountMinor: minor, currency: addItemForm.currency.toUpperCase() };
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/budget/plans/${planId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add item');
      setShowAddItem(false);
      setAddItemForm({ category: 'other', label: '', amountState: 'estimated', amountMinor: '', currency: '', cadence: 'one_time', notes: '' });
      await load();
    } catch (e) {
      setAddItemError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-500">Loading…</div>;
  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">{error}</div>
      <Link to={ROUTES.BUDGET} className="mt-4 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline">← Back</Link>
    </div>
  );

  const grouped = groupItems(items);
  const isArchived = plan?.status === 'archived';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-4">
        <Link to={ROUTES.BUDGET} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">← Budget Planner</Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{plan?.title}</h1>
          {plan?.programTitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Program: {plan.programTitle}</p>}
          {plan?.targetIntake && <p className="text-sm text-gray-500 dark:text-gray-400">Intake: {plan.targetIntake}</p>}
        </div>
        {isArchived && (
          <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 flex-shrink-0">Archived</span>
        )}
      </div>

      {/* Summary box */}
      {summary && (
        <div className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">Cost Summary</h2>

          <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded px-3 py-2 mb-3">
            {summary.note}
          </div>

          {/* Totals by currency */}
          {Object.keys(summary.totalsByCurrency).length > 0 ? (
            <div className="mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Known totals (by currency)</p>
              <div className="space-y-1">
                {Object.entries(summary.totalsByCurrency).map(([currency, amt]) => (
                  <div key={currency} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{currency}</span>
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{amt.toLocaleString()} minor units</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No known amounts added yet.</p>
          )}

          {summary.multiCurrencyUnresolved && (
            <div className="mb-3 text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 rounded px-3 py-2">
              Multiple currencies detected. Totals cannot be combined without an explicit exchange rate.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded bg-gray-100 dark:bg-gray-700">
              <p className="text-gray-500 dark:text-gray-400">Unknown costs</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">{summary.unknownCostCount}</p>
            </div>
            <div className="p-2 rounded bg-gray-100 dark:bg-gray-700">
              <p className="text-gray-500 dark:text-gray-400">Estimated items</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">{summary.estimatedCostCount}</p>
            </div>
            <div className="p-2 rounded bg-gray-100 dark:bg-gray-700">
              <p className="text-gray-500 dark:text-gray-400">Stale items</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">{summary.dataQuality?.staleCount || 0}</p>
            </div>
          </div>

          {/* Affordability */}
          {summary.budgetGap && (
            <div className="mt-3 p-3 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Budget comparison (same currency)</p>
              <p className={`text-sm font-semibold ${AFFORDABILITY_DISPLAY[summary.budgetGap.affordabilityState]?.cls || ''}`}>
                {AFFORDABILITY_DISPLAY[summary.budgetGap.affordabilityState]?.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{summary.budgetGap.explanation}</p>
            </div>
          )}

          {/* Completeness */}
          {summary.completeness?.missing?.length > 0 && (
            <div className="mt-3 text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded px-3 py-2">
              Missing required categories: {summary.completeness.missing.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Cost Items */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Cost Items</h2>
        {!isArchived && (
          <button
            onClick={() => setShowAddItem((v) => !v)}
            className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {showAddItem ? 'Cancel' : '+ Add Cost'}
          </button>
        )}
      </div>

      {/* Add item form */}
      {showAddItem && (
        <div className="mb-6 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Add Your Estimate</h3>
          {addItemError && <div className="mb-3 text-xs text-red-600 dark:text-red-400">{addItemError}</div>}
          <form onSubmit={handleAddItem} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
                <select
                  value={addItemForm.category}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  {Object.values(CATEGORY_GROUPS).flat().map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount State</label>
                <select
                  value={addItemForm.amountState}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, amountState: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="estimated">Estimated</option>
                  <option value="known">Known</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Label *</label>
              <input
                type="text"
                maxLength={300}
                value={addItemForm.label}
                onChange={(e) => setAddItemForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Monthly accommodation — London"
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            {addItemForm.amountState !== 'unknown' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Amount (minor units) <span className="text-gray-400">e.g. 150000 = 1500.00</span>
                  </label>
                  <input
                    type="number"
                    step={1}
                    value={addItemForm.amountMinor}
                    onChange={(e) => setAddItemForm((f) => ({ ...f, amountMinor: e.target.value }))}
                    placeholder="150000"
                    className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Currency (ISO 3-letter)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={addItemForm.currency}
                    onChange={(e) => setAddItemForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    placeholder="GBP"
                    className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cadence</label>
              <select
                value={addItemForm.cadence}
                onChange={(e) => setAddItemForm((f) => ({ ...f, cadence: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {['one_time','monthly','yearly','semester','term','weekly','daily','custom','unknown'].map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes (optional)</label>
              <textarea
                maxLength={2000}
                value={addItemForm.notes}
                onChange={(e) => setAddItemForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded px-3 py-2">
              This will be saved as "Your Estimate" — it does not represent official or verified data.
            </div>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Add Item'}
            </button>
          </form>
        </div>
      )}

      {/* Item groups */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
          No cost items yet. Add your first estimate above.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([groupName, groupItems]) => (
            <div key={groupName}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{groupName}</h3>
              <div className="space-y-2">
                {groupItems.map((item) => (
                  <div key={item._id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
                          {item.truthCategory && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${TRUTH_LABELS[item.truthCategory]?.cls || 'bg-gray-100 text-gray-600'}`}>
                              {TRUTH_LABELS[item.truthCategory]?.label || item.truthCategory}
                            </span>
                          )}
                          {item.freshness && FRESHNESS_WARNINGS[item.freshness] && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                              ⚠ {item.freshness}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-mono">
                          {item.amountState === 'unknown' ? (
                            <span className="text-red-600 dark:text-red-400 font-semibold">Amount unknown</span>
                          ) : item.money ? (
                            <span className="text-gray-800 dark:text-gray-200">
                              {item.money.currency} {item.money.amountMinor.toLocaleString()} minor units
                              {item.cadence && item.cadence !== 'one_time' && <span className="text-gray-400"> /{item.cadence}</span>}
                            </span>
                          ) : null}
                        </div>
                        {item.freshness && FRESHNESS_WARNINGS[item.freshness] && (
                          <p className="mt-0.5 text-xs text-orange-600 dark:text-orange-400">{FRESHNESS_WARNINGS[item.freshness]}</p>
                        )}
                        {item.notes && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.notes}</p>}
                      </div>
                      {!isArchived && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          {item.truthCategory !== 'student_entered' && ['stale','broken'].includes(item.freshness) && (
                            <button
                              onClick={() => handleRefreshItem(item._id)}
                              disabled={busy}
                              className="text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                              Refresh
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveItem(item._id)}
                            disabled={busy}
                            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assumptions */}
      {plan?.assumptions?.length > 0 && (
        <div className="mt-8 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Assumptions</h2>
          <ul className="list-disc list-inside space-y-1">
            {plan.assumptions.map((a, i) => <li key={i} className="text-xs text-gray-600 dark:text-gray-400">{a}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
