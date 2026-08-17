import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ISO_3166_ALPHA2, countryDisplayName } from '@shared/international/country.js';
import { AGENT_JOURNEY_TYPES } from '@shared/agent/constants.js';
import { agentApi } from '../../services/agentService';
import { programIntelligenceApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { MultiSelect } from '../../components/forms/MultiSelect';
import { inputControlClassName } from '../../components/forms/controlClasses';
import { btnPrimary, cardClass, inputClass, labelClass, muted } from './agentUi';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'Urdu' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'zh', label: 'Chinese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'tr', label: 'Turkish' },
  { value: 'fa', label: 'Persian' },
  { value: 'ms', label: 'Malay' },
  { value: 'id', label: 'Indonesian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
];

const JOURNEY_OPTIONS = Object.values(AGENT_JOURNEY_TYPES).map((value) => ({
  value,
  label: value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}));

function buildCountryOptions(locale) {
  return ISO_3166_ALPHA2.map((code) => ({
    value: code,
    label: countryDisplayName(code, locale),
  })).sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: 'base' }));
}

function normalizeList(value) {
  return Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

const EMPTY = {
  postType: 'service_announcement',
  title: '',
  summary: '',
  contentKind: 'agent_statement',
  agentStatement: '',
  relatedAgentServiceId: '',
  targetCountries: [],
  destinationCountries: [],
  journeyCategories: [],
  languages: [],
  factualStatement: '',
  effectiveAt: '',
  endsAt: '',
};

function ProgramReferencePicker({ value, onChange, disabled = false }) {
  const listId = useId();
  const rootRef = useRef(null);
  const debounceRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const runSearch = useCallback(async (term) => {
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError('');
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const res = await programIntelligenceApi.list({ search: q, limit: 10 });
      setResults(res.data?.data || []);
    } catch {
      setResults([]);
      setSearchError('Unable to search published programs.');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSearchError('');
    }
  }, [open]);

  useEffect(() => {
    function onDocClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const onQueryChange = (event) => {
    const next = event.target.value;
    setQuery(next);
    if (!open) setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(next), 300);
  };

  const pick = (program) => {
    onChange?.(program);
    setOpen(false);
  };

  const clear = () => onChange?.(null);

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40">
          <span className="font-medium text-gray-900 dark:text-white">{value.name}</span>
          <span className={muted}>({value.slug})</span>
          <button type="button" onClick={clear} disabled={disabled} className="ml-auto text-sm text-primary hover:underline disabled:opacity-50">
            Clear
          </button>
        </div>
      ) : (
        <div ref={rootRef} className="relative">
          <input
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            disabled={disabled}
            value={query}
            placeholder="Search published programs by name…"
            onFocus={() => !disabled && setOpen(true)}
            onChange={onQueryChange}
            className={inputControlClassName()}
          />
          {open && !disabled ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
            >
              {searching ? (
                <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Searching…</li>
              ) : searchError ? (
                <li className="px-3 py-2 text-sm text-red-600 dark:text-red-300">{searchError}</li>
              ) : query.trim().length < 2 ? (
                <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Type at least 2 characters to search.</li>
              ) : results.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No published programs found. Save as an agent statement instead.
                </li>
              ) : (
                results.map((program) => (
                  <li key={program._id} role="option">
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-start text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(program)}
                    >
                      <span className="font-medium">{program.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{program.slug}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

async function resolveProgramReference(referenceId) {
  if (!referenceId) return null;
  try {
    const res = await programIntelligenceApi.compare([String(referenceId)]);
    const program = (res.data?.data || [])[0];
    return program ? { _id: program._id || referenceId, name: program.name, slug: program.slug } : null;
  } catch {
    return null;
  }
}

export default function AgentMarketplaceForm() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const countryOptions = useMemo(() => buildCountryOptions(i18n.language || 'en'), [i18n.language]);

  const [form, setForm] = useState(EMPTY);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(!!postId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([agentApi.getServices(), postId ? agentApi.getMarketplacePost(postId) : Promise.resolve(null)])
      .then(async ([s, p]) => {
        setServices(s.data.services || []);
        if (p) {
          const x = p.data.post;
          const ref = x.canonicalReferences?.[0] || {};
          setForm({
            ...EMPTY,
            ...x,
            targetCountries: normalizeList(x.targetCountries),
            destinationCountries: normalizeList(x.destinationCountries),
            journeyCategories: normalizeList(x.journeyCategories),
            languages: normalizeList(x.languages),
            factualStatement: x.factualClaims?.[0]?.statement || '',
            effectiveAt: x.effectiveAt?.slice?.(0, 10) || '',
            endsAt: x.endsAt?.slice?.(0, 10) || '',
          });
          if (ref.referenceType === 'program' && ref.referenceId) {
            const program = await resolveProgramReference(ref.referenceId);
            setSelectedProgram(program);
          }
        }
      })
      .catch((e) => setError(e.response?.data?.error || 'Unable to load form.'))
      .finally(() => setLoading(false));
  }, [postId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setList = (k) => (value) => setForm((f) => ({ ...f, [k]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    const programLinked = form.contentKind === 'source_backed_fact' && selectedProgram?._id;
    const factualStatement = form.factualStatement?.trim() || '';
    const useSourceBacked = programLinked && factualStatement;
    const contentKind = useSourceBacked ? 'source_backed_fact' : 'agent_statement';

    if (form.contentKind === 'source_backed_fact' && !useSourceBacked) {
      setNotice('Saved as an agent statement because no published program was linked.');
    }

    const canonicalReferences = useSourceBacked
      ? [{ referenceType: 'program', referenceId: selectedProgram._id }]
      : [];
    const factualClaims = useSourceBacked
      ? [{ claimKey: 'agent_referenced_fact', statement: factualStatement, sourceIds: [] }]
      : [];

    const body = {
      postType: form.postType,
      title: form.title,
      summary: form.summary,
      contentKind,
      agentStatement: form.agentStatement,
      relatedAgentServiceId: form.relatedAgentServiceId || null,
      targetCountries: form.targetCountries,
      destinationCountries: form.destinationCountries,
      journeyCategories: form.journeyCategories,
      languages: form.languages,
      canonicalReferences,
      factualClaims,
      sourceIds: [],
      effectiveAt: form.effectiveAt || null,
      endsAt: form.endsAt || null,
    };

    try {
      if (postId) await agentApi.updateMarketplacePost(postId, body);
      else await agentApi.createMarketplacePost(body);
      navigate(ROUTES.AGENT_EDUCATION_MARKETPLACE);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save draft.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className={muted}>Loading…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{postId ? 'Edit marketplace post' : 'Create marketplace draft'}</h1>
        <p className={`mt-1 ${muted}`}>Agent statements are never converted into official facts. Do not claim guaranteed visa, admission, scholarship, or job outcomes.</p>
      </div>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="status">{notice}</p> : null}
      <form onSubmit={submit} className={`grid gap-4 ${cardClass} md:grid-cols-2`}>
        <label className={labelClass}>
          Post type
          <select value={form.postType} onChange={set('postType')} className={inputClass}>
            {['service_announcement', 'consultation_availability', 'application_support', 'scholarship_guidance', 'university_guidance', 'test_guidance', 'career_guidance', 'informational_update', 'verified_opportunity_reference', 'event_or_session', 'other'].map((v) => (
              <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Content classification
          <select value={form.contentKind} onChange={set('contentKind')} className={inputClass}>
            <option value="agent_statement">Agent statement (default)</option>
            <option value="source_backed_fact">Official/source-backed fact reference (advanced)</option>
          </select>
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Title
          <input required value={form.title} onChange={set('title')} className={inputClass} />
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Summary
          <textarea required value={form.summary} onChange={set('summary')} className={inputClass} />
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Agent/Agency statement
          <textarea required rows="5" value={form.agentStatement} onChange={set('agentStatement')} className={inputClass} placeholder="Describe how you can assist. Do not state guaranteed outcomes." />
        </label>
        <label className={labelClass}>
          Related active service
          <select value={form.relatedAgentServiceId || ''} onChange={set('relatedAgentServiceId')} className={inputClass}>
            <option value="">None</option>
            {services.filter((s) => s.status === 'active').map((s) => (
              <option key={s._id} value={s._id}>{s.title}</option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          End date
          <input type="date" value={form.endsAt || ''} onChange={set('endsAt')} className={inputClass} />
        </label>
        <div className={labelClass}>
          Destination countries
          <MultiSelect
            value={form.destinationCountries}
            onChange={setList('destinationCountries')}
            options={countryOptions}
            placeholder="Search countries…"
            emptyLabel="Select destination countries"
            className="mt-1"
          />
        </div>
        <div className={labelClass}>
          Service countries
          <MultiSelect
            value={form.targetCountries}
            onChange={setList('targetCountries')}
            options={countryOptions}
            placeholder="Search countries…"
            emptyLabel="Select service countries"
            className="mt-1"
          />
        </div>
        <div className={labelClass}>
          Journey categories
          <MultiSelect
            value={form.journeyCategories}
            onChange={setList('journeyCategories')}
            options={JOURNEY_OPTIONS}
            placeholder="Search journey types…"
            emptyLabel="Select journey categories"
            className="mt-1"
          />
        </div>
        <div className={labelClass}>
          Languages
          <MultiSelect
            value={form.languages}
            onChange={setList('languages')}
            options={LANGUAGE_OPTIONS}
            placeholder="Search languages…"
            emptyLabel="Select languages"
            className="mt-1"
          />
        </div>
        {form.contentKind === 'source_backed_fact' ? (
          <>
            <p className={`md:col-span-2 text-sm ${muted}`}>
              Link a published program and describe the fact you are referencing. If you cannot find a program, save as an agent statement instead.
            </p>
            <div className={`${labelClass} md:col-span-2`}>
              Published program
              <ProgramReferencePicker value={selectedProgram} onChange={setSelectedProgram} disabled={busy} />
            </div>
            <label className={`${labelClass} md:col-span-2`}>
              Referenced factual statement
              <textarea
                value={form.factualStatement}
                onChange={set('factualStatement')}
                className={inputClass}
                placeholder="Describe the official fact you are referencing (required when a program is linked)."
              />
            </label>
          </>
        ) : null}
        <button disabled={busy} className={`${btnPrimary} md:col-span-2`}>{busy ? 'Saving…' : 'Save draft'}</button>
      </form>
    </div>
  );
}
