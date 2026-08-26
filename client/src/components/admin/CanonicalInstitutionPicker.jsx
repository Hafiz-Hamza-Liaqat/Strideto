import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { adminFieldClass } from '../admin/AdminFormFields';
import { adminEducationInstitutionsApi } from '../../services/adminEducationInstitutionsApi';

function formatResult(inst) {
  const loc = [inst.city, inst.region].filter(Boolean).join(', ');
  const country = inst.countryCode || '';
  return {
    primary: inst.officialName || 'Institution',
    secondary: [loc, country].filter(Boolean).join(' · ') || country || '—',
  };
}

/**
 * Server-backed searchable picker for CanonicalInstitution.
 * Submits institutionId only; never free-text institution identity.
 */
export function CanonicalInstitutionPicker({
  value = '',
  selectedLabel = '',
  selectedMeta = null,
  onChange,
  disabled = false,
  countryFilter = '',
  placeholder = 'Search institutions...',
}) {
  const listId = useId().replace(/:/g, '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  const runSearch = useCallback(async (term) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        search: term || undefined,
        country: countryFilter || undefined,
        page: 1,
        limit: 20,
        sort: 'officialName',
        order: 'asc',
      };
      const res = await adminEducationInstitutionsApi.list(params);
      setResults(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to search institutions');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [countryFilter]);

  useEffect(() => {
    if (!open) return undefined;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query.trim());
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, runSearch]);

  useEffect(() => {
    const onDoc = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const displaySelected = selectedMeta
    ? formatResult(selectedMeta)
    : (selectedLabel ? { primary: selectedLabel, secondary: '' } : null);

  return (
    <div ref={wrapRef} className="relative" data-testid="canonical-institution-picker">
      {value && displaySelected && (
        <div className="mb-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">
          <div className="font-medium break-words">{displaySelected.primary}</div>
          {displaySelected.secondary ? (
            <div className="text-xs text-gray-500">{displaySelected.secondary}</div>
          ) : null}
          {!disabled && (
            <button
              type="button"
              className="mt-1 text-xs text-red-600 underline"
              onClick={() => onChange?.({ institutionId: '', institution: null })}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {!disabled && (
        <>
          <input
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className={adminFieldClass}
            placeholder={placeholder}
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open && (
            <div
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg"
            >
              {loading && <p className="px-3 py-2 text-xs text-gray-500">Searching…</p>}
              {error && <p className="px-3 py-2 text-xs text-red-600" role="alert">{error}</p>}
              {!loading && !error && results.length === 0 && (
                <p className="px-3 py-2 text-xs text-gray-500">No institutions found</p>
              )}
              {results.map((inst) => {
                const label = formatResult(inst);
                return (
                  <button
                    key={inst._id}
                    type="button"
                    role="option"
                    aria-selected={String(inst._id) === String(value)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0"
                    onClick={() => {
                      onChange?.({ institutionId: inst._id, institution: inst });
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <div className="font-medium break-words">{label.primary}</div>
                    <div className="text-xs text-gray-500">{label.secondary}</div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
