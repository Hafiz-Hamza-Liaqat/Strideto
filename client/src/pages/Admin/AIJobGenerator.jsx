import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { aiJobApi } from '../../services/listingsService';
import { useToast } from '../../context/ToastContext';
import { AdminErrorBoundary, normalizeGenerateResult } from '../../components/admin/AdminErrorBoundary';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { LocationCascadeFilter } from '../../components/forms/LocationCascadeFilter';
import { PERMISSIONS } from '../../config/rbac';
import { JOB_FAMILIES, SPECIALIZATIONS_BY_FAMILY } from '../../constants/listings';
import { ROUTES } from '../../constants';

const fieldClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 min-h-[44px]';

function SectionEditor({ label, value, onChange, rows = 4 }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`${fieldClass} font-sans text-sm`}
      />
    </div>
  );
}

function AIJobGeneratorForm() {
  const { t } = useTranslation(['admin', 'common', 'employer']);
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [location, setLocation] = useState({ countryCode: '', region: '', city: '' });
  const [jobFamily, setJobFamily] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [skills, setSkills] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const specializations = useMemo(
    () => (jobFamily ? SPECIALIZATIONS_BY_FAMILY[jobFamily] || [] : []),
    [jobFamily]
  );

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t('admin:titleRequired'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await aiJobApi.generate({
        title: title.trim(),
        organization: organization.trim() || undefined,
        location: [location.city, location.region, location.countryCode].filter(Boolean).join(', ') || undefined,
        jobFamily: jobFamily || undefined,
        specialization: specialization || undefined,
        workMode: workMode || undefined,
        skills: skills.trim() ? skills.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : undefined,
      });
      const normalized = normalizeGenerateResult(data);
      if (!normalized || !normalized.description) {
        setError(t('admin:generationFailed'));
        toast.error(t('admin:generationFailed'));
        return;
      }
      setResult({
        ...normalized,
        sections: {
          summary: normalized.sections?.summary || normalized.summary || '',
          about: normalized.sections?.about || '',
          responsibilities: normalized.sections?.responsibilities || '',
          requirements: normalized.sections?.requirements || '',
          skills: normalized.sections?.skills || '',
          other: normalized.sections?.other || '',
        },
      });
      setEditing(true);
      toast.success(t('admin:generationSuccess'));
    } catch (err) {
      const msg = err.response?.data?.error || t('admin:generationFailed');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const patchSection = (key, value) => {
    setResult((current) => current ? { ...current, sections: { ...current.sections, [key]: value } } : current);
  };

  const composedDescription = result?.sections
    ? [
      result.sections.summary && `SUMMARY\n${result.sections.summary}`,
      result.sections.about && `ABOUT THE ROLE\n${result.sections.about}`,
      result.sections.responsibilities && `RESPONSIBILITIES\n${result.sections.responsibilities}`,
      result.sections.requirements && `REQUIREMENTS\n${result.sections.requirements}`,
      result.sections.skills && `SKILLS\n${result.sections.skills}`,
      result.sections.other && `OTHER DETAILS\n${result.sections.other}`,
    ].filter(Boolean).join('\n\n')
    : result?.description || '';

  const copyText = () => {
    navigator.clipboard.writeText(composedDescription);
    toast.success(t('common:copied', { defaultValue: 'Copied' }));
  };

  const useInJobForm = () => {
    try {
      sessionStorage.setItem('strideto-admin-job-draft', JSON.stringify({
        title,
        organization,
        description: composedDescription,
        countryCode: location.countryCode,
        region: location.region,
        city: location.city,
        jobFamily,
        specialization,
        workMode,
      }));
    } catch {
      /* ignore */
    }
    copyText();
  };

  return (
    <>
      <SeoHead title={t('admin:aiJobGenerator')} description={t('admin:aiJobSeoDesc')} noindex />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('admin:aiJobHeading')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('admin:aiJobIntro')}</p>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin:jobTitleRequired')}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('admin:jobTitlePlaceholder')} className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin:organizationCompany')}</label>
            <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder={t('admin:organizationPlaceholder')} className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country / region / city</label>
            <LocationCascadeFilter
              className="flex flex-col gap-2"
              countryCode={location.countryCode}
              region={location.region}
              city={location.city}
              onChange={setLocation}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job family</label>
              <select value={jobFamily} onChange={(e) => { setJobFamily(e.target.value); setSpecialization(''); }} className={fieldClass}>
                <option value="">Select family</option>
                {JOB_FAMILIES.map((family) => <option key={family} value={family}>{family}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Specialization</label>
              <select value={specialization} onChange={(e) => setSpecialization(e.target.value)} disabled={!jobFamily} className={fieldClass}>
                <option value="">{jobFamily ? 'Select specialization' : 'Select a family first'}</option>
                {specializations.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Work mode</label>
            <select value={workMode} onChange={(e) => setWorkMode(e.target.value)} className={fieldClass}>
              <option value="">Unspecified</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="on_site">On-site</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('employer:skillsCommaSeparated')}</label>
            <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder={t('admin:skillsPlaceholder')} className={fieldClass} />
          </div>
          <button type="submit" disabled={loading} className="min-h-[44px] rounded-lg bg-primary hover:bg-primary-hover text-white btn-theme px-4 py-2 font-medium disabled:opacity-50">
            {loading ? t('admin:generating') : t('admin:generateDescription')}
          </button>
        </form>

        {loading && (
          <p className="text-gray-500 dark:text-gray-400 animate-pulse mb-4">{t('admin:generating')}</p>
        )}

        {result && !loading && (
          <div className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin:generatedEditable')}</h2>
            <SectionEditor label="SUMMARY" value={result.sections?.summary || ''} onChange={(v) => patchSection('summary', v)} rows={3} />
            <SectionEditor label="ABOUT THE ROLE" value={result.sections?.about || ''} onChange={(v) => patchSection('about', v)} />
            <SectionEditor label="RESPONSIBILITIES" value={result.sections?.responsibilities || ''} onChange={(v) => patchSection('responsibilities', v)} />
            <SectionEditor label="REQUIREMENTS" value={result.sections?.requirements || ''} onChange={(v) => patchSection('requirements', v)} />
            <SectionEditor label="SKILLS" value={result.sections?.skills || ''} onChange={(v) => patchSection('skills', v)} rows={3} />
            <SectionEditor label="OTHER DETAILS" value={result.sections?.other || ''} onChange={(v) => patchSection('other', v)} rows={3} />
            <details className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer">Advanced / developer payload</summary>
              <pre className="text-xs mt-1 text-gray-600 dark:text-gray-300 overflow-auto">{JSON.stringify(result.suggested, null, 2)}</pre>
            </details>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600" onClick={() => setEditing((v) => !v)}>
                {editing ? 'Lock preview' : 'Edit'}
              </button>
              <button type="button" className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600" onClick={copyText}>
                Copy
              </button>
              <Link
                to={ROUTES.ADMIN_JOBS || '/admin/jobs'}
                onClick={useInJobForm}
                className="inline-flex items-center min-h-[44px] px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover"
              >
                Use in Job Form
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function AIJobGenerator() {
  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_JOBS}>
      <AdminErrorBoundary>
        <AIJobGeneratorForm />
      </AdminErrorBoundary>
    </AdminRouteGuard>
  );
}
