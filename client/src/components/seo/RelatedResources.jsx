import { Link } from 'react-router-dom';

/**
 * SEO-P4 — lightweight related hub/resource links module.
 *
 * @param {{
 *   title: string;
 *   items: { label: string; path: string; description?: string }[];
 *   maxItems?: number;
 *   variant?: 'cards' | 'list';
 *   className?: string;
 * }} props
 */
export function RelatedResources({
  title,
  items = [],
  maxItems = 4,
  variant = 'cards',
  className = '',
}) {
  const visible = (items || []).filter((item) => item?.label && item?.path).slice(0, maxItems);
  if (!visible.length) return null;

  return (
    <section
      className={`mt-10 pt-8 border-t border-gray-200 dark:border-gray-700 min-w-0 ${className}`.trim()}
      aria-labelledby="related-resources-heading"
    >
      <h2
        id="related-resources-heading"
        className="text-xl font-bold text-gray-900 dark:text-white mb-4"
      >
        {title}
      </h2>
      {variant === 'list' ? (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className="text-primary dark:text-mint hover:underline break-words-safe"
              >
                {item.label}
              </Link>
              {item.description ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {visible.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md hover:border-edur-blue/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 min-w-0"
            >
              <span className="font-semibold text-gray-900 dark:text-white break-words-safe">{item.label}</span>
              {item.description ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 break-words-safe">{item.description}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
