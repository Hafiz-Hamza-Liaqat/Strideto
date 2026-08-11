import { LAYOUT_FIELD_TYPES } from '@shared/formSchema.js';
import { adminFieldClass } from '../admin/AdminImageUrlField';
import { sanitizeHtmlForRender } from '../../utils/sanitizeHtml';

/**
 * Render a single form field with a11y (C.7.0.2).
 */
export function FormFieldInput({
  field,
  value,
  onChange,
  error,
  disabled,
  idPrefix = 'form',
}) {
  const inputId = `${idPrefix}-${field.name}`;
  const helpId = field.helpText ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  if (LAYOUT_FIELD_TYPES.has(field.type)) {
    if (field.type === 'divider') {
      return <hr className="my-4 border-gray-200 dark:border-gray-700" aria-hidden="true" />;
    }
    if (field.type === 'heading') {
      return <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">{field.label}</h3>;
    }
    if (field.type === 'richtext') {
      const safe = sanitizeHtmlForRender(field.defaultValue || field.label || '');
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none mb-4"
          dangerouslySetInnerHTML={{ __html: safe }}
        />
      );
    }
    if (field.type === 'hidden') return null;
  }

  const common = {
    id: inputId,
    name: field.name,
    disabled,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: `${adminFieldClass} ${error ? 'border-red-500' : ''}`,
  };

  let control = null;

  switch (field.type) {
    case 'textarea':
      control = (
        <textarea
          {...common}
          rows={4}
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'select':
      control = (
        <select {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {(field.options || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
      break;
    case 'radio':
      control = (
        <fieldset className="space-y-2 mt-1">
          {(field.options || []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.name}
                value={o.value}
                checked={value === o.value}
                disabled={disabled}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      );
      break;
    case 'checkbox':
    case 'consent':
      control = (
        <label className="flex items-start gap-2 text-sm mt-1">
          <input
            type="checkbox"
            id={inputId}
            name={field.name}
            checked={Boolean(value)}
            disabled={disabled}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-1"
          />
          <span>{field.label}{field.required ? ' *' : ''}</span>
        </label>
      );
      break;
    case 'multi-checkbox':
      control = (
        <fieldset className="space-y-2 mt-1">
          {(field.options || []).map((o) => {
            const arr = Array.isArray(value) ? value : [];
            return (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={o.value}
                  checked={arr.includes(o.value)}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...arr, o.value]
                      : arr.filter((x) => x !== o.value);
                    onChange(next);
                  }}
                />
                {o.label}
              </label>
            );
          })}
        </fieldset>
      );
      break;
    case 'file':
      control = (
        <input
          {...common}
          type="file"
          accept={(field.validation?.allowedTypes || ['image/*', 'application/pdf']).join(',')}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      );
      break;
    default:
      control = (
        <input
          {...common}
          type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(field.type === 'number' ? e.target.value : e.target.value)}
        />
      );
  }

  if (field.type === 'checkbox' || field.type === 'consent') {
    return (
      <div className="mb-4">
        {control}
        {field.helpText && <p id={helpId} className="text-xs text-gray-500 mt-1 ml-6">{field.helpText}</p>}
        {error && <p id={errorId} className="text-xs text-red-600 mt-1" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {field.label}{field.required ? ' *' : ''}
      </label>
      {control}
      {field.helpText && <p id={helpId} className="text-xs text-gray-500 mt-1">{field.helpText}</p>}
      {error && <p id={errorId} className="text-xs text-red-600 mt-1" role="alert">{error}</p>}
    </div>
  );
}
