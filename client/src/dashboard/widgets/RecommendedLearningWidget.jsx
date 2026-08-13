import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { WidgetShell } from '../WidgetShell';

/** L.2.6 — Deterministic learning recommendations (no AI). */
export function RecommendedLearningWidget({ data }) {
  const { t } = useTranslation(['dashboard']);
  const items = data?.items || [];

  return (
    <WidgetShell title={t('dashboard:widgets.recommendedLearning')}>
      {!items.length ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('dashboard:widgets.learningEmpty', {
            defaultValue: 'Complete your profile and explore Tests & Prep to unlock personalized learning steps.',
          })}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const isExternal = Boolean(item.external);
            const className = 'block rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-primary transition-colors';
            const href = String(item.href || '/tests').startsWith('/assessments') ? '/tests' : (item.href || '/tests');
            const body = (
              <>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                {item.reason ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.reason}</p>
                ) : null}
                <p className="text-[11px] uppercase tracking-wide text-primary mt-1">{item.type}</p>
              </>
            );
            return (
              <li key={item.id}>
                {isExternal ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
                    {body}
                  </a>
                ) : (
                  <Link to={href} className={className}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
}
