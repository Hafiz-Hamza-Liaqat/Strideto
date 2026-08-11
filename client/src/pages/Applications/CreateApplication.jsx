import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';
import { applicationsApi } from '../../services/applicationsApi';
import { DocumentPicker } from '../../components/applications/DocumentPicker';
import { isOpportunityApplicationEnabled } from '../../config/careerFeatureFlags';
import { OPPORTUNITY_TYPE_FILTERS } from '../../utils/applicationUi';
import { useToast } from '../../context/ToastContext';

const PLATFORM_TYPES = OPPORTUNITY_TYPE_FILTERS.filter((t) => t !== 'all');

export default function CreateApplication() {
  const { t } = useTranslation(['applications', 'common']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [mode, setMode] = useState(searchParams.get('external') === '1' ? 'external' : 'platform');
  const [opportunityType, setOpportunityType] = useState(searchParams.get('type') || 'job');
  const [opportunityId, setOpportunityId] = useState(searchParams.get('opportunityId') || '');
  const [title, setTitle] = useState(searchParams.get('title') || '');
  const [companyName, setCompanyName] = useState('');
  const [externalUrl, setExternalUrl] = useState(searchParams.get('url') || '');
  const [documentId, setDocumentId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpportunityApplicationEnabled()) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <SeoHead title={t('applications:create.title')} noindex />
        <p className="text-gray-600 dark:text-gray-400" role="alert">{t('applications:featureDisabled')}</p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = mode === 'external'
        ? {
            opportunityType,
            title: title.trim(),
            companyName: companyName.trim(),
            externalUrl: externalUrl.trim(),
            source: 'external',
          }
        : {
            opportunityType,
            opportunityId: opportunityId.trim(),
            source: 'platform',
          };

      const { data: app } = await applicationsApi.create(body);

      if (documentId) {
        await applicationsApi.attachDocument(app._id, {
          documentId,
          role: 'resume',
        });
      }

      toast.success(t('applications:create.success'));
      navigate(`${ROUTES.APPLICATIONS}/${app._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || t('applications:create.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SeoHead title={t('applications:create.title')} description={t('applications:create.subtitle')} noindex />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 min-w-0 w-full">
        <Link to={ROUTES.APPLICATIONS} className="text-sm text-primary dark:text-mint hover:underline mb-4 inline-block">
          {t('applications:backToList')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('applications:create.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('applications:create.subtitle')}</p>
        {mode === 'external' ? (
          <p className="mb-4 text-sm text-amber-800 dark:text-amber-200" role="note">
            {t('applications:create.outsideNote')}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label={t('applications:create.modeLabel')}>
          {['platform', 'external'].map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                mode === m
                  ? 'bg-primary text-white'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t(`applications:create.modes.${m}`)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="opp-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('applications:create.opportunityType')}
            </label>
            <select
              id="opp-type"
              value={opportunityType}
              onChange={(e) => setOpportunityType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              required
            >
              {PLATFORM_TYPES.map((type) => (
                <option key={type} value={type}>{t(`applications:opportunityTypes.${type}`)}</option>
              ))}
            </select>
          </div>

          {mode === 'platform' ? (
            <div>
              <label htmlFor="opp-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('applications:create.opportunityId')}
              </label>
              <input
                id="opp-id"
                type="text"
                value={opportunityId}
                onChange={(e) => setOpportunityId(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                placeholder={t('applications:create.opportunityIdPlaceholder')}
                aria-required="true"
              />
              <p className="text-xs text-gray-500 mt-1">{t('applications:create.opportunityIdHint')}</p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="ext-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('applications:create.externalTitle')}
                </label>
                <input
                  id="ext-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="ext-company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('applications:create.companyName')}
                </label>
                <input
                  id="ext-company"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="ext-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('applications:create.externalUrl')}
                </label>
                <input
                  id="ext-url"
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  placeholder="https://"
                />
              </div>
            </>
          )}

          <DocumentPicker value={documentId} onChange={setDocumentId} disabled={submitting} />

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-primary text-white font-medium text-sm disabled:opacity-50 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              {submitting ? t('applications:create.submitting') : t('applications:create.submit')}
            </button>
            <Link
              to={ROUTES.APPLICATIONS}
              className="inline-flex items-center px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm min-h-[44px]"
            >
              {t('common:cancel')}
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
