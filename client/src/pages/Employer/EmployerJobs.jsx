import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';
import { EmptyState } from '../../components/common/EmptyState';

const STATUS_FILTERS = ['', 'draft', 'active', 'closed'];

export default function EmployerJobs() {
  const { t } = useTranslation(['employer', 'common']);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    employerApi
      .getJobs({ status: status || undefined })
      .then(({ data }) => setJobs(data.data || []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [status]);

  const statusLabel = (s) => {
    if (!s) return t('common:all');
    const key = s === 'active' ? 'active' : s === 'draft' ? 'draft' : s === 'closed' ? 'closed' : s;
    return t(`common:${key}`, { defaultValue: s });
  };

  return (
    <>
      <SeoHead title={t('employer:myJobsSeoTitle')} description={t('employer:myJobsSeoDesc')} noindex />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0F172A]">{t('employer:myJobPosts')}</h1>
        <Link
          to={ROUTES.EMPLOYER_POST_JOB}
          className="px-4 py-2.5 bg-[#635BFF] hover:bg-[#4F46E5] text-white text-sm font-medium rounded-lg min-h-[44px] inline-flex items-center shrink-0"
        >
          {t('employer:postNewJob')}
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3 py-2 text-sm rounded-lg min-h-[44px] ${
              status === s ? 'bg-[#635BFF] text-white' : 'bg-white border border-[#E5E7EB] text-slate-600'
            }`}
          >
            {statusLabel(s)}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-600">{t('common:loading')}</div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon="🏢"
            title="Post your first job"
            description="Create your first job posting and start hiring."
            actionLabel="Post a Job"
            actionTo={ROUTES.EMPLOYER_POST_JOB}
          />
        ) : (
          <>
            <div className="md:hidden divide-y divide-[#E5E7EB]">
              {jobs.map((j) => (
                <div key={j._id} className="p-4 space-y-2">
                  <Link
                    to={`/jobs/${j.slug}`}
                    className="font-medium text-[#0F172A] hover:text-[#635BFF] break-words-safe block"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {j.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded ${
                        j.status === 'active' ? 'bg-green-100 text-green-800' : j.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {statusLabel(j.status)}
                    </span>
                    <span>{t('common:views')}: {j.views ?? 0}</span>
                    <span>{t('common:applications')}: {j.applicationsCount ?? 0}</span>
                  </div>
                  <Link
                    to={`${ROUTES.EMPLOYER_APPLICATIONS}?jobId=${j._id}`}
                    className="text-sm text-[#635BFF] hover:underline inline-flex min-h-[44px] items-center"
                  >
                    {t('employer:viewApplications')}
                  </Link>
                </div>
              ))}
            </div>
            <div className="hidden md:block table-scroll">
              <table>
                <thead className="bg-slate-50 border-b border-[#E5E7EB]">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#0F172A]">{t('common:title')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#0F172A]">{t('common:status')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#0F172A]">{t('common:views')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#0F172A]">{t('common:applications')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#0F172A]">{t('common:actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {jobs.map((j) => (
                    <tr key={j._id}>
                      <td className="py-3 px-4">
                        <Link to={`/jobs/${j.slug}`} className="font-medium text-[#0F172A] hover:text-[#635BFF] break-words-safe" target="_blank" rel="noopener noreferrer">
                          {j.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded ${
                            j.status === 'active' ? 'bg-green-100 text-green-800' : j.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {statusLabel(j.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{j.views ?? 0}</td>
                      <td className="py-3 px-4 text-slate-600">{j.applicationsCount ?? 0}</td>
                      <td className="py-3 px-4">
                        <Link
                          to={`${ROUTES.EMPLOYER_APPLICATIONS}?jobId=${j._id}`}
                          className="text-sm text-[#635BFF] hover:underline"
                        >
                          {t('employer:viewApplications')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
