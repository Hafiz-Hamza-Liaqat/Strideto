import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';

const TOPICS = [
  'guideVerification',
  'guideFreeJobs',
  'guideDrafts',
  'guideQuota',
  'guideActiveLimit',
  'guideRolling',
  'guideReview',
  'guideDuration',
  'guideRepost',
  'guideOpenings',
  'guideInternalExternal',
  'guidePipeline',
  'guideInterviews',
  'guidePayments',
  'guideRefunds',
  'guideProhibited',
  'guidePrivacy',
  'guideSkillTrust',
];

export default function EmployerGuidelines() {
  const { t } = useTranslation(['employer']);
  return (
    <>
      <SeoHead title={t('employer:guidelinesSeoTitle')} description={t('employer:guidelinesSeoDesc')} noindex />
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
        {t('employer:navGuidelines')}
      </h1>
      <p className="text-sm text-slate-600 dark:text-gray-400 mb-6 max-w-2xl">{t('employer:guidelinesIntro')}</p>
      <div className="space-y-4 max-w-3xl">
        {TOPICS.map((key) => (
          <section key={key} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white">{t(`employer:${key}Title`)}</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-gray-300 whitespace-pre-line">{t(`employer:${key}Body`)}</p>
          </section>
        ))}
      </div>
    </>
  );
}
