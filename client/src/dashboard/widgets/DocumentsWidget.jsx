import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { formatApplicationDate } from '../../utils/applicationUi';
import { WidgetShell } from '../WidgetShell';

/**
 * @param {{ data?: object }} props
 */
export function DocumentsWidget({ data }) {
  const { t, i18n } = useTranslation(['dashboard', 'documents-platform']);

  if (!data) {
    return (
      <WidgetShell title={t('dashboard:widgets.documents')}>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard:widgets.unavailable')}</p>
      </WidgetShell>
    );
  }

  const recent = data.recent || [];
  const expiring = data.expiring || [];

  return (
    <WidgetShell title={t('dashboard:widgets.documents')}>
      <div className="flex gap-4 text-sm mb-3">
        <span className="text-gray-600 dark:text-gray-400">
          {t('dashboard:widgets.resumeCount', { count: data.resumeCount || 0 })}
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          {t('dashboard:widgets.certificateCount', { count: data.certificateCount || 0 })}
        </span>
      </div>
      {expiring.length > 0 && (
        <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
            {t('dashboard:widgets.expiringSoon')}
          </p>
          <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
            {expiring.slice(0, 3).map((doc) => (
              <li key={doc._id}>
                {doc.title || doc.fileName}
                {doc.expiresAt ? (
                  <span className="text-xs ml-1">
                    ({formatApplicationDate(doc.expiresAt, i18n.language)})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {recent.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {recent.map((doc) => (
            <li key={doc._id} className="flex justify-between gap-2">
              <span className="text-gray-900 dark:text-white truncate">{doc.title || doc.fileName}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {t(`documents-platform:types.${doc.documentType}`, { defaultValue: doc.documentType })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard:widgets.noDocuments')}</p>
      )}
      <Link to={ROUTES.VAULT} className="mt-3 inline-block text-sm text-primary dark:text-mint hover:underline">
        {t('dashboard:widgets.manageDocuments')}
      </Link>
    </WidgetShell>
  );
}
