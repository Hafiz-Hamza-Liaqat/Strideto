import { useState, useEffect, useId } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { ROUTES } from '../../constants';
import {
  FIELD_IDS,
  validateEmployerPostJobForm,
  buildUpdateJobPayload,
  jobToForm,
  mapServerErrorToFields,
  APPLY_METHOD_VALUES,
  DEFAULT_APPLY_METHOD,
  validateApplyMethodSelection,
  resolveApplyMethodFromJob,
  JOB_FAMILIES,
  SPECIALIZATIONS_BY_FAMILY,
} from './employerPostJobValidation';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { DateInput } from '../../components/forms/NativeTemporalInput';
import { regionsForCountry } from '@shared/international/regions.js';
import { JobDescriptionUploadPanel } from '../../components/jobs/JobDescriptionUploadPanel';
import { EMPLOYER_SUGGESTION_FIELD_MAP } from '../../components/jobs/jobDocumentSuggestionMerge';

const defaultForm = {
  jobTitle: '',
  companyName: '',
  location: '',
  countryCode: '',
  region: '',
  city: '',
  jobFamily: '',
  specialization: '',
  jobType: 'Private',
  type: 'full-time',
  workMode: '',
  experience: '',
  educationRequirement: '',
  salaryRange: '',
  salaryCurrency: '',
  skillsRequired: '',
  requirements: '',
  responsibilities: '',
  jobDescription: '',
  applicationDeadline: '',
  applyLink: '',
  applyEmail: '',
  applyMethod: DEFAULT_APPLY_METHOD,
  openingsCount: '1',
};

const APPLY_METHOD_META = {
  internal: { labelKey: 'applyMethodInternalLabel', helpKey: 'applyMethodInternalHelp' },
  external_url: { labelKey: 'applyMethodExternalUrlLabel', helpKey: 'applyMethodExternalUrlHelp' },
  external_email: { labelKey: 'applyMethodExternalEmailLabel', helpKey: 'applyMethodExternalEmailHelp' },
};

const labelClass = 'block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1';
const helpClass = 'mt-1 text-xs text-gray-600 dark:text-gray-400';
const errorClass = 'mt-1 text-sm text-red-600 dark:text-red-400';
const inputClass =
  'w-full min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 disabled:cursor-not-allowed';
const requiredMarkClass = 'text-red-600 dark:text-red-400';
const optionalMarkClass = 'text-gray-500 dark:text-gray-400 font-normal';

function RequiredMark() {
  return (
    <span className={requiredMarkClass} aria-hidden="true">
      {' '}
      *
    </span>
  );
}

function OptionalMark({ t }) {
  return <span className={optionalMarkClass}> ({t('employer:optional')})</span>;
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className={errorClass} role="alert">
      {message}
    </p>
  );
}

export default function EmployerPostJob() {
  const { t } = useTranslation(['employer', 'common']);
  const navigate = useNavigate();
  const { jobId } = useParams();
  const isEdit = Boolean(jobId);
  const { employer } = useEmployerAuth();
  const formErrorId = useId();

  const [form, setForm] = useState(defaultForm);
  const [plans, setPlans] = useState([]);
  const [paidPublishingEnabled, setPaidPublishingEnabled] = useState(false);
  const [step, setStep] = useState('form');
  const [createdJob, setCreatedJob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [prefilledCompany, setPrefilledCompany] = useState(false);
  const [loadingJob, setLoadingJob] = useState(isEdit);
  const [editMeta, setEditMeta] = useState(null);

  useEffect(() => {
    if (!isEdit || !jobId) return;
    setLoadingJob(true);
    employerApi
      .getJob(jobId)
      .then(({ data }) => {
        setForm(jobToForm(data.job));
        setEditMeta({
          status: data.job?.status,
          approvalStatus: data.job?.approvalStatus,
          applyMethod: resolveApplyMethodFromJob(data.job || {}),
        });
        setPrefilledCompany(true);
      })
      .catch(() => {
        setError(t('employer:jobLoadFailed'));
      })
      .finally(() => setLoadingJob(false));
  }, [isEdit, jobId, t]);

  useEffect(() => {
    if (isEdit) return;
    employerApi.plansUsage()
      .then(({ data }) => setPaidPublishingEnabled(data?.entitlement?.paidPublishingEnabled === true))
      .catch(() => setPaidPublishingEnabled(false));
    employerApi.plans().then(({ data }) => setPlans(data.data || [])).catch(() => setPlans([]));
  }, [isEdit]);

  useEffect(() => {
    if (isEdit || prefilledCompany) return;
    const company = employer?.companyName?.trim();
    if (!company) return;
    setForm((f) => (f.companyName ? f : { ...f, companyName: company }));
    setPrefilledCompany(true);
  }, [employer?.companyName, prefilledCompany, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      if (name === 'jobFamily') next.specialization = '';
      if (name === 'countryCode') {
        next.region = '';
        next.city = '';
      }
      if (name === 'region') next.city = '';
      return next;
    });
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const translateFieldError = (key) => (key ? t(`employer:${key}`) : '');

  const describedBy = (field, helpId) => {
    const parts = [];
    if (helpId) parts.push(helpId);
    if (fieldErrors[field]) parts.push(`${FIELD_IDS[field]}-error`);
    return parts.length ? parts.join(' ') : undefined;
  };

  const handleSubmitDraft = async (e) => {
    e.preventDefault();
    setError('');
    const result = validateEmployerPostJobForm(form, { requireOpenings: !isEdit || String(form.openingsCount || '').trim() !== '' });
    // The application-method selector (create and edit alike, PF-HIRE-B2) is
    // authoritative for applyLink/applyEmail requirements — supersede (not
    // append to) the generic validator's own optional-fields checks for
    // those two fields, so a stale error can't be shown for a field the
    // selected method has since hidden.
    const baseErrors = { ...result.errors };
    delete baseErrors.applyLink;
    delete baseErrors.applyEmail;
    const methodResult = validateApplyMethodSelection(form);
    const mergedErrors = { ...baseErrors, ...methodResult.errors };
    if (!result.ok || !methodResult.ok) {
      setFieldErrors(mergedErrors);
      const firstKey = Object.keys(mergedErrors)[0];
      const el = firstKey ? document.getElementById(FIELD_IDS[firstKey]) : null;
      if (el?.focus) el.focus();
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      // buildUpdateJobPayload and the create payload are identical in shape
      // (both layer buildApplyMethodPayload's explicit applyType/applyLink/
      // applyEmail over the base field payload) — using the same builder for
      // both modes guarantees edit submissions get the same clear-not-omit
      // guarantee create already had.
      const payload = buildUpdateJobPayload(form, result.skills);
      if (isEdit) {
        const { data } = await employerApi.updateJob(jobId, payload);
        navigate(ROUTES.EMPLOYER_JOBS, {
          state: { message: data.message || t('employer:jobUpdated') },
        });
        return;
      }
      const { data } = await employerApi.createJob(payload);
      setCreatedJob(data.job);
      setStep('plan');
    } catch (err) {
      const serverMsg = err.response?.data?.error || t('employer:failedCreateJob');
      setError(serverMsg);
      const mapped = mapServerErrorToFields(serverMsg);
      if (Object.keys(mapped).length) setFieldErrors(mapped);
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
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
          {paidPublishingEnabled ? t('employer:choosePlan') : 'Submit for review'}
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {t('employer:draftSavedPlan', { title: createdJob.title })}
          {' '}
          {t('employer:draftDidNotConsumeQuota')}
        </p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">
            {error}
          </div>
        )}
        <div className="grid gap-4 max-w-2xl w-full min-w-0">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('employer:firstJobFree')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t('employer:firstJobFreeDesc')}</p>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleActivate(null, true)}
              className="mt-4 min-h-[44px] px-4 py-2 bg-primary hover:opacity-90 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {t('employer:activateFree')}
            </button>
          </div>
          {paidPublishingEnabled ? plans.map((plan) => (
            <div key={plan._id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
              <p className="text-2xl font-semibold text-primary mt-1">${plan.price}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {plan.durationDays ? t('employer:daysDuration', { count: plan.durationDays }) : t('employer:untilFilled')}
              </p>
              <ul className="mt-2 text-sm text-gray-600 dark:text-gray-300 list-disc list-inside">
                {(plan.features || []).slice(0, 3).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleActivate(plan._id)}
                className="mt-4 min-h-[44px] px-4 py-2 bg-primary hover:opacity-90 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {t('employer:payAndPublish')}
              </button>
            </div>
          )) : null}
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setStep('form');
              setError('');
            }}
            className="text-sm text-primary dark:text-mint hover:underline text-left min-h-[44px]"
          >
            {t('employer:backToEditDraft')}
          </button>
        </div>
      </>
    );
  }

  if (loadingJob) {
    return <div className="text-slate-600 dark:text-gray-300">{t('common:loading')}</div>;
  }

  const regionCatalog = regionsForCountry(form.countryCode);

  return (
    <>
      <SeoHead
        title={isEdit ? t('employer:editJobSeoTitle') : t('employer:postJobSeoTitle')}
        description={isEdit ? t('employer:editJobSeoDesc') : t('employer:postJobSeoDesc')}
        noindex
      />
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
        {isEdit ? t('employer:editJob') : t('employer:postNewJob')}
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 max-w-2xl">
        {isEdit ? t('employer:editJobIntro', { status: editMeta?.status || '' }) : t('employer:postJobIntro')}
      </p>

      {error && (
        <div
          id={formErrorId}
          className="mb-4 max-w-2xl p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmitDraft}
        className="max-w-2xl w-full min-w-0 space-y-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6"
        noValidate
        aria-describedby={error ? formErrorId : undefined}
      >
        <JobDescriptionUploadPanel
          uploadFn={employerApi.extractJobFromDocument}
          fieldMap={EMPLOYER_SUGGESTION_FIELD_MAP}
          form={form}
          onApply={(next) => setForm(next)}
        />

        <div>
          <label htmlFor={FIELD_IDS.jobTitle} className={labelClass}>
            {t('employer:jobTitle')}
            <RequiredMark />
            <span className="sr-only">{t('employer:required')}</span>
          </label>
          <input
            id={FIELD_IDS.jobTitle}
            name="jobTitle"
            value={form.jobTitle}
            onChange={handleChange}
            required
            aria-required="true"
            aria-invalid={fieldErrors.jobTitle ? 'true' : undefined}
            aria-describedby={describedBy('jobTitle')}
            disabled={submitting}
            className={inputClass}
            placeholder={t('employer:jobTitlePlaceholder')}
            autoComplete="off"
          />
          <FieldError id={`${FIELD_IDS.jobTitle}-error`} message={translateFieldError(fieldErrors.jobTitle)} />
        </div>

        <div>
          <label htmlFor={FIELD_IDS.openingsCount} className={labelClass}>
            {t('employer:openingsCountLabel')}
            <RequiredMark />
            <span className="sr-only">{t('employer:required')}</span>
          </label>
          <input
            id={FIELD_IDS.openingsCount}
            name="openingsCount"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            step={1}
            value={form.openingsCount}
            onChange={handleChange}
            required={!isEdit}
            aria-required={!isEdit ? 'true' : undefined}
            aria-invalid={fieldErrors.openingsCount ? 'true' : undefined}
            aria-describedby={describedBy('openingsCount', `${FIELD_IDS.openingsCount}-help`)}
            disabled={submitting}
            className={inputClass}
          />
          <p id={`${FIELD_IDS.openingsCount}-help`} className={helpClass}>
            {t('employer:openingsCountHelp')}
          </p>
          <FieldError id={`${FIELD_IDS.openingsCount}-error`} message={translateFieldError(fieldErrors.openingsCount)} />
        </div>

        <div>
          <label htmlFor={FIELD_IDS.companyName} className={labelClass}>
            {t('employer:companyLabel')}
            <RequiredMark />
            <span className="sr-only">{t('employer:required')}</span>
          </label>
          <input
            id={FIELD_IDS.companyName}
            name="companyName"
            value={form.companyName}
            onChange={handleChange}
            required
            aria-required="true"
            aria-invalid={fieldErrors.companyName ? 'true' : undefined}
            aria-describedby={describedBy('companyName', `${FIELD_IDS.companyName}-help`)}
            disabled={submitting}
            className={inputClass}
            placeholder={t('employer:companyPlaceholder')}
            autoComplete="organization"
          />
          <p id={`${FIELD_IDS.companyName}-help`} className={helpClass}>
            {t('employer:companyHelp')}
          </p>
          <FieldError id={`${FIELD_IDS.companyName}-error`} message={translateFieldError(fieldErrors.companyName)} />
        </div>

        <div>
          <label htmlFor={FIELD_IDS.location} className={labelClass}>
            {t('common:location')}
            <OptionalMark t={t} />
          </label>
          <input
            id={FIELD_IDS.location}
            name="location"
            value={form.location}
            onChange={handleChange}
            aria-invalid={fieldErrors.location ? 'true' : undefined}
            aria-describedby={describedBy('location')}
            disabled={submitting}
            className={inputClass}
            placeholder={t('employer:locationPlaceholder')}
            autoComplete="address-level2"
          />
          <FieldError id={`${FIELD_IDS.location}-error`} message={translateFieldError(fieldErrors.location)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
          <div className="min-w-0">
            <label htmlFor={FIELD_IDS.countryCode} className={labelClass}>
              {t('employer:countryLabel', { defaultValue: 'Country' })}
            </label>
            <CountrySelect
              id={FIELD_IDS.countryCode}
              value={form.countryCode}
              disabled={submitting}
              placeholder={t('employer:selectCountry', { defaultValue: 'Select country' })}
              onChange={(code) => {
                setForm((f) => ({ ...f, countryCode: code || '', region: '', city: '' }));
                setFieldErrors((prev) => {
                  if (!prev.countryCode && !prev.region && !prev.city) return prev;
                  const next = { ...prev };
                  delete next.countryCode;
                  delete next.region;
                  delete next.city;
                  return next;
                });
              }}
            />
            <p className={helpClass}>Optional</p>
            <FieldError id={`${FIELD_IDS.countryCode}-error`} message={translateFieldError(fieldErrors.countryCode)} />
          </div>
          <div className="min-w-0">
            <label htmlFor={FIELD_IDS.region} className={labelClass}>
              {t('employer:regionLabel', { defaultValue: 'State / Province / Region' })}
            </label>
            {regionCatalog.length > 0 ? (
              <select
                id={FIELD_IDS.region}
                name="region"
                value={form.region}
                onChange={handleChange}
                disabled={submitting || !form.countryCode}
                className={inputClass}
              >
                <option value="">{form.countryCode ? 'Optional' : 'Select country first'}</option>
                {regionCatalog.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input
                id={FIELD_IDS.region}
                name="region"
                value={form.region}
                onChange={handleChange}
                disabled={submitting || !form.countryCode}
                className={inputClass}
                autoComplete="address-level1"
                placeholder={form.countryCode ? 'Optional' : 'Select country first'}
              />
            )}
            <FieldError id={`${FIELD_IDS.region}-error`} message={translateFieldError(fieldErrors.region)} />
          </div>
          <div className="min-w-0">
            <label htmlFor={FIELD_IDS.city} className={labelClass}>
              {t('employer:cityLabel', { defaultValue: 'City' })}
            </label>
            <input
              id={FIELD_IDS.city}
              name="city"
              value={form.city}
              onChange={handleChange}
              disabled={submitting || !form.countryCode}
              className={inputClass}
              autoComplete="address-level2"
              placeholder={form.countryCode ? 'Optional' : 'Select country first'}
            />
            <FieldError id={`${FIELD_IDS.city}-error`} message={translateFieldError(fieldErrors.city)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={FIELD_IDS.jobFamily} className={labelClass}>
              {t('employer:jobFamilyLabel', { defaultValue: 'Job family' })}
              <OptionalMark t={t} />
            </label>
            <select
              id={FIELD_IDS.jobFamily}
              name="jobFamily"
              value={form.jobFamily}
              onChange={handleChange}
              disabled={submitting}
              className={inputClass}
            >
              <option value="">{t('employer:selectJobFamily', { defaultValue: 'Select job family' })}</option>
              {JOB_FAMILIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <FieldError id={`${FIELD_IDS.jobFamily}-error`} message={translateFieldError(fieldErrors.jobFamily)} />
          </div>
          <div>
            <label htmlFor={FIELD_IDS.specialization} className={labelClass}>
              {t('employer:specializationLabel', { defaultValue: 'Specialization' })}
              <OptionalMark t={t} />
            </label>
            <select
              id={FIELD_IDS.specialization}
              name="specialization"
              value={form.specialization}
              onChange={handleChange}
              disabled={submitting || !form.jobFamily}
              className={inputClass}
            >
              <option value="">{t('employer:selectSpecialization', { defaultValue: 'Select specialization' })}</option>
              {(SPECIALIZATIONS_BY_FAMILY[form.jobFamily] || []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <FieldError id={`${FIELD_IDS.specialization}-error`} message={translateFieldError(fieldErrors.specialization)} />
          </div>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            {t('employer:classificationLegend')}
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="min-w-0">
              <label htmlFor={FIELD_IDS.jobType} className={labelClass}>
                {t('employer:jobTypeLabel')}
                <RequiredMark />
              </label>
              <select
                id={FIELD_IDS.jobType}
                name="jobType"
                value={form.jobType}
                onChange={handleChange}
                aria-invalid={fieldErrors.jobType ? 'true' : undefined}
                aria-describedby={describedBy('jobType')}
                disabled={submitting}
                className={inputClass}
              >
                <option value="Private">{t('employer:jobTypePrivate')}</option>
                <option value="Government">{t('employer:jobTypeGovernment')}</option>
                <option value="Internship">{t('employer:jobTypeInternship')}</option>
              </select>
              <FieldError id={`${FIELD_IDS.jobType}-error`} message={translateFieldError(fieldErrors.jobType)} />
            </div>
            <div className="min-w-0">
              <label htmlFor={FIELD_IDS.type} className={labelClass}>
                {t('employer:workTypeLabel')}
                <RequiredMark />
              </label>
              <select
                id={FIELD_IDS.type}
                name="type"
                value={form.type}
                onChange={handleChange}
                aria-invalid={fieldErrors.type ? 'true' : undefined}
                aria-describedby={describedBy('type')}
                disabled={submitting}
                className={inputClass}
              >
                <option value="full-time">{t('common:fullTime')}</option>
                <option value="part-time">{t('common:partTime')}</option>
                <option value="contract">{t('common:contract')}</option>
                <option value="internship">{t('common:internship')}</option>
              </select>
              <FieldError id={`${FIELD_IDS.type}-error`} message={translateFieldError(fieldErrors.type)} />
            </div>
            <div className="min-w-0">
              <label htmlFor={FIELD_IDS.workMode} className={labelClass}>
                {t('employer:workModeLabel', { defaultValue: 'Work mode' })}
                <OptionalMark t={t} />
              </label>
              <select
                id={FIELD_IDS.workMode}
                name="workMode"
                value={form.workMode}
                onChange={handleChange}
                disabled={submitting}
                className={inputClass}
              >
                <option value="">{t('employer:workModeNotSpecified', { defaultValue: 'Not specified' })}</option>
                <option value="on_site">{t('employer:workModeOnSite', { defaultValue: 'On-site' })}</option>
                <option value="remote">{t('employer:workModeRemote', { defaultValue: 'Remote' })}</option>
                <option value="hybrid">{t('employer:workModeHybrid', { defaultValue: 'Hybrid' })}</option>
              </select>
              <FieldError id={`${FIELD_IDS.workMode}-error`} message={translateFieldError(fieldErrors.workMode)} />
            </div>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={FIELD_IDS.salaryRange} className={labelClass}>
              {t('employer:salaryRange')}
              <OptionalMark t={t} />
            </label>
            <input
              id={FIELD_IDS.salaryRange}
              name="salaryRange"
              value={form.salaryRange}
              onChange={handleChange}
              aria-invalid={fieldErrors.salaryRange ? 'true' : undefined}
              aria-describedby={describedBy('salaryRange', `${FIELD_IDS.salaryRange}-help`)}
              disabled={submitting}
              className={inputClass}
              placeholder={t('employer:salaryPlaceholder')}
            />
            <p id={`${FIELD_IDS.salaryRange}-help`} className={helpClass}>
              {t('employer:salaryHelp')}
            </p>
            <FieldError id={`${FIELD_IDS.salaryRange}-error`} message={translateFieldError(fieldErrors.salaryRange)} />
          </div>
          <div>
            <label htmlFor={FIELD_IDS.salaryCurrency} className={labelClass}>
              {t('employer:salaryCurrencyLabel', { defaultValue: 'Salary currency' })}
              <OptionalMark t={t} />
            </label>
            <input
              id={FIELD_IDS.salaryCurrency}
              name="salaryCurrency"
              value={form.salaryCurrency}
              onChange={handleChange}
              aria-invalid={fieldErrors.salaryCurrency ? 'true' : undefined}
              aria-describedby={describedBy('salaryCurrency', `${FIELD_IDS.salaryCurrency}-help`)}
              disabled={submitting}
              className={inputClass}
              placeholder={t('employer:salaryCurrencyPlaceholder', { defaultValue: 'e.g. PKR, USD, GBP' })}
              maxLength={3}
            />
            <p id={`${FIELD_IDS.salaryCurrency}-help`} className={helpClass}>
              {t('employer:salaryCurrencyHelp', { defaultValue: 'ISO 4217 code (optional). Leave blank if salary is not specified.' })}
            </p>
            <FieldError id={`${FIELD_IDS.salaryCurrency}-error`} message={translateFieldError(fieldErrors.salaryCurrency)} />
          </div>
        </div>

        <div>
          <label htmlFor={FIELD_IDS.skillsRequired} className={labelClass}>
            {t('employer:skillsLabel')}
            <OptionalMark t={t} />
          </label>
          <input
            id={FIELD_IDS.skillsRequired}
            name="skillsRequired"
            value={form.skillsRequired}
            onChange={handleChange}
            aria-invalid={fieldErrors.skillsRequired ? 'true' : undefined}
            aria-describedby={describedBy('skillsRequired', `${FIELD_IDS.skillsRequired}-help`)}
            disabled={submitting}
            className={inputClass}
            placeholder={t('employer:skillsPlaceholder')}
          />
          <p id={`${FIELD_IDS.skillsRequired}-help`} className={helpClass}>
            {t('employer:skillsHelp')}
          </p>
          <FieldError id={`${FIELD_IDS.skillsRequired}-error`} message={translateFieldError(fieldErrors.skillsRequired)} />
        </div>

        <div>
          <label htmlFor={FIELD_IDS.experience} className={labelClass}>
            {t('employer:experienceLabel', { defaultValue: 'Experience requirement' })}
            <OptionalMark t={t} />
          </label>
          <input
            id={FIELD_IDS.experience}
            name="experience"
            value={form.experience}
            onChange={handleChange}
            disabled={submitting}
            className={inputClass}
            placeholder={t('employer:experiencePlaceholder', { defaultValue: 'e.g. 2+ years in software development' })}
          />
          <FieldError id={`${FIELD_IDS.experience}-error`} message={translateFieldError(fieldErrors.experience)} />
        </div>

        <div>
          <label htmlFor={FIELD_IDS.educationRequirement} className={labelClass}>
            {t('employer:educationReqLabel', { defaultValue: 'Education requirement' })}
            <OptionalMark t={t} />
          </label>
          <input
            id={FIELD_IDS.educationRequirement}
            name="educationRequirement"
            value={form.educationRequirement}
            onChange={handleChange}
            disabled={submitting}
            className={inputClass}
            placeholder={t('employer:educationReqPlaceholder', { defaultValue: "e.g. Bachelor's degree in Computer Science" })}
          />
          <FieldError id={`${FIELD_IDS.educationRequirement}-error`} message={translateFieldError(fieldErrors.educationRequirement)} />
        </div>

        <div>
          <label htmlFor={FIELD_IDS.requirements} className={labelClass}>
            {t('employer:requirementsLabel', { defaultValue: 'Requirements' })}
            <OptionalMark t={t} />
          </label>
          <textarea
            id={FIELD_IDS.requirements}
            name="requirements"
            value={form.requirements}
            onChange={handleChange}
            aria-invalid={fieldErrors.requirements ? 'true' : undefined}
            aria-describedby={describedBy('requirements', `${FIELD_IDS.requirements}-help`)}
            disabled={submitting}
            rows={4}
            className={`${inputClass} min-h-[100px] py-3`}
            placeholder={t('employer:requirementsPlaceholder', {
              defaultValue: '5+ years of relevant experience\nStrong communication skills\nExperience with React and Node.js',
            })}
          />
          <p id={`${FIELD_IDS.requirements}-help`} className={helpClass}>
            {t('employer:requirementsHelp', { defaultValue: 'One requirement per line.' })}
          </p>
          <FieldError id={`${FIELD_IDS.requirements}-error`} message={translateFieldError(fieldErrors.requirements)} />
        </div>

        <div>
          <label htmlFor={FIELD_IDS.responsibilities} className={labelClass}>
            {t('employer:responsibilitiesLabel', { defaultValue: 'Responsibilities' })}
            <OptionalMark t={t} />
          </label>
          <textarea
            id={FIELD_IDS.responsibilities}
            name="responsibilities"
            value={form.responsibilities}
            onChange={handleChange}
            aria-invalid={fieldErrors.responsibilities ? 'true' : undefined}
            aria-describedby={describedBy('responsibilities', `${FIELD_IDS.responsibilities}-help`)}
            disabled={submitting}
            rows={4}
            className={`${inputClass} min-h-[100px] py-3`}
            placeholder={t('employer:responsibilitiesPlaceholder', {
              defaultValue: 'Design and implement new features\nCollaborate with cross-functional teams',
            })}
          />
          <p id={`${FIELD_IDS.responsibilities}-help`} className={helpClass}>
            {t('employer:responsibilitiesHelp', { defaultValue: 'One responsibility per line.' })}
          </p>
          <FieldError id={`${FIELD_IDS.responsibilities}-error`} message={translateFieldError(fieldErrors.responsibilities)} />
        </div>

        <div>
          <label htmlFor={FIELD_IDS.jobDescription} className={labelClass}>
            {t('employer:descriptionLabel')}
            <RequiredMark />
            <span className="sr-only">{t('employer:required')}</span>
          </label>
          <textarea
            id={FIELD_IDS.jobDescription}
            name="jobDescription"
            value={form.jobDescription}
            onChange={handleChange}
            required
            aria-required="true"
            aria-invalid={fieldErrors.jobDescription ? 'true' : undefined}
            aria-describedby={describedBy('jobDescription', `${FIELD_IDS.jobDescription}-help`)}
            disabled={submitting}
            rows={6}
            className={`${inputClass} min-h-[140px] py-3`}
            placeholder={t('employer:descriptionPlaceholder')}
          />
          <p id={`${FIELD_IDS.jobDescription}-help`} className={helpClass}>
            {t('employer:descriptionHelp')}
          </p>
          <FieldError id={`${FIELD_IDS.jobDescription}-error`} message={translateFieldError(fieldErrors.jobDescription)} />
        </div>

        <div>
          <label htmlFor={FIELD_IDS.applicationDeadline} className={labelClass}>
            {t('employer:applicationDeadline')}
            <OptionalMark t={t} />
          </label>
          <DateInput
            id={FIELD_IDS.applicationDeadline}
            name="applicationDeadline"
            value={form.applicationDeadline}
            onChange={handleChange}
            aria-invalid={fieldErrors.applicationDeadline ? 'true' : undefined}
            aria-describedby={describedBy('applicationDeadline', `${FIELD_IDS.applicationDeadline}-help`)}
            disabled={submitting}
            className={inputClass}
          />
          <p id={`${FIELD_IDS.applicationDeadline}-help`} className={helpClass}>
            {t('employer:deadlineHelp')}
          </p>
          <FieldError
            id={`${FIELD_IDS.applicationDeadline}-error`}
            message={translateFieldError(fieldErrors.applicationDeadline)}
          />
        </div>

        {isEdit &&
          ((editMeta?.status === 'active' && editMeta?.approvalStatus === 'approved') || editMeta?.applyMethod === 'internal') && (
          <div
            className="text-sm text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1"
            role="note"
          >
            {editMeta?.status === 'active' && editMeta?.approvalStatus === 'approved' && (
              <p>{t('employer:editReReviewWarning')}</p>
            )}
            {editMeta?.applyMethod === 'internal' && <p>{t('employer:editExistingApplicationsWarning')}</p>}
          </div>
        )}

        <fieldset className="space-y-4 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <legend className="px-1 text-sm font-medium text-gray-900 dark:text-gray-100">
            {t('employer:applicationMethodLegend')}
            <RequiredMark />
          </legend>

            <div
              className="space-y-3"
              role="radiogroup"
              aria-required="true"
              aria-describedby={describedBy('applyMethod')}
              data-testid="apply-method-selector"
            >
              {APPLY_METHOD_VALUES.map((method, idx) => (
                <label
                  key={method}
                  htmlFor={idx === 0 ? FIELD_IDS.applyMethod : `${FIELD_IDS.applyMethod}-${method}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                    form.applyMethod === method
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <input
                    id={idx === 0 ? FIELD_IDS.applyMethod : `${FIELD_IDS.applyMethod}-${method}`}
                    type="radio"
                    name="applyMethod"
                    value={method}
                    checked={form.applyMethod === method}
                    onChange={handleChange}
                    disabled={submitting}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      {t(`employer:${APPLY_METHOD_META[method].labelKey}`)}
                    </span>
                    <span className="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {t(`employer:${APPLY_METHOD_META[method].helpKey}`)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <FieldError id={`${FIELD_IDS.applyMethod}-error`} message={translateFieldError(fieldErrors.applyMethod)} />

            {form.applyMethod === 'external_url' && (
              <div>
                <label htmlFor={FIELD_IDS.applyLink} className={labelClass}>
                  {t('employer:applyLink')}
                  <RequiredMark />
                </label>
                <input
                  id={FIELD_IDS.applyLink}
                  name="applyLink"
                  type="url"
                  inputMode="url"
                  value={form.applyLink}
                  onChange={handleChange}
                  required
                  aria-required="true"
                  aria-invalid={fieldErrors.applyLink ? 'true' : undefined}
                  aria-describedby={describedBy('applyLink', `${FIELD_IDS.applyLink}-help`)}
                  disabled={submitting}
                  className={inputClass}
                  placeholder={t('employer:applyLinkPlaceholder')}
                />
                <p id={`${FIELD_IDS.applyLink}-help`} className={helpClass}>
                  {t('employer:applyLinkHelp')}
                </p>
                <FieldError id={`${FIELD_IDS.applyLink}-error`} message={translateFieldError(fieldErrors.applyLink)} />
              </div>
            )}

            {form.applyMethod === 'external_email' && (
              <div>
                <label htmlFor={FIELD_IDS.applyEmail} className={labelClass}>
                  {t('employer:applyEmailLabel')}
                  <RequiredMark />
                </label>
                <input
                  id={FIELD_IDS.applyEmail}
                  name="applyEmail"
                  type="email"
                  inputMode="email"
                  value={form.applyEmail}
                  onChange={handleChange}
                  required
                  aria-required="true"
                  aria-invalid={fieldErrors.applyEmail ? 'true' : undefined}
                  aria-describedby={describedBy('applyEmail', `${FIELD_IDS.applyEmail}-help`)}
                  disabled={submitting}
                  className={inputClass}
                  placeholder={t('employer:applyEmailPlaceholder')}
                  autoComplete="email"
                />
                <p id={`${FIELD_IDS.applyEmail}-help`} className={helpClass}>
                  {t('employer:applyEmailHelp')}
                </p>
                <FieldError id={`${FIELD_IDS.applyEmail}-error`} message={translateFieldError(fieldErrors.applyEmail)} />
              </div>
            )}
          </fieldset>

        <div className="pt-2 pb-16 sm:pb-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-primary hover:opacity-90 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {submitting ? t('common:saving') : isEdit ? t('employer:saveJobChanges') : t('employer:saveDraftChoosePlan')}
          </button>
          <p className={`${helpClass} mt-2`}>
            {isEdit ? t('employer:saveJobChangesHelp') : t('employer:saveDraftHelp')}
          </p>
        </div>
      </form>
    </>
  );
}
