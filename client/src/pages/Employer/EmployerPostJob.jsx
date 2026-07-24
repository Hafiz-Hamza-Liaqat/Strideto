import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';

const defaultForm = {
  jobTitle: '',
  companyName: '',
  location: '',
  jobType: 'Private',
  type: 'full-time',
  salaryRange: '',
  skillsRequired: '',
  jobDescription: '',
  applicationDeadline: '',
  applyLink: '',
  applyEmail: '',
};

export default function EmployerPostJob() {
  const { t } = useTranslation(['employer', 'common']);
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [plans, setPlans] = useState([]);
  const [step, setStep] = useState('form');
  const [createdJob, setCreatedJob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    employerApi.plans().then(({ data }) => setPlans(data.data || [])).catch(() => setPlans([]));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmitDraft = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        skillsRequired: form.skillsRequired ? form.skillsRequired.split(',').map((s) => s.trim()).filter(Boolean) : [],
      };
      const { data } = await employerApi.createJob(payload);
      setCreatedJob(data.job);
      setStep('plan');
    } catch (err) {
      setError(err.response?.data?.error || t('employer:failedCreateJob'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (planId, isFree = false) => {
    if (!createdJob) return;
    setSubmitting(true);
    setError('');
    try {
      if (isFree || !planId) {
        await employerApi.activateJob(createdJob._id, { planId: planId || undefined });
        navigate(ROUTES.EMPLOYER_JOBS);
        return;
      }
      const plan = plans.find((p) => p._id === planId);
      if (plan && plan.price > 0) {
        const { data } = await employerApi.createCheckout(createdJob._id, { planId });
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      await employerApi.activateJob(createdJob._id, { planId });
      navigate(ROUTES.EMPLOYER_JOBS);
    } catch (err) {
      setError(err.response?.data?.error || t('employer:failedActivate'));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'plan' && createdJob) {
    return (
      <>
        <SeoHead title={t('employer:choosePlanSeoTitle')} description={t('employer:choosePlanSeoDesc')} noindex />
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] mb-2">{t('employer:choosePlan')}</h1>
        <p className="text-slate-600 mb-6">{t('employer:draftSavedPlan', { title: createdJob.title })}</p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        <div className="grid gap-4 max-w-2xl">
          {createdJob.planType === 'free' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <h3 className="font-semibold text-[#0F172A]">{t('employer:firstJobFree')}</h3>
              <p className="text-sm text-slate-600 mt-1">{t('employer:firstJobFreeDesc')}</p>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleActivate(null, true)}
                className="mt-4 px-4 py-2 bg-[#635BFF] hover:bg-[#4F46E5] text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {t('employer:activateFree')}
              </button>
            </div>
          )}
          {plans.map((plan) => (
            <div key={plan._id} className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <h3 className="font-semibold text-[#0F172A]">{plan.name}</h3>
              <p className="text-2xl font-semibold text-[#635BFF] mt-1">${plan.price}</p>
              <p className="text-sm text-slate-600 mt-1">
                {plan.durationDays ? t('employer:daysDuration', { count: plan.durationDays }) : t('employer:untilFilled')}
              </p>
              <ul className="mt-2 text-sm text-slate-600 list-disc list-inside">
                {(plan.features || []).slice(0, 3).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleActivate(plan._id)}
                className="mt-4 px-4 py-2 bg-[#635BFF] hover:bg-[#4F46E5] text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {t('employer:payAndPublish')}
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title={t('employer:postJobSeoTitle')} description={t('employer:postJobSeoDesc')} noindex />
      <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] mb-6">{t('employer:postNewJob')}</h1>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmitDraft} className="max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:jobTitleRequired')}</label>
          <input
            name="jobTitle"
            value={form.jobTitle}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
            placeholder={t('employer:jobTitlePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:companyNameRequired')}</label>
          <input
            name="companyName"
            value={form.companyName}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('common:location')}</label>
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
            placeholder={t('employer:locationPlaceholder')}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:jobTypeLabel')}</label>
            <select
              name="jobType"
              value={form.jobType}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
            >
              <option value="Private">{t('employer:jobTypePrivate')}</option>
              <option value="Government">{t('employer:jobTypeGovernment')}</option>
              <option value="Internship">{t('employer:jobTypeInternship')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:workTypeLabel')}</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
            >
              <option value="full-time">{t('common:fullTime')}</option>
              <option value="part-time">{t('common:partTime')}</option>
              <option value="contract">{t('common:contract')}</option>
              <option value="internship">{t('common:internship')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:salaryRange')}</label>
          <input
            name="salaryRange"
            value={form.salaryRange}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
            placeholder={t('employer:salaryPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:skillsCommaSeparated')}</label>
          <input
            name="skillsRequired"
            value={form.skillsRequired}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
            placeholder={t('employer:skillsPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:descriptionRequired')}</label>
          <textarea
            name="jobDescription"
            value={form.jobDescription}
            onChange={handleChange}
            required
            rows={5}
            className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:applicationDeadline')}</label>
          <input
            name="applicationDeadline"
            type="date"
            value={form.applicationDeadline}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:applyLink')}</label>
          <input
            name="applyLink"
            type="url"
            value={form.applyLink}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
            placeholder={t('employer:applyLinkPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1">{t('employer:orApplyEmail')}</label>
          <input
            name="applyEmail"
            type="email"
            value={form.applyEmail}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A]"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 bg-[#635BFF] hover:bg-[#4F46E5] text-white font-medium rounded-lg disabled:opacity-50"
        >
          {submitting ? t('common:saving') : t('employer:saveDraftChoosePlan')}
        </button>
      </form>
    </>
  );
}
