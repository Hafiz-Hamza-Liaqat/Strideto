import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { StageBadge } from './StageBadge';
import {
  applicationDisplayTitle,
  formatApplicationDate,
} from '../../utils/applicationUi';

export function ApplicationTable({ applications }) {
  const { t, i18n } = useTranslation(['applications']);

  return (
    <div className="table-scroll rounded-xl border border-gray-200 dark:border-gray-700" role="region" aria-label={t('applications:views.table')}>
      <table className="min-w-full text-sm text-left">
        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">{t('applications:table.title')}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t('applications:table.company')}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t('applications:table.type')}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t('applications:table.stage')}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t('applications:table.updated')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
          {applications.map((app) => (
            <tr key={app._id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
              <td className="px-4 py-3">
                <Link
                  to={`${ROUTES.APPLICATIONS}/${app._id}`}
                  className="font-medium text-primary dark:text-mint hover:underline"
                >
                  {applicationDisplayTitle(app, t)}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{app.companyName || '—'}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                {app.opportunityRef?.opportunityType
                  ? t(`applications:opportunityTypes.${app.opportunityRef.opportunityType}`)
                  : '—'}
              </td>
              <td className="px-4 py-3"><StageBadge stage={app.pipelineStage} /></td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {formatApplicationDate(app.updatedAt, i18n.language)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
