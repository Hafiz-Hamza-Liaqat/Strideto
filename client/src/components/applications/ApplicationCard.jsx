import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { StageBadge } from './StageBadge';
import { applicationDisplayTitle, formatApplicationDate } from '../../utils/applicationUi';
import { ROUTES } from '../../constants';

export function ApplicationCard({ application }) {
  const { t, i18n } = useTranslation(['applications', 'common']);
  const title = applicationDisplayTitle(application, t);
  const type = application.opportunityRef?.opportunityType;

  return (
    <article className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-primary/40 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            <Link
              to={`${ROUTES.APPLICATIONS}/${application._id}`}
              className="hover:text-primary dark:hover:text-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              {title}
            </Link>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {type ? t(`applications:opportunityTypes.${type}`, { defaultValue: type }) : ''}
            {application.companyName ? ` · ${application.companyName}` : ''}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {application.stageAuthority === 'personal'
              ? t('applications:authority.myTrackingStatus')
              : application.applicationChannel === 'institution'
                ? t('applications:authority.institutionStatus')
                : t('applications:authority.employerStatus')}
            {application.applicationChannel === 'external_personal'
              ? ` · ${t('applications:authority.outsideStrideto')}`
              : ''}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {t('applications:list.updated', {
              date: formatApplicationDate(application.updatedAt, i18n.language, { time: true }),
            })}
          </p>
        </div>
        <StageBadge stage={application.pipelineStage} />
      </div>
    </article>
  );
}
