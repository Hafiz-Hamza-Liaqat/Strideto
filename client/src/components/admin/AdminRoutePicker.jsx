import { useMemo, useState, useRef, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLabel, adminFieldClass } from './AdminFormFields.jsx';
import { getPickablePages, getPageCategories } from '@shared/pageRegistry.js';
import { registerOverlayEscape } from '../../a11y/overlayStack';

const APP_BASE = (import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

function isExternalUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

/**
 * Searchable route picker — platform standard for internal paths and optional external URLs.
 */
export function AdminRoutePicker({
  value = '',
  onChange,
  label,
  hint,
  disabled = false,
  includeProtected = false,
  includeAdmin = false,
  allowExternal = true,
  className = '',
  id: idProp,
  name = 'route',
}) {
  const { t } = useTranslation(['admin', 'common']);
  const autoId = useId();
  const id = idProp || `admin-route-${autoId}`;
  const listId = `${id}-list`;
  const wrapperRef = useRef(null);

  const [externalMode, setExternalMode] = useState(isExternalUrl(value));
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const pickablePages = useMemo(
    () => getPickablePages({ includeProtected, includeAdmin }),
    [includeProtected, includeAdmin]
  );

  const categories = useMemo(
    () => getPageCategories({ includeProtected, includeAdmin }),
    [includeProtected, includeAdmin]
  );

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? pickablePages.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.route.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q)
        )
      : pickablePages;

    return categories
      .map((cat) => ({
        category: cat,
        pages: filtered.filter((p) => p.category === cat),
      }))
      .filter((g) => g.pages.length > 0);
  }, [pickablePages, categories, query]);

  const selectedPage = useMemo(
    () => (externalMode ? null : pickablePages.find((p) => p.route === value) ?? null),
    [pickablePages, value, externalMode]
  );

  useEffect(() => {
    setExternalMode(isExternalUrl(value));
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    return registerOverlayEscape(() => setOpen(false));
  }, [open]);

  const displayValue = externalMode
    ? value
    : selectedPage
      ? `${selectedPage.name} (${selectedPage.route})`
      : value;

  const previewUrl = externalMode
    ? (isExternalUrl(value) ? value : '')
    : value
      ? `${APP_BASE}${value.startsWith('/') ? value : `/${value}`}`
      : '';

  const pickRoute = (route) => {
    onChange?.(route);
    setQuery('');
    setOpen(false);
    setExternalMode(false);
  };

  return (
    <div className={`space-y-2 ${className}`} ref={wrapperRef}>
      <AdminLabel htmlFor={id}>{label || t('admin:routePickerLabel', { defaultValue: 'Route / URL' })}</AdminLabel>

      {allowExternal && (
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`${id}-mode`}
              checked={!externalMode}
              onChange={() => {
                setExternalMode(false);
                if (isExternalUrl(value)) onChange?.('');
              }}
              disabled={disabled}
            />
            {t('admin:routePickerInternal', { defaultValue: 'Internal page' })}
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`${id}-mode`}
              checked={externalMode}
              onChange={() => {
                setExternalMode(true);
                onChange?.('');
              }}
              disabled={disabled}
            />
            {t('admin:routePickerExternal', { defaultValue: 'External URL' })}
          </label>
        </div>
      )}

      {externalMode ? (
        <input
          id={id}
          name={name}
          type="url"
          className={adminFieldClass}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="https://"
          disabled={disabled}
        />
      ) : (
        <div className="relative">
          <input
            id={id}
            name={name}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className={adminFieldClass}
            value={open ? query : displayValue}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setQuery('');
              setOpen(true);
            }}
            placeholder={t('admin:routePickerSearch', { defaultValue: 'Search pages…' })}
            disabled={disabled}
            autoComplete="off"
          />
          {open && grouped.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-lg"
            >
              {grouped.map((group) => (
                <li key={group.category}>
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 sticky top-0">
                    {group.category}
                  </div>
                  <ul>
                    {group.pages.map((page) => (
                      <li key={page.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={value === page.route}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 dark:hover:bg-mint/10 flex flex-col gap-0.5"
                          onClick={() => pickRoute(page.route)}
                        >
                          <span className="font-medium text-gray-900 dark:text-gray-100">{page.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{page.route}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}

      {previewUrl && (
        <p className="text-xs text-gray-600 dark:text-gray-300">
          {t('admin:routePickerPreview', { defaultValue: 'Preview' })}:{' '}
          <code className="break-all">{previewUrl}</code>
        </p>
      )}

      {selectedPage && !externalMode && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {selectedPage.category} · {selectedPage.dynamic ? t('admin:routeDynamic', { defaultValue: 'Dynamic' }) : t('admin:routeStatic', { defaultValue: 'Static' })}
        </p>
      )}
    </div>
  );
}

export { isExternalUrl };
