import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminInput } from './AdminFormFields.jsx';
import { adminContentApi } from '../../services/adminContentApi';
import { VIEW_PUBLIC_HINT } from '@shared/cms/publicReadiness.js';

const APP_BASE = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');

const RESOURCE_PATHS = {
  job: '/jobs',
  scholarship: '/scholarships',
  admission: '/admissions',
  blog: '/blog',
  company: '/company',
  institution: '/schools-and-colleges',
  webinar: '/webinars',
  'cms-page': '',
  'foreign-study': '/foreign-studies',
  internship: '/internships',
  university: '/university',
  'career-article': '/career-guidance',
  'intl-scholarship': '/intl-scholarships',
};

function localPreview(resourceType, slug, locale) {
  if (!slug) return '';
  const path = RESOURCE_PATHS[resourceType] ?? '';
  if (resourceType === 'cms-page') {
    const loc = locale && locale !== 'en' ? `/${locale}` : '';
    return `${APP_BASE}${loc}/${slug}`;
  }
  return `${APP_BASE}${path}/${slug}`;
}

function normalizeClientSlug(text) {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Shared admin slug field with preview, copy, and availability check.
 */
export function AdminSlugField({
  resourceType,
  value = '',
  onChange,
  sourceText = '',
  status = 'draft',
  excludeId,
  locale,
  label,
  name = 'slug',
  id: idProp,
  className = '',
  disabled = false,
  publicPreviewReady,
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);
  const locked = status && status !== 'draft';

  const runCheck = useCallback(async (slugVal) => {
    const normalized = normalizeClientSlug(slugVal);
    if (!normalized) {
      setCheck(null);
      return;
    }
    setChecking(true);
    try {
      const result = await adminContentApi.checkSlug({
        type: resourceType,
        slug: normalized,
        excludeId: excludeId || undefined,
        locale: locale || undefined,
      });
      setCheck(result);
    } catch {
      setCheck(null);
    } finally {
      setChecking(false);
    }
  }, [resourceType, excludeId, locale]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runCheck(value), 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, runCheck]);

  const preview = check?.previewUrl || localPreview(resourceType, normalizeClientSlug(value), locale);

  const handleBlur = () => {
    const normalized = normalizeClientSlug(value);
    if (normalized !== value) onChange?.(normalized);
  };

  const handleAutoGenerate = () => {
    if (!sourceText?.trim()) return;
    onChange?.(normalizeClientSlug(sourceText));
  };

  const handleCopy = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const statusMsg = check?.reserved
    ? t('admin:slugReserved')
    : check?.valid === false
      ? (check.message || t('admin:slugInvalid'))
      : check?.available === false
        ? t('admin:slugTaken')
        : check?.available
          ? t('admin:slugAvailable')
          : null;

  const statusClass = check?.reserved || check?.available === false || check?.valid === false
    ? 'text-red-600 dark:text-red-400'
    : check?.available
      ? 'text-green-600 dark:text-green-400'
      : 'text-gray-500 dark:text-gray-400';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <AdminInput
            id={idProp}
            name={name}
            label={label || t('admin:fieldSeoSlug')}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            hint={locked ? t('admin:slugLockedHint') : t('admin:slugDraftHint')}
          />
        </div>
        {sourceText && !locked && (
          <button
            type="button"
            onClick={handleAutoGenerate}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[40px] shrink-0"
          >
            {t('admin:slugAutoGenerate')}
          </button>
        )}
      </div>

      {preview && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700">
          <code className="text-xs text-gray-700 dark:text-gray-300 break-all flex-1 min-w-0">{preview}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 min-h-[32px]"
          >
            {copied ? t('admin:slugCopied') : t('admin:slugCopyUrl')}
          </button>
          {preview.startsWith('http') && (
            publicPreviewReady === true ? (
              <a
                href={preview}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 min-h-[32px] inline-flex items-center"
              >
                {t('admin:viewPublic')}
              </a>
            ) : (
              <span className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-400 cursor-not-allowed min-h-[32px] inline-flex items-center" title={VIEW_PUBLIC_HINT}>
                {t('admin:viewPublic')}
              </span>
            )
          )}
        </div>
      )}

      {(checking || statusMsg) && (
        <p className={`text-xs ${statusClass}`} role="status" aria-live="polite">
          {checking ? t('admin:slugChecking') : statusMsg}
        </p>
      )}
    </div>
  );
}

export { normalizeClientSlug, RESOURCE_PATHS };
