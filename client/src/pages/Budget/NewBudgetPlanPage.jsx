/**
 * NewBudgetPlanPage — Mission 20.
 *
 * Create a new Student Cost Plan.
 * All fields are validated client-side before submission.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { budgetApi } from '../../services/budgetApi';

const JOURNEY_TYPES = [
  { value: 'study', label: 'Study Abroad' },
  { value: 'work', label: 'Work Abroad' },
  { value: 'visit', label: 'Visit' },
  { value: 'research', label: 'Research' },
  { value: 'other', label: 'Other' },
];

export default function NewBudgetPlanPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    journeyType: 'study',
    destinationCountry: '',
    targetIntake: '',
    planningHorizonMonths: '',
    displayCurrency: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Plan title is required.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const body = {
        title: form.title.trim(),
        journeyType: form.journeyType,
      };
      if (form.destinationCountry.trim()) body.destinationCountry = form.destinationCountry.trim().toUpperCase();
      if (form.targetIntake.trim()) body.targetIntake = form.targetIntake.trim();
      if (form.planningHorizonMonths) body.planningHorizonMonths = parseInt(form.planningHorizonMonths, 10);
      if (form.displayCurrency.trim()) body.displayCurrency = form.displayCurrency.trim().toUpperCase();

      const { data } = await budgetApi.createPlan(body);
      navigate(ROUTES.BUDGET_DETAIL.replace(':planId', data.plan._id));
    } catch (e) {
      setError(e.message || 'Failed to create plan.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to={ROUTES.BUDGET} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          ← Budget Planner
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">New Cost Plan</h1>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Plan Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            maxLength={200}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. MSc Computer Science — UK 2025"
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Journey Type</label>
          <select
            value={form.journeyType}
            onChange={(e) => set('journeyType', e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {JOURNEY_TYPES.map((jt) => (
              <option key={jt.value} value={jt.value}>{jt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Destination Country <span className="text-gray-400 text-xs">(ISO 2-letter code, e.g. GB, CA, AU)</span>
          </label>
          <input
            type="text"
            maxLength={2}
            value={form.destinationCountry}
            onChange={(e) => set('destinationCountry', e.target.value.toUpperCase())}
            placeholder="e.g. GB"
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Intake</label>
          <input
            type="text"
            maxLength={100}
            value={form.targetIntake}
            onChange={(e) => set('targetIntake', e.target.value)}
            placeholder="e.g. Fall 2025, January 2026"
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Planning Horizon <span className="text-gray-400 text-xs">(months — used for recurring cost estimates)</span>
          </label>
          <input
            type="number"
            min={1}
            max={120}
            value={form.planningHorizonMonths}
            onChange={(e) => set('planningHorizonMonths', e.target.value)}
            placeholder="e.g. 24"
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Display Currency <span className="text-gray-400 text-xs">(ISO code — does not convert amounts)</span>
          </label>
          <input
            type="text"
            maxLength={3}
            value={form.displayCurrency}
            onChange={(e) => set('displayCurrency', e.target.value.toUpperCase())}
            placeholder="e.g. USD, GBP, PKR"
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating…' : 'Create Plan'}
          </button>
          <Link
            to={ROUTES.BUDGET}
            className="px-5 py-2.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
