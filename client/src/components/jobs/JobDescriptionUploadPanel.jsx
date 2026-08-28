import { useRef, useState } from 'react';
import {
  applyJobDocumentSuggestions,
  buildSuggestionConflicts,
  SUGGESTION_FIELD_LABELS,
} from './jobDocumentSuggestionMerge';

const STATUS = {
  idle: 'idle',
  uploading: 'uploading',
  parsing: 'parsing',
  review: 'review',
  error: 'error',
};

function formatValue(val) {
  if (Array.isArray(val)) return val.join(', ');
  return String(val ?? '');
}

export function JobDescriptionUploadPanel({
  uploadFn,
  fieldMap,
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
  const [suggestions, setSuggestions] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [resolvedConflicts, setResolvedConflicts] = useState({});

  const reset = () => {
    setStatus(STATUS.idle);
    setError('');
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
      setConflicts(buildSuggestionConflicts(form, sug, {
        fieldMap,
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
    fieldMap,
    touchedFields,
    initialForm,
    formDefaults,
  };

  const applyEmpty = () => {
    if (!suggestions) return;
    const { form: next } = applyJobDocumentSuggestions(form, suggestions, {
      ...mergeOptions,
      onlyEmpty: true,
      allowUntouchedDefaults: true,
    });
    onApply(next);
    reset();
  };

  const applyField = (field, useSuggestion = true) => {
    if (!suggestions?.[field]) return;
    const patch = useSuggestion
      ? { [field]: suggestions[field] }
      : {};
    if (useSuggestion) {
      const { form: next } = applyJobDocumentSuggestions(form, patch, {
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
        const { form: patched } = applyJobDocumentSuggestions(nextForm, { [c.field]: suggestions[c.field] }, {
          ...mergeOptions,
          onlyEmpty: false,
        });
        nextForm = patched;
      }
    }
    const { form: withEmpty } = applyJobDocumentSuggestions(nextForm, suggestions, {
      ...mergeOptions,
      onlyEmpty: true,
      allowUntouchedDefaults: true,
    });
    onApply(withEmpty);
    reset();
  };

  const suggestionEntries = Object.entries(suggestions || {});
  const openConflicts = conflicts.filter((c) => !resolvedConflicts[c.field]);

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upload job description</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            PDF, DOCX or TXT · maximum 5 MB
          </p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={status === STATUS.uploading || status === STATUS.parsing}
            onClick={() => fileRef.current?.click()}
            className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {status === STATUS.uploading ? 'Uploading…' : status === STATUS.parsing ? 'Parsing…' : 'Choose file'}
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
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Review suggestions below. Nothing is saved until you use the form Save action.
          </p>
          <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
            {suggestionEntries.map(([field, sug]) => (
              <li key={field} className="rounded border border-gray-200 dark:border-gray-600 p-2 bg-white dark:bg-gray-900">
                <div className="font-medium text-gray-800 dark:text-gray-200">
                  {SUGGESTION_FIELD_LABELS[field] || field}
                  <span className="ml-2 text-xs font-normal text-gray-500">({sug.confidence})</span>
                </div>
                <div className="text-gray-700 dark:text-gray-300 mt-0.5">{formatValue(sug.value)}</div>
                {sug.evidence && (
                  <div className="text-xs text-gray-500 mt-1 italic">&ldquo;{sug.evidence}&rdquo;</div>
                )}
              </li>
            ))}
          </ul>

          {openConflicts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Conflicts — choose which value to keep:</p>
              {openConflicts.map((c) => (
                <div key={c.field} className="rounded border border-amber-300 dark:border-amber-700 p-2 text-sm">
                  <div className="font-medium">{SUGGESTION_FIELD_LABELS[c.field] || c.field}</div>
                  <div className="mt-1 grid sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-gray-500">Current:</span>
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
                      Use suggestion
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
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium"
            >
              Apply all valid suggestions
            </button>
            {openConflicts.length > 0 && (
              <button type="button" onClick={applyAllResolved} className="px-3 py-1.5 rounded-lg border text-sm">
                Apply resolved + empty
              </button>
            )}
            <button type="button" onClick={reset} className="px-3 py-1.5 rounded-lg border text-sm text-gray-600">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {status === STATUS.review && suggestionEntries.length === 0 && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          No supported fields were detected. You can continue entering the form manually.
          <button type="button" onClick={reset} className="ml-2 underline text-primary">Dismiss</button>
        </p>
      )}
    </div>
  );
}
