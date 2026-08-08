import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';
import { PIPELINE_STAGES } from '@shared/career/constants.js';
import { isEmployerIntelligenceEnabled } from '../../config/careerFeatureFlags';
import { stageLabel } from '../../utils/applicationUi';

const SORT_OPTIONS = [
  { value: 'best_match', labelKey: 'sortBestMatch' },
  { value: 'highest_job_match', labelKey: 'sortJobMatch' },
  { value: 'highest_readiness', labelKey: 'sortReadiness' },
  { value: 'highest_resume_quality', labelKey: 'sortResumeQuality' },
  { value: 'highest_assessment', labelKey: 'sortAssessment' },
  { value: 'newest', labelKey: 'sortNewest' },
];

export default function EmployerCandidates() {
  const { t } = useTranslation(['employer', 'common', 'applications']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [candidates, setCandidates] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    minReadiness: searchParams.get('minReadiness') || '',
    minResumeQuality: searchParams.get('minResumeQuality') || '',
    minProfileCompletion: searchParams.get('minProfileCompletion') || '',
    minJobMatch: searchParams.get('minJobMatch') || '',
    minExperience: searchParams.get('minExperience') || '',
    minAssessmentScore: searchParams.get('minAssessmentScore') || '',
    pipelineStage: searchParams.get('stage') || '',
    skill: searchParams.get('skill') || '',
    verifiedSkill: searchParams.get('verifiedSkill') || '',
    skillCategory: searchParams.get('skillCategory') || '',
    city: searchParams.get('city') || '',
    province: searchParams.get('province') || '',
    education: searchParams.get('education') || '',
    workMode: searchParams.get('workMode') || '',
    jobType: searchParams.get('jobType') || '',
    recentActivityDays: searchParams.get('recentActivityDays') || '',
    sort: searchParams.get('sort') || 'best_match',
    jobId: searchParams.get('jobId') || '',
  });
  const [saveName, setSaveName] = useState('');

  const enabled = isEmployerIntelligenceEnabled();

  const buildQuery = (f = filters) => {
    const q = {};
    Object.entries(f).forEach(([k, v]) => {
      if (v != null && v !== '') q[k] = v;
    });
    if (q.pipelineStage) q.stage = q.pipelineStage;
    return q;
  };

  const load = (override = {}) => {
    setLoading(true);
    setError(null);
    const query = buildQuery({ ...filters, ...override });
    employerApi
      .intelligenceCandidates(query)
      .then(({ data }) => setCandidates(data.data || []))
      .catch((err) => setError(err.response?.data?.error || t('employer:intelligenceLoadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!enabled) return;
    load();
    employerApi.intelligenceSavedFilters().then(({ data }) => setSavedFilters(data.data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const setF = (key, val) => setFilters((prev) => ({ ...prev, [key]: val }));

  const onSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) next.set(k === 'pipelineStage' ? 'stage' : k, v); });
    setSearchParams(next);
    load();
  };

  const onSaveFilter = async () => {
    if (!saveName.trim()) return;
    await employerApi.intelligenceSaveFilter({ name: saveName.trim(), filters: buildQuery() });
    setSaveName('');
    const { data } = await employerApi.intelligenceSavedFilters();
    setSavedFilters(data.data || []);
  };

  const toggleCompare = (id) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  if (!enabled) {
    return <div className="p-6 text-sm text-gray-600">{t('employer:intelligenceDisabled')}</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Helmet>
        <title>{t('employer:candidateListSeoTitle')}</title>
      </Helmet>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('employer:candidateList')}</h1>
        <div className="flex gap-2">
          {compareIds.length >= 2 && (
            <Link
              to={`${ROUTES.EMPLOYER_INTELLIGENCE_COMPARE}?ids=${compareIds.join(',')}`}
              className="text-sm px-3 py-2 rounded-lg bg-primary text-white"
            >
              {t('employer:compareCandidates', { defaultValue: 'Compare' })} ({compareIds.length})
            </Link>
          )}
          <Link to={ROUTES.EMPLOYER_INTELLIGENCE} className="text-sm text-primary dark:text-mint hover:underline">
            {t('employer:intelligenceHeading')}
          </Link>
        </div>
      </div>

      <form onSubmit={onSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <label className="text-sm sm:col-span-2">
          <span className="block text-gray-500 mb-1">{t('employer:searchCandidates')}</span>
          <input value={filters.q} onChange={(e) => setF('q', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t('employer:minReadiness')}</span>
          <input type="number" min="0" max="100" value={filters.minReadiness} onChange={(e) => setF('minReadiness', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t('employer:minResumeQuality', { defaultValue: 'Min resume quality' })}</span>
          <input type="number" min="0" max="100" value={filters.minResumeQuality} onChange={(e) => setF('minResumeQuality', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t('employer:minJobMatch', { defaultValue: 'Min job match %' })}</span>
          <input type="number" min="0" max="100" value={filters.minJobMatch} onChange={(e) => setF('minJobMatch', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t('employer:minProfileCompletion', { defaultValue: 'Min profile %' })}</span>
          <input type="number" min="0" max="100" value={filters.minProfileCompletion} onChange={(e) => setF('minProfileCompletion', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t('employer:pipelineStage', { defaultValue: 'Stage' })}</span>
          <select value={filters.pipelineStage} onChange={(e) => setF('pipelineStage', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700">
            <option value="">{t('common:all', { defaultValue: 'All' })}</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>{stageLabel(t, s)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t('employer:skillFilter', { defaultValue: 'Skill' })}</span>
          <input value={filters.skill} onChange={(e) => setF('skill', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t('employer:city', { defaultValue: 'City' })}</span>
          <input value={filters.city} onChange={(e) => setF('city', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t('employer:province', { defaultValue: 'Province' })}</span>
          <input value={filters.province} onChange={(e) => setF('province', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t('employer:workMode', { defaultValue: 'Work mode' })}</span>
          <select value={filters.workMode} onChange={(e) => setF('workMode', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700">
            <option value="">{t('common:all', { defaultValue: 'All' })}</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t('employer:jobType', { defaultValue: 'Job type' })}</span>
          <select value={filters.jobType} onChange={(e) => setF('jobType', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700">
            <option value="">{t('common:all', { defaultValue: 'All' })}</option>
            <option value="internship">Internship</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t('employer:sortBy', { defaultValue: 'Sort by' })}</span>
          <select value={filters.sort} onChange={(e) => setF('sort', e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(`employer:${o.labelKey}`, { defaultValue: o.value })}</option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2 flex flex-wrap gap-2 items-end">
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">{t('common:search')}</button>
          <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={t('employer:saveViewName')} className="border rounded-lg px-3 py-2 min-h-[44px] dark:bg-gray-900 dark:border-gray-700 flex-1 min-w-[120px]" />
          <button type="button" onClick={onSaveFilter} className="px-3 py-2 rounded-lg border text-sm min-h-[44px]">{t('employer:saveView')}</button>
        </div>
      </form>

      {savedFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedFilters.map((f) => (
            <button
              key={f._id}
              type="button"
              className="px-3 py-1.5 rounded-full border text-xs"
              onClick={() => {
                setFilters((prev) => ({ ...prev, ...f.filters, pipelineStage: f.filters?.stage || f.filters?.pipelineStage || '' }));
                load(f.filters);
              }}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">{t('common:loading')}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        {candidates.map((c) => (
          <li key={c.legacyApplicationId} className="flex items-stretch">
            <label className="flex items-center px-3 border-r border-gray-100 dark:border-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={compareIds.includes(c.legacyApplicationId)}
                onChange={() => toggleCompare(c.legacyApplicationId)}
              />
            </label>
            <Link
              to={`${ROUTES.EMPLOYER_INTELLIGENCE_CANDIDATES}/${c.legacyApplicationId}`}
              className="flex-1 flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <div className="min-w-0">
                <div className="font-medium text-gray-900 dark:text-white truncate">{c.basic?.displayName || t('employer:unnamedCandidate')}</div>
                <div className="text-xs text-gray-500 truncate">
                  {c.headline || '—'} · {c.location || '—'} · {stageLabel(t, c.pipelineStage)}
                </div>
              </div>
              <div className="text-right text-sm shrink-0 space-y-0.5">
                <div>{t('employer:rankScore')}: {c.ranking?.percent ?? '—'}%</div>
                <div className="text-xs text-gray-500">
                  {t('employer:jobMatchShort', { defaultValue: 'Match' })}: {c.jobMatch?.overall ?? '—'} ·
                  {t('employer:readinessShort')}: {c.readiness?.overall ?? '—'} ·
                  {t('employer:resumeShort', { defaultValue: 'Resume' })}: {c.resumeStrength?.overall ?? '—'}
                </div>
              </div>
            </Link>
          </li>
        ))}
        {!loading && !candidates.length && (
          <li className="px-4 py-6 text-sm text-gray-500">{t('employer:noCandidates')}</li>
        )}
      </ul>
    </div>
  );
}
