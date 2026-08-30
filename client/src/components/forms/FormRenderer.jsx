import { useCallback, useEffect, useMemo, useState } from 'react';
import { validateSubmission } from '@shared/formSchema.js';
import { formsApi } from '../../services/formsApi';
import { talentApi } from '../../services/talentApi';
import { shouldUseTalentProfileApi } from '../../config/careerFeatureFlags';
import { useStudentProductEnabled } from '../../hooks/useStudentProductEnabled';
import { FormFieldInput } from './FormFieldInput';

/**
 * Runtime form renderer (C.7.0.2) — single source for all form display/submit.
 */
export function FormRenderer({
  form: formProp,
  formSlug,
  formId,
  title,
  subtitle,
  submitLabel,
  preview = false,
  className = '',
}) {
  const [form, setForm] = useState(formProp || null);
  const [loading, setLoading] = useState(!formProp && Boolean(formSlug || formId));
  const [loadError, setLoadError] = useState('');
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(null);
  const { studentProductEnabled } = useStudentProductEnabled();
  const [prefillApplied, setPrefillApplied] = useState(false);

  useEffect(() => {
    if (formProp) {
      setForm(formProp);
      return;
    }
    if (!formSlug && !formId) return;
    setLoading(true);
    const req = formId ? formsApi.getFormById(formId) : formsApi.getForm(formSlug);
    req
      .then(({ data }) => setForm(data.form))
      .catch(() => setLoadError('Form could not be loaded'))
      .finally(() => setLoading(false));
  }, [formProp, formSlug, formId]);

  const fields = useMemo(() => form?.fields || [], [form]);

  useEffect(() => {
    if (!fields.length) return;
    const defaults = {};
    for (const f of fields) {
      if (f.defaultValue != null && f.defaultValue !== '') defaults[f.name] = f.defaultValue;
    }
    setValues((v) => ({ ...defaults, ...v }));
  }, [fields]);

  useEffect(() => {
    if (!studentProductEnabled || !shouldUseTalentProfileApi() || prefillApplied || !fields.length || preview) return;
    talentApi.getPrefill()
      .then(({ data }) => {
        if (!data || typeof data !== 'object') return;
        setValues((prev) => {
          const next = { ...prev };
          for (const field of fields) {
            const key = field.name;
            const direct = data[key];
            if (direct != null && direct !== '' && (next[key] == null || next[key] === '')) {
              next[key] = direct;
              continue;
            }
            const aliases = {
              full_name: data.fullName,
              first_name: data.firstName,
              last_name: data.lastName,
              phone_number: data.phone,
              linkedin: data.linkedIn,
            };
            const aliasVal = aliases[key];
            if (aliasVal != null && aliasVal !== '' && (next[key] == null || next[key] === '')) {
              next[key] = aliasVal;
            }
          }
          return next;
        });
        setPrefillApplied(true);
      })
      .catch(() => {});
  }, [fields, studentProductEnabled, prefillApplied, preview]);

  const setValue = useCallback((name, val) => {
    setValues((prev) => ({ ...prev, [name]: val }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (preview || !form) return;

    const clientValidation = validateSubmission(form, values);
    if (!clientValidation.ok) {
      setErrors(clientValidation.errors);
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const hpField = form.spamSettings?.honeypotField || 'website';
      const payload = {
        ...values,
        [hpField]: '',
        _pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      };

      const hasFiles = fields.some((f) => f.type === 'file' && values[f.name] instanceof File);
      let res;
      if (hasFiles) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v instanceof File) fd.append(k, v);
          else if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
          else fd.append(k, v == null ? '' : String(v));
        });
        res = await formsApi.submitMultipart(form.slug, fd);
      } else {
        res = await formsApi.submit(form.slug, payload);
      }

      setSuccess({
        message: res.data?.message || form.successMessage,
        redirectUrl: res.data?.redirectUrl || form.redirectUrl,
      });
      if (res.data?.redirectUrl && typeof window !== 'undefined') {
        setTimeout(() => { window.location.href = res.data.redirectUrl; }, 1500);
      }
    } catch (err) {
      const details = err.response?.data?.details;
      if (details && typeof details === 'object') setErrors(details);
      else setSubmitError(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading form…</p>;
  if (loadError) return <p className="text-sm text-red-600" role="alert">{loadError}</p>;
  if (!form) return null;

  const displayTitle = title || form.name;
  const displaySubtitle = subtitle || form.description;
  const buttonLabel = submitLabel || form.settings?.submitLabel || 'Submit';

  if (success) {
    return (
      <div className={`rounded-xl border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-6 ${className}`} role="status">
        <p className="text-green-800 dark:text-green-200 font-medium">{success.message}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-1 ${className}`}
      noValidate
      aria-labelledby={displayTitle ? 'form-title' : undefined}
    >
      {displayTitle && <h2 id="form-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{displayTitle}</h2>}
      {displaySubtitle && <p className="text-gray-600 dark:text-gray-300 mb-4">{displaySubtitle}</p>}

      {/* Honeypot — hidden from users */}
      <div className="absolute opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input type="text" name={form.spamSettings?.honeypotField || 'website'} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {fields.map((field) => (
        <FormFieldInput
          key={field.id || field.name}
          field={field}
          value={values[field.name]}
          error={errors[field.name]}
          disabled={preview || submitting}
          onChange={(v) => setValue(field.name, v)}
        />
      ))}

      {submitError && <p className="text-sm text-red-600" role="alert">{submitError}</p>}

      {!preview && (
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 px-5 py-2.5 rounded-lg bg-primary text-white font-medium text-sm disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : buttonLabel}
        </button>
      )}
    </form>
  );
}
