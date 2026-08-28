import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../../constants';
import { adminContentApi } from '../../services/adminContentApi';
import { MediaAssetPicker } from '../media/MediaAssetPicker';
import { isLikelyWebpageNotDirectImage } from '../../utils/imageUrlHints';

/** API origin without /api suffix — used for /uploads paths. */
export function getApiOrigin() {
  const base = API_BASE_URL.replace(/\/$/, '');
  return base.replace(/\/api$/i, '');
}

/**
 * Resolve any supported image URL/path to an absolute URL for browser preview.
 * Stored value is unchanged; only preview uses the resolved URL.
 */
export function resolveImagePreviewUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (/^data:image\//i.test(trimmed)) return trimmed;
  if (/^blob:/i.test(trimmed)) return trimmed;
  if (/^https?:\/\/.+/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//') && trimmed.length > 2) return `https:${trimmed}`;

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('/uploads')) {
      return `${getApiOrigin()}${trimmed}`;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return origin ? `${origin}${trimmed}` : trimmed;
  }

  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)) {
    const pathPart = trimmed.includes('/') ? trimmed : `${trimmed}/`;
    return `http://${pathPart.replace(/^\/\//, '')}`;
  }

  if (/^[\w.-]+:\d+\/.+/i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

/** @deprecated use resolveImagePreviewUrl */
export function normalizeImageUrl(url) {
  return resolveImagePreviewUrl(url);
}

export function isPreviewableImageUrl(url) {
  const resolved = resolveImagePreviewUrl(url);
  if (!resolved) return false;
  if (/^(data:image\/|blob:)/i.test(resolved)) return true;
  return /^https?:\/\/.+/i.test(resolved);
}

/** @deprecated use isPreviewableImageUrl */
export function isLikelyImageUrl(url) {
  return isPreviewableImageUrl(url);
}

const PREVIEW_TIMEOUT_MS = 12000;

export function AdminImageUrlField({ label, value, onChange, placeholder, className = '', allowUpload = true, allowLibrary = true, compact = false, onAssetSelect, helperText }) {
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef(null);
  const timeoutRef = useRef(null);

  const previewSrc = useMemo(() => resolveImagePreviewUrl(value), [value]);
  const canPreview = Boolean(previewSrc && isPreviewableImageUrl(value));

  const clearLoadTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearLoadTimer();
    setImgError(false);
    setUploadError('');
    if (!canPreview) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setImgError(true);
    }, PREVIEW_TIMEOUT_MS);
    return clearLoadTimer;
  }, [previewSrc, canPreview, clearLoadTimer]);

  const handleLoad = () => {
    clearLoadTimer();
    setLoading(false);
    setImgError(false);
  };

  const handleError = () => {
    clearLoadTimer();
    setLoading(false);
    setImgError(true);
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const { data } = await adminContentApi.uploadMediaAssets([file]);
      const asset = data?.uploaded?.[0] || data?.results?.[0]?.asset;
      const url = asset?.storageUrl || asset?.largeUrl || asset?.mediumUrl;
      if (url) {
        onChange(url);
        onAssetSelect?.(asset);
      } else {
        setUploadError('Upload succeeded but no URL was returned.');
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const statusMessage = (() => {
    if (uploadError) return uploadError;
    if (uploading) return 'Uploading image…';
    if (!value?.trim()) return null;
    if (isLikelyWebpageNotDirectImage(value)) {
      return 'This looks like a profile or webpage URL, not a direct image. Use a public image URL (JPG, PNG, WebP or SVG), or choose an image from Media Library.';
    }
    if (!canPreview) return helperText || 'Enter a valid image URL (see accepted formats below).';
    if (imgError) return 'Image could not be loaded — check the URL is public or upload a file instead.';
    return null;
  })();

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          placeholder={placeholder || 'https://example.com/image.jpg'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onDrop={(e) => {
            e.preventDefault();
            const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
            if (text?.trim()) onChange(text.trim());
          }}
          onDragOver={(e) => e.preventDefault()}
        />
        {allowUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,.jpg,.jpeg,.png,.gif,.webp,.svg"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="shrink-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </>
        )}
        {allowLibrary && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="shrink-0 px-3 py-2 rounded-lg border border-primary/40 text-primary bg-primary/5 text-sm font-medium hover:bg-primary/10"
          >
            Media Library
          </button>
        )}
      </div>
      <MediaAssetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={({ url, asset }) => {
          onChange(url);
          onAssetSelect?.(asset);
          setPickerOpen(false);
        }}
      />
      {statusMessage && (
        <p className={`text-xs mt-1 ${uploadError || imgError ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {statusMessage}
        </p>
      )}
      <div
        className={`mt-2 w-full max-w-sm rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center overflow-hidden relative ${
          compact ? 'h-16' : 'h-32'
        }`}
        aria-live="polite"
      >
        {loading && canPreview && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/90 dark:bg-gray-800/90 z-10">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading preview</span>
          </div>
        )}
        {canPreview && !imgError ? (
          <img
            key={previewSrc}
            src={previewSrc}
            alt=""
            className="max-h-full max-w-full object-contain p-1"
            referrerPolicy="no-referrer"
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
          />
        ) : (
          <div className="text-center px-3">
            <svg className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs text-gray-400">
              {!value?.trim() ? 'Image preview' : imgError ? 'Preview unavailable' : 'Enter URL or upload'}
            </span>
          </div>
        )}
      </div>
      {!compact && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
          {helperText || 'Accepted: https://… · /uploads/… · Upload · or pick from Media Library'}
        </p>
      )}
    </div>
  );
}

export { adminFieldClass, AdminInput, AdminSelect, AdminTextarea, AdminLabel, AdminSelectBare } from './AdminFormFields.jsx';

export function linesToText(arr) {
  return Array.isArray(arr) ? arr.join('\n') : '';
}

export function textToLines(text) {
  return String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}
