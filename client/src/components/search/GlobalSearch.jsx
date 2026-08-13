import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { searchApi } from '../../services/searchApi';
import { entityTypeLabel } from '@shared/search/entityTypes.js';
import { SEARCH_DEBOUNCE_MS } from '@shared/search/rankingWeights.js';
import { CountrySelect } from '../forms/CountrySelect';
import { ROUTES } from '../../constants';

/**
 * Global search combobox with instant suggestions (C.7.0.4 / L.2.6 layout).
 */
export function GlobalSearch({
  placeholder,
  className = '',
  showCategoryFilter = false,
  categories = [],
  category = '',
  categoryValue = '',
  onCategoryChange,
  showProvinceFilter = false,
  provinces = [],
  province = '',
  onProvinceChange,
  showCountryFilter = false,
  countryCode = '',
  onCountryChange,
  onNavigate,
  inputClassName = '',
  selectClassName = '',
}) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState({});
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announce, setAnnounce] = useState('');
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  const flatItems = Object.entries(groups).flatMap(([type, items]) =>
    (items || []).map((item) => ({ ...item, groupType: type })),
  );

  const fetchSuggestions = useCallback((q) => {
    if (!q || q.length < 2) {
      setGroups({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = {};
    if (countryCode) params.countryCode = countryCode;
    if (province) params.province = province;
    if (category) params.type = category;
    searchApi.suggestions(q, params)
      .then(({ data }) => {
        setGroups(data?.groups || {});
        const count = Object.values(data?.groups || {}).reduce((n, g) => n + g.length, 0);
        setAnnounce(count ? `${count} suggestions` : 'No results');
        setActiveIndex(-1);
      })
      .catch(() => {
        setGroups({});
        setAnnounce('Search unavailable');
      })
      .finally(() => setLoading(false));
  }, [province, category, countryCode]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  const goToSearch = (q) => {
    const term = q?.trim();
    if (!term) return;
    setOpen(false);
    const params = new URLSearchParams({ q: term });
    if (countryCode) params.set('countryCode', countryCode);
    if (province) params.set('province', province);
    if (category) params.set('type', category);
    const path = `${ROUTES.SEARCH}?${params.toString()}`;
    if (onNavigate) onNavigate(path);
    else navigate(path);
  };

  const selectItem = (item) => {
    if (!item) return;
    setOpen(false);
    void searchApi.click({ query, entityType: item.entityType, entityId: item.id, url: item.url });
    if (item.url) navigate(item.url);
    else goToSearch(query);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && flatItems[activeIndex]) selectItem(flatItems[activeIndex]);
      else goToSearch(query);
    }
  };

  const listboxId = 'global-search-listbox';
  const baseSelect =
    selectClassName
    || 'rounded-xl border border-white/30 bg-white/10 text-white px-4 py-3 text-sm focus:ring-2 focus:ring-edur-sky outline-none backdrop-blur-sm w-full sm:w-40 shrink-0 h-[48px]';
  const baseInput =
    inputClassName
    || 'w-full h-[48px] pl-4 pr-12 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-600 focus:ring-2 focus:ring-edur-sky focus:border-transparent outline-none transition shadow-sm';

  return (
    <div className={`w-full min-w-0 ${className}`} data-tour="search">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch w-full">
        {showCategoryFilter && categories?.length ? (
          <select
            value={categoryValue || categories[0]?.value || ''}
            onChange={(e) => {
              const match = categories.find((c) => c.value === e.target.value);
              onCategoryChange?.(match);
            }}
            className={baseSelect}
            aria-label={t('opportunityType', { defaultValue: 'Opportunity type' })}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value} className="text-gray-900">
                {c.label}
              </option>
            ))}
          </select>
        ) : null}

        <div className="relative flex-1 w-full min-w-0" role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-controls={listboxId}>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            placeholder={placeholder || t('search')}
            aria-label={t('search')}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `gs-opt-${activeIndex}` : undefined}
            className={baseInput}
          />
          <button
            type="button"
            onClick={() => goToSearch(query)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-primary rounded-lg"
            aria-label={t('submitSearch')}
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>

          {open && query.trim().length >= 2 && (
            <ul
              id={listboxId}
              ref={listRef}
              role="listbox"
              className="absolute z-50 mt-1 left-0 right-0 w-full max-h-80 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1 text-left"
            >
              {flatItems.length === 0 && !loading ? (
                <li className="px-4 py-3 text-sm text-gray-500" role="option">No matches — press Enter to search all</li>
              ) : null}
              {Object.entries(groups).map(([type, items]) => {
                if (!items?.length) return null;
                return (
                  <li key={type} className="list-none">
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {entityTypeLabel(type)}
                    </div>
                    <ul className="list-none">
                      {items.map((item) => {
                        const idx = flatItems.findIndex((f) => f.id === item.id && f.entityType === item.entityType);
                        const active = idx === activeIndex;
                        return (
                          <li
                            key={`${type}-${item.id}`}
                            id={`gs-opt-${idx}`}
                            role="option"
                            aria-selected={active}
                            className={`px-4 py-2 cursor-pointer text-sm ${active ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectItem(item)}
                          >
                            <span className="font-medium text-gray-900 dark:text-white line-clamp-2 break-words">{item.title}</span>
                            {item.summary ? (
                              <span className="block text-xs text-gray-500 truncate">{item.summary}</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
              <li className="list-none border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-gray-50 dark:hover:bg-gray-800"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToSearch(query)}
                >
                  Search all for &ldquo;{query.trim()}&rdquo;
                </button>
              </li>
            </ul>
          )}
        </div>

        {showCountryFilter ? (
          <div className="w-full sm:w-52 shrink-0">
            <CountrySelect
              allowAll
              value={countryCode}
              onChange={(code) => onCountryChange?.(code || '')}
              placeholder={t('searchCountry', { defaultValue: 'Search country...' })}
              allLabel={t('allCountries', { defaultValue: 'All countries' })}
              inputClassName={baseSelect}
              listClassName="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
        ) : null}

        {showProvinceFilter && provinces?.length ? (
          <select
            value={province}
            onChange={(e) => onProvinceChange?.(e.target.value)}
            className={`${baseSelect} sm:w-44`}
            aria-label={t('province', { defaultValue: 'Province' })}
          >
            <option value="" className="text-gray-900">{t('allProvinces', { defaultValue: 'All provinces' })}</option>
            {provinces.map((p) => (
              <option key={p} value={p} className="text-gray-900">{p}</option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">{announce}</div>
    </div>
  );
}
