import { useState, useEffect, useRef } from 'react';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { adminImportApi } from '../../services/publicProfilesService';
import { Alert } from '../../components/ui/Alerts';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';

const RESOURCES = [
  { id: 'jobs', labelKey: 'importJobs' },
  { id: 'scholarships', labelKey: 'importScholarships' },
  { id: 'admissions', labelKey: 'importAdmissions' },
  { id: 'blogs', labelKey: 'importBlogs' },
  { id: 'mcqs', labelKey: 'importMcqs' },
  { id: 'career-guidance', labelKey: 'importCareer' },
  { id: 'foreign-studies', labelKey: 'importForeignStudies' },
];

export default function AdminImport() {
  const { t } = useTranslation(['admin', 'common']);
  const [resource, setResource] = useState('jobs');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    adminImportApi.resources()
      .then(({ data }) => setMeta(data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(t('admin:importSelectFile'));
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const { data } = await adminImportApi.upload(resource, file);
      setReport(data);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.error || t('admin:importFailed');
      setError(msg);
      if (data?.detectedColumns?.length) {
        setReport({
          columnMismatch: true,
          detectedColumns: data.detectedColumns,
          missingColumns: data.missingColumns,
          hint: data.hint,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_IMPORT}>
      <SeoHead title={t('admin:importTitle')} description={t('admin:importDescription')} noindex />
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('admin:importTitle')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{t('admin:importIntro')}</p>

        {meta && (
          <p className="text-xs text-gray-500 mb-4">
            {t('admin:importFormats')}: {meta.formats?.join(', ')}
          </p>
        )}

        <div className="mb-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-600 dark:text-gray-400">
          <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin:importRequiredColumns')}</p>
          <p>{t(`admin:importColumns_${resource.replace(/-/g, '_')}`, { defaultValue: t('admin:importColumnsDefault') })}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin:importResource')}</label>
            <AdminSelectBare
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              {RESOURCES.map((r) => (
                <option key={r.id} value={r.id}>{t(`admin:${r.labelKey}`)}</option>
              ))}
            </AdminSelectBare>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin:importFile')}</label>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,.xlsx,.xls"
              className="w-full text-sm text-gray-600 dark:text-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? t('common:loading') : t('admin:importUpload')}
          </button>
        </form>

        {error && <Alert variant="error" className="mt-4">{error}</Alert>}

        {report?.columnMismatch && (
          <div className="mt-4 p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200 mb-2">{t('admin:importColumnMismatch')}</p>
            {report.detectedColumns?.length > 0 && (
              <p className="text-amber-800 dark:text-amber-300 mb-1">
                <span className="font-medium">{t('admin:importDetectedColumns')}:</span>{' '}
                {report.detectedColumns.join(', ')}
              </p>
            )}
            {report.hint && <p className="text-amber-800 dark:text-amber-300">{report.hint}</p>}
          </div>
        )}

        {report && !report.columnMismatch && (
          <div className="mt-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('admin:importReport')}</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><dt className="text-gray-500">{t('admin:imported')}</dt><dd className="font-bold text-emerald-600">{report.imported}</dd></div>
              <div><dt className="text-gray-500">{t('admin:skipped')}</dt><dd className="font-bold text-amber-600">{report.skipped}</dd></div>
              <div><dt className="text-gray-500">{t('admin:failed')}</dt><dd className="font-bold text-red-600">{report.failed}</dd></div>
              <div><dt className="text-gray-500">{t('admin:totalRows')}</dt><dd className="font-bold">{report.totalRows}</dd></div>
            </dl>
            {report.errors?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin:importErrors')}</p>
                <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 max-h-40 overflow-y-auto">
                  {report.errors.slice(0, 20).map((err, i) => (
                    <li key={i}>Row {err.row}: {err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
}
