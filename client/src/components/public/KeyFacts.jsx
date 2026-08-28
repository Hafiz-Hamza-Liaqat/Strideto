import { NOT_SPECIFIED, NOT_CONFIGURED } from '@shared/publicDiscovery/publicTruth.js';

const OMIT_FACT_VALUES = new Set([NOT_SPECIFIED, NOT_CONFIGURED]);

function shouldRenderFactValue(value) {
  if (value == null || value === '') return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || OMIT_FACT_VALUES.has(trimmed)) return false;
  }
  return true;
}

/**
 * Visible factual summary for public entity detail pages (SEO-P7).
 * Accepts explicit label/value pairs only; omits unknown or empty values.
 */
export function KeyFacts({
  title = 'Key details',
  facts = [],
  className = '',
  headingId = 'key-facts-heading',
}) {
  const items = (facts || []).filter((fact) => fact && shouldRenderFactValue(fact.value));
  if (items.length === 0) return null;

  return (
    <section
      className={`min-w-0 ${className}`}
      aria-labelledby={headingId}
    >
      <h2
        id={headingId}
        className="text-base font-semibold text-gray-900 dark:text-white mb-3"
      >
        {title}
      </h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {fact.label}
            </dt>
            <dd className="text-sm text-gray-900 dark:text-white break-words-safe mt-0.5">
              {fact.href ? (
                <a
                  href={fact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary dark:text-mint hover:underline break-words-safe"
                >
                  {fact.value}
                </a>
              ) : (
                fact.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
