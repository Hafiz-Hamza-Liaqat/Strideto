import { useRef, useState } from 'react';
import {
  applyCmsDocumentSuggestions,
  buildSuggestionConflicts,
  CMS_SUGGESTION_FIELD_LABELS,
} from './cmsDocumentSuggestionMerge';

const STATUS = {
  idle: 'idle',
  uploading: 'uploading',
  parsing: 'parsing',
  review: 'review',
  error: 'error',
};

function formatValue(val) {
  if (Array.isArray(val)) return val.join('\n');
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  const s = String(val ?? '');
  if (s.length > 200) return `${s.slice(0, 200)}…`;
  return s;
}

function formatSuggestionStatus(sug) {
  const st = sug?.status || 'accepted';
  if (st === 'accepted') return 'Ready';
  if (st === 'review') return 'Review';
  return 'Not found';
}

function suggestionStatusClass(sug) {
  const st = sug?.status || 'accepted';
  if (st === 'accepted') return 'text-green-700 dark:text-green-400';
  if (st === 'review') return 'text-amber-700 dark:text-amber-400';
  return 'text-gray-500';
}

export function CmsDocumentUploadPanel({
  title = 'Import blog document',
  hint = 'Structured DOCX, PDF or TXT · maximum 5 MB',
  uploadFn,
  form,
  onApply,
  formDefaults,
  initialForm,
  touchedFields,
  className = '',
}) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState(STATUS.idle);
  const [error, setError] = useState('');
  const [importMeta, setImportMeta] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [resolvedConflicts, setResolvedConflicts] = useState({});

  const reset = () => {
    setStatus(STATUS.idle);
    setError('');
    setImportMeta(null);
    setSuggestions(null);
    setConflicts([]);
    setResolvedConflicts({});
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setStatus(STATUS.uploading);
    try {
      setStatus(STATUS.parsing);
      const formData = new FormData();
      formData.append('document', file);
      const { data } = await uploadFn(formData);
      const sug = data?.suggestions || {};
      setSuggestions(sug);
      setImportMeta(data?.meta || null);
      setConflicts(buildSuggestionConflicts(form, sug, {
        fieldMap: {},
        touchedFields,
        initialForm,
        formDefaults,
      }));
      setResolvedConflicts({});
      setStatus(STATUS.review);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not parse document');
      setStatus(STATUS.error);
    }
  };

  const mergeOptions = {
    touchedFields,
    initialForm,
    formDefaults,
  };

  const applyEmpty = () => {
    if (!suggestions) return;
    const { form: next } = applyCmsDocumentSuggestions(form, suggestions, {
      ...mergeOptions,
      onlyEmpty: true,
      allowUntouchedDefaults: true,
    });
    onApply(next);
    reset();
  };

  const applyField = (field, useSuggestion = true) => {
    if (!suggestions?.[field]) return;
    if (useSuggestion) {
      const { form: next } = applyCmsDocumentSuggestions(form, { [field]: suggestions[field] }, {
        ...mergeOptions,
        onlyEmpty: false,
      });
      onApply(next);
    }
    setResolvedConflicts((prev) => ({ ...prev, [field]: useSuggestion ? 'suggestion' : 'current' }));
    setConflicts((prev) => prev.filter((c) => c.field !== field));
  };

  const applyAllResolved = () => {
    let nextForm = { ...form };
    const pending = conflicts.filter((c) => !resolvedConflicts[c.field]);
    for (const c of pending) {
      const choice = resolvedConflicts[c.field];
      if (choice === 'suggestion' && suggestions[c.field]) {
        const { form: patched } = applyCmsDocumentSuggestions(nextForm, { [c.field]: suggestions[c.field] }, {
          ...mergeOptions,
          onlyEmpty: false,
        });
        nextForm = patched;
      }
    }
    const { form: withEmpty } = applyCmsDocumentSuggestions(nextForm, suggestions, {
      ...mergeOptions,
      onlyEmpty: true,
      allowUntouchedDefaults: true,
    });
    onApply(withEmpty);
    reset();
  };

  const suggestionEntries = Object.entries(suggestions || {});
  const openConflicts = conflicts.filter((c) => !resolvedConflicts[c.field]);
  const acceptedCount = suggestionEntries.filter(([, sug]) => (sug?.status || 'accepted') === 'accepted').length;
  const canApply = acceptedCount > 0 || openConflicts.some((c) => resolvedConflicts[c.field] === 'suggestion');

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{hint}</p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            aria-label={`${title} file input`}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={status === STATUS.uploading || status === STATUS.parsing}
            onClick={() => fileRef.current?.click()}
            className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 min-h-[40px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {status === STATUS.uploading ? 'Uploading…' : status === STATUS.parsing ? 'Parsing…' : 'Upload document'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {status === STATUS.review && suggestionEntries.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-600 dark:text-gray-400" role="status" aria-live="polite">
            Document imported. Review the populated fields before saving.
            {importMeta?.fieldCount != null ? (
              <> {importMeta.fieldCount} field(s) found · {importMeta.validCount ?? 0} valid
                {(importMeta.reviewCount ?? 0) > 0 ? ` · ${importMeta.reviewCount} need review` : ''}.
              </>
            ) : null}
          </p>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Document fields found</p>
          <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
            {suggestionEntries.map(([field, sug]) => (
              <li key={field} className="rounded border border-gray-200 dark:border-gray-600 p-2 bg-white dark:bg-gray-900">
                <div className="font-medium text-gray-800 dark:text-gray-200">
                  {CMS_SUGGESTION_FIELD_LABELS[field] || field}
                  <span className={`ml-2 text-xs font-normal ${suggestionStatusClass(sug)}`}>
                    {formatSuggestionStatus(sug)}
                  </span>
                </div>
                <div className="text-gray-700 dark:text-gray-300 mt-0.5">{formatValue(sug.value)}</div>
                {sug.reason && (
                  <div className="text-xs text-gray-500 mt-1">{String(sug.reason).replace(/_/g, ' ')}</div>
                )}
                {sug.status === 'review' && (
                  <button
                    type="button"
                    className="mt-1 text-xs px-2 py-0.5 rounded border border-amber-400 text-amber-800 dark:text-amber-300"
                    onClick={() => applyField(field, true)}
                  >
                    Use this value
                  </button>
                )}
              </li>
            ))}
          </ul>

          {openConflicts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Conflicts — choose which value to keep:</p>
              {openConflicts.map((c) => (
                <div key={c.field} className="rounded border border-amber-300 dark:border-amber-700 p-2 text-sm">
                  <div className="font-medium">{CMS_SUGGESTION_FIELD_LABELS[c.field] || c.field}</div>
                  <div className="mt-1 grid sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-gray-500">Existing:</span>
                      <div>{formatValue(c.current)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Document:</span>
                      <div>{formatValue(c.suggested)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button type="button" className="text-xs px-2 py-1 rounded border" onClick={() => applyField(c.field, false)}>
                      Keep current
                    </button>
                    <button type="button" className="text-xs px-2 py-1 rounded bg-primary text-white" onClick={() => applyField(c.field, true)}>
                      Use document value
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={applyEmpty}
              disabled={!canApply || status === STATUS.uploading || status === STATUS.parsing}
              aria-label="Apply all valid fields"
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Apply all valid fields
            </button>
            {openConflicts.length > 0 && (
              <button type="button" onClick={applyAllResolved} className="px-3 py-1.5 rounded-lg border text-sm">
                Apply resolved + empty
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              aria-label="Clear import"
              className="px-3 py-1.5 rounded-lg border text-sm text-gray-600 min-h-[36px]"
            >
              Clear import
            </button>
          </div>
        </div>
      )}

      {status === STATUS.review && suggestionEntries.length === 0 && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          No supported fields were detected. Use labeled STRIDETO import format or enter manually.
          <button type="button" onClick={reset} className="ml-2 underline text-primary">Clear import</button>
        </p>
      )}
    </div>
  );
}
